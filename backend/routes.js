const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Ticket = require('./models/Ticket');

router.post('/tickets', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ error: "La base de datos de MongoDB no está conectada aún." });
  }

  // Definimos variables globales del ticket para usarlas en todo el proceso
  let prioridad = "Media";
  let categoria = "Software";
  let sugerencia = "Un técnico de Cenestur revisará tu caso pronto.";

  try {
    const { titulo, descripcion } = req.body;
    if (!titulo || !descripcion) {
      return res.status(400).json({ error: "Faltan campos obligatorios." });
    }

    // 📡 1. INTENTO DE CONEXIÓN CON IA REAL (CÓDIGO EXIGIDO PARA LA ENTREGA)
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      const prompt = `Analiza este ticket de soporte técnico y devuelve UNICAMENTE un objeto JSON estrictamente con estas tres propiedades (no uses bloques de código markdown, solo el JSON limpio): 
      {
        "prioridad": "Baja" o "Media" o "Alta", 
        "categoria": "Hardware" o "Software" o "Redes" o "Accesos",
        "sugerencia": "una respuesta técnica breve y cordial con 2 pasos claros"
      }
      Asunto: ${titulo} | Descripción: ${descripcion}`;

      const responseIA = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(4000) // Si Google tarda más de 4 segundos, pasa al respaldo
      });

      const dataIA = await responseIA.json();

      if (dataIA.error) {
        throw new Error(`Google API Error: ${dataIA.error.message}`);
      }

      let responseText = dataIA.candidates[0].content.parts[0].text.trim();
      if (responseText.includes("```")) {
        responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }

      const resultadoJSON = JSON.parse(responseText);
      prioridad = resultadoJSON.prioridad || "Media";
      categoria = resultadoJSON.categoria || "Software";
      sugerencia = resultadoJSON.sugerencia || "Revisión en proceso.";
      console.log("🤖 IA Real (Gemini) procesó con éxito el ticket.");

    } catch (apiError) {
      // 🛡️ SISTEMA DE RESPALDO INTELIGENTE (Se activa si Google da 404, falla la red o el token)
      console.warn("⚠️ Gemini falló o dio 404. Activando Motor de Respaldo Híbrido...");
      
      const textoAnalizar = `${titulo} ${descripcion}`.toLowerCase();

      // Clasificación por palabras clave
      if (textoAnalizar.includes("internet") || textoAnalizar.includes("red") || textoAnalizar.includes("wifi") || textoAnalizar.includes("router") || textoAnalizar.includes("switch")) {
        categoria = "Redes";
      } else if (textoAnalizar.includes("pantalla") || textoAnalizar.includes("proyector") || textoAnalizar.includes("mouse") || textoAnalizar.includes("teclado") || textoAnalizar.includes("hardware") || textoAnalizar.includes("computadora")) {
        categoria = "Hardware";
      } else if (textoAnalizar.includes("contraseña") || textoAnalizar.includes("usuario") || textoAnalizar.includes("login") || textoAnalizar.includes("acceso") || textoAnalizar.includes("bloqueado")) {
        categoria = "Accesos";
      }

      // Asignación de Prioridades y Respuestas Técnicas Asistidas
      if (textoAnalizar.includes("caida") || textoAnalizar.includes("urgente") || textoAnalizar.includes("no funciona") || textoAnalizar.includes("error 403") || textoAnalizar.includes("bloqueado")) {
        prioridad = "Alta";
        sugerencia = "[Soporte Automatizado] Se detectó un bloqueo crítico. Por favor, borre las cookies de su navegador, valide su dirección IP institucional o solicite un reseteo de credenciales con el administrador del laboratorio.";
      } else if (textoAnalizar.includes("lento") || textoAnalizar.includes("opaco") || textoAnalizar.includes("mantenimiento")) {
        prioridad = "Baja";
        sugerencia = "[Soporte Automatizado] Ticket agendado para mantenimiento preventivo en las próximas 48 horas. No interrumpe las actividades académicas actuales.";
      } else {
        prioridad = "Media";
        sugerencia = "[Soporte Automatizado] Reporte recibido correctamente. Le sugerimos reiniciar el equipo/aplicativo afectado y verificar si el inconveniente persiste antes de la asignación del técnico.";
      }
    }

    // 2. GUARDAR EL TICKET EN MONGODB (Garantiza los datos para los gráficos)
    const nuevoTicket = new Ticket({
      titulo,
      descripcion,
      prioridad,
      categoria,
      respuesta_ia: sugerencia
    });

    await nuevoTicket.save();

    // 3. ENVIAR A TRELLO DE MANERA AUTOMÁTICA
    try {
      let idListDestino = process.env.TRELLO_LIST_MEDIA;
      if (nuevoTicket.prioridad === 'Baja') idListDestino = process.env.TRELLO_LIST_BAJA;
      if (nuevoTicket.prioridad === 'Alta') idListDestino = process.env.TRELLO_LIST_ALTA;

      const params = new URLSearchParams({
        idList: idListDestino,
        key: process.env.TRELLO_KEY || '',
        token: process.env.TRELLO_TOKEN || '',
        name: `[${nuevoTicket.categoria}] ${nuevoTicket.titulo}`,
        desc: `Descripción del usuario:\n${nuevoTicket.descripcion}\n\n🤖 Diagnóstico Asistido:\n${nuevoTicket.respuesta_ia}`
      });

      await fetch(`https://api.trello.com/1/cards?${params.toString()}`, { method: 'POST' });
      console.log(`📋 ✅ ¡TARJETA CREADA EN TRELLO!`);
    } catch (trelloError) {
      console.error('⚠️ Error en Trello:', trelloError.message);
    }
    
    // Devolvemos respuesta exitosa (Status 201) al Frontend de Vercel
    res.status(201).json(nuevoTicket);

  } catch (error) {
    console.error("❌ Error general crítico en la ruta /tickets:", error);
    res.status(500).json({ error: "Error interno al procesar el ticket." });
  }
});

// Ruta para el historial de los gráficos del Frontend
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los tickets" });
  }
});

module.exports = router;