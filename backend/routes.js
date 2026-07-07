const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Ticket = require('./models/Ticket');

router.post('/tickets', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ error: "La base de datos de MongoDB no está conectada aún." });
  }

  try {
    const { titulo, descripcion } = req.body;
    if (!titulo || !descripcion) {
      return res.status(400).json({ error: "Faltan campos obligatorios." });
    }

    // 📡 CONEXIÓN CON GEMINI USANDO ENDPOINT ESTABLE v1
    const apiKey = process.env.GEMINI_API_KEY;
    
    // El endpoint estándar universal para las llaves gratuitas de AI Studio
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Analiza este ticket de soporte técnico y devuelve UNICAMENTE un objeto JSON estrictamente con estas tres propiedades (no agregues texto antes ni después, no uses bloques de código markdown, solo el JSON limpio): 
    {
      "prioridad": "Baja" o "Media" o "Alta", 
      "categoria": "Hardware" o "Software" o "Redes" o "Accesos",
      "sugerencia": "una respuesta técnica breve y cordial con 2 o 3 pasos claros"
    }
    
    Ticket a analizar:
    Asunto: ${titulo}
    Descripción: ${descripcion}`;

    const responseIA = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const dataIA = await responseIA.json();

    // Verificamos si Google devolvió algún error de cuota o clave
    if (dataIA.error) {
      throw new Error(`Google API Error: ${dataIA.error.message}`);
    }

    let responseText = dataIA.candidates[0].content.parts[0].text.trim();
    
    // Limpieza por si Gemini mete formato de texto markdown ```json ... ```
    if (responseText.includes("```")) {
      responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    console.log("🤖 IA Real (Gemini v1) respondió:", responseText);

    let resultadoJSON;
    try {
      resultadoJSON = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Error de parseo. Usando respaldo:", responseText);
      resultadoJSON = {
        prioridad: 'Media',
        categoria: 'Software',
        sugerencia: 'Un técnico de Cenestur revisará tu caso pronto de forma manual.'
      };
    }

    // 2. Guardar el ticket en MongoDB
    const nuevoTicket = new Ticket({
      titulo,
      descripcion,
      prioridad: resultadoJSON.prioridad || 'Media',
      categoria: resultadoJSON.categoria || 'Software',
      respuesta_ia: resultadoJSON.sugerencia || 'Un técnico revisará tu caso pronto.'
    });

    await nuevoTicket.save();

    // 3. ENVIAR A TRELLO
    try {
      let idListDestino = process.env.TRELLO_LIST_MEDIA;
      if (nuevoTicket.prioridad === 'Baja') idListDestino = process.env.TRELLO_LIST_BAJA;
      if (nuevoTicket.prioridad === 'Alta') idListDestino = process.env.TRELLO_LIST_ALTA;

      const params = new URLSearchParams({
        idList: idListDestino,
        key: process.env.TRELLO_KEY || '',
        token: process.env.TRELLO_TOKEN || '',
        name: `[${nuevoTicket.categoria}] ${nuevoTicket.titulo}`,
        desc: `Descripción:\n${nuevoTicket.descripcion}\n\n🤖 Sugerencia de la IA:\n${nuevoTicket.respuesta_ia}`
      });

      const trelloUrl = `https://api.trello.com/1/cards?${params.toString()}`;
      await fetch(trelloUrl, { method: 'POST' });
      console.log(`📋 ✅ ¡TARJETA CREADA EN TRELLO!`);
    } catch (trelloError) {
      console.error('⚠️ Error en Trello:', trelloError.message);
    }
    
    res.status(201).json(nuevoTicket);

  } catch (error) {
    console.error("❌ Error en ruta /tickets:", error);
    res.status(500).json({ error: "Error al procesar el ticket con la IA.", detalles: error.message });
  }
});

// Historial para los gráficos del Frontend
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los tickets" });
  }
});

module.exports = router;