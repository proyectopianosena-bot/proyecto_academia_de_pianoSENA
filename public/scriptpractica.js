/* ══════════════════════════════════════
   PIANO STUDIO — app.js
   Lógica Interactiva y Motor de Audio
   ══════════════════════════════════════ */

// --- CONFIGURACIÓN Y ESTADO ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let currentOctaves = [3, 4, 5];
let activeOscillators = {};
let currentExercise = null;
let exerciseState = {
    step: 0,
    hits: 0,
    startTime: null,
    timerInterval: null
};

// Base de datos de ejercicios
const EXERCISES = [
    { id: 1, title: "Escala Mayor C", level: "principiante", sequence: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"], desc: "La base de toda la música occidental." },
    { id: 2, title: "Acorde de Am", level: "principiante", sequence: ["A3", "C4", "E4"], desc: "Un sonido melancólico y profundo." },
    { id: 3, title: "Escala de Blues", level: "intermedio", sequence: ["C4", "Eb4", "F4", "Gb4", "G4", "Bb4", "C5"], desc: "Añade tensión con la nota de blues." },
    { id: 4, title: "Arpegio de Sol", level: "intermedio", sequence: ["G3", "B3", "D4", "G4", "B4", "D5"], desc: "Movimiento fluido por el teclado." },
    { id: 5, title: "Estudio en Em", level: "avanzado", sequence: ["E3", "G3", "B3", "E4", "F#4", "G4", "A4", "B4"], desc: "Requiere precisión en las teclas negras." }
];

const NOTE_FREQS = {
    "C": 261.63, "C#": 277.18, "Db": 277.18, "D": 293.66, "D#": 311.13, "Eb": 311.13,
    "E": 329.63, "F": 349.23, "F#": 369.99, "Gb": 369.99, "G": 392.00, "G#": 415.30,
    "Ab": 415.30, "A": 440.00, "A#": 466.16, "Bb": 466.16, "B": 493.88
};

// ══════════════════════════════════════
// MAPEADO DE TECLADO PC → PIANO
// Fila inferior (teclas blancas): A S D F G H J K L
// Fila superior (teclas negras):  W E   T Y U   O
//
//  Tecla PC │ Nota  │ Descripción
// ──────────┼───────┼────────────────
//    A       │ C4    │ Do central
//    W       │ C#4   │ Do sostenido
//    S       │ D4    │ Re
//    E       │ D#4   │ Re sostenido
//    D       │ E4    │ Mi
//    F       │ F4    │ Fa
//    T       │ F#4   │ Fa sostenido
//    G       │ G4    │ Sol
//    Y       │ G#4   │ Sol sostenido
//    H       │ A4    │ La
//    U       │ A#4   │ La sostenido
//    J       │ B4    │ Si
//    K       │ C5    │ Do (octava alta)
//    O       │ C#5   │ Do sostenido alto
//    L       │ D5    │ Re alto
//    P       │ D#5   │ Re sostenido alto
// ══════════════════════════════════════
const PC_KEY_MAP = {
    'a': { note: 'C',  octave: 4 },
    'w': { note: 'C#', octave: 4 },
    's': { note: 'D',  octave: 4 },
    'e': { note: 'D#', octave: 4 },
    'd': { note: 'E',  octave: 4 },
    'f': { note: 'F',  octave: 4 },
    't': { note: 'F#', octave: 4 },
    'g': { note: 'G',  octave: 4 },
    'y': { note: 'G#', octave: 4 },
    'h': { note: 'A',  octave: 4 },
    'u': { note: 'A#', octave: 4 },
    'j': { note: 'B',  octave: 4 },
    'k': { note: 'C',  octave: 5 },
    'o': { note: 'C#', octave: 5 },
    'l': { note: 'D',  octave: 5 },
    'p': { note: 'D#', octave: 5 },
};

// Teclas actualmente presionadas (evita repetición de keydown)
const pressedKeys = new Set();

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    renderKeyboard('keyboard-libre');
    renderExerciseGrid();
    updateHistoryUI();
    initKeyboardInput();   // ← Activa el teclado PC
    renderKeyboardGuide(); // ← Muestra el mapa visual de teclas

const repeatBtn = document.getElementById('btn-repetir');
    if (repeatBtn) {
        repeatBtn.addEventListener('click', repeatExercise);
    }

});

