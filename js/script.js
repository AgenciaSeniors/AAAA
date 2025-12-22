// js/script.js - Lógica Cliente (Refactorizado con AppStore)

// --- GESTIÓN DE ESTADO CENTRALIZADO (STORE) ---
const AppStore = {
    state: {
        products: [],
        activeProduct: null,
        reviewScore: 0,
        searchTimeout: null,
        shaker: {
            selected: [],
            isProcessing: false,
            shakeCount: 0,
            shakeTimer: null
        }
    },

    setProducts(list) { this.state.products = list; },
    getProducts() { return this.state.products; },
    
    setActiveProduct(product) { 
        this.state.activeProduct = product;
        this.state.reviewScore = 0; // Reset score
    },

    setReviewScore(score) { this.state.reviewScore = score; },

    // Helpers del Shaker
    getShakerState() { return this.state.shaker; },
    resetShaker() {
        this.state.shaker.selected = [];
        this.state.shaker.isProcessing = false;
        this.state.shaker.shakeCount = 0;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    checkWelcome(); 
    cargarMenu();
    updateConnectionStatus();
    registrarServiceWorker();
    loadDynamicHero();
});
// 1. Detectar Contexto del Usuario
async function getUserContext() {
    const ahora = new Date();
    const hora = ahora.getHours() + ":" + ahora.getMinutes();
    
    // Simulación de clima (Para producción usarías una API como OpenWeather)
    // Aquí asumimos calor si es de día en Cuba, fresco si es de noche
    const esDeDia = ahora.getHours() > 8 && ahora.getHours() < 19;
    const temperatura = esDeDia ? 32 : 24; 

    return { hora, temperatura };
}
// --- LÓGICA DE VISITAS Y BIENVENIDA ---
// --- LÓGICA DE VISITAS Y BIENVENIDA (MODO PRUEBA: 10 SEGUNDOS) ---
async function checkWelcome() {
    const clienteId = localStorage.getItem('cliente_id');
    const modal = document.getElementById('modal-welcome');

    if (clienteId) {
        // CASO 1: CLIENTE QUE REGRESA
        if (modal) modal.style.display = 'none';

        const nombreGuardado = localStorage.getItem('cliente_nombre') || 'Amigo';
        
        // Mensaje de bienvenida visual
        setTimeout(() => {
            showToast(`¡Qué bueno verte de nuevo, ${nombreGuardado}! 🍹`, "success");
        }, 1500);

        // Lógica de registro en base de datos (MODIFICADO PARA PRUEBAS)
        const ultimaVisita = localStorage.getItem('ultima_visita_ts');
        const ahora = Date.now();
        
        // CAMBIO AQUÍ: 10 segundos en lugar de 12 horas
        const TIEMPO_ESPERA = 10 * 1000; // 10 segundos * 1000 ms

        if (!ultimaVisita || (ahora - parseInt(ultimaVisita)) > TIEMPO_ESPERA) {
            console.log("Registrando visita recurrente (Prueba 10s)...");
            
            if (typeof supabaseClient !== 'undefined') {
                const { error } = await supabaseClient.from('visitas').insert([{
                    cliente_id: clienteId,
                    motivo: 'Regreso al Menú'
                }]);

                if (!error) {
                    localStorage.setItem('ultima_visita_ts', ahora.toString());
                }
            }
        }
    } else {
        // CASO 2: CLIENTE NUEVO
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    }
}

function limpiarTelefono(input) {
    if (!input) return "";
    let limpio = input.replace(/\D/g, '');
    if (limpio.length === 10 && limpio.startsWith('53')) {
        limpio = limpio.substring(2);
    }
    return limpio;
}

function validarEntradasRegistro(nombre, telefono) {
    if (!nombre || nombre.length < 3) {
        showToast("El nombre debe tener al menos 3 letras.", "warning");
        return false;
    }
    const nombreRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nombreRegex.test(nombre)) {
        showToast("El nombre solo puede contener letras.", "warning");
        return false;
    }
    const telefonoRegex = /^\d{8}$/;
    if (!telefono) {
        showToast("El teléfono es obligatorio.", "warning");
        return false;
    }
    if (!telefonoRegex.test(telefono)) {
        showToast("Ingresa un número válido de 8 dígitos.", "warning");
        return false;
    }
    return true;
}

