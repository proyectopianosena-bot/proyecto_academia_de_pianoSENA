const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = require('../../db');

const API_URL = 'https://api.resend.com/emails';

// REGISTRO
router.post('/registro', async (req, res) => {

    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({
            error: 'Todos los campos son obligatorios.'
        });
    }

    try {

        const [existe] = await db.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        );

        if (existe.length > 0) {
            return res.status(400).json({
                error: 'Este correo ya está registrado.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const codigo = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        await db.query(
            `INSERT INTO usuarios
            (nombre, email, password, rol, verificado, token_verificacion)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                nombre,
                email,
                passwordHash,
                'alumno',
                false,
                codigo
            ]
        );

        await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Academia Piano <onboarding@resend.dev>',
                to: email,
                subject: 'Código de verificación - Academia Piano',
                html: `
                    <div style="font-family:Arial;padding:20px;">
                        <h1>Academia Piano 🎹</h1>

                        <p>Tu código de verificación es:</p>

                        <h2 style="letter-spacing:5px;">
                            ${codigo}
                        </h2>

                        <p>Ingresa este código en la plataforma.</p>
                    </div>
                `
            })
        });

        res.status(201).json({
            mensaje: 'Código enviado al correo.',
            email
        });

    } catch (error) {

        console.error('Error en registro:', error);

        res.status(500).json({
            error: 'Error interno del servidor.'
        });
    }
});

// VERIFICAR CODIGO
router.post('/verificar-codigo', async (req, res) => {

    const { email, codigo } = req.body;

    try {

        const [rows] = await db.query(
            `SELECT * FROM usuarios
             WHERE email = ?
             AND token_verificacion = ?`,
            [email, codigo]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                error: 'Código incorrecto.'
            });
        }

        await db.query(
            `UPDATE usuarios
             SET verificado = true,
                 token_verificacion = NULL
             WHERE email = ?`,
            [email]
        );

        res.json({
            mensaje: 'Cuenta verificada correctamente.'
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error interno del servidor.'
        });
    }
});

// LOGIN
router.post('/login', async (req, res) => {

    const { email, password } = req.body;

    try {

        const [rows] = await db.query(
            'SELECT * FROM usuarios WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                error: 'Email o contraseña incorrectos.'
            });
        }

        const usuario = rows[0];

        if (!usuario.verificado) {
            return res.status(401).json({
                error: 'Debes verificar tu correo.'
            });
        }

        const ok = await bcrypt.compare(
            password,
            usuario.password
        );

        if (!ok) {
            return res.status(401).json({
                error: 'Email o contraseña incorrectos.'
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
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                rol: usuario.rol
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error interno del servidor.'
        });
    }
});

module.exports = router;