// ══════════════════════════════════════
// TECLADO PC — INICIALIZACIÓN
// ══════════════════════════════════════
function initKeyboardInput() {

    document.addEventListener('keydown', (e) => {
        // Ignorar si el foco está en un input, textarea, etc.
        if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;
        // Ignorar teclas modificadoras y repetición continua al mantener presionado
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (pressedKeys.has(e.key)) return; // Evitar repetición

        const key = e.key.toLowerCase();
        const mapping = PC_KEY_MAP[key];

        if (!mapping) return;

        e.preventDefault(); // Evitar scroll con teclas como L, P
        pressedKeys.add(e.key);

        const { note, octave } = mapping;
        const noteStr = `${note}${octave}`;

        // Activar el sonido con duración sostenida (nota larga mientras se mantiene)
        startSustainedNote(note, octave, noteStr);

        // Resaltar visualmente la tecla en el teclado activo
        highlightKeyPress(note, octave);

        // Mostrar info en panel libre
        const activePanel = getActiveTab();
        if (activePanel === 'libre') {
            updateNoteInfo(note, octave);
        }

        // Si está en ejercicios, evaluar la nota
        if (activePanel === 'ejercicios' && currentExercise) {
            checkExerciseNote(note, octave);
        }
    });

    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (!PC_KEY_MAP[key]) return;

        pressedKeys.delete(e.key);

        const { note, octave } = PC_KEY_MAP[key];
        const noteStr = `${note}${octave}`;

        // Detener el oscilador sostenido
        stopSustainedNote(noteStr);

        // Quitar resaltado visual
        removeKeyHighlight(note, octave);
    });
}

// ══════════════════════════════════════
// NOTAS SOSTENIDAS (mientras se mantiene la tecla)
// ══════════════════════════════════════
function startSustainedNote(note, octave, id) {
    if (activeOscillators[id]) return; // Ya está sonando

    if (audioCtx.state === 'suspended') audioCtx.resume();

    const freq = NOTE_FREQS[note] * Math.pow(2, octave - 4);
    if (!freq) return;

    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    // Ataque suave
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.01);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();

    activeOscillators[id] = { osc, gain };
}

function stopSustainedNote(id) {
    const active = activeOscillators[id];
    if (!active) return;

    // Release suave para evitar "click" de audio
    active.gain.gain.cancelScheduledValues(audioCtx.currentTime);
    active.gain.gain.setValueAtTime(active.gain.gain.value, audioCtx.currentTime);
    active.gain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
    active.osc.stop(audioCtx.currentTime + 0.15);

    delete activeOscillators[id];
}

// ══════════════════════════════════════
// RESALTADO VISUAL DE TECLAS PC
// ══════════════════════════════════════
function highlightKeyPress(note, octave) {
    // Busca en ambos teclados (libre y ejercicio)
    ['keyboard-libre', 'keyboard-ex'].forEach(kbId => {
        const kb = document.getElementById(kbId);
        if (!kb) return;
        const keys = kb.querySelectorAll('[data-note][data-octave]');
        keys.forEach(k => {
            if (k.dataset.note === note && parseInt(k.dataset.octave) === octave) {
                k.classList.add('pressed');
            }
        });
    });
}

function removeKeyHighlight(note, octave) {
    ['keyboard-libre', 'keyboard-ex'].forEach(kbId => {
        const kb = document.getElementById(kbId);
        if (!kb) return;
        const keys = kb.querySelectorAll('[data-note][data-octave]');
        keys.forEach(k => {
            if (k.dataset.note === note && parseInt(k.dataset.octave) === octave) {
                k.classList.remove('pressed');
            }
        });
    });
}

