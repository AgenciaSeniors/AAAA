// js/script.js - Lógica Cliente (Refactorizado con AppStore)

// --- GESTIÓN DE ESTADO CENTRALIZADO (STORE REACTIVO) ---
const AppStore = {
    state: {
        products: [],       // Inventario completo (Base de datos)
        visibleProducts: [], // Lo que el usuario ve actualmente (Filtrado)
        activeProduct: null, // Producto seleccionado para el modal
        reviewScore: 0,
        shaker: {
            selected: [],
            isProcessing: false,
            shakeCount: 0,
            shakeTimer: null
        }
    },

    // Inicializa o actualiza el inventario completo
    setProducts(list) { 
        this.state.products = list; 
        this.state.visibleProducts = list; // Al inicio, todo es visible
    },

    getProducts() { return this.state.products; },
    getVisibleProducts() { return this.state.visibleProducts; },

    // Lógica de filtrado CENTRALIZADA
    filterProducts(term) {
        if (!term || term.length < 2) {
            this.state.visibleProducts = this.state.products;
        } else {
            const lowerTerm = normalizarTexto(term);
            this.state.visibleProducts = this.state.products.filter(p => 
                normalizarTexto(p.nombre).includes(lowerTerm) || 
                normalizarTexto(p.descripcion).includes(lowerTerm)
            );
        }
        return this.state.visibleProducts;
    },
    
    // Selección de producto segura
    setActiveProduct(productId) { 
        // Buscamos siempre en el array maestro para evitar errores si el filtro cambia
        const found = this.state.products.find(p => p.id === productId);
        this.state.activeProduct = found || null;
        this.state.reviewScore = 0;
        return this.state.activeProduct;
    },

    getActiveProduct() { return this.state.activeProduct; },

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
    
    const API_KEY = "3bc237701499f9b6b03de6f10e1e65d6"; 
    const LAT = "21.9297"; 
    const LON = "-79.4440"; 
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${API_KEY}&units=metric`;

    let temp = 28; 
    let climaDesc = "despejado";
    let isRaining = false;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.main) {
            temp = Math.round(data.main.temp);
            climaDesc = data.weather[0].description;
            // Detectamos lluvia basándonos en los códigos de OpenWeather o el texto
            isRaining = data.weather[0].main === "Rain" || climaDesc.includes("rain") || climaDesc.includes("lluvia");
            console.log(`🌤️ Clima real: ${temp}°C, ${climaDesc} (Lluvia: ${isRaining})`);
        }
    } catch (e) {
        console.warn("Usando estimación horaria.");
        const esDeDia = ahora.getHours() > 8 && ahora.getHours() < 19;
        temp = esDeDia ? 32 : 24;
    }

    // Devolvemos 'temp' para que copywriter.js lo entienda
    return { hora, temp, temperatura: temp, isRaining, descripcion: climaDesc };
}
// --- LÓGICA DE VISITAS Y BIENVENIDA ---
async function checkWelcome() {
    const clienteId = localStorage.getItem('cliente_id');
    // Verificamos si es un invitado temporal (solo dura mientras el navegador esté abierto)
    const esInvitado = sessionStorage.getItem('es_invitado') === 'true';
    const modal = document.getElementById('modal-welcome');

    // CASO A: Usuario Registrado O Invitado Activo
    if (clienteId || esInvitado) {
        if (modal) modal.style.display = 'none';

        // Solo ejecutamos lógica de base de datos si es un CLIENTE REAL
        if (clienteId) {
            const nombreGuardado = localStorage.getItem('cliente_nombre') || 'Amigo';
            
            setTimeout(() => {
                // Solo mostrar toast si no acaba de registrarse (evitar doble toast)
                if (!sessionStorage.getItem('recien_registrado')) {
                    showToast(`¡Qué bueno verte de nuevo, ${nombreGuardado}! 🍹`, "success");
                }
            }, 1500);

            // Lógica de visitas (Solo para IDs reales)
            const ultimaVisita = localStorage.getItem('ultima_visita_ts');
            const ahora = Date.now();
            const TIEMPO_ESPERA = 10 * 1000; 

            if (!ultimaVisita || (ahora - parseInt(ultimaVisita)) > TIEMPO_ESPERA) {
                if (typeof supabaseClient !== 'undefined') {
                    await supabaseClient.from('visitas').insert([{
                        cliente_id: clienteId,
                        motivo: 'Regreso al Menú'
                    }]);
                    localStorage.setItem('ultima_visita_ts', ahora.toString());
                }
            }
        }
    } else {
        // CASO B: Usuario Nuevo (o invitado que cerró el navegador)
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
        sessionStorage.removeItem('es_invitado');
        cerrarWelcome();
        showToast(`¡Hola de nuevo, ${nombre}!`, "success");

    } catch (err) {
        console.error("Error registro:", err);
        showToast("Error de conexión. Entrando como invitado...", "error");
        sessionStorage.setItem('es_invitado', 'true');
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
        ? `<button class="btn-match" onclick="event.stopPropagation(); askPairing('${item.nombre}', this)">🍷 Match</button>` 
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
        const term = e.target.value; // No normalizamos aquí, lo hace el Store
        
        AppStore.state.searchTimeout = setTimeout(() => {
            // 1. Pedimos al Store que actualice su estado "visible"
            const listaOficial = AppStore.filterProducts(term);
            
            // 2. Renderizamos lo que el Store nos dice
            renderizarMenu(listaOficial);
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

// --- DETALLES Y OPINIONES (Refactorizado) ---

function abrirDetalle(id, mensajeMaridaje = null) {
    // Usamos el Store para activar el producto
    const p = AppStore.setActiveProduct(id); 

    // SI EL PRODUCTO NO EXISTE, MOSTRAMOS UN AVISO Y NO ROMPEMOS EL CÓDIGO
    if (!p) {
        console.warn("La IA recomendó un ID que no existe en el menú:", id);
        showToast("Esa recomendación no está disponible hoy.", "info");
        return;
    }

    // Si existe, rellenamos el modal (tu lógica actual...)
    const imgEl = document.getElementById('det-img');
    if(imgEl) imgEl.src = p.imagen_url || 'img/logo.png';
    setText('det-titulo', p.nombre);
    setText('det-desc', p.descripcion);
    setText('det-precio', `$${p.precio}`);
    
    // Mostrar nota del sommelier si existe
    const notaSommelier = document.getElementById('nota-sommelier');
    if (mensajeMaridaje && notaSommelier) {
        notaSommelier.innerHTML = `<div class="ai-pairing-note"><small>🍷 NOTA DEL SOMMELIER:</small><p>"${mensajeMaridaje}"</p></div>`;
        notaSommelier.style.display = 'block';
    } else if(notaSommelier) {
        notaSommelier.style.display = 'none';
    }

    const modal = document.getElementById('modal-detalle');
    if(modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

// Función exclusiva para manipular el DOM (Pura UI)
function renderizarModalDetalle(p) {
    const imgEl = document.getElementById('det-img');
    const box = document.getElementById('box-curiosidad');
    const modal = document.getElementById('modal-detalle');

    // Inyecciones seguras
    if(imgEl) imgEl.src = p.imagen_url || 'img/logo.png';
    setText('det-titulo', p.nombre);
    setText('det-desc', p.descripcion);
    setText('det-precio', `$${p.precio}`);
    setText('det-rating-big', p.ratingPromedio ? `★ ${p.ratingPromedio}` : '★ --');

    // Lógica visual específica
    if (p.curiosidad && p.curiosidad.length > 5) {
        if(box) box.style.display = "block";
        setText('det-curiosidad', p.curiosidad);
    } else {
        if(box) box.style.display = "none";
    }
    
    // Animación de entrada
    if (modal) {
        modal.style.display = 'flex';
        // Pequeño delay para permitir que el display:flex se aplique antes de la opacidad
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
    }
}

function cerrarDetalle() {
    const modal = document.getElementById('modal-detalle');
    if (modal) {
        modal.classList.remove('active');
        // Limpiamos el producto activo al cerrar para evitar datos residuales
        AppStore.state.activeProduct = null; 
        setTimeout(() => modal.style.display = 'none', 350);
    }
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
    if (!texto) return "";
    return texto.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quita acentos
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Quita signos de puntuación
        .trim();
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

// ==========================================
// 🌪️ GESTIÓN DE SENSORES (Optimizado)
// ==========================================

// Variable global para almacenar la REFERENCIA EXACTA de la función
let motionHandler = null; 

function iniciarDetectorMovimiento() {
    // 1. LIMPIEZA PREVENTIVA (Defensa contra fugas)
    // Antes de crear nada, nos aseguramos de matar cualquier listener anterior.
    detenerDetectorMovimiento();

    const umbral = 15; 
    let lastX = 0, lastY = 0, lastZ = 0;

    // 2. Definimos el handler y lo guardamos en la variable global
    motionHandler = (event) => {
        const shaker = AppStore.getShakerState();
        
        // Si ya estamos procesando, ignoramos movimientos para no saturar
        if (shaker.isProcessing || shaker.selected.length === 0) return;

        // Soporte cruzado para aceleración con o sin gravedad
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc) return;

        const deltaX = Math.abs(acc.x - lastX);
        const deltaY = Math.abs(acc.y - lastY);
        const deltaZ = Math.abs(acc.z - lastZ);

        // Detectar sacudida fuerte
        if (deltaX + deltaY + deltaZ > umbral) {
            shaker.shakeCount++;
            
            // Feedback visual inmediato
            const imgShaker = document.getElementById('shaker-img');
            if(imgShaker) imgShaker.classList.add('shaking');
            
            // Umbral de activación (5 sacudidas)
            if (shaker.shakeCount > 5) {
                procesarMezcla();
                shaker.shakeCount = 0; // Reset inmediato para evitar disparos dobles
            }
            
            // Limpieza visual
            clearTimeout(shaker.shakeTimer);
            shaker.shakeTimer = setTimeout(() => {
                if(imgShaker) imgShaker.classList.remove('shaking');
            }, 300);
        }

        lastX = acc.x; lastY = acc.y; lastZ = acc.z;
    };

    // 3. Solicitud de Permisos (iOS 13+) y Activación
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
            .then(state => {
                if (state === 'granted') {
                    window.addEventListener('devicemotion', motionHandler, true);
                    console.log("📡 Sensor activado (iOS)");
                }
            })
            .catch(console.error);
    } else {
        // Android y navegadores estándar
        window.addEventListener('devicemotion', motionHandler, true);
        console.log("📡 Sensor activado (Android/Std)");
    }
}

function detenerDetectorMovimiento() {
    // Solo intentamos remover si existe una referencia válida
    if (motionHandler) {
        window.removeEventListener('devicemotion', motionHandler, true);
        motionHandler = null; // Liberamos la memoria
        console.log("🛑 Sensor detenido y memoria liberada");
    }
}

async function procesarMezcla() {
    const shaker = AppStore.getShakerState();
    if (shaker.isProcessing) return; // Evitar dobles clics
    
    shaker.isProcessing = true;
    detenerDetectorMovimiento(); 

    // Referencias al DOM
    const btn = document.getElementById('btn-mix-manual');
    const status = document.getElementById('shaker-status');
    const visual = document.getElementById('shaker-img');
    
    // Estado de "Cargando"
    if(btn) { btn.textContent = "Mezclando..."; btn.disabled = true; }
    if(status) status.textContent = "El Sommelier está pensando...";
    if(visual) visual.classList.add('shaking');

    // URL del script (usa CONFIG si existe)
    const scriptUrl = (typeof CONFIG !== 'undefined') ? CONFIG.URL_SCRIPT : "https://script.google.com/macros/s/AKfycbzzXvv1KtxUpBZVNfkhkZ6rI4iQEfk8SXHOgHeAa4jdH6-lLfKE-wswfMXtfaoeVMJC/exec";

    try {
        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "shaker",
                sabor: shaker.selected.join(', '),
                token: "DLV_SECURE_TOKEN_2025_X9"
            })
        });

        const res = await response.json();
        
        if (res.success && res.data) {
            // MEJORA: Pasamos tanto el nombre como el ID (si el backend lo devuelve)
            // Esto soluciona la fragilidad si el backend empieza a enviar IDs.
            mostrarResultadoShaker(res.data.recomendacion, res.data.id_elegido);
            if(status) status.textContent = "¡Listo!";
        } else {
            throw new Error("Respuesta de IA vacía o inválida");
        }

    } catch (error) {
        console.warn("Fallo en la IA, usando Sommelier Local (Fallback):", error);
        
        // Lógica Fallback: Elegimos algo rico localmente si falla internet
        const productos = AppStore.getProducts();
        // Preferimos destacados que no estén agotados
        const pool = productos.filter(p => p.destacado && p.estado !== 'agotado');
        // Si no hay, usamos cualquiera
        const candidatos = pool.length > 0 ? pool : productos;
        
        if (candidatos.length > 0) {
            const random = candidatos[Math.floor(Math.random() * candidatos.length)];
            // Pasamos el ID explícito para asegurar el match
            mostrarResultadoShaker(random.nombre, random.id);
        } else {
            showToast("No pudimos preparar nada. Intenta de nuevo.", "error");
        }

    } finally {
        // Restaurar estado UI
        shaker.isProcessing = false;
        if(visual) visual.classList.remove('shaking');
        if(btn) { btn.textContent = "¡MEZCLAR DE NUEVO!"; btn.disabled = false; }
    }
}

function mostrarResultadoShaker(nombreIA, idOpcional) {
    const productos = AppStore.getProducts();
    let elegido = null;

    // ESTRATEGIA 1: Búsqueda Directa por ID (Infalible)
    if (idOpcional) {
        elegido = productos.find(p => p.id == idOpcional);
    }

    // ESTRATEGIA 2: Búsqueda Inteligente por Texto (Si falla el ID)
    if (!elegido && nombreIA) {
        const textoIA = normalizarTexto(nombreIA);
        
        // A. Intento exacto
        elegido = productos.find(p => normalizarTexto(p.nombre) === textoIA);
        
        // B. Intento por palabras clave (Scoring)
        if (!elegido) {
            const palabrasIA = textoIA.split(' ').filter(w => w.length > 3);
            let mejorPuntuacion = 0;

            productos.forEach(prod => {
                // Buscamos en nombre, descripción y categoría
                const textoBD = normalizarTexto(`${prod.nombre} ${prod.descripcion} ${prod.categoria}`);
                let puntos = 0;
                palabrasIA.forEach(palabra => {
                    if (textoBD.includes(palabra)) puntos++;
                });

                if (puntos > mejorPuntuacion) {
                    mejorPuntuacion = puntos;
                    elegido = prod;
                }
            });
        }
    }

    cerrarShaker();

    if (elegido) {
        showToast(`✨ Combinación perfecta: ${elegido.nombre}`);
        abrirDetalle(elegido.id);
    } else {
        // Fallback final por si todo falla (muy raro con la lógica nueva)
        showToast("¡Sorpresa! Prueba nuestra recomendación", "info");
        const random = productos[Math.floor(Math.random() * productos.length)];
        if(random) abrirDetalle(random.id);
    }

    // Asegurar que el flag de proceso se apague
    AppStore.state.shaker.isProcessing = false;
}

async function loadDynamicHero() {
    const container = document.getElementById('hero-ai-container');
    if (!container) return; 

    container.innerHTML = '<div class="skeleton-text">El Sommelier está analizando la atmósfera...</div>';
    container.classList.remove('hidden');

    try {
        // ESPERAR a que los productos estén en el AppStore (máximo 3 segundos)
        let intentos = 0;
        while (AppStore.getProducts().length === 0 && intentos < 30) {
            await new Promise(r => setTimeout(r, 100));
            intentos++;
        }

        const context = await getUserContext();
        const scriptUrl = CONFIG.URL_SCRIPT;
        
        const response = await fetch(scriptUrl, {
            method: "POST",
            body: JSON.stringify({
                action: "hero",
                contexto: context, 
                token: "DLV_SECURE_TOKEN_2025_X9"
            })
        });
        
        const result = await response.json();
        if(result.success && result.data) {
            renderHeroHTML(result.data, context);
        }
    } catch (e) {
        console.error("Fallo el Sommelier:", e);
        container.classList.add('hidden');
    }
}
function renderHeroHTML(aiData, context) {
    const container = document.getElementById('hero-ai-container');
    if (!container) return;

    // Buscamos el producto comparando IDs con == (para ignorar si es string o number)
    const productoReal = AppStore.getProducts().find(p => p.id == aiData.id_elegido);
    
    if (!productoReal) {
        container.classList.add('hidden');
        return;
    }

    const imagenFinal = productoReal.imagen_url || 'img/logo.png';
    const nombreProducto = productoReal.nombre;

    // Obtener mensaje emocional del Sommelier (Copywriter)
    let mensajeNoir = aiData.copy_venta; // Fallback de la IA
    
    if (typeof getNoirMessage === 'function') {
        const ahora = new Date();
        // getNoirMessage ya recibirá context.temp y context.isRaining correctamente
        mensajeNoir = getNoirMessage(context, ahora.getHours(), ahora.getMinutes());
    }

    container.innerHTML = `
        <div class="hero-content">
            <span class="ai-badge">📍 Sancti Spíritus: ${context.temp}°C</span>
            <h2 class="noir-title">${mensajeNoir}</h2>
            <p class="hero-suggestion">Hoy te sugerimos: <strong>${nombreProducto}</strong></p>
            
            <button onclick="abrirDetalle(${productoReal.id})" class="btn-neon-action">
                Revelar Secreto <i class="fas fa-arrow-right"></i>
            </button>
        </div>
        <div class="hero-image-glow">
            <img src="${imagenFinal}" alt="${nombreProducto}" onerror="this.src='img/logo.png'">
        </div>
    `;
}
async function askPairing(nombreProducto, btn) {
    const modal = document.getElementById('modal-match');
    const loading = document.getElementById('match-loading');
    const content = document.getElementById('match-content');
    
    // 1. Mostrar modal y estado de carga
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    loading.style.display = 'block';
    content.style.display = 'none';

    const scriptUrl = CONFIG.URL_SCRIPT;

    try {
        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "pairing",
                producto: nombreProducto,
                token: "DLV_SECURE_TOKEN_2025_X9" 
            })
        });

        const res = await response.json();
        
        if (res.success && res.data) {
            // Buscamos el producto recomendado en nuestro inventario local
            const recomendado = AppStore.getProducts().find(p => p.id == res.data.id_elegido);
            
            if (recomendado) {
                // Rellenar datos en el modal de Match
                document.getElementById('match-plato-base').textContent = nombreProducto;
                document.getElementById('match-img').src = recomendado.imagen_url || 'img/logo.png';
                document.getElementById('match-producto-nombre').textContent = recomendado.nombre;
                document.getElementById('match-justificacion').textContent = res.data.copy_venta;
                
                // Configurar el botón de acción final
                document.getElementById('match-btn-action').onclick = () => {
                    cerrarMatch();
                    abrirDetalle(recomendado.id, res.data.copy_venta);
                };

                // Cambiar de "Cargando" a "Resultado"
                loading.style.display = 'none';
                content.style.display = 'block';
            }
        }
    } catch (error) {
        console.error("Error en Match:", error);
        showToast("Error conectando con el Sommelier.", "error");
        cerrarMatch();
    }
}

function cerrarMatch() {
    const modal = document.getElementById('modal-match');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}