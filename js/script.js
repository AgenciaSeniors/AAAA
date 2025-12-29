// js/script.js - Lógica Cliente (Refactorizado con AppStore)

// --- GESTIÓN DE ESTADO CENTRALIZADO (STORE REACTIVO) ---
const AppStore = {
    state: {
        products: [],       // Inventario completo (Base de datos)
        visibleProducts: [], // Lo que el usuario ve actualmente (Filtrado)
        activeProduct: null, // Producto seleccionado para el modal
        reviewScore: 0,
        searchTimeout: null,
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
document.addEventListener('DOMContentLoaded', async () => { 
    try {
        await inicializarRestaurante();
        checkWelcome(); 
        
        // CORRECCIÓN: Esperar a que el menú cargue y luego iniciar el Scroll Spy
        await cargarMenu(); 
        iniciarScrollSpy(); 
        
        updateConnectionStatus();
        registrarServiceWorker();
        loadDynamicHero();
    } catch (error) {
        console.error("Error en la inicialización:", error);
    }
});
// --- PRECARGA ---
function precargarImagenes(productos) {
    if (!productos) return;
    
    // Si el documento ya está listo, ejecuta directo
    if (document.readyState === 'complete') {
        ejecutarPrecarga(productos);
    } else {
        window.addEventListener('load', () => ejecutarPrecarga(productos));
    }
}
function ejecutarPrecarga(lista) {
    lista.forEach(prod => { if (prod.imagen_url) {
                const img = new Image();
                img.src = prod.imagen_url;
            } });
}
// Detecta el slug de la URL automáticamente (ej: de-la-vida-bar)
const currentSlug = (typeof CONFIG !== 'undefined' && CONFIG.SLUG) ? CONFIG.SLUG : 'de-la-vida-bar';
let globalRestaurantId = null;

async function inicializarRestaurante() {
    console.log("Buscando configuración para:", currentSlug); // Aquí verás "de-la-vida-bar"
    const { data, error } = await supabaseClient
        .from('restaurantes')
        .select('id')
        .eq('slug', currentSlug)
        .maybeSingle(); 

    if (data) {
        globalRestaurantId = data.id;
        console.log("Sistema listo para el restaurante ID:", globalRestaurantId);
        return data.id;
    } else {
        console.error("ERROR: No existe el slug '" + currentSlug + "' en la tabla 'restaurantes'.");
        return null;
    }
}
// --- MENÚ Y PRODUCTOS ---
async function cargarMenu() {
    try {
        if (!globalRestaurantId) await inicializarRestaurante();

        const { data: productos, error } = await supabaseClient
            .from('productos')
            .select(`id, nombre, precio, imagen_url, categoria, destacado, estado, descripcion, curiosidad, stock, opiniones(puntuacion)`)
            .eq('activo', true)
            .eq('restaurant_id', globalRestaurantId);

        if (error) throw error;

        // Filtramos para que solo entren productos de tu lista oficial
        const productosProcesados = productos
            .filter(p => ORDEN_MENU.includes((p.categoria || '').toUpperCase()))
            .map(prod => {
                 const opiniones = prod.opiniones || [];
                 prod.ratingPromedio = opiniones.length ? 
                    (opiniones.reduce((acc, curr) => acc + curr.puntuacion, 0) / opiniones.length).toFixed(1) : null;
                 return prod;
            });

        AppStore.setProducts(productosProcesados);
        renderizarMenu(productosProcesados);
        renderizarBotonesFiltro(productosProcesados);

    } catch (err) {
        console.error("Error cargando menú:", err);
    }
}
// --- RENDERIZADO POR SECCIONES (TIPO INSTAGRAM/UBER EATS) ---


function renderizarMenu(lista) {
    const contenedor = document.getElementById('menu-grid');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const categorias = {};
    lista.forEach(item => {
        const cat = (item.categoria || 'AGREGOS').toUpperCase(); 
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(item);
    });

    let htmlFinal = '';
    // CORRECCIÓN: Usamos ORDEN_MENU y NOMBRES_MOSTRAR
    ORDEN_MENU.forEach(catKey => {
        if (categorias[catKey] && categorias[catKey].length > 0) {
            htmlFinal += construirSeccionHTML(catKey, NOMBRES_MOSTRAR[catKey] || catKey, categorias[catKey]);
        }
    });
    contenedor.innerHTML = htmlFinal;
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
    // 1. Primera y única declaración de variables de estado
    const esAgotado = item.estado === 'agotado'; 
    const img = item.imagen_url || 'img/logo.png';
    const rating = item.ratingPromedio ? `★ ${item.ratingPromedio}` : '';
    const accionClick = esAgotado ? '' : `onclick="abrirDetalle(${item.id})"`;
    const claseAgotado = esAgotado ? 'agotado' : '';
    
    // 2. Lógica de Badges
    let badgeHTML = '';
    if (esAgotado) {
        badgeHTML = `<span class="badge-agotado">AGOTADO</span>`;
    } else if (item.destacado) {
        badgeHTML = `<span class="badge-destacado">✨ TOP</span>`;
    } else if (item.stock < 5 && item.stock > 0) {
        badgeHTML = `<span class="badge-urgent">¡Últimos ${item.stock}!</span>`;
    }

    // 3. Lógica de Maridaje (Aquí estaba el error)
    const categoriasBebida = ['tragos', 'bebidas', 'café', 'whiskey', 'especialidades', 'ron'];
    const catLimpia = (item.categoria || '').toLowerCase();
    const esBebida = categoriasBebida.includes(catLimpia);
    const esComida = !esBebida; 

    // Ya no usamos "const esAgotado" aquí porque ya existe arriba
    const btnMatch = (esComida && !esAgotado) 
        ? `<button class="btn-match" onclick="event.stopPropagation(); askPairing('${item.nombre}', this)">🍷 Match</button>` 
        : '';

    // 4. Retornar el HTML (Asegúrate de que tu función retorne el string de la tarjeta)
    return `
        <div class="card ${claseAgotado}" ${accionClick}>
            ${badgeHTML}
            <div class="img-box">
                <img src="${img}" alt="${item.nombre}" loading="lazy">
            </div>
            <div class="info">
                <h3>${item.nombre}</h3>
                <p class="short-desc">${item.descripcion || ''}</p>
                <div class="card-footer">
                    <span class="price">$${item.precio}</span>
                    <span class="rating-pill">${rating}</span>
                </div>
                ${btnMatch}
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
    if (cat === 'todos') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    const seccion = document.getElementById(`cat-${cat}`);
    if (seccion) {
        // Offset de 125px para que el título no quede tapado por la barra de filtros sticky
        const headerOffset = 125; 
        const elementPosition = seccion.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
}

function iniciarScrollSpy() {
    const secciones = document.querySelectorAll('.category-section');
    const navFiltros = document.getElementById('nav-filtros');

    const observer = new IntersectionObserver((entries) => {
        // Si estamos muy cerca del tope, marcar "Todos"
        if (window.scrollY < 100) {
            actualizarBotonesActivos('todos');
            return;
        }

        entries.forEach(entry => {
            // El umbral se ajusta con rootMargin para detectar la sección 
            // justo cuando pasa debajo de la barra de navegación
            if (entry.isIntersecting) {
                const categoriaId = entry.target.id.replace('cat-', '');
                actualizarBotonesActivos(categoriaId);
            }
        });
    }, { 
        rootMargin: '-120px 0px -70% 0px', // Ajusta según el alto de tu header
        threshold: 0 
    });

    secciones.forEach(sec => observer.observe(sec));
}
function actualizarBotonesActivos(categoriaActiva) {
    const botones = document.querySelectorAll('.filter-btn');
    const nav = document.getElementById('nav-filtros');
    
    botones.forEach(btn => {
        btn.classList.remove('active');
        
        const clickAttr = btn.getAttribute('onclick') || "";
        
        // Verifica si es el botón de la categoría actual o el de "todos"
        if (clickAttr.includes(`'${categoriaActiva}'`)) {
            btn.classList.add('active');

            // Centrar el botón automáticamente en el scroll horizontal
            if (nav) {
                const btnLeft = btn.offsetLeft;
                const btnWidth = btn.offsetWidth;
                const navWidth = nav.offsetWidth;
                
                nav.scrollTo({
                    left: btnLeft - (navWidth / 2) + (btnWidth / 2),
                    behavior: 'smooth'
                });
            }
        }
    });
}
function renderizarBotonesFiltro(productos) {
    const nav = document.querySelector('.filters');
    if (!nav) return;

    const categoriasPresentes = [...new Set(productos.map(p => (p.categoria || 'OTROS').toUpperCase()))];

    // CORRECCIÓN: Usamos ORDEN_MENU para el sort
    categoriasPresentes.sort((a, b) => {
        const idxA = ORDEN_MENU.indexOf(a);
        const idxB = ORDEN_MENU.indexOf(b);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    nav.innerHTML = '<button class="filter-btn active" onclick="filtrar(\'todos\', this)">Todos</button>';
    categoriasPresentes.forEach(catKey => {
        if (NOMBRES_MOSTRAR[catKey]) {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.textContent = NOMBRES_MOSTRAR[catKey];
            btn.setAttribute('onclick', `filtrar('${catKey}', this)`);
            nav.appendChild(btn);
        }
    });
}

// --- DETALLES Y OPINIONES (Refactorizado) ---

function abrirDetalle(id, mensajeMaridaje = null) {
    const p = AppStore.setActiveProduct(id);
    if (!p) return;

    // Llenar datos básicos
    const imgEl = document.getElementById('det-img');
    if(imgEl) imgEl.src = p.imagen_url || 'img/logo.png';
    
    setText('det-titulo', p.nombre);
    setText('det-desc', p.descripcion);
    setText('det-precio', `$${p.precio}`); 
    setText('det-rating-big', p.ratingPromedio ? `★ ${p.ratingPromedio}` : '★ --');
    // Lógica para la curiosidad (IA)
    const boxCuriosidad = document.getElementById('box-curiosidad');
    const textoCuriosidad = document.getElementById('det-curiosidad');

    if (p.curiosidad && p.curiosidad !== "undefined" && p.curiosidad.trim().length > 5) {
        if(boxCuriosidad) boxCuriosidad.style.display = "block";
        if(textoCuriosidad) textoCuriosidad.textContent = p.curiosidad;
    } else {
        if(boxCuriosidad) boxCuriosidad.style.display = "none";
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


// Estrellas
// --- LÓGICA DE ESTRELLAS INTERACTIVAS (MEJORADA) ---
const starsContainer = document.getElementById('stars-container');
if(starsContainer) {
    const estrellas = starsContainer.querySelectorAll('span');

    // 1. Efecto al pasar el ratón (Hover)
    estrellas.forEach(star => {
        star.addEventListener('mouseenter', () => {
            const val = parseInt(star.dataset.val);
            pintarEstrellasVisual(val, true); // true = modo previsualización
        });
    });

    // 2. Al sacar el ratón, vuelve a la nota que habías marcado
    starsContainer.addEventListener('mouseleave', () => {
        const notaGuardada = AppStore.state.reviewScore || 0;
        pintarEstrellasVisual(notaGuardada, false);
    });

    // 3. Al hacer clic (Guardar nota)
    starsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
            const val = parseInt(e.target.dataset.val);
            AppStore.setReviewScore(val);
            pintarEstrellasVisual(val, false);
            
            // Pequeña animación de "pop" al pulsar
            e.target.style.transform = "scale(1.4)";
            setTimeout(() => e.target.style.transform = "scale(1)", 200);
        }
    });
}

// Función auxiliar para pintar rápido sin esperar a la base de datos
function pintarEstrellasVisual(nota, esPreview) {
    const estrellas = document.querySelectorAll('#stars-container span');
    estrellas.forEach(s => {
        const sVal = parseInt(s.dataset.val);
        // Si es preview usamos un amarillo pálido, si es fijo usamos el dorado fuerte
        const colorActivo = esPreview ? '#fff5cc' : 'var(--gold)'; 
        const colorInactivo = '#333'; // Gris oscuro para las apagadas
        
        s.style.color = sVal <= nota ? colorActivo : colorInactivo;
        s.style.transition = "color 0.1s, transform 0.2s"; // Suavidad
        
        // Efecto de brillo si está activa
        s.style.textShadow = (sVal <= nota && !esPreview) ? "0 0 10px var(--gold-glow)" : "none";
    });
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
let motionHandler = null; 