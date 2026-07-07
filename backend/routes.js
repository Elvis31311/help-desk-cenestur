const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Ticket = require('./models/Ticket');

// Inicializar Gemini
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/tickets', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ error: "La base de datos de MongoDB no está conectada aún." });
  }

  try {
    const { titulo, descripcion } = req.body;

    // 1. Llamada mejorada a Gemini para clasificar y generar sugerencias reales
    const model = ai.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" } 
    });
    
    const prompt = `Analiza este ticket de soporte técnico y devuelve un objeto JSON estrictamente con estas tres propiedades: 
    "prioridad" (debe ser una de estas: Baja, Media, Alta), 
    "categoria" (debe ser una de estas: Hardware, Software, Redes, Accesos) y
    "sugerencia" (una respuesta técnica breve, cordial y con 2 o 3 pasos claros orientados a solucionar el problema descrito). 
    
    Ticket a analizar:
    Asunto: ${titulo}
    Descripción: ${descripcion}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const dataIA = JSON.parse(responseText);

    // 2. Guardar el ticket en MongoDB con la sugerencia real de la IA
    const nuevoTicket = new Ticket({
      titulo,
      descripcion,
      prioridad: dataIA.prioridad || 'Media',
      categoria: dataIA.categoria || 'Software',
      // Guardamos la sugerencia real obtenida de Gemini
      respuesta_ia: dataIA.sugerencia || 'Un técnico revisará tu caso pronto.'
    });

    await nuevoTicket.save();

    // 3. ENVIAR A TRELLO (Con asignación de columna dinámica y datos reales)
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
        const errorTexto = await trelloRes.text();
        console.error(`⚠️ Trello rechazó la tarjeta. Motivo: ${errorTexto}`);
      } else {
        console.log(`📋 ✅ ¡TARJETA CREADA EN TRELLO! Columna: [${nuevoTicket.prioridad}]`);
      }

    } catch (trelloError) {
      console.error('⚠️ Error de red al conectar con Trello:', trelloError.message);
    }
    
    res.status(201).json(nuevoTicket);

  } catch (error) {
    console.error("❌ Error general:", error.message);
    res.status(500).json({ error: "Error al procesar el ticket." });
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