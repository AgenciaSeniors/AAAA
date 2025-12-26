// js/social-service.js
const RESTAURANT_ID = '3d615b07-c20b-492e-a3b1-e25951967a47';
let opinionesGlobal = []; // Memoria para filtros sin recarga

// UTILIDADES AUXILIARES
function limpiarTelefono(input) {
    let limpio = (input || "").replace(/\D/g, '');
    if (limpio.length === 10 && limpio.startsWith('53')) limpio = limpio.substring(2);
    return limpio;
}

function validarEntradasRegistro(nombre, telefono) {
    if (!nombre || nombre.length < 3) { showToast("Nombre muy corto", "warning"); return false; }
    if (!/^\d{8}$/.test(telefono)) { showToast("Teléfono inválido (8 dígitos)", "warning"); return false; }
    return true;
}

const SocialService = {
    // --- 1. BIENVENIDA Y REGISTRO ---
    async checkWelcome() {
        const clienteId = localStorage.getItem('cliente_id');
        const nombre = localStorage.getItem('cliente_nombre');
        const modal = document.getElementById('modal-welcome');

        if (clienteId) {
            await supabaseClient.from('visitas').insert([{
                 cliente_id: clienteId,
                 restaurant_id: RESTAURANT_ID
                 }]);
                 
            if (modal) modal.style.display = 'none';
            if (nombre) {
                setTimeout(() => showToast(`¡Qué bueno verte de nuevo, ${nombre}!`, "success"), 1500);
            }
        } else {
            if (modal) {
                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('active'), 10);
            }
        }
    },

    async registrarBienvenida() {
    // 1. Obtener datos del DOM
    const nombreInput = document.getElementById('welcome-nombre');
    const telefonoInput = document.getElementById('welcome-phone');
    
    const nombre = nombreInput.value.trim();
    const telefonoRaw = telefonoInput.value.trim();
    
    // 2. Validación (Usamos tu función auxiliar limpiarTelefono)
    const telefono = limpiarTelefono(telefonoRaw);
    
    // Usamos la validación que ya tenías definida arriba
    if (!validarEntradasRegistro(nombre, telefono)) return;

    const RESTAURANT_ID = CONFIG.RESTAURANT_ID; 
    const btn = document.querySelector('.btn-modal-action');
    const txtOriginal = btn.textContent;
    
    // Feedback visual de carga
    btn.textContent = "Entrando...";
    btn.disabled = true;

    try {
        // 3. Insertar o Actualizar Cliente (UPSERT)
        const { data: cliente, error: errCliente } = await supabaseClient
            .from('clientes')
            .upsert({ 
                restaurant_id: RESTAURANT_ID, 
                nombre: nombre, 
                telefono: telefono 
            }, { onConflict: 'restaurant_id, telefono' }) // Clave única compuesta
            .select()
            .single();

        if (errCliente) throw errCliente;

        // --- PASO CRUCIAL QUE FALTABA ---
        
        // 4. Guardar en el navegador (Persistencia)
        localStorage.setItem('cliente_id', cliente.id);
        localStorage.setItem('cliente_nombre', cliente.nombre);

        // 5. Registrar la visita inmediatamente
        await supabaseClient.from('visitas').insert([{
             cliente_id: cliente.id,
             restaurant_id: RESTAURANT_ID
        }]);

        // 6. Cerrar modal y saludar
        this.cerrarWelcome();
        showToast(`¡Bienvenido a la experiencia, ${nombre}!`, "success");

    } catch (err) {
        console.error("Error en registro:", err);
        // Mensaje amigable si es error de duplicado o permisos
        if (err.code === '23505') {
            showToast("Ya existe un registro con ese teléfono", "warning");
        } else {
            showToast("No pudimos registrarte. Intenta anónimo.", "error");
        }
    } finally {
        // Restaurar botón
        btn.textContent = txtOriginal;
        btn.disabled = false;
    }
},
    cerrarWelcome() {
        const modal = document.getElementById('modal-welcome');
        if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 400); }
    },
    entrarComoAnonimo() { this.cerrarWelcome(); },

    // --- 2. GESTIÓN DE OPINIONES (CLIENTE) ---
    abrirOpinionDesdeDetalle() {
        const productoActual = AppStore.getActiveProduct(); 
        cerrarDetalle();
        
        if (productoActual) AppStore.state.activeProduct = productoActual; 

        const modal = document.getElementById('modal-opinion');
        if (!modal) return;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        
        const nombre = localStorage.getItem('cliente_nombre');
        if (nombre) document.getElementById('cliente-nombre').value = nombre;
        
        AppStore.setReviewScore(0);
        this.actualizarEstrellas();
    },

    actualizarEstrellas() {
        const score = AppStore.state.reviewScore;
        document.querySelectorAll('#stars-container span').forEach(s => {
            const val = parseInt(s.dataset.val);
            s.style.color = val <= score ? 'var(--gold)' : '#444';
            s.style.textShadow = val <= score ? '0 0 10px var(--gold-glow)' : 'none';
        });
    },

    async enviarOpinion() {
    const score = AppStore.state.reviewScore;
    const prod = AppStore.getActiveProduct();
    
    if (score === 0) return showToast("¡Marca las estrellas!", "warning");
    if (!prod) return showToast("Error: Producto no identificado", "error");

    const nombre = document.getElementById('cliente-nombre').value || "Anónimo";
    const comentario = document.getElementById('cliente-comentario').value;

    const { error } = await supabaseClient.from('opiniones').insert([{
        restaurant_id: RESTAURANT_ID, // <--- ESTA LÍNEA SOLUCIONA EL ERROR
        producto_id: prod.id, 
        cliente_nombre: nombre, 
        comentario: comentario, 
        puntuacion: score
    }]);

    if (error) {
        showToast("Error: " + error.message, "error");
    } else {
        showToast("¡Gracias por tu opinión!", "success");
        this.cerrarModalOpiniones();
        if (typeof cargarOpiniones === 'function') cargarOpiniones();
    }
},

    cerrarModalOpiniones() {
        const modal = document.getElementById('modal-opinion');
        if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
    },

    // --- 3. PANEL ADMIN (ESTO ES LO NUEVO) ---
    async cargarOpiniones() {
        const { data, error } = await supabaseClient
            .from('opiniones')
            .select('*, productos(nombre, imagen_url)')
            .order('created_at', { ascending: false });

        if (!error && data) {
            opinionesGlobal = data; 
            this.renderizarOpiniones(data);
            this.actualizarEstadisticasOpiniones(data); // ¡Calcula promedios!
        }
    },

    renderizarOpiniones(lista) {
        const container = document.getElementById('grid-opiniones');
        if (!container) return;

        if (lista.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:#666;">No hay opiniones con este filtro.</div>';
            return;
        }

        container.innerHTML = lista.map(op => {
            const fecha = new Date(op.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            const inicial = op.cliente_nombre ? op.cliente_nombre.charAt(0).toUpperCase() : '?';
            const estrellas = "★".repeat(op.puntuacion);
            const colorNota = op.puntuacion >= 4 ? 'var(--gold)' : (op.puntuacion <= 2 ? '#ff4444' : '#ccc');

            return `
            <div class="review-card">
                <div class="review-header">
                    <div class="user-profile">
                        <div class="user-avatar">${inicial}</div>
                        <div class="user-info">
                            <h4>${op.cliente_nombre || 'Anónimo'}</h4>
                            <span class="review-date">${fecha}</span>
                        </div>
                    </div>
                    <div class="review-rating" style="color:${colorNota}">${estrellas}</div>
                </div>
                <div class="review-body">
                    <p class="review-text">"${op.comentario}"</p>
                </div>
                <div class="review-footer">
                    <div class="product-tag">
                        <img src="${op.productos?.imagen_url || 'img/logo.png'}" onerror="this.src='img/logo.png'">
                        <span>${op.productos?.nombre || 'Producto eliminado'}</span>
                    </div>
                    <button class="btn-delete-icon" onclick="eliminarOpinion(${op.id})" title="Borrar">
                        <span class="material-icons">delete_outline</span>
                    </button>
                </div>
            </div>`;
        }).join('');
    },

    // NUEVA FUNCIÓN: MATEMÁTICAS
    // js/social-service.js - Función corregida
    actualizarEstadisticasOpiniones(lista) {
        if (!lista || lista.length === 0) return;

        // A. Promedio General
        const sumaTotal = lista.reduce((acc, curr) => acc + curr.puntuacion, 0);
        const promedioGral = (sumaTotal / lista.length).toFixed(1);

        // B. Cálculo del Mejor Producto
        const conteo = {};
        lista.forEach(op => {
            const pid = op.producto_id;
            const pNombre = op.productos?.nombre || 'Producto';
            if (!conteo[pid]) conteo[pid] = { nombre: pNombre, suma: 0, votos: 0 };
            conteo[pid].suma += op.puntuacion;
            conteo[pid].votos += 1;
        });

        let mejor = { nombre: 'Sin datos', prom: 0 };
        Object.values(conteo).forEach(c => {
            const p = c.suma / c.votos;
            // Eliminamos la restricción de 'votos > 1' para que funcione desde la primera reseña
            if (p > mejor.prom) {
                mejor = { nombre: c.nombre, prom: p };
            }
        });

        // C. Inyección en el DOM
        if (document.getElementById('stat-promedio')) document.getElementById('stat-promedio').textContent = promedioGral;
        if (document.getElementById('stat-total')) document.getElementById('stat-total').textContent = lista.length;
        
        // Mostramos el nombre del producto mejor calificado
        const elMejor = document.getElementById('stat-mejor');
        if (elMejor) {
            elMejor.textContent = mejor.nombre;
            elMejor.title = `Promedio: ${mejor.prom.toFixed(1)}`; // Tooltip con el promedio exacto
        }
    },

    // NUEVA FUNCIÓN: FILTRAR
    filtrarOpiniones(criterio, btnHTML) {
        if (btnHTML) {
            document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
            btnHTML.classList.add('active');
        }

        let filtradas = opinionesGlobal;
        if (criterio === '5') filtradas = opinionesGlobal.filter(op => op.puntuacion === 5);
        if (criterio === 'alertas') filtradas = opinionesGlobal.filter(op => op.puntuacion <= 2);

        this.renderizarOpiniones(filtradas);
    },

    // NUEVA FUNCIÓN: ELIMINAR
    async eliminarOpinion(id) {
        if (!confirm("¿Seguro que quieres borrar esta opinión?")) return;
        const { error } = await supabaseClient.from('opiniones').delete().eq('id', id);
        if (error) {
            showToast("Error: " + error.message, "error");
        } else {
            showToast("Opinión eliminada", "success");
            this.cargarOpiniones();
        }
    },

    // --- 4. MÉTRICAS VISITAS ---
async cargarMetricasVisitas() {
    try {
        const { data, error } = await supabaseClient.rpc('obtener_contadores_dashboard');
        if (error) throw error;

        const c = data[0];
        this.setVal('stat-hoy', c.hoy);
        this.setVal('stat-ayer', c.ayer);
        this.setVal('stat-semana', c.semana);
        this.setVal('stat-mes', c.mes);
        this.setVal('stat-anio', c.anio);
        this.setVal('stat-unique-clients', c.total_clientes);

        // Comparación porcentual
        const trendEl = document.getElementById('pct-hoy');
        if (trendEl && c.ayer > 0) {
            const diff = ((c.hoy - c.ayer) / c.ayer) * 100;
            const color = diff >= 0 ? '#00ff88' : '#ff4444';
            trendEl.innerHTML = `<span style="color:${color}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(0)}%</span> vs ayer`;
        }
        this.cargarTopClientes();
        this.dibujarGraficos();
    } catch (e) { console.error(e); }
},

// Función auxiliar para evitar errores de DOM
setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined ? val : 0;
},

