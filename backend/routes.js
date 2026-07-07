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

    const apiKey = process.env.GEMINI_API_KEY;
    
    // 📡 MODELO ACTUALIZADO: Usamos gemini-2.0-flash para total compatibilidad
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const prompt = `Actúa como un ingeniero de soporte técnico de TI para el Instituto Cenestur.
    Analiza con total atención el siguiente ticket y responde EXCLUSIVAMENTE con un objeto JSON plano. 
    No incluyas introducciones, no uses bloques de código markdown como \`\`\`json, solo devuelve el objeto JSON limpio con esta estructura exacta:
    {
      "prioridad": "Baja" o "Media" o "Alta",
      "categoria": "Hardware" o "Software" o "Redes" o "Accesos",
      "sugerencia": "Una respuesta técnica, analítica, profesional y cordial adaptada exactamente al problema del usuario con 2 o 3 pasos claros."
    }

    Ticket a analizar:
    Asunto: ${titulo}
    Descripción: ${descripcion}`;

    // Petición directa a la Inteligencia Artificial
    const responseIA = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const dataIA = await responseIA.json();

    if (dataIA.error) {
      throw new Error(`Google API Error: ${dataIA.error.message} (Código: ${dataIA.error.code})`);
    }

    // Extraemos el texto de la IA
    let responseText = dataIA.candidates[0].content.parts[0].text.trim();
    
    // Limpieza profunda por si la IA devuelve bloques markdown
    if (responseText.includes("```")) {
      responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    console.log("🤖 ¡IA REAL RESPONDIENDO!:", responseText);

    // Parseamos la respuesta dinámica de la IA
    const resultadoIA = JSON.parse(responseText);

    // 2. Guardamos en MongoDB el análisis REAL de la IA
    const nuevoTicket = new Ticket({
      titulo,
      descripcion,
      prioridad: resultadoIA.prioridad || 'Media',
      categoria: resultadoIA.categoria || 'Software',
      respuesta_ia: resultadoIA.sugerencia || 'Procesando soporte...'
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
        desc: `Descripción del usuario:\n${nuevoTicket.descripcion}\n\n🤖 Diagnóstico de Gemini 2.0:\n${nuevoTicket.respuesta_ia}`
      });

      await fetch(`https://api.trello.com/1/cards?${params.toString()}`, { method: 'POST' });
      console.log(`📋 ✅ ¡TARJETA EN TRELLO CON IA REAL!`);
    } catch (trelloError) {
      console.error('⚠️ Trello Error:', trelloError.message);
    }
    
    // Enviamos el ticket real al frontend
    res.status(201).json(nuevoTicket);

  } catch (error) {
    console.error("❌ Error crítico en la llamada de IA:", error);
    // Si todo lo demás falla, devolvemos un estado controlado para corregir el token
    res.status(500).json({ 
      error: "Error de comunicación con la IA real.", 
      detalles: error.message 
    });
  }
});

// Historial de tickets
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los tickets" });
  }
});

module.exports = router;