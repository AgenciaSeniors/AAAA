// js/script.js - Lógica Cliente (Corregido)

let todosLosProductos = [];
let productoActual = null;
let puntuacion = 0;
let searchTimeout;

document.addEventListener('DOMContentLoaded', () => {
    checkWelcome(); 
    cargarMenu();
    updateConnectionStatus();
    registrarServiceWorker(); // <--- NUEVA LÍNEA AGREGADA
});

// --- LÓGICA DE VISITAS Y BIENVENIDA ---
async function checkWelcome() {
    const clienteId = localStorage.getItem('cliente_id');
    const modal = document.getElementById('modal-welcome');

    if (clienteId) {
        // Usuario ya registrado: Ocultamos modal
        if (modal) modal.style.display = 'none';

        // LÓGICA DE VISITA RECURRENTE (SILENCIOSA)
        const ultimaVisita = localStorage.getItem('ultima_visita_ts');
        const ahora = Date.now();
        const HORAS_12 = 12 * 60 * 60 * 1000; // Cooldown de 12 horas

        if (!ultimaVisita || (ahora - parseInt(ultimaVisita)) > HORAS_12) {
            console.log("Registrando visita recurrente...");
            // Registramos visita sin molestar al usuario
            const { error } = await supabaseClient.from('visitas').insert([{
                cliente_id: clienteId,
                motivo: 'Regreso al Menú'
            }]);

            if (!error) {
                localStorage.setItem('ultima_visita_ts', ahora.toString());
            }
        }
    } else {
        // Usuario nuevo: Mostrar modal
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    }
}

// --- VALIDACIONES Y UTILIDADES ---

// Limpia el teléfono eliminando prefijos internacionales comunes en Cuba (+53)
function limpiarTelefono(input) {
    if (!input) return "";
    // Elimina todo lo que no sea un número (espacios, guiones, +, paréntesis)
    let limpio = input.replace(/\D/g, '');

    // Lógica inteligente para Cuba:
    // Si tiene 10 dígitos y empieza por 53 (ej: 5351234567), quitamos el prefijo
    if (limpio.length === 10 && limpio.startsWith('53')) {
        limpio = limpio.substring(2);
    }
    
    return limpio;
}

function validarEntradasRegistro(nombre, telefono) {
    // 1. Validar Nombre
    if (!nombre || nombre.length < 3) {
        showToast("El nombre debe tener al menos 3 letras.", "warning");
        return false;
    }
    
    // Regex: Solo permite letras (mayúsculas/minúsculas), acentos y espacios. No números ni símbolos.
    const nombreRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nombreRegex.test(nombre)) {
        showToast("El nombre solo puede contener letras.", "warning");
        return false;
    }

    // 2. Validar Teléfono (Cuba: 8 dígitos)
    // Asumimos que ya pasó por limpiarTelefono, así que esperamos 8 números.
    const telefonoRegex = /^\d{8}$/;
    
    if (!telefono) {
        showToast("El teléfono es obligatorio.", "warning");
        return false;
    }
    
    if (!telefonoRegex.test(telefono)) {
        showToast("Ingresa un número válido de 8 dígitos.", "warning");
        return false;
    }

    // Validación extra opcional: Móviles en Cuba suelen empezar por 5 o 6
    if (!['5', '6'].includes(telefono.charAt(0))) {
         // Puedes comentar esto si aceptas teléfonos fijos también
         showToast("El número parece no ser un móvil válido.", "info");
    }

    return true;
}

