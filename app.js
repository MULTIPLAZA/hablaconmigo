/* =========================================================
   HablaConmigo - app.js
   AAC con salida de voz (PWA vanilla + IndexedDB + Web Speech API + MediaRecorder)
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   Configuracion / constantes
   --------------------------------------------------------- */
const DB_NAME = 'hablaconmigo';
const DB_VERSION = 2;
const APP_VERSION = '2.1';
const STORE_BOTONES = 'botones';
const STORE_CONFIG = 'config';

const PIN_DEFAULT = '1234';
const TAP_LARGO_MS = 3000;

/* Biblioteca de palabras pre-armadas, agrupadas por categoria.
   IMPORTANTE: las palabras llevan tildes/enie para que el TTS pronuncie bien.
   Los nombres de archivo SVG NO llevan tildes (mejor para URLs). */
const BIBLIOTECA = [
  // basicas (las 6 originales)
  { palabra: 'mamá',      cat: 'basicas',     color: '#fce7f3', imagen: 'seed-images/mama.svg' },
  { palabra: 'papá',      cat: 'basicas',     color: '#dbeafe', imagen: 'seed-images/papa.svg' },
  { palabra: 'agua',      cat: 'basicas',     color: '#cffafe', imagen: 'seed-images/agua.svg' },
  { palabra: 'comer',     cat: 'basicas',     color: '#fef3c7', imagen: 'seed-images/comer.svg' },
  { palabra: 'más',       cat: 'nucleo',      color: '#dcfce7', imagen: 'seed-images/mas.svg' },
  { palabra: 'terminado', cat: 'nucleo',      color: '#fee2e2', imagen: 'seed-images/terminado.svg' },

  // cosas
  { palabra: 'biberón',   cat: 'cosas',       color: '#fef3c7', imagen: 'seed-images/biberon.svg' },
  { palabra: 'tele',      cat: 'cosas',       color: '#fef3c7', imagen: 'seed-images/tele.svg' },
  { palabra: 'cama',      cat: 'cosas',       color: '#fef3c7', imagen: 'seed-images/cama.svg' },
  { palabra: 'sillón',    cat: 'cosas',       color: '#fef3c7', imagen: 'seed-images/sillon.svg' },
  { palabra: 'jugar',     cat: 'cosas',       color: '#fef3c7', imagen: 'seed-images/jugar.svg' },

  // acciones
  { palabra: 'dame',      cat: 'acciones',    color: '#dcfce7', imagen: 'seed-images/dame.svg' },
  { palabra: 'mirá',      cat: 'acciones',    color: '#dcfce7', imagen: 'seed-images/mira.svg' },
  { palabra: 'abrir',     cat: 'acciones',    color: '#dcfce7', imagen: 'seed-images/abrir.svg' },
  { palabra: 'sacar',     cat: 'acciones',    color: '#dcfce7', imagen: 'seed-images/sacar.svg' },

  // sentimientos
  { palabra: 'contento',  cat: 'sentimientos', color: '#fce7f3', imagen: 'seed-images/contento.svg' },
  { palabra: 'triste',    cat: 'sentimientos', color: '#fce7f3', imagen: 'seed-images/triste.svg' },
  { palabra: 'duele',     cat: 'sentimientos', color: '#fce7f3', imagen: 'seed-images/duele.svg' },
  { palabra: 'miedo',     cat: 'sentimientos', color: '#fce7f3', imagen: 'seed-images/miedo.svg' },

  // lugares
  { palabra: 'afuera',    cat: 'lugares',     color: '#dbeafe', imagen: 'seed-images/afuera.svg' },
  { palabra: 'baño',      cat: 'lugares',     color: '#dbeafe', imagen: 'seed-images/bano.svg' },
  { palabra: 'cocina',    cat: 'lugares',     color: '#dbeafe', imagen: 'seed-images/cocina.svg' },
  { palabra: 'auto',      cat: 'lugares',     color: '#dbeafe', imagen: 'seed-images/auto.svg' },

  // nucleo
  { palabra: 'sí',        cat: 'nucleo',      color: '#dcfce7', imagen: 'seed-images/si.svg' },
  { palabra: 'no',        cat: 'nucleo',      color: '#fee2e2', imagen: 'seed-images/no.svg' },
  { palabra: 'menos',     cat: 'nucleo',      color: '#fed7aa', imagen: 'seed-images/menos.svg' },
  { palabra: 'basta',     cat: 'nucleo',      color: '#fee2e2', imagen: 'seed-images/basta.svg' },
];

