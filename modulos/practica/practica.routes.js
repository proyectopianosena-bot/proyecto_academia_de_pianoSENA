// modulos/practica/practica.routes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../../db');

// ─────────────────────────────────────
// MIDDLEWARE - Verificar token (cualquier rol)
// ─────────────────────────────────────
function verificarToken(req, res, next) { 
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ error: "Token requerido." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido." });
    }
}

// ─────────────────────────────────────
// 1. OBTENER TODOS LOS EJERCICIOS
// ─────────────────────────────────────
router.get('/ejercicios', verificarToken, async (req, res) => {
    try {
        const [ejercicios] = await db.query(
            'SELECT * FROM ejercicios_practica ORDER BY nivel ASC, id ASC'
        );
        res.json(ejercicios);
    } catch (error) {
        console.error("Error al obtener ejercicios:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// ─────────────────────────────────────
// 2. OBTENER EJERCICIO POR ID
// ─────────────────────────────────────
router.get('/ejercicios/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query(
            'SELECT * FROM ejercicios_practica WHERE id = ?', [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Ejercicio no encontrado." });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error("Error al obtener ejercicio:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// ─────────────────────────────────────
// 3. REGISTRAR RESULTADO DE PRÁCTICA
// ─────────────────────────────────────
router.post('/resultado', verificarToken, async (req, res) => {
    const { ejercicio_id, notas_correctas, notas_totales, tiempo_segundos } = req.body;
    const usuario_id = req.usuario.id;

    if (!ejercicio_id || notas_correctas === undefined || !notas_totales) {
        return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

    const porcentaje = Math.round((notas_correctas / notas_totales) * 100);

    try {
        await db.query(
            `INSERT INTO resultados_practica 
             (alumno_id, ejercicio_id, notas_correctas, notas_totales, porcentaje, tiempo_segundos) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [usuario_id, ejercicio_id, notas_correctas, notas_totales, porcentaje, tiempo_segundos || 0]
        );

        res.status(201).json({
            mensaje: "Resultado guardado con éxito.",
            porcentaje
        });
    } catch (error) {
        console.error("Error al guardar resultado:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// ─────────────────────────────────────
// 4. VER HISTORIAL DE PRÁCTICA DEL USUARIO
// ─────────────────────────────────────
router.get('/historial', verificarToken, async (req, res) => {
    const usuario_id = req.usuario.id;

    try {
        const [historial] = await db.query(
            `SELECT 
                rp.id,
                rp.notas_correctas,
                rp.notas_totales,
                rp.porcentaje,
                rp.tiempo_segundos,
                rp.fecha,
                ep.titulo AS ejercicio,
                ep.nivel,
                ep.instrumento,
                ep.curso_id,
                c.titulo AS curso
             FROM resultados_practica rp
             JOIN ejercicios_practica ep ON rp.ejercicio_id = ep.id
             LEFT JOIN cursos c ON ep.curso_id = c.id
             WHERE rp.alumno_id = ?
             ORDER BY rp.fecha DESC
             LIMIT 20`,
            [usuario_id]
        );

        res.json(historial);
    } catch (error) {
        console.error("Error al obtener historial:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// ─────────────────────────────────────
// 5. ESTADÍSTICAS DEL USUARIO
// ─────────────────────────────────────
router.get('/estadisticas', verificarToken, async (req, res) => {
    const usuario_id = req.usuario.id;

    try {
        const [[stats]] = await db.query(
            `SELECT 
                COUNT(*) AS total_sesiones,
                AVG(porcentaje) AS promedio_aciertos,
                MAX(porcentaje) AS mejor_resultado,
                SUM(tiempo_segundos) AS tiempo_total_segundos
             FROM resultados_practica
             WHERE alumno_id = ?`,
            [usuario_id]
        );

        res.json({
            total_sesiones: stats.total_sesiones,
            promedio_aciertos: Math.round(stats.promedio_aciertos || 0),
            mejor_resultado: stats.mejor_resultado || 0,
            tiempo_total_minutos: Math.round((stats.tiempo_total_segundos || 0) / 60)
        });
    } catch (error) {
        console.error("Error al obtener estadísticas:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// ─────────────────────────────────────
// 6. CREAR EJERCICIO (solo admin/profesor)
// ─────────────────────────────────────
router.post('/ejercicios', verificarToken, async (req, res) => {
    const { rol } = req.usuario;

    if (rol !== 'administrador' && rol !== 'profesor') {
        return res.status(403).json({ error: "Solo profesores o administradores pueden crear ejercicios." });
    }

    const { titulo, descripcion, nivel, instrumento, secuencia_notas, curso_id } = req.body;

    if (!titulo || !nivel || !instrumento || !secuencia_notas) {
        return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

    const nivelesValidos = ['principiante', 'intermedio', 'avanzado'];
    if (!nivelesValidos.includes(nivel)) {
        return res.status(400).json({ error: "Nivel inválido. Use: principiante, intermedio o avanzado." });
    }

    try {
        const [resultado] = await db.query(
            `INSERT INTO ejercicios_practica (titulo, descripcion, nivel, instrumento, secuencia_notas, curso_id, creado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [titulo, descripcion || '', nivel, instrumento, JSON.stringify(secuencia_notas), curso_id || null, req.usuario.id]
        );

        res.status(201).json({
            mensaje: "Ejercicio creado con éxito.",
            id: resultado.insertId
        });
    } catch (error) {
        console.error("Error al crear ejercicio:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

module.exports = router;