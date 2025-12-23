let ultimaCargaMetricas = 0;
async function cargarMetricasVisitas() {
    const AHORA_MS = Date.now();
    // Si se cargó hace menos de 1 minuto, no molestar a la DB
    if (AHORA_MS - ultimaCargaMetricas < 60000) return;
    console.log("🚀 Cargando métricas optimizadas...");

    // Cálculo de fechas locales (usando la corrección "cubana" que vimos antes)
    const ahora = new Date();
    const medianocheLocal = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const inicioMesLocal = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    try {
        // LLAMADA ÚNICA A SUPABASE
        // Enviamos las fechas calculadas y recibimos todo junto
        const { data: metricas, error } = await supabaseClient
            .rpc('obtener_contadores_dashboard', {
                fecha_inicio_dia: medianocheLocal.toISOString(),
                fecha_inicio_mes: inicioMesLocal.toISOString()
            });

        if (error) throw error;

        // Actualización de la UI (Instantánea)
        if (metricas) {
            // Histórico
            if (document.getElementById('stat-unique-clients')) 
                document.getElementById('stat-unique-clients').textContent = metricas.historico || 0;
            
            // Mensual
            if (document.getElementById('stat-mes')) 
                document.getElementById('stat-mes').textContent = metricas.mensual || 0;
            
            // Diario
            if (document.getElementById('stat-hoy')) {
                document.getElementById('stat-hoy').textContent = metricas.diario || 0;
                document.getElementById('trend-hoy').textContent = "Al día";
            }
        }

        // Cargar el resto de cosas (Gráficos y Ranking)
        if (typeof cargarGraficoTendencia === 'function') cargarGraficoTendencia();
        if (typeof cargarTopClientes === 'function') cargarTopClientes(); // ¡Recuerda usar la versión optimizada aquí también!

    } catch (err) {
        console.error("Error en métricas:", err);
        // Opcional: Mostrar guiones si falla
        ['stat-unique-clients', 'stat-mes', 'stat-hoy'].forEach(id => {
             const el = document.getElementById(id);
             if(el) el.textContent = "-";
        });
    }
}
async function cargarTopClientes() {
    const container = document.getElementById('top-clientes-list');
    if (!container) return;

    // Mostramos un estado de carga ligero
    container.innerHTML = '<p style="text-align:center; color:#888; font-size:0.9rem;">Calculando líderes...</p>';

    try {
        // LLAMADA OPTIMIZADA: Usamos .rpc() para ejecutar la función en el servidor
        // Esto descarga solo 5 objetos JSON, rapidísimo.
        const { data: ranking, error } = await supabaseClient
            .rpc('obtener_top_clientes');

        if (error) throw error;

        // Si no hay datos (base de datos vacía)
        if (!ranking || ranking.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#666;">Aún no hay visitas registradas.</p>';
            return;
        }

        // Renderizado (Idéntico a tu lógica visual, pero usando los datos directos)
        container.innerHTML = ranking.map((c, i) => {
            const iconos = ['👑', '🥇', '🥈', '🥉', '👤'];
            // Nota: La RPC devuelve 'total_visitas', no 'visitas[0].count'
            const cantidad = c.total_visitas || 0; 
            
            return `
                <div class="inventory-item" style="justify-content: space-between;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span>${iconos[i] || '👤'}</span>
                        <div>
                            <div class="item-title">${c.nombre}</div>
                            <small>${c.telefono || 'Sin Teléfono'}</small>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span style="color:var(--gold); font-weight:bold;">${cantidad}</span>
                    </div>
                </div>`;
        }).join('');

    } catch (err) {
        console.error("Error cargando ranking:", err);
        container.innerHTML = '<p style="text-align:center; color:var(--neon-red);">Error de conexión</p>';
    }
}