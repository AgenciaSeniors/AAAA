// js/reviews.js - Gestión de Feedback y Opiniones
let opinionesGlobal = [];

async function cargarOpiniones() {
    console.log("Cargando opiniones con datos de producto...");
    const { data, error } = await supabaseClient
        .from('opiniones')
        .select(`
            *,
            productos (
                nombre,
                imagen_url
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error opiniones:", error);
        return;
    }

    opinionesGlobal = data;
    renderizarOpiniones(data);
    actualizarEstadisticasOpiniones(data);
}
function renderizarOpiniones(lista) {
    const container = document.getElementById('grid-opiniones');
    if (!container) return;

    if (lista.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#888; grid-column:1/-1;">No hay opiniones para mostrar.</p>';
        return;
    }

    container.innerHTML = lista.map(op => {
        const puntos = op.puntuacion || 0;
        const estrellas = "⭐".repeat(puntos);
        const fecha = new Date(op.created_at).toLocaleDateString();
        
        // Obtenemos los datos del producto (con fallback por si no existe)
        const infoProducto = op.productos || { nombre: 'Producto eliminado', imagen_url: 'https://via.placeholder.com/50' };
        
        return `
            <div class="review-card">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #333;">
                    <img src="${infoProducto.imagen_url}" 
                         style="width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid #444;" 
                         alt="prod">
                    <div style="display:flex; flex-direction:column;">
                        <span style="color:var(--gold); font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                            ${infoProducto.nombre}
                        </span>
                        <small style="color:#666; font-size:0.7rem;">${fecha}</small>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <span style="color:#fff; font-weight:600; font-size:0.9rem;">${op.cliente_nombre || 'Anónimo'}</span>
                    <div style="font-size:0.8rem;">${estrellas}</div>
                </div>

                <p style="color:#aaa; font-size:0.85rem; font-style:italic; margin-top:5px; line-height:1.4;">
                    "${op.comentario || 'Sin comentario'}"
                </p>
            </div>
        `;
    }).join('');
}

function actualizarEstadisticasOpiniones(data) {
    if (!data || data.length === 0) return;
    
    const total = data.length;
    const suma = data.reduce((acc, curr) => acc + (curr.puntuacion || 0), 0);
    const promedio = (suma / total).toFixed(1);

    const elTotal = document.getElementById('stat-total');
    const elProm = document.getElementById('stat-promedio');
    
    if (elTotal) elTotal.textContent = total;
    if (elProm) elProm.textContent = promedio;
}
function filtrarOpiniones(filtro, btn) {
    // 1. Actualizar la interfaz (botones)
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // 2. Aplicar el filtro usando la propiedad correcta: "puntuacion"
    let filtradas = opinionesGlobal;
    
    if (filtro === '5') {
        // Cambiamos "estrellas" por "puntuacion"
        filtradas = opinionesGlobal.filter(o => o.puntuacion === 5);
    } else if (filtro === 'alertas') {
        // Cambiamos "estrellas" por "puntuacion"
        filtradas = opinionesGlobal.filter(o => o.puntuacion <= 2);
    }
    
    // 3. Volver a dibujar las reseñas en pantalla
    renderizarOpiniones(filtradas);
}


async function cargarMetricasVisitas() {
    console.log("Cargando métricas completas...");

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
    const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();

    // 1. Cifras Generales
    // Total Histórico
    const { count: total, error: errTotal } = await supabaseClient
        .from('visitas')
        .select('*', { count: 'exact', head: true });
    if (!errTotal) setText('stat-unique-clients', total); 

    // Mes Actual
    const { count: mes, error: errMes } = await supabaseClient
        .from('visitas')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioMes);
    if (!errMes) setText('stat-mes', mes);

    // Hoy
    const { count: dia, error: errDia } = await supabaseClient
        .from('visitas')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia);
    if (!errDia) {
        setText('stat-hoy', dia);
        setText('trend-hoy', "Tiempo real");
    }

    // 2. Cargar Gráficos y Listas
    cargarGraficoTendencia();
    cargarGraficoHoras();  // ¡Agregado!
    cargarTopClientes();   // ¡Agregado!
}

// --- GRÁFICO 1: TENDENCIA (Últimos 7 días) ---
async function cargarGraficoTendencia() {
    const canvas = document.getElementById('chart-visitas');
    if (!canvas) return;

    // Destruir gráfico anterior si existe para evitar superposiciones
    if (window.chartTendencia instanceof Chart) window.chartTendencia.destroy();

    const fecha7dias = new Date();
    fecha7dias.setDate(fecha7dias.getDate() - 7);

    const { data } = await supabaseClient
        .from('visitas')
        .select('created_at')
        .gte('created_at', fecha7dias.toISOString());

    if (!data) return;

    const agrupado = {};
    data.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleDateString('es-ES', {day: '2-digit', month: 'short'});
        agrupado[fecha] = (agrupado[fecha] || 0) + 1;
    });

    // Ordenar fechas cronológicamente podría requerir lógica extra, pero el objeto suele mantener orden de inserción si los datos vienen ordenados
    const labels = Object.keys(agrupado);
    const valores = Object.values(agrupado);

    window.chartTendencia = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Visitas',
                data: valores,
                borderColor: '#FFD700',
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: '#333'} }, x: { grid: { display: false } } }
        }
    });
}

// --- GRÁFICO 2: HORAS PUNTA (Histórico) ---
async function cargarGraficoHoras() {
    const canvas = document.getElementById('chart-horas');
    if (!canvas) return;

    // Destruir anterior si existe
    if (window.chartHoras instanceof Chart) window.chartHoras.destroy();

    // Traemos solo la hora de creación de todas las visitas
    const { data } = await supabaseClient
        .from('visitas')
        .select('created_at');

    if (!data) return;

    // Inicializar contadores para las 24 horas (o rango comercial ej: 18h a 04h)
    const horasCount = new Array(24).fill(0);

    data.forEach(v => {
        const fecha = new Date(v.created_at);
        const hora = fecha.getHours(); // 0 a 23
        horasCount[hora]++;
    });

    // Filtramos para mostrar solo horas relevantes (ej: donde haya visitas)
    // O mostramos todo. Aquí mostraremos las horas con actividad.
    const labels = [];
    const counts = [];
    
    horasCount.forEach((count, hora) => {
        if(count > 0) { // Solo horas con movimiento
            labels.push(`${hora}:00`);
            counts.push(count);
        }
    });

    window.chartHoras = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Clientes',
                data: counts,
                backgroundColor: 'var(--gold)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { display: false }, 
                x: { grid: { display: false }, ticks: { color: '#888' } } 
            }
        }
    });
}

// --- LISTA: TOP CLIENTES (Nombre + Tel + Visitas) ---
async function cargarTopClientes() {
    const container = document.getElementById('top-clientes-list');
    if(!container) return;

    container.innerHTML = '<p style="text-align:center; color:#666;">Analizando datos...</p>';

    const { data, error } = await supabaseClient
    .from('clientes')
    .select('nombre, telefono, visitas(id)');

    if (error || !data || data.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#666;">No hay datos de clientes registrados.</p>';
        return;
    }

    // Procesar datos en JS (Agrupar por Telefono o Nombre)
    const clientesMap = {};

    data.forEach(v => {
        // Usamos telefono como ID único, o nombre si no hay tel
        const key = v.telefono || v.nombre || 'Anónimo'; 
        if (key === 'Anónimo') return; // Saltamos anónimos

        if (!clientesMap[key]) {
            clientesMap[key] = {
                nombre: v.nombre || 'Sin Nombre',
                telefono: v.telefono || '---',
                visitas: 0
            };
        }
        clientesMap[key].visitas++;
    });

    // Convertir a array y ordenar por visitas (Descendente)
    const ranking = Object.values(clientesMap)
        .sort((a, b) => b.visitas - a.visitas)
        .slice(0, 10); // Top 10

    // Renderizar
    if (ranking.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#666;">Solo hay visitas anónimas.</p>';
        return;
    }

    const html = ranking.map((c, index) => {
        let icono = '🥈';
        if(index === 0) icono = '👑'; // Rey
        if(index === 1) icono = '🥇';
        if(index > 1) icono = `#${index + 1}`;

        return `
            <div class="inventory-item" style="justify-content: space-between;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:bold; font-size:1.2rem; width:30px; text-align:center;">${icono}</span>
                    <div>
                        <div class="item-title" style="color:white;">${c.nombre}</div>
                        <div class="item-price" style="color:#888; font-size:0.8rem;">Tel: ${c.telefono}</div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span style="display:block; font-size:1.2rem; color:var(--gold); font-weight:bold;">${c.visitas}</span>
                    <small style="color:#666; font-size:0.7rem;">visitas</small>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function setText(id, val) {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
}