async function registrarBienvenida() {
    const inputNombre = document.getElementById('welcome-nombre');
    const inputPhone = document.getElementById('welcome-phone');
    const btn = document.querySelector('#modal-welcome button');

    // 1. Obtener y Limpiar valores
    const nombre = inputNombre.value ? inputNombre.value.trim() : '';
    const telefonoRaw = inputPhone.value ? inputPhone.value.trim() : '';
    const telefono = limpiarTelefono(telefonoRaw);

    // 2. Resetear estilos de error previos
    inputNombre.style.borderColor = "var(--neon-cyan)";
    inputPhone.style.borderColor = "var(--neon-cyan)";

    // 3. Ejecutar Validación
    if (!validarEntradasRegistro(nombre, telefono)) {
        // Identificar visualmente cuál falló para mejor UX
        if (!nombre || nombre.length < 3 || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombre)) {
            inputNombre.style.borderColor = "var(--neon-red)"; // Borde rojo si falla nombre
            inputNombre.focus();
        } else {
            inputPhone.style.borderColor = "var(--neon-red)"; // Borde rojo si falla teléfono
            inputPhone.focus();
        }
        return; // Detener ejecución si no valida
    }

    // 4. Procesar Registro (Si todo está OK)
    if(btn) { 
        btn.textContent = "Verificando..."; 
        btn.disabled = true; 
    }

    try {
        // Buscar o crear cliente (Tu lógica original de Supabase)
        let { data: cliente } = await supabaseClient
            .from('clientes')
            .select('id')
            .eq('telefono', telefono)
            .single();

        let clienteId = cliente ? cliente.id : null;

        if (!clienteId) {
            const { data: nuevo, error: errorInsert } = await supabaseClient
                .from('clientes')
                .insert([{ nombre, telefono }])
                .select()
                .single();
            
            if (errorInsert) throw errorInsert;
            clienteId = nuevo.id;
        }

        // Registrar primera visita
        await supabaseClient.from('visitas').insert([{
            cliente_id: clienteId,
            motivo: 'Ingreso Inicial'
        }]);

        // Guardar sesión local
        localStorage.setItem('cliente_id', clienteId);
        localStorage.setItem('cliente_nombre', nombre);
        localStorage.setItem('ultima_visita_ts', Date.now().toString());

        // Cerrar modal
        const modal = document.getElementById('modal-welcome');
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 400);
        
        showToast(`¡Hola de nuevo, ${nombre}!`, "success");

    } catch (err) {
        console.error("Error registro:", err);
        showToast("Error de conexión. Entrando como invitado...", "error");
        // Fallback para no bloquear al usuario
        setTimeout(() => {
             document.getElementById('modal-welcome').style.display = 'none';
        }, 1500);
    } finally {
        if(btn) { 
            btn.textContent = "ENTRAR"; 
            btn.disabled = false; 
        }
    }
}
// --- OPTIMIZACIÓN: PRECARGA DE IMÁGENES ---
function precargarImagenes(productos) {
    if (!productos || productos.length === 0) return;

    // Usamos 'requestIdleCallback' para no bloquear la interacción del usuario
    // Si el navegador no lo soporta, usamos setTimeout
    const ejecutarPrecarga = window.requestIdleCallback || ((cb) => setTimeout(cb, 1000));

    ejecutarPrecarga(() => {
        productos.forEach(prod => {
            if (prod.imagen_url) {
                // Creamos una imagen en memoria. Al asignar el src, el navegador
                // intenta descargarla. Nuestro nuevo SW interceptará esta petición
                // y guardará la imagen en caché silenciosamente.
                const img = new Image();
                img.src = prod.imagen_url;
            }
        });
        console.log(`📡 Iniciando precarga de ${productos.length} imágenes para modo offline.`);
    });
}

