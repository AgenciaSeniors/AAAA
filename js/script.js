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
// --- PRECARGA ---
function precargarImagenes(productos) {
    if (!productos) return;
    // Usar window.onload para esperar a que lo principal esté listo
    window.addEventListener('load', () => {
        productos.forEach(prod => {
            if (prod.imagen_url) {
                const img = new Image();
                img.src = prod.imagen_url;
            }
        });
    });
}
// Detecta el slug de la URL automáticamente (ej: de-la-vida-bar)
const currentSlug = window.location.pathname.split('/').filter(Boolean).pop() || 'de-la-vida-bar';
let globalRestaurantId = null;

async function inicializarRestaurante() {
    const { data, error } = await supabaseClient
        .from('restaurantes')
        .select('id')
        .eq('slug', currentSlug)
        .single();

    if (data) {
        globalRestaurantId = data.id;
        console.log("Sistema listo para el restaurante:", globalRestaurantId);
    }
}
// --- MENÚ Y PRODUCTOS ---
async function cargarMenu() {
    const grid = document.getElementById('menu-grid');
    // 1. Carga instantánea desde Cache
    const menuCache = localStorage.getItem('menu_cache');
    if (menuCache) {
        AppStore.setProducts(JSON.parse(menuCache));
        renderizarMenu(AppStore.getProducts());
    }
    try {
        // 2. Consulta optimizada (Quitamos 'stock' si te da error)
        // Si 'curiosidad' o 'destacado' tampoco existen en tu DB, quítalos de aquí:
        const { data: productos, error } = await supabaseClient
            .from('productos')
            .select(`
                id, nombre, precio, imagen_url, categoria, 
                destacado, estado, descripcion, curiosidad,
                opiniones(puntuacion)
            `)
            .eq('activo', true);
        if (error) throw error;
        const productosProcesados = productos.map(prod => {
            const opiniones = prod.opiniones || [];
            const total = opiniones.length;
            const suma = opiniones.reduce((acc, curr) => acc + curr.puntuacion, 0);
            prod.ratingPromedio = total ? (suma / total).toFixed(1) : null;
            return prod;
        });
        // 3. Actualizar Cache y UI solo si hay cambios
        if (JSON.stringify(productosProcesados) !== menuCache) {
            localStorage.setItem('menu_cache', JSON.stringify(productosProcesados));
            AppStore.setProducts(productosProcesados);
            renderizarMenu(productosProcesados);
            renderizarBotonesFiltro(productosProcesados); // <--- CREA LOS BOTONES
            setTimeout(iniciarScrollSpy, 500);            // <--- ACTIVA EL RASTREO DE SCROLL
            crearBotonesFiltro(productosProcesados); // <--- AÑADE ESTO
        }
        precargarImagenes(productosProcesados);
    } catch (err) {
        console.error("Error cargando menú:", err);
        // Si el error persiste, vuelve temporalmente a .select(`*, opiniones(puntuacion)`)
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

    // 1. Mapa de Categorías (se mantiene igual)
    const nombresCat = {
        'cocteles': 'Cócteles de la Casa 🍸',
        'cervezas': 'Cervezas Frías 🍺',
        'licores': 'Vinos y Licores 🍷',
        'tapas': 'Para Picar 🍟',
        'italiana': 'Pizzas y Pastas 🍕',
        'fuertes': 'Platos Fuertes 🍽️',
        'bebidas_sin': 'Refrescos y Jugos 🥤',
        'otros': 'Otros 🍴'
    };

    // 2. Agrupamos los productos
    const categorias = {};
    
    lista.forEach(item => {
        const cat = item.categoria || 'otros';
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(item);
    });

    // --- NUEVO: Ordenar productos dentro de cada categoría ---
    // Esto hace que los 'destacado' (TOP) suban al principio de su sección
    Object.keys(categorias).forEach(catKey => {
        categorias[catKey].sort((a, b) => {
            // Si 'a' es destacado y 'b' no, 'a' va primero
            if (a.destacado && !b.destacado) return -1;
            // Si 'b' es destacado y 'a' no, 'b' va primero
            if (!a.destacado && b.destacado) return 1;
            return 0; // Si ambos son iguales, mantienen su orden
        });
    });

    // 3. Generamos el HTML respetando el orden de categorías (se mantiene igual)
    const orden = ['cocteles', 'cervezas', 'licores', 'tapas', 'italiana', 'fuertes', 'bebidas_sin'];
    let htmlFinal = '';

    orden.forEach(catKey => {
        if (categorias[catKey] && categorias[catKey].length > 0) {
            htmlFinal += construirSeccionHTML(catKey, nombresCat[catKey], categorias[catKey]);
            delete categorias[catKey];
        }
    });

    // Resto de categorías no listadas en 'orden'
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
        badgeHTML = `<span class="badge-destacado">✨ TOP</span>`;
    } else if (item.stock < 5 && item.stock > 0) {
        badgeHTML = `<span class="badge-urgent">¡Últimos ${item.stock}!</span>`;
    }

    // BOTÓN DE MARIDAJE (Solo para comida)
    const esBebida = ['cocteles', 'cervezas', 'licores', 'bebidas_sin', 'cafes', 'jugos'].some(c => item.categoria.toLowerCase().includes(c));
    const esComida = !esBebida;
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
        
        // Obtenemos el atributo onclick y verificamos que exista antes de usar .includes
        const clickAttr = btn.getAttribute('onclick');
        
        if (clickAttr && clickAttr.includes(`'${categoriaActiva}'`)) {
            btn.classList.add('active');
        }

        // Caso especial para resaltar "Todos" cuando estamos arriba
        if (categoriaActiva === 'todos' && btn.textContent.toLowerCase().includes('todos')) {
            btn.classList.add('active');
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
    
    // --- ESTA ES LA LÍNEA QUE FALTA ---
    setText('det-precio', `$${p.precio}`); 
    // ----------------------------------

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
// Función para crear botones automáticamente según tus categorías
function crearBotonesFiltro(productos) {
    const contenedor = document.querySelector('.filters');
    // Obtenemos las categorías únicas de tus productos
    const categorias = [...new Set(productos.map(p => p.categoria))];

    // Diccionario para poner emojis bonitos (opcional)
    const emojis = {
        'cocteles': 'Cócteles 🍸', 'cervezas': 'Cervezas 🍺', 
        'italiana': 'Italiana 🍕', 'tapas': 'Picar 🍟'
    };

    categorias.forEach(cat => {
        // Si ya existe el botón (ej: Todos), no lo creamos de nuevo
        if ([...contenedor.children].some(btn => btn.getAttribute('onclick')?.includes(cat))) return;

        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        // Si tenemos emoji lo usa, si no, pone el nombre tal cual (con mayúscula inicial)
        btn.textContent = emojis[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1));
        btn.onclick = function() { filtrar(cat, this); };
        contenedor.appendChild(btn);
    });
}
function renderizarBotonesFiltro(productos) {
    const nav = document.querySelector('.filters');
    if (!nav) return;

    // 1. Obtenemos las categorías únicas de los productos reales
    const categoriasUnicas = [...new Set(productos.map(p => p.categoria))];
    
    // 2. Reiniciamos el contenedor dejando solo el botón "Todos"
    nav.innerHTML = '<button class="filter-btn active" onclick="filtrar(\'todos\', this)">Todos</button>';

    // 3. Diccionario de Emojis para que se vea elegante
    const emojis = {
        'Tragos': 'Tragos 🍸', 'Bebidas': 'Bebidas 🍺', 'Café': 'Café ☕',
        'Whiskey': 'Whiskey 🥃', 'Ron': 'Ron 🥃', 'Tapas': 'Tapas 🍟',
        'Especialidades': 'Licores ✨', 'Agregos': 'Extras 🍕'
    };

    // 4. Creamos los botones dinámicamente
    categoriasUnicas.forEach(cat => {
        if(!cat) return;
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = emojis[cat] || cat;
        btn.onclick = function() { filtrar(cat, this); };
        nav.appendChild(btn);
    });
}
let watchID = null;


let motionHandler = null; 




