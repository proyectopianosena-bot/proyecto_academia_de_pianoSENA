// modulos/usuarios/usuarios.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const db = require('../../db');

// CONFIG EMAIL
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// REGISTRO
router.post('/registro', async (req, res) => {

    const { nombre, email, password } = req.body;

    const rol = 'alumno';

    if (!nombre || !email || !password) {
        return res.status(400).json({
            error: "Todos los campos son obligatorios."
        });
    }

    try {

        const [existe] = await db.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        );

        if (existe.length > 0) {
            return res.status(400).json({
                error: "Este email ya está registrado."
            });
        }

        const passwordEncriptada = await bcrypt.hash(password, 10);

        const tokenVerificacion = crypto.randomBytes(32).toString('hex');

        const [resultado] = await db.query(
            `INSERT INTO usuarios
            (nombre, email, password, rol, verificado, token_verificacion)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                nombre,
                email,
                passwordEncriptada,
                rol,
                false,
                tokenVerificacion
            ]
        );

        const nuevoId = resultado.insertId;

        await db.query(
            'INSERT INTO alumnos (usuario_id, nivel_interes) VALUES (?, ?)',
            [nuevoId, 'Principiante']
        );

        const verificationLink =
            `${process.env.APP_URL}/usuarios/verificar/${tokenVerificacion}`;

        await transporter.sendMail({
            from: `"Academia de Piano" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verifica tu cuenta - Academia Piano',
            html: `
                <h2>Bienvenido a Academia Piano 🎹</h2>

                <p>Gracias por registrarte.</p>

                <p>Haz clic aquí para verificar tu cuenta:</p>

                <a href="${verificationLink}">
                    Verificar cuenta
                </a>
            `
        });

        res.status(201).json({
            mensaje: "Cuenta creada. Revisa tu correo."
        });

    } catch (error) {

        console.error('Error en registro:', error);

        res.status(500).json({
            error: "Error interno del servidor."
        });
    }
});

// VERIFICAR EMAIL
router.get('/verificar/:token', async (req, res) => {

    const { token } = req.params;

    try {

        const [rows] = await db.query(
            'SELECT * FROM usuarios WHERE token_verificacion = ?',
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).send('Token inválido.');
        }

        await db.query(
            `UPDATE usuarios
             SET verificado = true,
                 token_verificacion = NULL
             WHERE token_verificacion = ?`,
            [token]
        );

        res.send(`
            <h1>Cuenta verificada correctamente 🎉</h1>
            <a href="${process.env.APP_URL}/login.html">Ir al login</a>
        `);

    } catch (error) {

        console.error(error);

        res.status(500).send('Error interno del servidor.');
    }
});

// LOGIN
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

        if (!usuario.verificado) {
            return res.status(401).json({
                error: "Debes verificar tu correo antes de iniciar sesión."
            });
        }

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