// ══════════════════════════════════════
// GUÍA VISUAL DEL MAPA DE TECLADO
// ══════════════════════════════════════
function renderKeyboardGuide() {
    // Busca el contenedor de la guía en el HTML
    const guide = document.getElementById('keyboard-guide');
    if (!guide) return;

    // Fila de teclas negras (W E _ T Y U _ O P)
    const blackRow = [
        { key: 'W', note: 'C#4', label: 'C#' },
        { key: 'E', note: 'D#4', label: 'D#' },
        { key: '',  note: '',    label: ''   },   // Hueco entre E y Mi
        { key: 'T', note: 'F#4', label: 'F#' },
        { key: 'Y', note: 'G#4', label: 'G#' },
        { key: 'U', note: 'A#4', label: 'A#' },
        { key: '',  note: '',    label: ''   },
        { key: 'O', note: 'C#5', label: 'C#' },
        { key: 'P', note: 'D#5', label: 'D#' },
    ];

    // Fila de teclas blancas (A S D F G H J K L)
    const whiteRow = [
        { key: 'A', note: 'C4', label: 'Do' },
        { key: 'S', note: 'D4', label: 'Re' },
        { key: 'D', note: 'E4', label: 'Mi' },
        { key: 'F', note: 'F4', label: 'Fa' },
        { key: 'G', note: 'G4', label: 'Sol' },
        { key: 'H', note: 'A4', label: 'La' },
        { key: 'J', note: 'B4', label: 'Si' },
        { key: 'K', note: 'C5', label: 'Do' },
        { key: 'L', note: 'D5', label: 'Re' },
    ];

    guide.innerHTML = `
        <div class="guide-title">Mapa del teclado</div>
        <div class="guide-rows">
            <div class="guide-row black-row">
                ${blackRow.map(k => k.key
                    ? `<div class="guide-key black-guide" data-pc="${k.key.toLowerCase()}">
                           <span class="gk-pc">${k.key}</span>
                           <span class="gk-note">${k.label}</span>
                       </div>`
                    : `<div class="guide-key-spacer"></div>`
                ).join('')}
            </div>
            <div class="guide-row white-row">
                ${whiteRow.map(k =>
                    `<div class="guide-key white-guide" data-pc="${k.key.toLowerCase()}">
                         <span class="gk-pc">${k.key}</span>
                         <span class="gk-note">${k.label}</span>
                     </div>`
                ).join('')}
            </div>
        </div>
        <div class="guide-hint">Mantén presionada la tecla para sostener la nota</div>
    `;

    // Sincronizar resaltado de guía con teclado físico
    document.addEventListener('keydown', (e) => {
        const el = guide.querySelector(`[data-pc="${e.key.toLowerCase()}"]`);
        if (el) el.classList.add('guide-pressed');
    });
    document.addEventListener('keyup', (e) => {
        const el = guide.querySelector(`[data-pc="${e.key.toLowerCase()}"]`);
        if (el) el.classList.remove('guide-pressed');
    });
}

// ══════════════════════════════════════
// UTILIDAD: saber qué tab está activo
// ══════════════════════════════════════
function getActiveTab() {
    const panel = document.querySelector('.tab-panel.active');
    if (!panel) return null;
    return panel.id.replace('tab-', '');
}

// --- MOTOR DE AUDIO (clic con mouse) ---
function playNote(note, octave, duration = null) {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const freq = NOTE_FREQS[note] * Math.pow(2, octave - 4);
    if (!freq) return;

    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + (duration || 1.5));

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + (duration || 1.5));

    return { osc, gain };
}

// --- GESTIÓN DEL TECLADO VISUAL ---
function renderKeyboard(containerId, isExercise = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    currentOctaves.forEach(oct => {
        notes.forEach(note => {
            const key = document.createElement('div');
            const isBlack = note.includes('#');
            key.className = isBlack ? 'black-key' : 'white-key';
            key.dataset.note   = note;
            key.dataset.octave = oct;

            if (isBlack) {
                const prevWhiteKeys = notes.slice(0, notes.indexOf(note)).filter(n => !n.includes('#')).length;
                const offset = (prevWhiteKeys * 47) + 32;
                key.style.left = `${offset + ((oct - currentOctaves[0]) * 7 * 47)}px`;
            }

            // Mostrar tecla PC correspondiente como label
            const pcKey = Object.entries(PC_KEY_MAP).find(
                ([, v]) => v.note === note && v.octave === oct
            );
            if (pcKey && !isBlack) {
                const label = document.createElement('span');
                label.className = 'key-pc-label';
                label.textContent = pcKey[0].toUpperCase();
                key.appendChild(label);
            }

            key.onmousedown = () => handleKeyPress(note, oct, key, isExercise);
            container.appendChild(key);
        });
    });

    // Highlight nota resaltada si hay ejercicio activo
    if (isExercise && currentExercise) {
        highlightNextNote();
    }
}