setVal(id, val) { 
    const el = document.getElementById(id); 
    if(el) el.textContent = val || 0; 
},

async dibujarGraficos() {
    // Gráfico de Tendencia (Line)
    const { data: tend } = await supabaseClient.rpc('obtener_tendencia_visitas');
    if (tend) {
        this.initChart('chart-visitas', {
            labels: tend.map(d => new Date(d.fecha).toLocaleDateString('es-ES', {day:'numeric', month:'short'})),
            data: tend.map(d => d.conteo),
            label: 'Visitas',
            color: '#00d4ff'
        });
    }

    // Gráfico de Horas Punta (Bar)
    const { data: hrs } = await supabaseClient.rpc('obtener_horas_punta');
    if (hrs) {
        // Rellenar las 24 horas del día
        const dataFull = Array.from({length: 24}, (_, i) => ({ hora: i, conteo: 0 }));
        hrs.forEach(h => dataFull[h.hora].conteo = h.conteo);

        this.initChart('chart-horas', {
            type: 'bar',
            labels: dataFull.map(h => `${h.hora}:00`),
            data: dataFull.map(h => h.conteo),
            label: 'Frecuencia',
            color: '#ff0055'
        });
    }
},

initChart(id, conf) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    
    // Destruir instancia previa si existe para evitar solapamiento
    if (window[id + 'Inst']) window[id + 'Inst'].destroy();

    window[id + 'Inst'] = new Chart(canvas, {
        type: conf.type || 'line',
        data: {
            labels: conf.labels,
            datasets: [{
                label: conf.label,
                data: conf.data,
                borderColor: conf.color,
                backgroundColor: conf.color + '22',
                fill: true,
                tension: 0.4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: '#333' } }, x: { grid: { display: false } } }
        }
    });
},