// --- MENÚ Y PRODUCTOS ---
async function cargarMenu() {
    const grid = document.getElementById('menu-grid');
    
    // 1. Cache First
    const menuCache = localStorage.getItem('menu_cache');
    if (menuCache) {
        todosLosProductos = JSON.parse(menuCache);
        renderizarMenu(todosLosProductos);
    } else {
        if(grid) grid.innerHTML = '<p style="text-align:center; color:#888; padding:40px;">Cargando carta...</p>';
    }

    // 2. Network Update
    try {
        if (typeof supabaseClient === 'undefined') throw new Error("Supabase no definido");

        let { data: productos, error } = await supabaseClient
            .from('productos')
            .select(`*, opiniones(puntuacion)`)
            .eq('activo', true)
            .order('destacado', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;

        // Calcular ratings
        const productosProcesados = productos.map(prod => {
            const opiniones = prod.opiniones || [];
            const total = opiniones.length;
            const suma = opiniones.reduce((acc, curr) => acc + curr.puntuacion, 0);
            prod.ratingPromedio = total ? (suma / total).toFixed(1) : null;
            return prod;
        });

        localStorage.setItem('menu_cache', JSON.stringify(productosProcesados));
        todosLosProductos = productosProcesados;
        renderizarMenu(todosLosProductos);
        precargarImagenes(productosProcesados);

    } catch (err) {
        console.warn("Offline o error:", err);
        if(!menuCache && grid) grid.innerHTML = '<div style="text-align:center; padding:30px;">📡 Sin conexión. Intenta recargar.</div>';
    }
}

function renderizarMenu(lista) {
    const contenedor = document.getElementById('menu-grid');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (!lista || lista.length === 0) {
        contenedor.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;"><h4>Carta Vacía</h4></div>';
        return;
    }

    const html = lista.map(item => {
        const esAgotado = item.estado === 'agotado';
        let badgeHTML = '';
        
        if (esAgotado) badgeHTML = `<span class="badge-agotado" style="color:var(--neon-red); border:1px solid var(--neon-red);">AGOTADO</span>`;
        else if (item.destacado) badgeHTML = `<span class="badge-destacado">🔥 HOT</span>`;

        const img = item.imagen_url || 'https://via.placeholder.com/300x300?text=Sin+Imagen';
        const rating = item.ratingPromedio ? `★ ${item.ratingPromedio}` : '';
        const accionClick = esAgotado ? '' : `onclick="abrirDetalle(${item.id})"`;
        const claseAgotado = esAgotado ? 'agotado' : '';

        return `
            <div class="card ${claseAgotado}" ${accionClick}>
                ${badgeHTML}
                <div class="img-box"><img src="${img}" loading="lazy" alt="${item.nombre}"></div>
                <div class="info">
                    <h3>${item.nombre}</h3>
                    <p class="short-desc">${item.descripcion || ''}</p>
                    <div class="card-footer">
                         <span class="price">$${item.precio}</span>
                         <span class="rating-pill">${rating}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    contenedor.innerHTML = html;
}

// --- BÚSQUEDA Y FILTROS ---
const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const term = normalizarTexto(e.target.value); // <--- USAR AQUÍ
        // 2. Si el usuario borró todo, restauramos el menú completo inmediatamente
        if (term.length === 0) {
            renderizarMenu(todosLosProductos);
            return;
        }
        // 3. OPTIMIZACIÓN: Si escribe menos de 2 letras, NO hacemos nada.
        if (term.length < 2) return;
        // 4. Si pasa las validaciones, esperamos 300ms antes de filtrar
        searchTimeout = setTimeout(() => {
            const lista = todosLosProductos.filter(p => 
                normalizarTexto(p.nombre).includes(term) || // <--- USAR AQUÍ
                normalizarTexto(p.descripcion).includes(term) // <--- USAR AQUÍ
            );
            renderizarMenu(lista);
        }, 300);
    });
}


function filtrar(cat, btn) {
    // 1. Gestión visual de los botones
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    
    // 2. Limpiar barra de búsqueda si se usa un filtro
    if(searchInput) searchInput.value = '';
    
    // 3. Normalizar la categoría seleccionada (ej: "Cócteles" -> "cocteles")
    const catFiltro = normalizarTexto(cat);

    // 4. Filtrado inteligente
    const lista = catFiltro === 'todos' 
        ? todosLosProductos 
        : todosLosProductos.filter(p => {
            // Normalizamos la categoría que viene de la Base de Datos
            const catProd = normalizarTexto(p.categoria);
            
            // Ahora "Cócteles" (BD) será igual a "cocteles" (Botón)
            return catProd === catFiltro;
        });

    renderizarMenu(lista);
}

// --- DETALLES Y OPINIONES ---
function abrirDetalle(id) {
    productoActual = todosLosProductos.find(p => p.id === id);
    if (!productoActual) return;

    const imgEl = document.getElementById('det-img');
    if(imgEl) imgEl.src = productoActual.imagen_url || '';
    
    setText('det-titulo', productoActual.nombre);
    setText('det-desc', productoActual.descripcion);
    setText('det-precio', `$${productoActual.precio}`);
    setText('det-rating-big', productoActual.ratingPromedio ? `★ ${productoActual.ratingPromedio}` : '★ --');

    const box = document.getElementById('box-curiosidad');
    if (productoActual.curiosidad && productoActual.curiosidad.length > 5) {
        if(box) box.style.display = "block";
        setText('det-curiosidad', productoActual.curiosidad);
    } else {
        if(box) box.style.display = "none";
    }
    
    const modal = document.getElementById('modal-detalle');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function cerrarDetalle() {
    const modal = document.getElementById('modal-detalle');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 350);
}

function abrirOpinionDesdeDetalle() {
    cerrarDetalle();
    const modal = document.getElementById('modal-opinion');
    setTimeout(() => {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        
        const nombreGuardado = localStorage.getItem('cliente_nombre');
        const inputNombre = document.getElementById('cliente-nombre');
        if(nombreGuardado && inputNombre) inputNombre.value = nombreGuardado;

        puntuacion = 0;
        actualizarEstrellas();
    }, 300);
}

function cerrarModalOpiniones() {
    const modal = document.getElementById('modal-opinion');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 350);
}

// Estrellas
const starsContainer = document.getElementById('stars-container');
if(starsContainer) {
    starsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
            puntuacion = parseInt(e.target.dataset.val);
            actualizarEstrellas();
        }
    });
}

function actualizarEstrellas() {
    document.querySelectorAll('#stars-container span').forEach(s => {
        const val = parseInt(s.dataset.val);
        s.style.color = val <= puntuacion ? 'var(--gold)' : '#444';
        s.textContent = val <= puntuacion ? '★' : '☆';
    });
}

async function enviarOpinion() {
    if (puntuacion === 0) { showToast("¡Marca las estrellas!", "warning"); return; }

    // CORRECCIÓN: Clave única por producto
    const LAST_OPINION = `last_opinion_ts_${productoActual.id}`; 
    
    const lastTime = localStorage.getItem(LAST_OPINION);
    const ahora = Date.now();
    
    // Cooldown de 12 horas
    if (lastTime && (ahora - parseInt(lastTime)) < 12 * 60 * 60 * 1000) {
        showToast("Ya opinaste sobre esto hoy.", "warning"); // Mensaje más claro
        return;
    }

    const nombre = document.getElementById('cliente-nombre').value || "Anónimo";
    const comentario = document.getElementById('cliente-comentario').value;
    const btn = document.querySelector('#modal-opinion .btn-big-action');

    if(btn) { btn.textContent = "Enviando..."; btn.disabled = true; }

    const { error } = await supabaseClient.from('opiniones').insert([{
        producto_id: productoActual.id,
        cliente_nombre: nombre,
        comentario: comentario, 
        puntuacion: puntuacion
    }]);

    if (!error) {
        localStorage.setItem(LAST_OPINION, ahora.toString());
        showToast("¡Gracias por tu opinión!", "success");
        cerrarModalOpiniones();
        document.getElementById('cliente-comentario').value = "";
        cargarMenu();
    } else {
        showToast("Error: " + error.message, "error");
    }
    
    if(btn) { btn.textContent = "ENVIAR"; btn.disabled = false; }
}

// --- UTILIDADES ---
function setText(id, val) { const el = document.getElementById(id); if(el) el.textContent = val; }

function showToast(msg, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const t = document.createElement('div');
    t.className = `toast ${tipo}`;
    t.innerHTML = `<span class="toast-msg">${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.style.animation = 'fadeOut 0.4s forwards'; setTimeout(() => t.remove(), 400); }, 3000);
}

function updateConnectionStatus() {
    const el = document.getElementById('connection-status');
    const dot = document.getElementById('status-dot');
    if (!el) return;
    if (navigator.onLine) {
        el.textContent = "Conectado"; el.style.color = "var(--green-success)";
        if(dot) dot.style.backgroundColor = "var(--green-success)";
    } else {
        el.textContent = "Offline"; el.style.color = "var(--neon-red)";
        if(dot) dot.style.backgroundColor = "var(--neon-red)";
    }
}

window.addEventListener('online', () => { updateConnectionStatus(); showToast("Conexión restaurada"); cargarMenu(); });
window.addEventListener('offline', () => { updateConnectionStatus(); showToast("Modo Offline", "warning"); });

// ==========================================
// 🌪️ SHAKER VIRTUAL (Mixer IA)
// ==========================================

const ESENCIAS = [
    { id: 'fresco', icono: '🧊', nombre: 'Fresco' },
    { id: 'dulce', icono: '🍬', nombre: 'Dulce' },
    { id: 'fuerte', icono: '🔥', nombre: 'Potente' },
    { id: 'frutal', icono: '🍍', nombre: 'Frutal' },
    { id: 'amargo', icono: '🍋', nombre: 'Ácido' },
    { id: 'party', icono: '🎉', nombre: 'Fiesta' }
];

let shakerState = {
    seleccionados: [],
    isShaking: false,
    shakeCount: 0
};

let watchID = null; // Para el acelerómetro

function abrirShaker() {
    const modal = document.getElementById('modal-shaker');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Reiniciar estado
    shakerState.seleccionados = [];
    renderizarEsencias();
    actualizarEstadoShaker();
    iniciarDetectorMovimiento();
}

function cerrarShaker() {
    const modal = document.getElementById('modal-shaker');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
    detenerDetectorMovimiento();
}

function renderizarEsencias() {
    const grid = document.getElementById('essences-grid');
    grid.innerHTML = '';
    
    ESENCIAS.forEach(esencia => {
        const btn = document.createElement('div');
        btn.className = 'essence-btn';
        btn.innerHTML = `<span>${esencia.icono}</span><small>${esencia.nombre}</small>`;
        btn.onclick = () => toggleEsencia(esencia, btn);
        grid.appendChild(btn);
    });
}

function toggleEsencia(esencia, btnElement) {
    const index = shakerState.seleccionados.indexOf(esencia.nombre);
    
    if (index > -1) {
        // Deseleccionar
        shakerState.seleccionados.splice(index, 1);
        btnElement.classList.remove('selected');
    } else {
        // Seleccionar (Máximo 3)
        if (shakerState.seleccionados.length < 3) {
            shakerState.seleccionados.push(esencia.nombre);
            btnElement.classList.add('selected');
        } else {
            showToast("Máximo 3 ingredientes", "warning");
        }
    }
    actualizarEstadoShaker();
}

function actualizarEstadoShaker() {
    const count = shakerState.seleccionados.length;
    const visual = document.getElementById('shaker-img');
    const status = document.getElementById('shaker-status');
    const btn = document.getElementById('btn-mix-manual');
    const icon = visual.querySelector('.material-icons');

    if (count === 0) {
        status.textContent = "Añade ingredientes...";
        visual.classList.remove('ready');
        icon.style.color = "#ccc";
        btn.disabled = true;
        btn.style.opacity = "0.5";
    } else {
        status.textContent = `${count}/3 Ingredientes`;
        icon.style.color = "white";
        
        if (count >= 1) { // Mínimo 1 para mezclar
            visual.classList.add('ready');
            status.textContent = "¡Agita tu móvil o pulsa el botón!";
            status.style.color = "var(--gold)";
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
}

// --- DETECTOR DE AGITACIÓN (SHAKE) ---
// --- DETECTOR DE AGITACIÓN (SHAKE) ---
function iniciarDetectorMovimiento() {
    // Si ya hay un listener activo, no hacemos nada
    if (watchID) return;

    // Lógica del evento (definimos la función internamente para capturar variables)
    const umbral = 15; 
    let lastX = 0, lastY = 0, lastZ = 0;

    const handleMotion = (event) => {
        // Si ya estamos procesando, ignorar
        if (shakerState.isProcessing) return; 
        // Si no hay suficientes ingredientes, ignorar
        if (shakerState.seleccionados.length === 0) return;

        // Soporte cruzado para aceleración (algunos navegadores usan accelerationIncludingGravity)
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc) return;

        const deltaX = Math.abs(acc.x - lastX);
        const deltaY = Math.abs(acc.y - lastY);
        const deltaZ = Math.abs(acc.z - lastZ);

        if (deltaX + deltaY + deltaZ > umbral) {
            shakerState.shakeCount++;
            const imgShaker = document.getElementById('shaker-img');
            if(imgShaker) imgShaker.classList.add('shaking');
            
            // Necesita agitarse un poco, no solo un golpe accidental
            if (shakerState.shakeCount > 5) {
                procesarMezcla();
                shakerState.shakeCount = 0; // Reset
            }
            
            // Quitar clase shaking después de un momento
            clearTimeout(shakerState.shakeTimer);
            shakerState.shakeTimer = setTimeout(() => {
                if(imgShaker) imgShaker.classList.remove('shaking');
            }, 300);
        }

        lastX = acc.x;
        lastY = acc.y;
        lastZ = acc.z;
    };

    // --- SOLUCIÓN IOS 13+ ---
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        // Es un iPhone/iPad con iOS 13+
        DeviceMotionEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('devicemotion', handleMotion, true);
                    watchID = handleMotion; // Guardamos la referencia
                } else {
                    showToast("Debes permitir el movimiento para usar el Shaker.", "warning");
                }
            })
            .catch(console.error); // Captura errores (ej. si no es HTTPS)
    } else {
        // Es Android o iOS antiguo (no requiere permiso explícito)
        window.addEventListener('devicemotion', handleMotion, true);
        watchID = handleMotion;
    }
}


