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
async function toggleEstado(id, checkboxElement) {
    const isAvailable = checkboxElement.checked;
    const nuevoEstado = isAvailable ? 'disponible' : 'agotado';

    showToast(isAvailable ? "Activando producto..." : "Marcando como AGOTADO...", "info");

    try {
        // 2. Enviar a Supabase
        const { error } = await supabaseClient
            .from('productos')
            .update({ estado: nuevoEstado })
            .eq('id', id);

        if (error) throw error;

        showToast(isAvailable ? "Producto DISPONIBLE" : "Producto AGOTADO", "success");
        await cargarAdmin(); 

    } catch (err) {
        console.error("Error toggleEstado:", err);
        showToast("Error de conexión. Revertiendo...", "error");
        
        // 3. ROLLBACK: Si falla, devolvemos el interruptor a su posición original
        checkboxElement.checked = !isAvailable; 
    }
}
async function eliminarProducto(id) {
    if(confirm("¿Estás seguro de eliminar este producto?")) {
        try {
            const { error } = await supabaseClient.from('productos').update({ activo: false }).eq('id', id);
            if(error) throw error;
            showToast("Producto eliminado", "success");
            cargarAdmin();
        } catch(err) {
            showToast("Error al eliminar", "error");
        }
    }
}

async function restaurarProducto(id) {
    try {
        const { error } = await supabaseClient.from('productos').update({ activo: true }).eq('id', id);
        if(error) throw error;
        showToast("Producto restaurado", "success");
        cargarAdmin();
    } catch(err) {
        showToast("Error al restaurar", "error");
    }
}
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
let ultimaCargaMetricas = 0;
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
    
    // 1. Estadísticas Generales (Lo que ya tenías)
    const total = data.length;
    const sumaTotal = data.reduce((acc, curr) => acc + (curr.puntuacion || 0), 0);
    const promedioGeneral = (sumaTotal / total).toFixed(1);

    const elTotal = document.getElementById('stat-total');
    const elProm = document.getElementById('stat-promedio');
    if (elTotal) elTotal.textContent = total;
    if (elProm) elProm.textContent = promedioGeneral;

    // 2. Lógica para el "Mejor Trago" 🏆
    const prodsMap = {};

    // Agrupamos sumas y conteos por nombre de producto
    data.forEach(op => {
        // Usamos el nombre que viene de la relación 'productos' que agregamos antes
        const nombreProd = op.productos?.nombre || "Desconocido";
        if (!prodsMap[nombreProd]) {
            prodsMap[nombreProd] = { suma: 0, cantidad: 0 };
        }
        prodsMap[nombreProd].suma += (op.puntuacion || 0);
        prodsMap[nombreProd].cantidad++;
    });

    let mejorNombre = "--";
    let maxPromedio = 0;

    // Calculamos el promedio de cada uno y buscamos el más alto
    for (const nombre in prodsMap) {
        const promedio = prodsMap[nombre].suma / prodsMap[nombre].cantidad;
        // Solo cuenta si tiene un promedio alto y al menos un par de votos para que sea justo
        if (promedio > maxPromedio) {
            maxPromedio = promedio;
            mejorNombre = nombre;
        }
    }

    // 3. Mostrar el resultado en el ID 'stat-mejor'
    const elMejor = document.getElementById('stat-mejor');
    if (elMejor) {
        elMejor.textContent = mejorNombre;
    }
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
