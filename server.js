// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Módulos
const cursosRoutes = require('./modulos/cursos/cursos.routes');
app.use('/cursos', cursosRoutes);

const usuariosRoutes = require('./modulos/usuarios/usuarios.routes');
app.use('/usuarios', usuariosRoutes);

const administradorRoutes = require('./modulos/administrador/administrador.routes');
app.use('/admin', administradorRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n Servidor corriendo en http://localhost:${PORT}\n`);
});