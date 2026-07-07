const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // 👈 1. Importar CORS
require('dotenv').config();

const app = express();

app.use(cors()); // 👈 2. Permitir que tu frontend de React se conecte
app.use(express.json());

// Tus rutas existentes
const routes = require('./routes');
app.use('/', routes);

// Tu conexión de Mongoose existente...
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  family: 4
})
.then(() => console.log('💾 ✅ ¡CONEXIÓN EXITOSA A MONGODB ATLAS! El puente está abierto.'))
.catch((error) => console.log('❌ Error real de conexión:', error.message));

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Servidor escuchando en el puerto ${PORT}`));