async function registrarBienvenida() {
    const inputNombre = document.getElementById('welcome-nombre');
    const inputPhone = document.getElementById('welcome-phone');
    const btn = document.querySelector('#modal-welcome button.btn-modal-action');

    const nombre = inputNombre.value ? inputNombre.value.trim() : '';
    const telefonoRaw = inputPhone.value ? inputPhone.value.trim() : '';
    const telefono = limpiarTelefono(telefonoRaw);

    inputNombre.style.borderColor = "var(--neon-cyan)";
    inputPhone.style.borderColor = "var(--neon-cyan)";

    if (!validarEntradasRegistro(nombre, telefono)) {
        if (!nombre || nombre.length < 3 || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombre)) {
            inputNombre.style.borderColor = "var(--neon-red)";
            inputNombre.focus();
        } else {
            inputPhone.style.borderColor = "var(--neon-red)";
            inputPhone.focus();
        }
        return;
    }

    if(btn) { btn.textContent = "Verificando..."; btn.disabled = true; }

    try {
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

        await supabaseClient.from('visitas').insert([{
            cliente_id: clienteId,
            motivo: 'Ingreso Inicial'
        }]);

        localStorage.setItem('cliente_id', clienteId);
        localStorage.setItem('cliente_nombre', nombre);
        localStorage.setItem('ultima_visita_ts', Date.now().toString());

        cerrarWelcome();
        showToast(`¡Hola de nuevo, ${nombre}!`, "success");

    } catch (err) {
        console.error("Error registro:", err);
        showToast("Error de conexión. Entrando como invitado...", "error");
        setTimeout(() => cerrarWelcome(), 1500);
    } finally {
        if(btn) { btn.textContent = "ENTRAR"; btn.disabled = false; }
    }
}

function cerrarWelcome() {
    const modal = document.getElementById('modal-welcome');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 400);
        localStorage.setItem('ultima_visita_ts', Date.now().toString());
    }
}

// --- PRECARGA ---
function precargarImagenes(productos) {
    if (!productos || productos.length === 0) return;
    const ejecutarPrecarga = window.requestIdleCallback || ((cb) => setTimeout(cb, 1000));
    ejecutarPrecarga(() => {
        productos.forEach(prod => {
            if (prod.imagen_url) {
                const img = new Image();
                img.src = prod.imagen_url;
            }
        });
        console.log(`📡 Iniciando precarga de ${productos.length} imágenes.`);
    });
}

