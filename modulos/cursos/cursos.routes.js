// modulos/cursos/cursos.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../../db'); // Sube dos niveles para llegar a db.js

// Configuración de Multer
const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 1. VER TODOS LOS CURSOS
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM cursos');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener los cursos", detalle: error.message });
    }
});

// 2. LECCIONES POR CURSO
router.get('/lecciones/:cursoId', async (req, res) => {
    const { cursoId } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM lecciones WHERE cursos_id = ?', [cursoId]);
        res.json(rows);
    } catch (error) {
        console.error("Error al obtener lecciones:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// 3. SUBIR VIDEO
router.post('/subir-video', upload.single('videoPiano'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No se seleccionó ningún video." });
    }

    const { cursos_id, titulo_video } = req.body;

    //  Validación que faltaba
    if (!cursos_id || !titulo_video) {
        return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

    const url_video = `/uploads/${req.file.filename}`;

    try {
        await db.query(
            'INSERT INTO lecciones (cursos_id, titulo, video_url) VALUES (?, ?, ?)',
            [cursos_id, titulo_video, url_video]
        );
        res.json({ mensaje: "Video subido y registrado con éxito 🎬" });
    } catch (error) {
        console.error("Fallo en el INSERT:", error);
        res.status(500).json({ error: "Error en la base de datos: " + error.message });
    }
});

module.exports = router;
