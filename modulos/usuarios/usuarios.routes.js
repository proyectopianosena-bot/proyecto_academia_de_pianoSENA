// modulos/usuarios/usuarios.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');


// 1. REGISTRO DE USUARIO

router.post('/registro', async (req, res) => {

    const { nombre, email, password } = req.body;

    // FORZAR ROL ALUMNO
    const rol = 'alumno';

    // Validación
    if (!nombre || !email || !password) {
        return res.status(400).json({
            error: "Todos los campos son obligatorios."
        });
    }

    try {

        // Verificar cuando se me pase la clave global
        const [existe] = await db.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        );

        if (existe.length > 0) {
            return res.status(400).json({
                error: "Este email ya está registrado."
            });
        }

        // Encriptar contraseña con archivo .env
        const passwordEncriptada = await bcrypt.hash(password, 10);

        // Crear usuario
        const [resultado] = await db.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, email, passwordEncriptada, rol]
        );

        const nuevoId = resultado.insertId;

        // Crear perfil alumno
        await db.query(
            'INSERT INTO alumnos (usuario_id, nivel_interes) VALUES (?, ?)',
            [nuevoId, 'principiante']
        );

        res.status(201).json({
            mensaje: "Usuario registrado correctamente."
        });

    } catch (error) {

        console.error('Error en registro:', error);

        res.status(500).json({
            error: "Error interno del servidor."
        });
    }
});

// LOGIN DE USUARIO modificar solo si es necesario

router.post('/login', async (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: "Email y contraseña son obligatorios."
        });
    }

    try {

        const [rows] = await db.query(
            'SELECT * FROM usuarios WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                error: "Email o contraseña incorrectos."
            });
        }

        const usuario = rows[0];

        const passwordCorrecta = await bcrypt.compare(
            password,
            usuario.password
        );

        if (!passwordCorrecta) {
            return res.status(401).json({
                error: "Email o contraseña incorrectos."
            });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                rol: usuario.rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '8h'
            }
        );

        res.json({
            mensaje: "Login exitoso",
            token,

            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            }
        });

    } catch (error) {

        console.error("Error en login:", error);

        res.status(500).json({
            error: "Error interno del servidor."
        });
    }
});

module.exports = router;