// --- MENÚ Y PRODUCTOS ---
async function cargarMenu() {
    const grid = document.getElementById('menu-grid');
    
    // Cache First
    const menuCache = localStorage.getItem('menu_cache');
    if (menuCache) {
        AppStore.setProducts(JSON.parse(menuCache));
        renderizarMenu(AppStore.getProducts());
    } else {
        if(grid) grid.innerHTML = '<p style="text-align:center; color:#888; padding:40px;">Cargando carta...</p>';
    }

    try {
        if (typeof supabaseClient === 'undefined') throw new Error("Supabase no definido");

        let { data: productos, error } = await supabaseClient
            .from('productos')
            .select(`*, opiniones(puntuacion)`)
            .eq('activo', true)
            .order('destacado', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;

        const productosProcesados = productos.map(prod => {
            const opiniones = prod.opiniones || [];
            const total = opiniones.length;
            const suma = opiniones.reduce((acc, curr) => acc + curr.puntuacion, 0);
            prod.ratingPromedio = total ? (suma / total).toFixed(1) : null;
            return prod;
        });

        localStorage.setItem('menu_cache', JSON.stringify(productosProcesados));
        AppStore.setProducts(productosProcesados);
        
        renderizarMenu(productosProcesados);
        precargarImagenes(productosProcesados);

    } catch (err) {
        console.warn("Offline o error:", err);
        if(!menuCache && grid) grid.innerHTML = '<div style="text-align:center; padding:30px;">📡 Sin conexión. Intenta recargar.</div>';
    }
}

// --- RENDERIZADO POR SECCIONES (TIPO INSTAGRAM/UBER EATS) ---

function renderizarMenu(lista) {
    const contenedor = document.getElementById('menu-grid');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (!lista || lista.length === 0) {
        contenedor.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;"><h4>No hay resultados</h4></div>';
        return;
    }

    // 1. Mapa de Categorías
    const nombresCat = {
        'cocteles': 'Cócteles de la Casa 🍸',
        'cervezas': 'Cervezas Frías 🍺',
        'licores': 'Vinos y Licores 🍷',
        'tapas': 'Para Picar 🍟',          // <--- Subimos la comida
        'italiana': 'Pizzas y Pastas 🍕',   // <--- Comida principal
        'fuertes': 'Platos Fuertes 🍽️',    // <--- Comida fuerte
        'bebidas_sin': 'Refrescos y Jugos 🥤', // <--- S/ Alcohol al final
        'otros': 'Otros 🍴'
    };

    // 2. Agrupamos los productos
    const categorias = {};
    
    // --- NUEVO ORDEN LÓGICO ---
    const orden = [
        'cocteles', 
        'cervezas', 
        'licores', 
        'tapas',       // Comida ligera después del alcohol
        'italiana',    // Comida media
        'fuertes',     // Comida pesada
        'bebidas_sin'  // Refrescos al final
    ];
    // ---------------------------

    lista.forEach(item => {
        const cat = item.categoria || 'otros';
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(item);
    });

    // 3. Generamos el HTML respetando el orden
    let htmlFinal = '';

    orden.forEach(catKey => {
        if (categorias[catKey] && categorias[catKey].length > 0) {
            htmlFinal += construirSeccionHTML(catKey, nombresCat[catKey], categorias[catKey]);
            delete categorias[catKey];
        }
    });

    Object.keys(categorias).forEach(catKey => {
        const titulo = nombresCat[catKey] || catKey.toUpperCase();
        htmlFinal += construirSeccionHTML(catKey, titulo, categorias[catKey]);
    });

    contenedor.innerHTML = htmlFinal;
    
    setTimeout(iniciarScrollSpy, 100); 
}
// Función auxiliar para crear el bloque HTML de cada sección
function construirSeccionHTML(id, titulo, items) {
    return `
        <section id="cat-${id}" class="category-section">
            <h2 class="category-header">${titulo}</h2>
            <div class="grid-productos">
                ${items.map(item => generarCardHTML(item)).join('')}
            </div>
        </section>
    `;
}

// Función auxiliar para la tarjeta (Misma lógica visual que tenías)
function generarCardHTML(item) {
    const esAgotado = item.estado === 'agotado';
    const img = item.imagen_url || 'img/logo.png';
    const rating = item.ratingPromedio ? `★ ${item.ratingPromedio}` : '';
    const accionClick = esAgotado ? '' : `onclick="abrirDetalle(${item.id})"`;
    const claseAgotado = esAgotado ? 'agotado' : '';
    
    // BADGES DE IA Y URGENCIA
    let badgeHTML = '';
    if (esAgotado) {
        badgeHTML = `<span class="badge-agotado">AGOTADO</span>`;
    } else if (item.destacado) {
        badgeHTML = `<span class="badge-destacado">🔥 HOT</span>`;
    } else if (item.stock < 5 && item.stock > 0) {
        badgeHTML = `<span class="badge-urgent">¡Últimos ${item.stock}!</span>`;
    }

    // BOTÓN DE MARIDAJE (Solo para comida)
    const categoriasComida = ['tapas', 'italiana', 'fuertes', 'otros'];
    const esComida = categoriasComida.includes(item.categoria);
    const btnMatch = (esComida && !esAgotado) 
        ? `<button class="btn-match" onclick="event.stopPropagation(); askPairing('${item.nombre}')">🍷 Match</button>` 
        : '';

    return `
        <div class="card ${claseAgotado}" ${accionClick}>
            ${badgeHTML}
            <div class="img-box"><img src="${img}" loading="lazy" alt="${item.nombre}"></div>
            <div class="info">
                <h3>${item.nombre}</h3>
                <div class="card-footer">
                     <span class="price">$${item.precio}</span>
                     <div class="actions-right">
                        ${btnMatch}
                        <span class="rating-pill">${rating}</span>
                     </div>
                </div>
            </div>
        </div>
    `;
}

// --- BÚSQUEDA Y FILTROS ---
const searchInput = document.getElementById('search-input');
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(AppStore.state.searchTimeout);
        const term = normalizarTexto(e.target.value);
        
        if (term.length === 0) {
            renderizarMenu(AppStore.getProducts());
            return;
        }
        if (term.length < 2) return;

        AppStore.state.searchTimeout = setTimeout(() => {
            const lista = AppStore.getProducts().filter(p => 
                normalizarTexto(p.nombre).includes(term) || 
                normalizarTexto(p.descripcion).includes(term)
            );
            renderizarMenu(lista);
        }, 300);
    });
}

// --- NAVEGACIÓN Y SCROLL SPY ---

