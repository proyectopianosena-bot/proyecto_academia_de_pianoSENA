// modulos/usuarios/usuarios.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../db');

// ─────────────────────────────────────
// 1. REGISTRO DE USUARIO
// ─────────────────────────────────────
router.post('/registro', async (req, res) => {
    const { nombre, email, password, rol } = req.body;

    // Validación
    if (!nombre || !email || !password || !rol) {
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    try {
        // Verificar si el email ya existe
        const [existe] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existe.length > 0) {
            return res.status(400).json({ error: "Este email ya está registrado." });
        }

        // Encriptar contraseña
        const passwordEncriptada = await bcrypt.hash(password, 10);

        // Insertar usuario
        const [resultado] = await db.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, email, passwordEncriptada, rol]
        );

        const nuevoId = resultado.insertId;

        // Si es alumno, crear registro en tabla alumnos
        if (rol === 'alumno') {
            await db.query(
                'INSERT INTO alumnos (usuario_id, nivel_interes) VALUES (?, ?)',
                [nuevoId, 'principiante']
            );
        }

        // Si es profesor, crear registro en tabla profesores
        if (rol === 'profesor') {
            await db.query(
                'INSERT INTO profesores (usuario_id, especialidad, biografia) VALUES (?, ?, ?)',
                [nuevoId, 'Piano', '']
            );
        }

        // Si es administrador, crear registro en tabla administrador
        if (rol === 'administrador') {
            await db.query(
                'INSERT INTO administrador (usuario_id, cargo, puede_gestionar_cursos, puede_gestionar_usuarios) VALUES (?, ?, ?, ?)',
                [nuevoId, 'Administrador General', 1, 1]
            );
        }

        res.status(201).json({ mensaje: "Usuario registrado con éxito." });

    } catch (error) {
        console.error("Error en registro:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// ─────────────────────────────────────
// 2. LOGIN DE USUARIO
// ─────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Validación
    if (!email || !password) {
        return res.status(400).json({ error: "Email y contraseña son obligatorios." });
    }

    try {
        // Buscar usuario
        const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ error: "Email o contraseña incorrectos." });
        }

        const usuario = rows[0];

        // Verificar contraseña
        const passwordCorrecta = await bcrypt.compare(password, usuario.password);
        if (!passwordCorrecta) {
            return res.status(401).json({ error: "Email o contraseña incorrectos." });
        }

        // Generar token JWT
        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
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
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

module.exports = router;