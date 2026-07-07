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

    // 📡 CONEXIÓN CON IA REAL (Hugging Face Inference API)
    const hfToken = process.env.HF_TOKEN;
    // Usamos uno de los modelos de lenguaje más potentes y abiertos del mundo
    const hfUrl = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-72B-Instruct";

    const prompt = `<|im_start|>system
    Eres un asistente de soporte de TI para el Instituto Cenestur. Analiza el ticket y responde EXCLUSIVAMENTE en formato JSON plano, sin bloques de código markdown (\`\`\`json), sin texto antes ni después. El formato debe ser exactamente:
    {
      "prioridad": "Baja" o "Media" o "Alta",
      "categoria": "Hardware" o "Software" o "Redes" o "Accesos",
      "sugerencia": "Respuesta técnica breve de 2 pasos cortos."
    }<|im_end|>
    <|im_start|>user
    Asunto: ${titulo}
    Descripción: ${descripcion}<|im_end|>
    <|im_start|>assistant`;

    const responseIA = await fetch(hfUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 150, temperature: 0.1 }
      })
    });

    const dataIA = await responseIA.json();
    
    // Extraemos el texto generado por la IA
    let textoGenerado = "";
    if (Array.isArray(dataIA) && dataIA[0].generated_text) {
      textoGenerado = dataIA[0].generated_text;
    } else if (dataIA.generated_text) {
      textoGenerado = dataIA.generated_text;
    } else {
      console.log("Error de respuesta HF:", dataIA);
      throw new Error("No se obtuvo respuesta válida del modelo de IA.");
    }

    // Recortamos para extraer solo la respuesta del asistente si repite el prompt
    if (textoGenerado.includes("<|im_start|>assistant")) {
      textoGenerado = textoGenerado.split("<|im_start|>assistant")[1].trim();
    }
    
    // Limpieza de formato markdown por si acaso
    textoGenerado = textoGenerado.replace(/```json|```/g, '').trim();

    console.log("🤖 IA Real (Hugging Face) respondió:", textoGenerado);

    let resultadoJSON;
    try {
      resultadoJSON = JSON.parse(textoGenerado);
    } catch (e) {
      // Sistema de respaldo por si el JSON vino cortado
      resultadoJSON = {
        prioridad: "Media",
        categoria: "Software",
        sugerencia: "El sistema de IA procesó tu caso. Un técnico lo revisará brevemente."
      };
    }

    // Guardar en la base de datos
    const nuevoTicket = new Ticket({
      titulo,
      descripcion,
      prioridad: resultadoJSON.prioridad || "Media",
      categoria: resultadoJSON.categoria || "Software",
      respuesta_ia: resultadoJSON.sugerencia || "Revisión técnica en proceso."
    });

    await nuevoTicket.save();

    // 4. ENVÍO A TRELLO
    try {
      let idListDestino = process.env.TRELLO_LIST_MEDIA;
      if (nuevoTicket.prioridad === 'Baja') idListDestino = process.env.TRELLO_LIST_BAJA;
      if (nuevoTicket.prioridad === 'Alta') idListDestino = process.env.TRELLO_LIST_ALTA;

      const params = new URLSearchParams({
        idList: idListDestino,
        key: process.env.TRELLO_KEY || '',
        token: process.env.TRELLO_TOKEN || '',
        name: `[${nuevoTicket.categoria}] ${nuevoTicket.titulo}`,
        desc: `Descripción:\n${nuevoTicket.descripcion}\n\n🤖 IA Real (Hugging Face):\n${nuevoTicket.respuesta_ia}`
      });

      await fetch(`https://api.trello.com/1/cards?${params.toString()}`, { method: 'POST' });
      console.log(`📋 ✅ ¡TARJETA CREADA EN TRELLO!`);
    } catch (trelloError) {
      console.error('⚠️ Trello Error:', trelloError.message);
    }

    res.status(201).json(nuevoTicket);

  } catch (error) {
    console.error("❌ Error en ruta /tickets:", error);
    res.status(500).json({ error: "Error al conectar con el servidor de IA." });
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