function filtrar(cat, btn) {
    // Si pulsan "Todos", volvemos arriba
    if (cat === 'todos') {
        renderizarMenu(AppStore.getProducts());
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Actualizamos botones manualmente
        actualizarBotonesActivos('todos');
        return;
    }

    // Buscamos la sección y scrolleamos hacia ella
    const seccionId = `cat-${cat}`; // ej: cat-cocteles
    const seccion = document.getElementById(seccionId);
    
    if (seccion) {
        // Cálculo para descontar el header fijo
        const headerOffset = 130; 
        const elementPosition = seccion.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
        });
    } else {
        // Si la sección no existe (ej. no hay productos de esa categoría), filtramos normal
        showToast("No hay productos en esta categoría hoy", "info");
    }
}

function iniciarScrollSpy() {
    const secciones = document.querySelectorAll('.category-section');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Obtenemos el ID puro (quitamos 'cat-')
                const idPuro = entry.target.id.replace('cat-', '');
                actualizarBotonesActivos(idPuro);
            }
        });
    }, {
        rootMargin: "-20% 0px -60% 0px" // Ajuste fino para detectar la sección activa al medio
    });

    secciones.forEach(sec => observer.observe(sec));
}

function actualizarBotonesActivos(categoriaActiva) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        // El botón debe tener onclick="filtrar('cocteles', this)"
        // Comprobamos si el atributo onclick contiene la categoría activa
        if (btn.getAttribute('onclick').includes(`'${categoriaActiva}'`)) {
            btn.classList.add('active');
        }
        // Caso especial para 'todos' si estamos arriba del todo (opcional)
        if (categoriaActiva === 'todos' && btn.textContent.includes('Todos')) {
            btn.classList.add('active');
        }
    });
}

// --- DETALLES Y OPINIONES ---
function abrirDetalle(id) {
    const prod = AppStore.getProducts().find(p => p.id === id);
    if (!prod) return;

    AppStore.setActiveProduct(prod);
    const p = AppStore.state.activeProduct;

    const imgEl = document.getElementById('det-img');
    if(imgEl) imgEl.src = p.imagen_url || '';
    
    setText('det-titulo', p.nombre);
    setText('det-desc', p.descripcion);
    setText('det-precio', `$${p.precio}`);
    setText('det-rating-big', p.ratingPromedio ? `★ ${p.ratingPromedio}` : '★ --');

    const box = document.getElementById('box-curiosidad');
    if (p.curiosidad && p.curiosidad.length > 5) {
        if(box) box.style.display = "block";
        setText('det-curiosidad', p.curiosidad);
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

        AppStore.setReviewScore(0);
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
            AppStore.setReviewScore(parseInt(e.target.dataset.val));
            actualizarEstrellas();
        }
    });
}

function actualizarEstrellas() {
    const score = AppStore.state.reviewScore;
    document.querySelectorAll('#stars-container span').forEach(s => {
        const val = parseInt(s.dataset.val);
        s.style.color = val <= score ? 'var(--gold)' : '#444';
        s.textContent = val <= score ? '★' : '☆';
    });
}

