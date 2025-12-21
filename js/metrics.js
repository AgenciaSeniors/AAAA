// js/metrics.js - Versión Corregida (Sin errores de Timezone)

async function cargarMetricasVisitas() {
    console.log("Calculando métricas con ajuste REAL de zona horaria...");
    
    // 1. Obtenemos el momento actual
    const ahora = new Date();

    // 2. Calculamos la medianoche LOCAL (00:00:00 en el reloj del usuario)
    // El constructor new Date(año, mes, dia) usa la zona horaria del dispositivo
    const medianocheLocal = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

    // 3. Calculamos el inicio del mes LOCAL
    const inicioMesLocal = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    // 4. Convertimos a ISO para Supabase
    // .toISOString() hace la matemática automáticamente:
    // Si en Cuba es 00:00 (medianoche), lo convertirá a "...T05:00:00.000Z" (UTC correcto)
    const inicioDia = medianocheLocal.toISOString();
    const inicioMes = inicioMesLocal.toISOString();

    try {
        // ... (El resto de tu código de consultas sigue igual) ...
        
        // 1. Total de Visitas (Histórico)
        const { count: totalH } = await supabaseClient
            .from('visitas')
            .select('*', { count: 'exact', head: true });

        // 2. Visitas del Mes (Filtrado con fecha corregida)
        const { count: totalM } = await supabaseClient
            .from('visitas')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', inicioMes);

        // 3. Visitas de Hoy (Filtrado con fecha corregida)
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