async cargarTopClientes() {
    const { data, error } = await supabaseClient.rpc('obtener_top_clientes');
    const container = document.getElementById('top-clientes-list');
    
    if (error || !data) {
        if (container) container.innerHTML = '<p style="text-align:center; color:#666;">No hay datos VIP aún.</p>';
        return;
    }

    if (container) {
        container.innerHTML = data.map((c, i) => {
            const medal = ['🥇', '🥈', '🥉'][i] || '👤';
            // Formateamos el teléfono para que sea clicable (opcional)
            const linkTel = `tel:+53${c.telefono}`; 
            
            return `
                <div class="review-card" style="margin-bottom:10px; padding:15px; flex-direction:row; align-items:center; gap:15px;">
                    <div class="user-avatar" style="width:50px; height:50px; font-size:1.5rem;">${medal}</div>
                    <div style="flex-grow:1;">
                        <h4 style="margin:0; color:white;">${c.nombre}</h4>
                        <a href="${linkTel}" style="font-size:0.8rem; color:var(--neon-cyan); text-decoration:none;">
                            📞 ${c.telefono}
                        </a>
                    </div>
                    <div class="review-rating" style="background:rgba(255,215,0,0.1); color:var(--gold); border:1px solid var(--gold); min-width:80px; text-align:center;">
                        ${c.total_visitas} visitas
                    </div>
                </div>`;
        }).join('');
    }
}
};

// EXPOSICIÓN GLOBAL
window.checkWelcome = () => SocialService.checkWelcome();
window.registrarBienvenida = () => SocialService.registrarBienvenida();
window.entrarComoAnonimo = () => SocialService.entrarComoAnonimo();
window.abrirOpinionDesdeDetalle = () => SocialService.abrirOpinionDesdeDetalle();
window.enviarOpinion = () => SocialService.enviarOpinion();
window.cerrarModalOpiniones = () => SocialService.cerrarModalOpiniones();
window.actualizarEstrellas = () => SocialService.actualizarEstrellas();
window.cargarOpiniones = () => SocialService.cargarOpiniones();
window.filtrarOpiniones = (c, b) => SocialService.filtrarOpiniones(c, b);
window.eliminarOpinion = (id) => SocialService.eliminarOpinion(id);
window.cargarMetricasVisitas = () => SocialService.cargarMetricasVisitas();