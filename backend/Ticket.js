const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true
  },
  descripcion: {
    type: String,
    required: true
  },
  prioridad: {
    type: String,
    default: 'Sin asignar' // Lo llenará la Inteligencia Artificial más adelante
  },
  categoria: {
    type: String,
    default: 'Sin asignar' // Lo llenará la Inteligencia Artificial más adelante
  },
  respuesta_ia: {
    type: String,
    default: '' // Aquí guardaremos la solución sugerida por Gemini
  },
  fecha: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Ticket', TicketSchema);