async function enviarOpinion() {
    const score = AppStore.state.reviewScore;
    const currentProd = AppStore.state.activeProduct;

    if (score === 0) { showToast("¡Marca las estrellas!", "warning"); return; }
    if (!currentProd) return;

    const LAST_OPINION = `last_opinion_ts_${currentProd.id}`; 
    const lastTime = localStorage.getItem(LAST_OPINION);
    const ahora = Date.now();
    
    if (lastTime && (ahora - parseInt(lastTime)) < 12 * 60 * 60 * 1000) {
        showToast("Ya opinaste sobre esto hoy.", "warning");
        return;
    }

    const nombre = document.getElementById('cliente-nombre').value || "Anónimo";
    const comentario = document.getElementById('cliente-comentario').value;
    const btn = document.querySelector('#modal-opinion .btn-big-action');

    if(btn) { btn.textContent = "Enviando..."; btn.disabled = true; }

    const { error } = await supabaseClient.from('opiniones').insert([{
        producto_id: currentProd.id,
        cliente_nombre: nombre,
        comentario: comentario, 
        puntuacion: score
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

function normalizarTexto(texto) {
    return (texto || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function registrarServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registrado:', reg.scope))
            .catch(err => console.log('SW fallo:', err));
    }
}

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

let watchID = null;

function abrirShaker() {
    const modal = document.getElementById('modal-shaker');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    AppStore.resetShaker();
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

// CORRECCIÓN ACCESIBILIDAD: Usamos <button>
function renderizarEsencias() {
    const grid = document.getElementById('essences-grid');
    grid.innerHTML = '';
    const shaker = AppStore.getShakerState();
    
    ESENCIAS.forEach(esencia => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'essence-btn';
        
        // Accesibilidad
        const isSelected = shaker.selected.includes(esencia.nombre);
        if (isSelected) btn.classList.add('selected');
        btn.setAttribute('aria-pressed', isSelected);
        
        btn.innerHTML = `<span>${esencia.icono}</span><small>${esencia.nombre}</small>`;
        btn.onclick = () => toggleEsencia(esencia, btn);
        grid.appendChild(btn);
    });
}

function toggleEsencia(esencia, btnElement) {
    const shaker = AppStore.getShakerState();
    const index = shaker.selected.indexOf(esencia.nombre);
    
    if (index > -1) {
        shaker.selected.splice(index, 1);
        btnElement.classList.remove('selected');
        btnElement.setAttribute('aria-pressed', 'false');
    } else {
        if (shaker.selected.length < 3) {
            shaker.selected.push(esencia.nombre);
            btnElement.classList.add('selected');
            btnElement.setAttribute('aria-pressed', 'true');
        } else {
            showToast("Máximo 3 ingredientes", "warning");
        }
    }
    actualizarEstadoShaker();
}

function actualizarEstadoShaker() {
    const shaker = AppStore.getShakerState();
    const count = shaker.selected.length;
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
        
        if (count >= 1) {
            visual.classList.add('ready');
            status.textContent = "¡Agita tu móvil o pulsa el botón!";
            status.style.color = "var(--gold)";
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
}

function iniciarDetectorMovimiento() {
    if (watchID) return;

    const umbral = 15; 
    let lastX = 0, lastY = 0, lastZ = 0;

    const handleMotion = (event) => {
        const shaker = AppStore.getShakerState();
        if (shaker.isProcessing || shaker.selected.length === 0) return;

        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc) return;

        const deltaX = Math.abs(acc.x - lastX);
        const deltaY = Math.abs(acc.y - lastY);
        const deltaZ = Math.abs(acc.z - lastZ);

        if (deltaX + deltaY + deltaZ > umbral) {
            shaker.shakeCount++;
            const imgShaker = document.getElementById('shaker-img');
            if(imgShaker) imgShaker.classList.add('shaking');
            
            if (shaker.shakeCount > 5) {
                procesarMezcla();
                shaker.shakeCount = 0;
            }
            
            clearTimeout(shaker.shakeTimer);
            shaker.shakeTimer = setTimeout(() => {
                if(imgShaker) imgShaker.classList.remove('shaking');
            }, 300);
        }

        lastX = acc.x; lastY = acc.y; lastZ = acc.z;
    };

    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
            .then(state => {
                if (state === 'granted') {
                    window.addEventListener('devicemotion', handleMotion, true);
                    watchID = handleMotion;
                }
            })
            .catch(console.error);
    } else {
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
    const shaker = AppStore.getShakerState();
    if (shaker.isProcessing) return;
    shaker.isProcessing = true;
    detenerDetectorMovimiento(); 

    const btn = document.getElementById('btn-mix-manual');
    const status = document.getElementById('shaker-status');
    const visual = document.getElementById('shaker-img');
    
    btn.textContent = "Mezclando..."; btn.disabled = true;
    status.textContent = "Preparando tu recomendación...";
    visual.classList.add('shaking');

    // Usamos CONFIG si está disponible
    const scriptUrl = (typeof CONFIG !== 'undefined') ? CONFIG.URL_SCRIPT : "https://script.google.com/macros/s/AKfycbzzXvv1KtxUpBZVNfkhkZ6rI4iQEfk8SXHOgHeAa4jdH6-lLfKE-wswfMXtfaoeVMJC/exec";

    try {
        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ sabor: shaker.selected.join(', ') }),
            headers: { "Content-Type": "text/plain" }
        });

        const data = await response.json();
        
        if (data.success && data.recomendacion) {
            mostrarResultadoShaker(data.recomendacion);
            status.textContent = "¡Listo!";
        } else {
            throw new Error("Respuesta inválida");
        }

    } catch (error) {
        console.error("Error silencioso:", error);
        // Fallback
        const destacados = AppStore.getProducts().filter(p => p.destacado && p.estado !== 'agotado');
        const pool = destacados.length > 0 ? destacados : AppStore.getProducts();
        
        if (pool.length > 0) {
            const random = pool[Math.floor(Math.random() * pool.length)];
            mostrarResultadoShaker(random.nombre);
        }
    } finally {
        shaker.isProcessing = false;
        visual.classList.remove('shaking');
        btn.textContent = "¡MEZCLAR DE NUEVO!";
        btn.disabled = false;
    }
}

