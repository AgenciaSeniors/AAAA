// js/metrics.js - Visitas y Clientes VIP

async function cargarMetricasVisitas() {
    console.log("Cargando métricas de visitas...");
    const hoy = new Date();
    const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();

    // Estadísticas rápidas
    const { count: totalH } = await supabaseClient.from('visitas').select('*', { count: 'exact', head: true });
    const { count: totalM } = await supabaseClient.from('visitas').select('*', { count: 'exact', head: true }).gte('created_at', inicioMes);
    const { count: totalD } = await supabaseClient.from('visitas').select('*', { count: 'exact', head: true }).gte('created_at', inicioDia);

    if (document.getElementById('stat-unique-clients')) document.getElementById('stat-unique-clients').textContent = totalH || 0;
    if (document.getElementById('stat-mes')) document.getElementById('stat-mes').textContent = totalM || 0;
    if (document.getElementById('stat-hoy')) {
        document.getElementById('stat-hoy').textContent = totalD || 0;
        document.getElementById('trend-hoy').textContent = "Hoy en tiempo real";
    }

    cargarGraficoTendencia();
    cargarGraficoHoras();
    cargarTopClientes();
}

async function cargarGraficoHoras() {
    const canvas = document.getElementById('chart-horas');
    if (!canvas) return;
    if (window.chartHoras) window.chartHoras.destroy();

    const { data } = await supabaseClient.from('visitas').select('created_at');
    if (!data) return;

    const horasCount = new Array(24).fill(0);
    data.forEach(v => {
        const hora = new Date(v.created_at).getHours();
        horasCount[hora]++;
    });

    const labels = horasCount.map((_, i) => `${i}:00`).filter((_, i) => horasCount[i] > 0);
    const valores = horasCount.filter(v => v > 0);

    window.chartHoras = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Escaneos', data: valores, backgroundColor: '#FFD700' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

async function cargarTopClientes() {
    const container = document.getElementById('top-clientes-list');
    if (!container) return;

    // Forma segura: Traer clientes y contar sus visitas por separado si no hay FK
    const { data: clientes, error } = await supabaseClient
        .from('clientes')
        .select('*, visitas(count)'); // Esto requiere que 'visitas' tenga una columna 'cliente_id' apuntando a 'clientes'

    if (error || !clientes || clientes.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#666;">No hay datos de clientes VIP.</p>';
        return;
    }

    // Ordenar por el conteo de visitas
    const ranking = clientes
        .sort((a, b) => (b.visitas[0]?.count || 0) - (a.visitas[0]?.count || 0))
        .slice(0, 5);

    container.innerHTML = ranking.map((c, i) => {
        const iconos = ['👑', '🥇', '🥈', '🥉', '👤'];
        const totalVisitas = c.visitas[0]?.count || 0;
        return `
            <div class="inventory-item" style="justify-content: space-between;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.2rem;">${iconos[i] || '👤'}</span>
                    <div>
                        <div class="item-title">${c.nombre}</div>
                        <small style="color:#666;">${c.telefono || 'Sin teléfono'}</small>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span style="color:var(--gold); font-weight:bold;">${totalVisitas}</span>
                    <small style="display:block; font-size:0.6rem; color:#666;">VISITAS</small>
                </div>
            </div>
        `;
    }).join('');
}