/* Migracion: palabras sin tilde -> con tilde.
   Solo actualiza la palabra que se pronuncia (TTS); la imagen queda igual.
   La etiqueta visible se mantiene tal cual la haya puesto el usuario,
   a menos que coincida exactamente con la version sin tilde. */
const MIGRACION_TILDES = {
  'mama':    'mamá',
  'papa':    'papá',
  'biberon': 'biberón',
  'sillon':  'sillón',
  'mas':     'más',
  'mira':    'mirá',
  'si':      'sí',
  'bano':    'baño',
};

const CATEGORIAS = [
  { id: 'basicas',      label: 'Basicas',      desc: 'Para empezar' },
  { id: 'cosas',        label: 'Cosas',        desc: 'Objetos del dia a dia' },
  { id: 'acciones',     label: 'Acciones',     desc: 'Verbos clave' },
  { id: 'sentimientos', label: 'Sentimientos', desc: 'Como me siento' },
  { id: 'lugares',      label: 'Lugares',      desc: 'A donde voy' },
  { id: 'nucleo',       label: 'Nucleo',       desc: 'Palabras pegamento' },
];

const SEED_BOTONES = BIBLIOTECA.filter(b => b.cat === 'basicas' || b.palabra === 'mas' || b.palabra === 'terminado');

/* ---------------------------------------------------------
   Estado
   --------------------------------------------------------- */
const State = {
  db: null,
  botones: [],
  config: {
    pin: PIN_DEFAULT,
    columnas: 3,
    nivel: 1,
    velocidad: 0.9,
    voz: '',
  },
  vozActual: null,
  vocesDisponibles: [],
  botonEnEdicion: null,
  imagenTemp: null,
  audioTemp: null,
  colorTemp: '#f0fdfa',
  mediaRecorder: null,
  audioChunks: [],
  grabandoDesde: null,
};