function handleKeyPress(note, octave, keyEl, isExercise) {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    playNote(note, octave);
    keyEl.classList.add('pressed');
    setTimeout(() => keyEl.classList.remove('pressed'), 200);

    if (!isExercise) {
        updateNoteInfo(note, octave);
    } else {
        checkExerciseNote(note, octave);
    }
}

function updateNoteInfo(note, octave) {
    const freq = (NOTE_FREQS[note] * Math.pow(2, octave - 4)).toFixed(2);
    document.getElementById('free-note-name').textContent = note;
    document.getElementById('free-note-freq').textContent = `${freq} Hz`;
    document.getElementById('free-note-oct').textContent  = octave;
    document.getElementById('free-note-midi').textContent =
        12 * (octave + 1) + ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"].indexOf(note);
}

// --- LÓGICA DE EJERCICIOS ---
function renderExerciseGrid() {
    const grid = document.getElementById('ex-grid');
    if (!grid) return;
    grid.innerHTML = '';
    EXERCISES.forEach(ex => {
        const card = document.createElement('div');
        card.className = 'ex-card';
        card.onclick = () => startExercise(ex);
        card.innerHTML = `
            <div class="ex-card-num">${String(ex.id).padStart(2, '0')}</div>
            <div class="ex-card-title">${ex.title}</div>
            <div class="ex-card-desc">${ex.desc}</div>
            <div class="ex-card-footer">
                <span class="badge badge-${ex.level}">${ex.level}</span>
                <span class="ex-card-notes">${ex.sequence.length} notas</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function startExercise(ex) {
    currentExercise = ex;
    exerciseState = { step: 0, hits: 0, startTime: Date.now(), timerInterval: null };

    document.getElementById('ex-list-view').style.display = 'none';
    document.getElementById('ex-play-view').style.display = 'block';
    document.getElementById('ex-play-title').textContent  = ex.title;
    document.getElementById('stat-total').textContent     = ex.sequence.length;

    const badge = document.getElementById('ex-play-badge');
    if (badge) {
        badge.textContent  = ex.level;
        badge.className    = `badge badge-${ex.level}`;
    }

    renderKeyboard('keyboard-ex', true);
    renderSequenceTrack();
    updateExerciseStats();

    exerciseState.timerInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - exerciseState.startTime) / 1000);
        document.getElementById('stat-time').textContent = `${sec}s`;
    }, 1000);
}

function renderSequenceTrack() {
    const track = document.getElementById('sequence-track');
    if (!track) return;
    track.innerHTML = '';
    currentExercise.sequence.forEach((n, i) => {
        const bubble = document.createElement('div');
        bubble.className = `seq-bubble ${i === 0 ? 'current' : ''}`;
        bubble.id = `bubble-${i}`;
        bubble.textContent = n;
        track.appendChild(bubble);
    });
}

function highlightNextNote() {
    if (!currentExercise) return;
    const target = currentExercise.sequence[exerciseState.step];
    if (!target) return;

    const note = target.slice(0, -1);
    const oct  = parseInt(target.slice(-1));

    document.querySelectorAll('#keyboard-ex [data-note][data-octave]').forEach(k => {
        k.classList.remove('highlight');
        if (k.dataset.note === note && parseInt(k.dataset.octave) === oct) {
            k.classList.add('highlight');
        }
    });
}

function checkExerciseNote(note, octave) {
    if (!currentExercise || exerciseState.step >= currentExercise.sequence.length) return;

    const played = `${note}${octave}`;
    const target  = currentExercise.sequence[exerciseState.step];

    // Equivalencias enarmónicas
    const enharmonics = {
        'C#': 'Db', 'Db': 'C#', 'D#': 'Eb', 'Eb': 'D#',
        'F#': 'Gb', 'Gb': 'F#', 'G#': 'Ab', 'Ab': 'G#',
        'A#': 'Bb', 'Bb': 'A#'
    };
    const targetNote = target.slice(0, -1);
    const targetOct  = target.slice(-1);
    const isEnharmonic =
        enharmonics[note] === targetNote && String(octave) === targetOct;

    const bubble = document.getElementById(`bubble-${exerciseState.step}`);

    if (played === target || isEnharmonic) {
        // ✓ Correcto
        if (bubble) bubble.className = 'seq-bubble done';
        exerciseState.step++;
        exerciseState.hits++;

        if (exerciseState.step < currentExercise.sequence.length) {
            const nextBubble = document.getElementById(`bubble-${exerciseState.step}`);
            if (nextBubble) nextBubble.classList.add('current');
            showFeedback('¡Bien! Siguiente nota →', 'var(--teal)');
            highlightNextNote();
        } else {
            finishExercise();
        }
    } else {
        // ✗ Incorrecto
        showFeedback(`Nota incorrecta — espera: ${target}`, 'var(--red)');
        if (bubble) {
            bubble.classList.add('wrong-flash');
            setTimeout(() => bubble.classList.remove('wrong-flash'), 400);
        }
    }
    updateExerciseStats();
}

function finishExercise() {
    clearInterval(exerciseState.timerInterval);

    const finalPct = Math.round((exerciseState.hits / currentExercise.sequence.length) * 100);
    const timeSec  = Math.floor((Date.now() - exerciseState.startTime) / 1000);

    // Limpia resaltados
    document.querySelectorAll('#keyboard-ex .highlight').forEach(k => k.classList.remove('highlight'));

    // Resultado
    const overlay = document.getElementById('result-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        document.getElementById('result-pct').textContent  = `${finalPct}%`;
        document.getElementById('result-sub').textContent  = `Completado en ${timeSec} segundos`;
        document.getElementById('result-icon').textContent = finalPct >= 80 ? '★' : finalPct >= 50 ? '◈' : '◇';
        document.getElementById('result-title').textContent =
            finalPct === 100 ? '¡Perfecto!' : finalPct >= 80 ? '¡Excelente!' : finalPct >= 50 ? '¡Buen trabajo!' : 'Sigue practicando';

    // Asegurar que el botón repetir del overlay funcione
        const overlayRepeatBtn = overlay.querySelector('.btn-repeat');
        if (overlayRepeatBtn) {
            // Remover event listeners anteriores para evitar duplicados
            const newBtn = overlayRepeatBtn.cloneNode(true);
            overlayRepeatBtn.parentNode.replaceChild(newBtn, overlayRepeatBtn);
            newBtn.addEventListener('click', () => {
                repeatExercise();
            });
        }
        
    }

    saveResult(currentExercise.title, finalPct, timeSec);
}

// --- PREVISUALIZAR SECUENCIA ---
function previewSequence() {
    if (!currentExercise) return;
    currentExercise.sequence.forEach((noteStr, i) => {
        setTimeout(() => {
            const note = noteStr.slice(0, -1);
            const oct  = parseInt(noteStr.slice(-1));
            playNote(note, oct, 0.45);
        }, i * 500);
    });
}

// --- NAVEGACIÓN Y UI ---
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

    document.getElementById(`tab-${tabId}`).classList.add('active');
    btn.classList.add('active');

    if (tabId === 'libre') renderKeyboard('keyboard-libre');
    if (tabId === 'historial') updateHistoryUI();
}

function setOctaves(range, btn) {
    currentOctaves = range;
    document.querySelectorAll('.oct-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderKeyboard('keyboard-libre');
}

function backToExList() {
    clearInterval(exerciseState.timerInterval);
    document.getElementById('ex-list-view').style.display  = 'block';
    document.getElementById('ex-play-view').style.display  = 'none';
    document.getElementById('result-overlay').style.display = 'none';
    currentExercise = null;
}

function filterLevel(level, btn) {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const grid = document.getElementById('ex-grid');
    grid.querySelectorAll('.ex-card').forEach((card, i) => {
        const ex = EXERCISES[i];
        card.style.display = (level === 'todos' || ex.level === level) ? '' : 'none';
    });
}

function showFeedback(msg, color) {
    const fb = document.getElementById('feedback-msg');
    if (!fb) return;
    fb.textContent  = msg;
    fb.style.color  = color;
}

function updateExerciseStats() {
    document.getElementById('stat-progress').textContent = exerciseState.step + 1;
    const pct = exerciseState.step > 0
        ? Math.round((exerciseState.hits / exerciseState.step) * 100)
        : 0;
    document.getElementById('stat-pct').textContent = `${pct}%`;
}

// --- HISTORIAL (localStorage) ---
function saveResult(name, pct, time) {
    const history = JSON.parse(localStorage.getItem('piano_history') || '[]');
    history.push({ name, pct, time, date: new Date().toLocaleDateString('es-CO') });
    localStorage.setItem('piano_history', JSON.stringify(history));
    updateHistoryUI();
}

function updateHistoryUI() {
    const history = JSON.parse(localStorage.getItem('piano_history') || '[]');
    const list    = document.getElementById('hist-list');
    if (!list) return;

    if (history.length === 0) {
        list.innerHTML = '<div class="hist-empty">Aún no hay sesiones registradas.<br>¡Completa un ejercicio para ver tu progreso!</div>';
        return;
    }

    list.innerHTML = '';
    let totalPct = 0;
    let totalTime = 0;
    let best = 0;

    [...history].reverse().forEach(item => {
        totalPct  += item.pct;
        totalTime += item.time || 0;
        if (item.pct > best) best = item.pct;

        const div = document.createElement('div');
        div.className = 'hist-item';
        div.innerHTML = `
            <div>
                <div class="hist-ex-name">${item.name}</div>
                <div class="hist-date">${item.date}</div>
            </div>
            <span class="badge badge-${item.pct > 80 ? 'principiante' : item.pct > 50 ? 'intermedio' : 'avanzado'}">${item.pct > 80 ? 'genial' : item.pct > 50 ? 'bien' : 'mejorar'}</span>
            <div class="hist-pct ${item.pct > 80 ? 'good' : item.pct > 50 ? 'avg' : 'low'}">${item.pct}%</div>
            <div class="hist-time">${item.time}s</div>
        `;
        list.appendChild(div);
    });

    document.getElementById('prog-sesiones').textContent = history.length;
    document.getElementById('prog-promedio').textContent  = `${Math.round(totalPct / history.length)}%`;
    document.getElementById('prog-mejor').textContent     = `${best}%`;
    document.getElementById('prog-tiempo').textContent    = `${Math.round(totalTime / 60)} min`;
}

// --- MICRÓFONO Y DETECCIÓN DE PITCH ---
let micStream    = null;
let analyserNode = null;
let pitchRafId   = null;
const NOTE_STRINGS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const recHistory   = [];

async function toggleMic() {
    const btn   = document.getElementById('mic-toggle');
    const label = document.getElementById('mic-label');

    if (!micStream) {
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const source = audioCtx.createMediaStreamSource(micStream);
            analyserNode = audioCtx.createAnalyser();
            analyserNode.fftSize = 2048;
            source.connect(analyserNode);

            btn.classList.add('active');
            label.textContent = 'Detener';
            document.getElementById('rec-hint').textContent = 'Toca una nota en tu instrumento…';

            startPitchDetection();
            startWaveform();
        } catch (err) {
            alert('No se pudo acceder al micrófono. Verifica los permisos del navegador.');
        }
    } else {
        micStream.getTracks().forEach(t => t.stop());
        micStream    = null;
        analyserNode = null;
        cancelAnimationFrame(pitchRafId);

        btn.classList.remove('active');
        label.textContent = 'Activar micrófono';
        document.getElementById('rec-big-note').textContent = '—';
        document.getElementById('rec-hz').textContent       = '— Hz';
        document.getElementById('rec-hint').textContent     = 'Presiona "Activar micrófono" y toca una nota en tu instrumento';
        moveTunerNeedle(0);
    }
}

function autoCorrelate(buf, sampleRate) {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    let r1 = 0, r2 = SIZE - 1;
    for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i])        < 0.2) { r1 = i; break; } }
    for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < 0.2) { r2 = SIZE - i; break; } }

    const buf2 = buf.slice(r1, r2);
    const c    = new Float32Array(buf2.length);
    for (let i = 0; i < buf2.length; i++)
        for (let j = 0; j < buf2.length - i; j++) c[i] += buf2[j] * buf2[j + i];

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxVal = -1, maxPos = -1;
    for (let i = d; i < buf2.length; i++) { if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; } }

    let T0 = maxPos;
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a   = (x1 + x3 - 2 * x2) / 2;
    const b   = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);
    return sampleRate / T0;
}

// ══════════════════════════════════════
// FUNCIÓN REPETIR EJERCICIO
// ══════════════════════════════════════
function repeatExercise() {
    if (!currentExercise) return;
    
    // Limpiar el estado actual del ejercicio
    clearInterval(exerciseState.timerInterval);
    
    // Reiniciar estado
    exerciseState = {
        step: 0,
        hits: 0,
        startTime: Date.now(),
        timerInterval: null
    };
    
    // Ocultar el overlay de resultados
    document.getElementById('result-overlay').style.display = 'none';
    
    // Reiniciar el temporizador
    exerciseState.timerInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - exerciseState.startTime) / 1000);
        const timeEl = document.getElementById('stat-time');
        if (timeEl) timeEl.textContent = `${sec}s`;
    }, 1000);
    
    // Resetear estadísticas
    updateExerciseStats();
    
    // Resetear la vista de secuencia
    renderSequenceTrack();
    
    // Resetear resaltados
    document.querySelectorAll('#keyboard-ex .highlight').forEach(k => k.classList.remove('highlight'));
    document.querySelectorAll('#keyboard-ex .pressed').forEach(k => k.classList.remove('pressed'));
    
    // Resaltar la primera nota nuevamente
    highlightNextNote();
    
    // Mostrar feedback
    showFeedback('Repitiendo ejercicio... ¡Concéntrate!', 'var(--teal)');
}

function startPitchDetection() {
    const buf = new Float32Array(analyserNode.fftSize);
    let lastNote = '';

    function detect() {
        if (!analyserNode) return;
        analyserNode.getFloatTimeDomainData(buf);
        const freq = autoCorrelate(buf, audioCtx.sampleRate);

        if (freq > 50 && freq < 2000) {
            const midi  = Math.round(12 * Math.log2(freq / 440) + 69);
            const note  = NOTE_STRINGS[midi % 12];
            const oct   = Math.floor(midi / 12) - 1;
            const label = `${note}${oct}`;

            // Afinación (cent offset)
            const idealFreq = 440 * Math.pow(2, (midi - 69) / 12);
            const cents     = 1200 * Math.log2(freq / idealFreq);
            moveTunerNeedle(cents);

            document.getElementById('rec-big-note').textContent = label;
            document.getElementById('rec-hz').textContent       = `${freq.toFixed(1)} Hz`;

            // Agregar al historial de burbujas
            if (note !== lastNote) {
                lastNote = note;
                addRecHistory(label);
            }
        }

        pitchRafId = requestAnimationFrame(detect);
    }
    detect();
}

function moveTunerNeedle(cents) {
    const needle   = document.getElementById('tuner-needle');
    if (!needle) return;
    const clamped  = Math.max(-50, Math.min(50, cents));
    const pct      = ((clamped + 50) / 100) * 100; // 0% = -50 cents, 100% = +50 cents
    needle.style.left = `${pct}%`;
}

function addRecHistory(label) {
    recHistory.unshift(label);
    if (recHistory.length > 16) recHistory.pop();

    const container = document.getElementById('rec-history');
    if (!container) return;
    container.innerHTML = '';
    recHistory.forEach(n => {
        const b = document.createElement('div');
        b.className  = 'rec-bubble';
        b.textContent = n;
        container.appendChild(b);
    });
}

function startWaveform() {
    const canvas = document.getElementById('waveCanvas');
    const ctx    = canvas.getContext('2d');

    function draw() {
        if (!analyserNode) return;
        requestAnimationFrame(draw);

        const buf = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteTimeDomainData(buf);

        canvas.width  = canvas.offsetWidth;
        const W = canvas.width, H = canvas.height;

        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = '#c9a84c';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();

        const sliceW = W / buf.length;
        buf.forEach((v, i) => {
            const x = i * sliceW;
            const y = (v / 128) * (H / 2);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    }
    draw();
}