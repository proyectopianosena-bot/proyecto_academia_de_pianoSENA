// modulos/administrador/administrador.routes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../../db');

// ─────────────────────────────────────
// MIDDLEWARE - Verificar token y rol admin
// ─────────────────────────────────────
function verificarAdmin(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ error: "Token requerido." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.rol !== 'administrador') {
            return res.status(403).json({ error: "Acceso denegado. Solo administradores." });
        }

        req.usuario = decoded;
        next();

    } catch (error) {
        return res.status(401).json({ error: "Token inválido." });
    }
}

// ─────────────────────────────────────
// 1. VER TODOS LOS USUARIOS
// ─────────────────────────────────────
router.get('/usuarios', verificarAdmin, async (req, res) => {
    try {
        const [usuarios] = await db.query(
            'SELECT id, nombre, email, rol FROM usuarios'
        );
        res.json(usuarios);
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// ─────────────────────────────────────
// 2. ELIMINAR UN USUARIO
// ─────────────────────────────────────
router.delete('/usuarios/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const [resultado] = await db.query(
            'DELETE FROM usuarios WHERE id = ?', [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "Usuario no encontrado." });
        }

        res.json({ mensaje: "Usuario eliminado con éxito." });

    } catch (error) {
        console.error("Error al eliminar usuario:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// ─────────────────────────────────────
// 3. VER TODOS LOS CURSOS
// ─────────────────────────────────────
router.get('/cursos', verificarAdmin, async (req, res) => {
    try {
        const [cursos] = await db.query(
            'SELECT * FROM cursos'
        );
        res.json(cursos);
    } catch (error) {
        console.error("Error al obtener cursos:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// ─────────────────────────────────────
// 4. ELIMINAR UN CURSO
// ─────────────────────────────────────
router.delete('/cursos/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const [resultado] = await db.query(
            'DELETE FROM cursos WHERE id = ?', [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: "Curso no encontrado." });
        }

        res.json({ mensaje: "Curso eliminado con éxito." });

    } catch (error) {
        console.error("Error al eliminar curso:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

module.exports = router;