// js/script.js - Lógica Cliente (Corregido)

let todosLosProductos = [];
let productoActual = null;
let puntuacion = 0;
let searchTimeout;

document.addEventListener('DOMContentLoaded', () => {
    checkWelcome(); // Lógica de visitas mejorada
    cargarMenu();
    updateConnectionStatus();
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

function limpiarTelefono(input) {
    if (!input) return "";
    let limpio = input.replace(/\D/g, '');
    if (limpio.length === 10 && limpio.startsWith('53')) limpio = limpio.substring(2);
    return limpio;
}

async function registrarBienvenida() {
    const inputNombre = document.getElementById('welcome-nombre');
    const inputPhone = document.getElementById('welcome-phone');
    const btn = document.querySelector('#modal-welcome button');

    const nombre = inputNombre.value ? inputNombre.value.trim() : '';
    const telefono = limpiarTelefono(inputPhone.value);

    if (!nombre || !telefono || telefono.length < 8) {
        showToast("Nombre y teléfono (8 dígitos) requeridos.", "warning");
        return;
    }

    if(btn) { btn.textContent = "Entrando..."; btn.disabled = true; }

    try {
        // Buscar o crear cliente
        let { data: cliente } = await supabaseClient
            .from('clientes')
            .select('id')
            .eq('telefono', telefono)
            .single();

        let clienteId = cliente ? cliente.id : null;

        if (!clienteId) {
            const { data: nuevo } = await supabaseClient
                .from('clientes')
                .insert([{ nombre, telefono }])
                .select()
                .single();
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
        showToast(`¡Bienvenido, ${nombre}!`, "success");

    } catch (err) {
        console.error("Error registro:", err);
        // En caso de error (ej. offline), permitimos pasar
        document.getElementById('modal-welcome').style.display = 'none';
    } finally {
        if(btn) { btn.textContent = "INGRESAR"; btn.disabled = false; }
    }
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
        const term = e.target.value.toLowerCase();
        searchTimeout = setTimeout(() => {
            const lista = todosLosProductos.filter(p => 
                (p.nombre || '').toLowerCase().includes(term) || 
                (p.descripcion || '').toLowerCase().includes(term) // Corrección Crash por null
            );
            renderizarMenu(lista);
        }, 300);
    });
}

function filtrar(cat, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    if(searchInput) searchInput.value = '';
    
    const catNormalizada = cat.toLowerCase().trim();

    const lista = catNormalizada === 'todos' 
        ? todosLosProductos 
        : todosLosProductos.filter(p => {
            // Protección contra null y normalización
            const catProd = (p.categoria || '').toLowerCase().trim(); 
            return catProd === catNormalizada;
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
function iniciarDetectorMovimiento() {
    if (watchID) {
            window.removeEventListener('devicemotion', watchID, true);
        }
        // Umbral de sensibilidad
        const umbral = 15; 
        let lastX = 0, lastY = 0, lastZ = 0;

        const handleMotion = (event) => {
            // Si ya estamos procesando, ignorar
            if (shakerState.isProcessing) return; 
            // Si no hay suficientes ingredientes, ignorar
            if (shakerState.seleccionados.length === 0) return;

            const acc = event.accelerationIncludingGravity;
            if (!acc) return;

            const deltaX = Math.abs(acc.x - lastX);
            const deltaY = Math.abs(acc.y - lastY);
            const deltaZ = Math.abs(acc.z - lastZ);

            if (deltaX + deltaY + deltaZ > umbral) {
                shakerState.shakeCount++;
                document.getElementById('shaker-img').classList.add('shaking');
                
                // Necesita agitarse un poco, no solo un golpe accidental
                if (shakerState.shakeCount > 5) {
                    procesarMezcla();
                    shakerState.shakeCount = 0; // Reset
                }
                
                // Quitar clase shaking después de un momento
                clearTimeout(shakerState.shakeTimer);
                shakerState.shakeTimer = setTimeout(() => {
                    document.getElementById('shaker-img').classList.remove('shaking');
                }, 300);
            }

            lastX = acc.x;
            lastY = acc.y;
            lastZ = acc.z;
        };
        
        window.addEventListener('devicemotion', handleMotion, true);
        watchID = handleMotion; // Guardar referencia para quitarlo luego
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
    detenerDetectorMovimiento(); // Parar el acelerómetro para ahorrar batería

    // 2. Feedback Visual para el usuario
    const btn = document.getElementById('btn-mix-manual');
    const status = document.getElementById('shaker-status');
    const visual = document.getElementById('shaker-img');
    
    btn.textContent = "Analizando sabores...";
    btn.disabled = true;
    status.textContent = "🧠 El Sommelier IA está pensando...";
    visual.classList.add('shaking'); // Inicia animación

    // 3. Configuración de la petición
    // NOTA: Asegúrate de que esta URL sea la de tu nuevo script desplegado
    const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbzyKZwIp4_3i1PNn0awo7hV7Ww6LpF9JLA9B831yPrnOtJz4ZoXwr_3FleVdUEVyaw4/exec";

    try {
        // Hacemos la petición a Google Apps Script
        const response = await fetch(URL_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({
                // Solo enviamos los sabores elegidos. 
                // La IA ya tiene acceso directo a Supabase para ver el inventario real.
                sabor: shakerState.seleccionados.join(', ') 
            }),
            headers: { "Content-Type": "text/plain" } // Evita errores de CORS (preflight)
        });

        const data = await response.json();
        
        // 4. Manejo de la Respuesta Inteligente
        if (data.success && data.recomendacion) {
            // Si Groq nos da una justificación ("Elegí este porque..."), la mostramos
            if (data.justificacion) {
                showToast(`💡 ${data.justificacion}`, "info");
            }
            
            // Llamamos a tu función existente para mostrar el producto
            // Importante: data.recomendacion debe ser el nombre exacto del producto
            mostrarResultadoShaker(data.recomendacion);
            
            status.textContent = "¡Recomendación lista!";
        } else {
            throw new Error(data.error || "Respuesta inválida de la IA");
        }

    } catch (error) {
        console.error("Error en Shaker IA:", error);
        
        // 5. Fallback Local (Plan B)
        // Si falla la IA o internet, no dejamos al usuario esperando: elegimos uno local al azar
        showToast("Conexión lenta... Usando recomendación de la casa", "warning");
        
        const destacados = todosLosProductos.filter(p => p.destacado && p.estado !== 'agotado');
        const pool = destacados.length > 0 ? destacados : todosLosProductos;
        
        if (pool.length > 0) {
            const random = pool[Math.floor(Math.random() * pool.length)];
            mostrarResultadoShaker(random.nombre);
        } else {
            status.textContent = "No hay productos disponibles.";
        }

    } finally {
        // 6. Limpieza final
        shakerState.isProcessing = false;
        visual.classList.remove('shaking');
        btn.textContent = "¡MEZCLAR OTRA VEZ!";
        btn.disabled = false;
    }
}

function mostrarResultadoShaker(nombreRecibido) {
    const nombreIA = nombreRecibido.toLowerCase().trim();

    // 1. Encontrar TODOS los posibles candidatos, no solo el primero
    const candidatos = todosLosProductos.filter(p => {
        const nombreBD = p.nombre.toLowerCase();
        return nombreBD.includes(nombreIA) || nombreIA.includes(nombreBD);
    });

    cerrarShaker();

    let elegido = null;

    if (candidatos.length > 0) {
        // 2. Elegir uno al azar de los candidatos encontrados (rompe el sesgo del orden)
        const indiceAleatorio = Math.floor(Math.random() * candidatos.length);
        elegido = candidatos[indiceAleatorio];
        showToast(`✨ Combinación perfecta: ${elegido.nombre}`);
    } else {
        // 3. Fallback Aleatorio (Antes siempre elegía el mismo destacado)
        const destacados = todosLosProductos.filter(p => p.destacado);
        const pool = destacados.length > 0 ? destacados : todosLosProductos;
        
        const indiceFallback = Math.floor(Math.random() * pool.length);
        elegido = pool[indiceFallback];
        
        showToast("¡Sorpresa! Prueba nuestra recomendación de la casa", "info");
    }

    if (elegido) {
        abrirDetalle(elegido.id);
    }
    
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