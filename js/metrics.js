// js/metrics.js - Versión Corregida (Sin errores de Timezone)

async function cargarMetricasVisitas() {
    console.log("Calculando métricas con ajuste de zona horaria...");
    
    // Obtenemos la fecha local en formato YYYY-MM-DD sin desfase UTC
    const hoy = new Date();
    const isoFecha = hoy.toLocaleDateString('en-CA'); // "2023-10-27"
    const inicioDia = `${isoFecha}T00:00:00.000Z`;
    const inicioMes = `${isoFecha.substring(0, 7)}-01T00:00:00.000Z`;

    try {
        // 1. Total de Visitas (Histórico)
        const { count: totalH } = await supabaseClient
            .from('visitas')
            .select('*', { count: 'exact', head: true });

        // 2. Visitas del Mes (Filtrado)
        const { count: totalM } = await supabaseClient
            .from('visitas')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', inicioMes);

        // 3. Visitas de Hoy (Filtrado)
        const { count: totalD } = await supabaseClient
            .from('visitas')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', inicioDia);

        // Actualización de la UI
        if (document.getElementById('stat-unique-clients')) 
            document.getElementById('stat-unique-clients').textContent = totalH || 0;
        
        if (document.getElementById('stat-mes')) 
            document.getElementById('stat-mes').textContent = totalM || 0;
        
        if (document.getElementById('stat-hoy')) {
            document.getElementById('stat-hoy').textContent = totalD || 0;
            document.getElementById('trend-hoy').textContent = "Sincronizado";
        }

        // Cargar componentes adicionales
        if (typeof cargarGraficoTendencia === 'function') cargarGraficoTendencia();
        if (typeof cargarTopClientes === 'function') cargarTopClientes();

    } catch (err) {
        console.error("Error cargando métricas:", err);
    }
}

// Asegúrate de que cargarTopClientes maneje errores si no hay relación de BD
async function cargarTopClientes() {
    const container = document.getElementById('top-clientes-list');
    if (!container) return;

    // Si visitas(count) falla, es por falta de Foreign Key en Supabase
    const { data: clientes, error } = await supabaseClient
        .from('clientes')
        .select('*, visitas(count)');

    if (error) {
        console.warn("Aviso: Verifica la Foreign Key entre Clientes y Visitas en Supabase.");
        container.innerHTML = '<p style="text-align:center; color:#666;">Configura la relación en la BD para ver VIPs.</p>';
        return;
    }

    const ranking = (clientes || [])
        .sort((a, b) => (b.visitas[0]?.count || 0) - (a.visitas[0]?.count || 0))
        .slice(0, 5);

    container.innerHTML = ranking.map((c, i) => {
        const iconos = ['👑', '🥇', '🥈', '🥉', '👤'];
        return `
            <div class="inventory-item" style="justify-content: space-between;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span>${iconos[i] || '👤'}</span>
                    <div>
                        <div class="item-title">${c.nombre}</div>
                        <small>${c.telefono || 'Sin ID'}</small>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span style="color:var(--gold); font-weight:bold;">${c.visitas[0]?.count || 0}</span>
                </div>
            </div>`;
    }).join('');
}