function mostrarResultadoShaker(nombreRecibido) {
    const nombreIA = (nombreRecibido || '').toLowerCase().trim();
    const candidatos = AppStore.getProducts().filter(p => {
        const nombreBD = (p.nombre || '').toLowerCase();
        if (!nombreBD || !nombreIA) return false;
        return nombreBD.includes(nombreIA) || nombreIA.includes(nombreBD);
    });

    cerrarShaker();
    let elegido = null;

    if (candidatos.length > 0) {
        elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
        showToast(`✨ Combinación perfecta: ${elegido.nombre}`);
    } else {
        const pool = AppStore.getProducts();
        if (pool.length > 0) {
            elegido = pool[Math.floor(Math.random() * pool.length)];
            showToast("¡Sorpresa! Prueba nuestra recomendación", "info");
        }
    }

    if (elegido) abrirDetalle(elegido.id);
    AppStore.state.shaker.isProcessing = false;
}

async function loadDynamicHero() {
    const context = await getUserContext();
    const container = document.getElementById('hero-ai-container');

    if (!container) return; // Seguridad

    container.innerHTML = '<div class="skeleton-text">El Sommelier está analizando el clima...</div>';
    container.classList.remove('hidden');

    try {
        // CORRECCIÓN: URL COMPLETA
        const scriptUrl = "https://script.google.com/macros/s/AKfycbzzXvv1KtxUpBZVNfkhkZ6rI4iQEfk8SXHOgHeAa4jdH6-lLfKE-wswfMXtfaoeVMJC/exec";
        
        const response = await fetch(scriptUrl, {
            method: "POST",
            body: JSON.stringify({
                action: "hero",
                contexto: context,
                token: "DLV_SECURE_TOKEN_2025_X9" // Asegura que el token coincida con tu backend
            })
        });
        
        const result = await response.json();
        if(result.success) {
            renderHeroHTML(result.data, context.temperatura);
        }
    } catch (e) {
        console.error("Fallo el Sommelier:", e);
        container.classList.add('hidden');
    }
}

function renderHeroHTML(aiData, temp) {
    const container = document.getElementById('hero-ai-container');
    const mensajeClima = temp > 28 ? "Para este calor 🔥" : "Para disfrutar la noche 🌙";
    
    container.innerHTML = `
        <div class="hero-content">
            <span class="ai-badge">${mensajeClima}</span>
            <h2>${aiData.copy_venta}</h2>
            <button onclick="addToCart('${aiData.id_elegido}')" class="btn-primary">
                Pedir ahora <i class="fas fa-arrow-right"></i>
            </button>
        </div>
        <div class="hero-image-glow">
            <img src="img/${aiData.id_elegido}.webp" alt="Recomendación" onerror="this.src='img/logo.png'">
        </div>
    `;
}

async function askPairing(nombrePlato) {
    // 1. Mostrar Feedback visual inmediato
    showToast(`Buscando la mejor bebida para tu ${nombrePlato}...`);

    try {
        const response = await fetch("https://script.google.com/macros/s/AKfycbzzXvv1KtxUpBZVNfkhkZ6rI4iQEfk8SXHOgHeAa4jdH6-lLfKE-wswfMXtfaoeVMJC/exec", {
            method: "POST",
            body: JSON.stringify({
                action: "pairing",
                producto: nombrePlato,
                token: "DLV_SECURE_TOKEN_2025_X9"
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showPairingModal(result.data, nombrePlato);
        }
    } catch (e) {
        showToast("El sommelier está ocupado.");
    }
}

function showPairingModal(data, plato) {
    const container = document.getElementById('modal-container');
    if (!container) return;

    const modalHTML = `
        <div class="pairing-modal">
            <h3>🤝 Maridaje Perfecto</h3>
            <p>Para tu <strong>${plato}</strong>:</p>
            <div class="pairing-result">
                <img src="img/${data.id_elegido}.webp" width="60" onerror="this.src='img/logo.png'">
                <div>
                    <h4>${data.id_elegido}</h4> 
                    <p class="pairing-reason">"${data.copy_venta}"</p>
                </div>
            </div>
            <button class="btn-primary" onclick="addToCart('${data.id_elegido}')">Añadir al pedido</button>
        </div>
    `;
    container.innerHTML = modalHTML;
    container.classList.add('active');
}