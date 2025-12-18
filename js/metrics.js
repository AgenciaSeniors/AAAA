// js/metrics.js - Métricas optimizadas (Count nativo)

async function cargarMetricasVisitas() {
    console.log("Cargando métricas optimizadas...");

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
    const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();

    // 1. Visitas Totales (Count Exacto)
    const { count: total, error: errTotal } = await supabaseClient
        .from('visitas')
        .select('*', { count: 'exact', head: true });

    if (!errTotal) setText('stat-unique-clients', total); // Reutilizamos ID en UI

    // 2. Visitas Mes Actual
    const { count: mes, error: errMes } = await supabaseClient
        .from('visitas')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioMes);

    if (!errMes) setText('stat-mes', mes);

    // 3. Visitas Hoy
    const { count: dia, error: errDia } = await supabaseClient
        .from('visitas')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia);

    if (!errDia) {
        setText('stat-hoy', dia);
        setText('trend-hoy', "Datos en tiempo real");
    }

    // 4. Cargar Gráficos (Solo si es necesario)
    cargarGraficoTendencia();
}

async function cargarGraficoTendencia() {
    const canvas = document.getElementById('chart-visitas');
    if (!canvas) return;

    // Obtenemos ultimos 7 dias (Aquí sí necesitamos datos, pero limitados)
    const fecha7dias = new Date();
    fecha7dias.setDate(fecha7dias.getDate() - 7);

    const { data } = await supabaseClient
        .from('visitas')
        .select('created_at')
        .gte('created_at', fecha7dias.toISOString());

    if (!data) return;

    // Agrupar por día
    const agrupado = {};
    data.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleDateString();
        agrupado[fecha] = (agrupado[fecha] || 0) + 1;
    });

    const labels = Object.keys(agrupado);
    const valores = Object.values(agrupado);

    new Chart(canvas, {
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

function setText(id, val) {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
}