/* ---------------------------------------------------------
   IndexedDB
   --------------------------------------------------------- */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_BOTONES)) {
        const store = db.createObjectStore(STORE_BOTONES, { keyPath: 'id', autoIncrement: true });
        store.createIndex('orden', 'orden', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CONFIG)) {
        db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbTx(stores, mode) {
  const tx = State.db.transaction(stores, mode);
  return { tx, ...Object.fromEntries(stores.map(s => [s, tx.objectStore(s)])) };
}

function dbAll(storeName) {
  return new Promise((resolve, reject) => {
    const { [storeName]: store } = dbTx([storeName], 'readonly');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(storeName, obj) {
  return new Promise((resolve, reject) => {
    const { [storeName]: store } = dbTx([storeName], 'readwrite');
    const req = store.put(obj);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const { [storeName]: store } = dbTx([storeName], 'readwrite');
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const { [storeName]: store } = dbTx([storeName], 'readonly');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ---------------------------------------------------------
   Config helpers
   --------------------------------------------------------- */
async function cargarConfig() {
  const keys = ['pin', 'columnas', 'nivel', 'velocidad', 'voz'];
  for (const k of keys) {
    const v = await dbGet(STORE_CONFIG, k);
    if (v && v.value !== undefined) State.config[k] = v.value;
  }
}

async function guardarConfig(key, value) {
  State.config[key] = value;
  await dbPut(STORE_CONFIG, { key, value });
}

/* ---------------------------------------------------------
   Util: cargar SVG y convertir a dataURL para guardar en IndexedDB
   --------------------------------------------------------- */
async function svgUrlToDataUrl(url) {
  const txt = await fetch(url).then(r => r.text());
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(txt)));
}

/* ---------------------------------------------------------
   Seed inicial
   --------------------------------------------------------- */
async function seedSiHaceFalta() {
  const todos = await dbAll(STORE_BOTONES);
  if (todos.length > 0) return;

  for (let i = 0; i < SEED_BOTONES.length; i++) {
    const seed = SEED_BOTONES[i];
    const dataUrl = await svgUrlToDataUrl(seed.imagen);
    await dbPut(STORE_BOTONES, {
      palabra: seed.palabra,
      etiqueta: seed.palabra,
      imagen: dataUrl,
      audio: null,
      color: seed.color,
      orden: i,
      nivel: 1,
    });
  }
}

/* Migracion idempotente: arregla acentos/enies en palabras seed
   que se cargaron en versiones anteriores sin tildes. */
async function migrarTildes() {
  const yaMigrado = await dbGet(STORE_CONFIG, 'migrado_tildes_v21');
  if (yaMigrado && yaMigrado.value) return;

  const todos = await dbAll(STORE_BOTONES);
  let cambios = 0;
  for (const b of todos) {
    const palabraNueva = MIGRACION_TILDES[(b.palabra || '').toLowerCase()];
    if (!palabraNueva) continue;
    // Si la etiqueta es igual a la palabra vieja, tambien la actualizo
    const etiquetaIgual = (b.etiqueta || '').toLowerCase() === (b.palabra || '').toLowerCase();
    b.palabra = palabraNueva;
    if (etiquetaIgual) b.etiqueta = palabraNueva;
    await dbPut(STORE_BOTONES, b);
    cambios++;
  }
  await guardarConfig('migrado_tildes_v21', true);
  if (cambios > 0) console.log(`[HablaConmigo] Migrados ${cambios} botones con tildes correctas`);
}

/* ---------------------------------------------------------
   TTS - Web Speech API + ranking de calidad
   --------------------------------------------------------- */
function rankearVoz(v) {
  /* devuelve un puntaje: mayor = mejor */
  let score = 0;
  const name = (v.name || '').toLowerCase();
  const lang = v.lang || '';

  // preferencia por idioma
  if (lang === 'es-PY') score += 100;
  else if (lang === 'es-AR' || lang === 'es-UY') score += 80;
  else if (lang === 'es-CL' || lang === 'es-MX' || lang === 'es-CO') score += 60;
  else if (lang === 'es-US') score += 50;
  else if (lang === 'es-ES') score += 40;
  else if (lang.startsWith('es')) score += 20;

  // calidad: voces neuronales / premium pesan mas
  if (/neural|wavenet|natural|premium|enhanced|online/i.test(name)) score += 50;
  if (/google/i.test(name)) score += 20;        // Google TTS suele tener mejores voces
  if (/microsoft/i.test(name)) score += 15;
  if (/female|mujer|fem/i.test(name)) score += 5; // ligera preferencia a femenina para AAC infantil

  return score;
}

function etiquetaCalidad(v) {
  const name = (v.name || '').toLowerCase();
  if (/neural|wavenet|natural|premium|enhanced/i.test(name)) return '* HD';
  return '';
}

function cargarVoces() {
  const todas = speechSynthesis.getVoices().filter(v => v.lang.startsWith('es'));
  todas.sort((a, b) => rankearVoz(b) - rankearVoz(a));
  State.vocesDisponibles = todas;

  if (State.config.voz) {
    State.vozActual = todas.find(v => v.name === State.config.voz);
  }
  if (!State.vozActual && todas.length > 0) {
    State.vozActual = todas[0];
  }

  poblarSelectVoces();
}

function poblarSelectVoces() {
  const sel = document.getElementById('select-voz');
  if (!sel) return;
  sel.innerHTML = '<option value="">(automatico - mejor disponible)</option>';
  for (const v of State.vocesDisponibles) {
    const opt = document.createElement('option');
    opt.value = v.name;
    const hd = etiquetaCalidad(v);
    opt.textContent = `${hd ? hd + ' ' : ''}${v.name} (${v.lang})`;
    if (State.vozActual && v.name === State.vozActual.name) opt.selected = true;
    sel.appendChild(opt);
  }
}

function hablar(texto) {
  if (!texto) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  if (State.vozActual) {
    u.voice = State.vozActual;
    u.lang = State.vozActual.lang;
  } else {
    u.lang = 'es-PY';
  }
  u.rate = parseFloat(State.config.velocidad) || 0.9;
  u.pitch = 1.0;
  u.volume = 1.0;
  speechSynthesis.speak(u);
  return u;
}

function reproducirAudio(dataUrl) {
  return new Promise((resolve) => {
    const audio = new Audio(dataUrl);
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.play().catch(resolve);
  });
}

function reproducirBoton(b) {
  if (b.audio) {
    return reproducirAudio(b.audio);
  }
  hablar(b.palabra);
  return Promise.resolve();
}

/* ---------------------------------------------------------
   Render: vista Mariano
   --------------------------------------------------------- */
async function renderMariano() {
  State.botones = await dbAll(STORE_BOTONES);
  State.botones.sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const grilla = document.getElementById('grilla-botones');
  grilla.innerHTML = '';
  grilla.style.setProperty('--cols', State.config.columnas);

  for (const b of State.botones) {
    const el = document.createElement('div');
    el.className = 'boton-tap';
    el.style.background = b.color || '#ffffff';
    el.dataset.id = b.id;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', b.etiqueta || b.palabra);

    const img = document.createElement('img');
    img.src = b.imagen;
    img.alt = '';
    el.appendChild(img);

    const lab = document.createElement('div');
    lab.className = 'etiqueta';
    lab.textContent = b.etiqueta || b.palabra;
    el.appendChild(lab);

    if (b.audio) {
      const dot = document.createElement('div');
      dot.className = 'audio-dot';
      dot.title = 'Audio personalizado';
      el.appendChild(dot);
    }

    el.addEventListener('click', () => {
      el.classList.add('hablando');
      reproducirBoton(b).finally(() => {
        setTimeout(() => el.classList.remove('hablando'), 200);
      });
    });

    grilla.appendChild(el);
  }
}

/* ---------------------------------------------------------
   Render: vista Edicion
   --------------------------------------------------------- */
async function renderEdicion() {
  document.getElementById('select-nivel').value = String(State.config.nivel);
  document.getElementById('select-columnas').value = String(State.config.columnas);
  document.getElementById('input-velocidad').value = String(State.config.velocidad);

  State.botones = await dbAll(STORE_BOTONES);
  State.botones.sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const lista = document.getElementById('lista-botones');
  lista.innerHTML = '';
  for (const b of State.botones) {
    const el = document.createElement('div');
    el.className = 'boton-edit';
    el.dataset.id = b.id;
    const audioBadge = b.audio ? '<span class="badge-audio" title="Audio grabado">*</span>' : '';
    el.innerHTML = `
      <div class="boton-edit-img"><img src="${b.imagen}" alt="" /></div>
      <div class="boton-edit-label">${escapeHtml(b.etiqueta || b.palabra)} ${audioBadge}</div>
      <div class="boton-edit-orden">#${(b.orden || 0) + 1}</div>
    `;
    el.addEventListener('click', () => abrirEditorBoton(b));
    lista.appendChild(el);
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------------------------------------------------------
   Vista switching
   --------------------------------------------------------- */
async function mostrarVista(nombre) {
  document.getElementById('vista-mariano').classList.toggle('activa', nombre === 'mariano');
  document.getElementById('vista-edicion').classList.toggle('activa', nombre === 'edicion');
  if (nombre === 'mariano') {
    await renderMariano();
  } else {
    await renderEdicion();
  }
}

/* ---------------------------------------------------------
   PIN: tap largo + modal
   --------------------------------------------------------- */
function inicializarTapLargo() {
  const zona = document.getElementById('zona-edicion');
  let timer = null;

  const cancelar = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    zona.classList.remove('activando');
  };

  const empezar = (e) => {
    cancelar();
    zona.classList.add('activando');
    timer = setTimeout(() => {
      timer = null;
      zona.classList.remove('activando');
      pedirPin();
    }, TAP_LARGO_MS);
  };

  zona.addEventListener('touchstart', empezar, { passive: true });
  zona.addEventListener('touchend', cancelar);
  zona.addEventListener('touchcancel', cancelar);
  zona.addEventListener('mousedown', empezar);
  zona.addEventListener('mouseup', cancelar);
  zona.addEventListener('mouseleave', cancelar);
}

function pedirPin() {
  const modal = document.getElementById('modal-pin');
  const input = document.getElementById('input-pin');
  const err = document.getElementById('pin-error');
  modal.classList.remove('oculto');
  err.classList.add('oculto');
  input.value = '';
  setTimeout(() => input.focus(), 50);
}

function cerrarPin() {
  document.getElementById('modal-pin').classList.add('oculto');
}

async function confirmarPin() {
  const pin = document.getElementById('input-pin').value;
  if (pin === State.config.pin) {
    cerrarPin();
    await mostrarVista('edicion');
  } else {
    document.getElementById('pin-error').classList.remove('oculto');
  }
}

/* ---------------------------------------------------------
   Editor de boton (modal)
   --------------------------------------------------------- */
function abrirEditorBoton(boton) {
  State.botonEnEdicion = boton ? { ...boton } : null;
  State.imagenTemp = boton ? boton.imagen : null;
  State.audioTemp = boton ? boton.audio : null;
  State.colorTemp = boton ? boton.color : '#f0fdfa';

  document.getElementById('titulo-boton').textContent = boton ? 'Editar boton' : 'Nuevo boton';
  document.getElementById('input-palabra').value = boton ? (boton.palabra || '') : '';
  document.getElementById('input-etiqueta').value = boton ? (boton.etiqueta || '') : '';
  const img = document.getElementById('img-preview');
  img.src = State.imagenTemp || 'icons/icon-192.svg';

  document.querySelectorAll('.color').forEach(c => {
    c.classList.toggle('activo', c.dataset.color === State.colorTemp);
  });

  actualizarUIAudio();

  const btnEliminar = document.querySelector('[data-action="eliminar-boton"]');
  if (btnEliminar) btnEliminar.style.display = boton ? '' : 'none';

  document.getElementById('modal-boton').classList.remove('oculto');
}

function cerrarEditorBoton() {
  document.getElementById('modal-boton').classList.add('oculto');
  detenerGrabacion(true);
  State.botonEnEdicion = null;
  State.imagenTemp = null;
  State.audioTemp = null;
}

async function guardarBoton() {
  const palabra = document.getElementById('input-palabra').value.trim();
  const etiqueta = document.getElementById('input-etiqueta').value.trim();
  if (!palabra) { toast('La palabra no puede estar vacia'); return; }
  if (!State.imagenTemp) { toast('Falta la imagen'); return; }

  const ahora = State.botonEnEdicion || {};
  const obj = {
    ...ahora,
    palabra,
    etiqueta: etiqueta || palabra,
    imagen: State.imagenTemp,
    audio: State.audioTemp,
    color: State.colorTemp,
    nivel: ahora.nivel || State.config.nivel,
  };
  if (obj.orden === undefined) obj.orden = State.botones.length;
  await dbPut(STORE_BOTONES, obj);
  cerrarEditorBoton();
  await renderEdicion();
  toast('Guardado');
}

async function eliminarBoton() {
  if (!State.botonEnEdicion || !State.botonEnEdicion.id) return;
  if (!confirm('Eliminar este boton?')) return;
  await dbDelete(STORE_BOTONES, State.botonEnEdicion.id);
  cerrarEditorBoton();
  await renderEdicion();
  toast('Eliminado');
}

/* ---------------------------------------------------------
   Grabacion de audio (MediaRecorder)
   --------------------------------------------------------- */
function actualizarUIAudio() {
  const btnGrabar = document.getElementById('btn-grabar');
  const btnDetener = document.getElementById('btn-detener');
  const btnEscuchar = document.getElementById('btn-escuchar');
  const btnBorrarAudio = document.getElementById('btn-borrar-audio');
  const statusAudio = document.getElementById('status-audio');
  const grabando = !!State.mediaRecorder && State.mediaRecorder.state === 'recording';

  btnGrabar.classList.toggle('oculto', grabando || !!State.audioTemp);
  btnDetener.classList.toggle('oculto', !grabando);
  btnEscuchar.classList.toggle('oculto', grabando || !State.audioTemp);
  btnBorrarAudio.classList.toggle('oculto', grabando || !State.audioTemp);

  if (grabando) statusAudio.textContent = 'Grabando... habla la palabra ahora.';
  else if (State.audioTemp) statusAudio.textContent = 'Audio grabado. Reemplaza al TTS cuando Mariano toque.';
  else statusAudio.textContent = 'Sin audio. Usara la voz del sistema (TTS).';
}

async function iniciarGrabacion() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    State.audioChunks = [];
    State.grabandoDesde = Date.now();
    State.mediaRecorder = new MediaRecorder(stream);
    State.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) State.audioChunks.push(e.data);
    };
    State.mediaRecorder.onstop = async () => {
      const blob = new Blob(State.audioChunks, { type: State.mediaRecorder.mimeType || 'audio/webm' });
      stream.getTracks().forEach(t => t.stop());
      // limite duracion: si grabaron mas de 6 segundos, advertir
      const dur = Date.now() - State.grabandoDesde;
      if (dur > 6000) toast('Audio largo: si suena mal, regraba mas corto');
      // a dataURL para guardar en IndexedDB
      const reader = new FileReader();
      reader.onload = () => {
        State.audioTemp = reader.result;
        State.mediaRecorder = null;
        actualizarUIAudio();
      };
      reader.readAsDataURL(blob);
    };
    State.mediaRecorder.start();
    actualizarUIAudio();
    // auto-stop a los 6 segundos por seguridad
    setTimeout(() => {
      if (State.mediaRecorder && State.mediaRecorder.state === 'recording') {
        detenerGrabacion();
      }
    }, 6000);
  } catch (e) {
    toast('Permiso de microfono denegado: ' + e.message);
  }
}

function detenerGrabacion(silencio) {
  if (State.mediaRecorder && State.mediaRecorder.state === 'recording') {
    State.mediaRecorder.stop();
  } else {
    State.mediaRecorder = null;
    actualizarUIAudio();
  }
}

function escucharAudio() {
  if (State.audioTemp) reproducirAudio(State.audioTemp);
}

function borrarAudio() {
  if (!confirm('Borrar audio grabado? El boton volvera a usar TTS.')) return;
  State.audioTemp = null;
  actualizarUIAudio();
}

/* ---------------------------------------------------------
   Cargar imagen desde archivo
   --------------------------------------------------------- */
function leerImagenDesdeInput(input) {
  return new Promise((resolve, reject) => {
    const file = input.files && input.files[0];
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = await redimensionarImagen(reader.result, 600);
        resolve(dataUrl);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function redimensionarImagen(dataUrl, maxLado) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxLado || height > maxLado) {
        const ratio = Math.min(maxLado / width, maxLado / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/* ---------------------------------------------------------
   Biblioteca (modal de seleccion)
   --------------------------------------------------------- */
function abrirBiblioteca() {
  renderBiblioteca();
  document.getElementById('modal-biblioteca').classList.remove('oculto');
}

function cerrarBiblioteca() {
  document.getElementById('modal-biblioteca').classList.add('oculto');
}

function renderBiblioteca() {
  const cont = document.getElementById('lista-biblioteca');
  cont.innerHTML = '';

  // set de palabras ya agregadas (para marcarlas)
  const yaUsadas = new Set(State.botones.map(b => b.palabra));

  for (const cat of CATEGORIAS) {
    const items = BIBLIOTECA.filter(b => b.cat === cat.id);
    if (items.length === 0) continue;

    const grupo = document.createElement('div');
    grupo.className = 'bib-grupo';
    grupo.innerHTML = `<h3 class="bib-titulo">${cat.label} <span class="bib-desc">${cat.desc}</span></h3>`;

    const grid = document.createElement('div');
    grid.className = 'bib-grid';

    for (const it of items) {
      const card = document.createElement('div');
      card.className = 'bib-card';
      card.style.background = it.color;
      if (yaUsadas.has(it.palabra)) card.classList.add('bib-usado');
      card.innerHTML = `
        <img src="${it.imagen}" alt="" />
        <div class="bib-label">${it.palabra}</div>
        ${yaUsadas.has(it.palabra) ? '<div class="bib-check">YA</div>' : ''}
      `;
      card.addEventListener('click', async () => {
        if (yaUsadas.has(it.palabra)) {
          toast('Ya esta en la pantalla de Mariano');
          return;
        }
        const dataUrl = await svgUrlToDataUrl(it.imagen);
        const orden = State.botones.length;
        await dbPut(STORE_BOTONES, {
          palabra: it.palabra,
          etiqueta: it.palabra,
          imagen: dataUrl,
          audio: null,
          color: it.color,
          orden,
          nivel: State.config.nivel,
        });
        await renderEdicion();
        renderBiblioteca();
        toast(`Agregado: ${it.palabra}`);
      });
      grid.appendChild(card);
    }

    grupo.appendChild(grid);
    cont.appendChild(grupo);
  }
}

/* ---------------------------------------------------------
   Export / Import JSON
   --------------------------------------------------------- */
async function exportarJSON() {
  const botones = await dbAll(STORE_BOTONES);
  const data = { app: 'hablaconmigo', version: 2, exportado: new Date().toISOString(), config: State.config, botones };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hablaconmigo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup descargado');
}

async function importarJSON(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.app !== 'hablaconmigo') throw new Error('Archivo no es de HablaConmigo');
    if (!Array.isArray(data.botones)) throw new Error('Falta lista de botones');
    if (!confirm(`Importar ${data.botones.length} botones? Esto reemplaza los actuales.`)) return;

    const actuales = await dbAll(STORE_BOTONES);
    for (const b of actuales) await dbDelete(STORE_BOTONES, b.id);
    for (const b of data.botones) {
      const copia = { ...b };
      delete copia.id;
      await dbPut(STORE_BOTONES, copia);
    }
    if (data.config) {
      for (const [k, v] of Object.entries(data.config)) await guardarConfig(k, v);
    }
    await renderEdicion();
    toast('Importado correctamente');
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

/* ---------------------------------------------------------
   Cambiar PIN
   --------------------------------------------------------- */
async function cambiarPin() {
  const nuevo = prompt('Nuevo PIN (4 digitos):');
  if (!nuevo) return;
  if (!/^\d{4}$/.test(nuevo)) { toast('PIN debe ser 4 digitos'); return; }
  await guardarConfig('pin', nuevo);
  toast('PIN actualizado');
}

/* ---------------------------------------------------------
   Toast
   --------------------------------------------------------- */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('oculto');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('oculto'), 2200);
}

/* ---------------------------------------------------------
   Bindings
   --------------------------------------------------------- */
function bindEventos() {
  // PIN
  document.querySelector('[data-action="confirmar-pin"]').addEventListener('click', confirmarPin);
  document.querySelector('[data-action="cancelar-pin"]').addEventListener('click', cerrarPin);
  document.getElementById('input-pin').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmarPin();
    if (e.key === 'Escape') cerrarPin();
  });

  // Volver a Mariano
  document.querySelector('[data-action="volver-mariano"]').addEventListener('click', () => mostrarVista('mariano'));

  // Nuevo boton + biblioteca
  document.querySelector('[data-action="nuevo-boton"]').addEventListener('click', () => abrirEditorBoton(null));
  document.querySelector('[data-action="abrir-biblioteca"]').addEventListener('click', abrirBiblioteca);
  document.querySelector('[data-action="cerrar-biblioteca"]').addEventListener('click', cerrarBiblioteca);

  // Modal boton
  document.querySelector('[data-action="cancelar-boton"]').addEventListener('click', cerrarEditorBoton);
  document.querySelector('[data-action="guardar-boton"]').addEventListener('click', guardarBoton);
  document.querySelector('[data-action="eliminar-boton"]').addEventListener('click', eliminarBoton);

  // Audio
  document.getElementById('btn-grabar').addEventListener('click', iniciarGrabacion);
  document.getElementById('btn-detener').addEventListener('click', () => detenerGrabacion());
  document.getElementById('btn-escuchar').addEventListener('click', escucharAudio);
  document.getElementById('btn-borrar-audio').addEventListener('click', borrarAudio);

  // Cargar imagen
  document.getElementById('input-imagen').addEventListener('change', async (e) => {
    const url = await leerImagenDesdeInput(e.target);
    if (url) {
      State.imagenTemp = url;
      document.getElementById('img-preview').src = url;
    }
    e.target.value = '';
  });
  document.getElementById('input-camara').addEventListener('change', async (e) => {
    const url = await leerImagenDesdeInput(e.target);
    if (url) {
      State.imagenTemp = url;
      document.getElementById('img-preview').src = url;
    }
    e.target.value = '';
  });

  // Colores
  document.querySelectorAll('.color').forEach(c => {
    c.addEventListener('click', () => {
      State.colorTemp = c.dataset.color;
      document.querySelectorAll('.color').forEach(x => x.classList.toggle('activo', x === c));
    });
  });

  // Config
  document.getElementById('select-nivel').addEventListener('change', async (e) => {
    await guardarConfig('nivel', parseInt(e.target.value, 10));
  });
  document.getElementById('select-columnas').addEventListener('change', async (e) => {
    await guardarConfig('columnas', parseInt(e.target.value, 10));
  });
  document.getElementById('select-voz').addEventListener('change', async (e) => {
    await guardarConfig('voz', e.target.value);
    cargarVoces();
  });
  document.getElementById('input-velocidad').addEventListener('change', async (e) => {
    await guardarConfig('velocidad', parseFloat(e.target.value));
  });

  // Probar voz
  document.querySelector('[data-action="probar-voz"]').addEventListener('click', () => {
    hablar('hola Mariano, esta es la voz que vas a usar');
  });

  // Exportar / importar
  document.querySelector('[data-action="exportar-json"]').addEventListener('click', exportarJSON);
  document.querySelector('[data-action="importar-json"]').addEventListener('click', () => {
    document.getElementById('input-importar').click();
  });
  document.getElementById('input-importar').addEventListener('change', async (e) => {
    if (e.target.files && e.target.files[0]) await importarJSON(e.target.files[0]);
    e.target.value = '';
  });

  // PIN
  document.querySelector('[data-action="cambiar-pin"]').addEventListener('click', cambiarPin);

  // Tap largo
  inicializarTapLargo();

  // Voces
  if ('speechSynthesis' in window) {
    cargarVoces();
    speechSynthesis.onvoiceschanged = cargarVoces;
  }
}

/* ---------------------------------------------------------
   Service worker
   --------------------------------------------------------- */
function registrarSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }
}

/* ---------------------------------------------------------
   Init
   --------------------------------------------------------- */
async function init() {
  try {
    State.db = await openDB();
    await cargarConfig();
    await seedSiHaceFalta();
    await migrarTildes();
    bindEventos();
    await mostrarVista('mariano');
    registrarSW();
  } catch (e) {
    console.error('Init error:', e);
    alert('Error inicializando la app: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', init);
