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
    enum: ['Baja', 'Media', 'Alta'],
    default: 'Baja'
  },
  categoria: {
    type: String,
    enum: ['Hardware', 'Software', 'Redes', 'Accesos'],
    default: 'Software'
  },
  respuesta_ia: {
    type: String
  }
}, {
  timestamps: true // Esto crea automáticamente las propiedades createdAt y updatedAt
});

module.exports = mongoose.model('Ticket', TicketSchema);