function detenerDetectorMovimiento() {
    if (watchID) {
        window.removeEventListener('devicemotion', watchID, true);
        watchID = null;
    }
}

async function procesarMezcla() {
    // 1. Evitar dobles clics
    if (shakerState.isProcessing) return;
    shakerState.isProcessing = true;
    detenerDetectorMovimiento(); 

    // 2. Feedback Visual simple
    const btn = document.getElementById('btn-mix-manual');
    const status = document.getElementById('shaker-status');
    const visual = document.getElementById('shaker-img');
    
    btn.textContent = "Mezclando...";
    btn.disabled = true;
    status.textContent = "Preparando tu recomendación...";
    visual.classList.add('shaking');

    // 3. URL de tu Script de Google (Asegúrate que sea la última versión implementada)
    const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbzzXvv1KtxUpBZVNfkhkZ6rI4iQEfk8SXHOgHeAa4jdH6-lLfKE-wswfMXtfaoeVMJC/exec";

    try {
        const response = await fetch(URL_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({
                sabor: shakerState.seleccionados.join(', ')
            }),
            headers: { "Content-Type": "text/plain" }
        });

        const data = await response.json();
        
        if (data.success && data.recomendacion) {
            // CAMBIO AQUÍ: Eliminamos el showToast de la justificación.
            // La IA elige silenciosamente y solo mostramos el producto.
            
            mostrarResultadoShaker(data.recomendacion);
            status.textContent = "¡Listo!";
        } else {
            throw new Error(data.error || "Respuesta inválida");
        }

    } catch (error) {
        console.error("Error silencioso:", error);
        
        // Fallback: Si algo falla, mostramos uno al azar sin asustar al usuario
        const destacados = todosLosProductos.filter(p => p.destacado && p.estado !== 'agotado');
        const pool = destacados.length > 0 ? destacados : todosLosProductos;
        
        if (pool.length > 0) {
            const random = pool[Math.floor(Math.random() * pool.length)];
            mostrarResultadoShaker(random.nombre);
        }
    } finally {
        shakerState.isProcessing = false;
        visual.classList.remove('shaking');
        btn.textContent = "¡MEZCLAR DE NUEVO!";
        btn.disabled = false;
    }
}
function mostrarResultadoShaker(nombreRecibido) {
    // Protección inicial: si nombreRecibido es null/undefined, asignamos cadena vacía
    const nombreIA = (nombreRecibido || '').toLowerCase().trim();

    // 1. Encontrar TODOS los posibles candidatos
    const candidatos = todosLosProductos.filter(p => {
        // CORRECCIÓN DEL BUG:
        // Usamos (p.nombre || '') para asegurar que siempre haya un string antes de toLowerCase()
        const nombreBD = (p.nombre || '').toLowerCase();
        
        // Evitamos comparar si alguno de los dos está vacío para no traer falsos positivos
        if (!nombreBD || !nombreIA) return false;

        return nombreBD.includes(nombreIA) || nombreIA.includes(nombreBD);
    });

    cerrarShaker();

    let elegido = null;

    if (candidatos.length > 0) {
        // 2. Elegir uno al azar de los candidatos encontrados
        const indiceAleatorio = Math.floor(Math.random() * candidatos.length);
        elegido = candidatos[indiceAleatorio];
        showToast(`✨ Combinación perfecta: ${elegido.nombre}`);
    } else {
        // 3. Fallback Aleatorio
        const destacados = todosLosProductos.filter(p => p.destacado);
        const pool = destacados.length > 0 ? destacados : todosLosProductos;
        
        // Protección extra por si pool está vacío
        if (pool.length > 0) {
            const indiceFallback = Math.floor(Math.random() * pool.length);
            elegido = pool[indiceFallback];
            showToast("¡Sorpresa! Prueba nuestra recomendación de la casa", "info");
        }
    }

    if (elegido) {
        abrirDetalle(elegido.id);
    }
    
    // Aseguramos que se libere el estado de procesamiento
    shakerState.isProcessing = false;
}

function cerrarWelcome() {
    const modal = document.getElementById('modal-welcome');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 400);
        
        // Opcional: Registrar que lo cerró para no mostrarlo de nuevo en esta sesión
        localStorage.setItem('ultima_visita_ts', Date.now().toString());
    }
}

// --- REGISTRO DE SERVICE WORKER (PWA) ---
function registrarServiceWorker() {
    // Comprobamos si el navegador soporta Service Workers
    if ('serviceWorker' in navigator) {
        // Registramos el archivo sw.js que está en la raíz
        // Nota: Usamos './sw.js' porque el path es relativo al index.html
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registrado con éxito:', registration.scope);
            })
            .catch(error => {
                console.log('Fallo al registrar Service Worker:', error);
            });
    }
}

function normalizarTexto(texto) {
    return (texto || '')           // Protegemos contra null/undefined
        .toLowerCase()             // A minúsculas
        .normalize("NFD")          // Descompone letras de sus acentos (ó -> o + ´)
        .replace(/[\u0300-\u036f]/g, "") // Elimina los acentos separados
        .trim();                   // Quita espacios extra
}