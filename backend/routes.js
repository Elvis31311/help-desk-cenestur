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

    // 📡 SOLUCIÓN MAESTRA: Conexión directa por HTTP Bypass sin usar el SDK roto de Google
    const apiKey = process.env.GEMINI_API_KEY;
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

    // Ejecutamos la petición HTTP nativa
    const responseIA = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const dataIA = await responseIA.json();

    // 🔍 DEBUG: Esto nos dirá exactamente qué está respondiendo Google
    console.log("🔍 Respuesta cruda completa de la API de Google:", JSON.stringify(dataIA));

    // Verificación de seguridad de la respuesta de Google
    if (dataIA.error) {
      throw new Error(`Google API Error: ${dataIA.error.message} (Código: ${dataIA.error.code})`);
    }

    if (!dataIA.candidates || !dataIA.candidates[0].content || !dataIA.candidates[0].content.parts[0].text) {
      throw new Error("La API de Gemini no devolvió una estructura válida. Revisa tu GEMINI_API_KEY.");
    }

    console.log("🤖 Respuesta cruda de Gemini:", responseText);

    let resultadoJSON;
    try {
      resultadoJSON = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Error al parsear el JSON de Gemini. Respuesta recibida:", responseText);
      // Valores por defecto por si la IA responde mal para que el sistema NO se caiga
      resultadoJSON = {
        prioridad: 'Media',
        categoria: 'Software',
        sugerencia: 'Un técnico revisará tu caso pronto de forma manual.'
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
        desc: `Descripción del usuario:\n${nuevoTicket.descripcion}\n\n🤖 Sugerencia de la IA:\n${nuevoTicket.respuesta_ia}`
      });

      const trelloUrl = `https://api.trello.com/1/cards?${params.toString()}`;
      const trelloRes = await fetch(trelloUrl, { method: 'POST' });
      
      if (!trelloRes.ok) {
        console.error(`⚠️ Trello rechazó la tarjeta.`);
      } else {
        console.log(`📋 ✅ ¡TARJETA CREADA EN TRELLO!`);
      }
    } catch (trelloError) {
      console.error('⚠️ Error en Trello:', trelloError.message);
    }
    
    res.status(201).json(nuevoTicket);

  } catch (error) {
    console.error("❌ Error general en la ruta /tickets:", error);
    res.status(500).json({ error: "Error al procesar el ticket con la IA.", detalles: error.message });
  }
});

// Ruta para obtener el historial
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los tickets" });
  }
});

module.exports = router;