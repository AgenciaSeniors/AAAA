// js/social-service.js - VERSIÓN CORREGIDA
// Asegúrate de que CONFIG.RESTAURANT_ID esté definido en config.js, o usa el string directo aquí.
const UMBRAL_VISITA_MS = 8 * 60 * 60 * 1000; 
const SOCIAL_RESTAURANT_ID = () => (typeof globalRestaurantId !== 'undefined' && globalRestaurantId) 
    ? globalRestaurantId 
    : CONFIG.RESTAURANT_ID;

let opinionesGlobal = []; 

// UTILIDADES AUXILIARES
function limpiarTelefono(input) {
    // 1. Quitamos absolutamente todo lo que no sea un número (+, espacios, guiones)
    let limpio = (input || "").replace(/\D/g, '');
    
    // 2. Si el usuario puso el código de país (53) delante (ej: 5363123456 o 5352123456)
    // El número tendrá 10 dígitos. En ese caso, cortamos el '53'.
    if (limpio.length === 10 && limpio.startsWith('53')) {
        limpio = limpio.substring(2);
    }
    
    return limpio;
}

function validarEntradasRegistro(nombre, telefono) {
    // Validación de nombre
    if (!nombre || nombre.length < 3) { 
        showToast("Nombre muy corto", "warning"); 
        return false; 
    }

    // EXPLICACIÓN DE LA NUEVA REGEX:
    // ^[56]     -> Debe empezar obligatoriamente con 5 o con 6.
    // \d{7}$    -> Debe seguir con exactamente 7 números más (para un total de 8).
    const regexMovilCuba = /^[56]\d{7}$/;

    if (!regexMovilCuba.test(telefono)) { 
        showToast("Número inválido. Debe empezar con 5 o 6 (8 dígitos).", "warning"); 
        return false; 
    }
    
    return true;
}

const SocialService = {
    // --- 1. BIENVENIDA Y REGISTRO ---
    // js/social-service.js

async checkWelcome() {
    let clienteId = localStorage.getItem('cliente_id');
    
    // Validación de seguridad para IDs corruptos
    if (clienteId === "undefined" || clienteId === "null" || (clienteId && clienteId.length < 10)) {
        localStorage.removeItem('cliente_id');
        clienteId = null;
    }

    const modal = document.getElementById('modal-welcome');

    if (clienteId) {
        // --- CLIENTE RECURRENTE DETECTADO ---
        
        // 1. Recuperamos el nombre para saludarlo
        const nombreGuardado = localStorage.getItem('cliente_nombre'); //
        
        // 2. Lanzamos el Toast de bienvenida (Solo si existe la función showToast)
        // <--- NUEVO BLOQUE DE CÓDIGO
        if (typeof showToast === 'function') {
            const saludo = nombreGuardado 
                ? `¡Qué bueno verte de nuevo, ${nombreGuardado}! 👋` 
                : "¡Bienvenido de nuevo! 👋";
            
            // Le damos un pequeño delay (500ms) para que la página cargue un poco antes de salir
            setTimeout(() => {
                showToast(saludo, "success");
            }, 500);
        }
        // <--- FIN NUEVO BLOQUE

        // --- LÓGICA DE CONTROL DE DUPLICADOS (8 HORAS) ---
        const storageKey = `visita_${SOCIAL_RESTAURANT_ID()}`; 
        const ahora = Date.now();
        const ultimaVisita = localStorage.getItem(storageKey);

        if (!ultimaVisita || (ahora - parseInt(ultimaVisita)) > UMBRAL_VISITA_MS) {
            
            const { error } = await supabaseClient.from('visitas').insert([{
                 cliente_id: clienteId,
                 restaurant_id: SOCIAL_RESTAURANT_ID(),
                 motivo: 'qr_scan' 
            }]);

            if (!error) {
                localStorage.setItem(storageKey, ahora.toString());
                console.log("Visita única registrada con éxito.");
            } else {
                console.error("Error Supabase:", error.message);
            }
        } else {
            console.log("Visita omitida: Se registró una hace menos de 8 horas.");
        }
        
        // Aseguramos que el modal esté oculto
        if (modal) modal.style.display = 'none';

    } else {
        // --- CLIENTE NUEVO ---
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    }
},

    async registrarBienvenida() {
        const nombreInput = document.getElementById('welcome-nombre');
        const telefonoInput = document.getElementById('welcome-phone');
        
        const nombre = nombreInput.value.trim();
        const telefonoRaw = telefonoInput.value.trim();
        const telefono = limpiarTelefono(telefonoRaw);
        
        if (!validarEntradasRegistro(nombre, telefono)) return;

        const btn = document.querySelector('.btn-modal-action');
        const txtOriginal = btn.textContent;
        
        btn.textContent = "Entrando...";
        btn.disabled = true;

        try {
            // UPSERT Cliente
            const { data: cliente, error: errCliente } = await supabaseClient
                .from('clientes')
                .upsert({ 
                    restaurant_id: SOCIAL_RESTAURANT_ID(), 
                    nombre: nombre, 
                    telefono: telefono 
                }, { onConflict: 'restaurant_id, telefono' }) 
                .select()
                .single();

            if (errCliente) throw errCliente;

            // Persistencia Local
            localStorage.setItem('cliente_id', cliente.id);
            localStorage.setItem('cliente_nombre', cliente.nombre);

            // Registrar visita
            await supabaseClient.from('visitas').insert([{
                 cliente_id: cliente.id,
                 restaurant_id: SOCIAL_RESTAURANT_ID(),
                 motivo: 'qr_scan'
            }]);
            const storageKey = `visita_${SOCIAL_RESTAURANT_ID()}`;
            localStorage.setItem(storageKey, Date.now().toString());
            this.cerrarWelcome();
            showToast(`¡Bienvenido a la experiencia, ${nombre}!`, "success");

        } catch (err) {
            console.error("Error en registro:", err);
            if (err.code === '23505') {
                showToast("Ya existe un registro con ese teléfono", "warning");
            } else {
                showToast("No pudimos registrarte. Intenta anónimo.", "error");
            }
        } finally {
            btn.textContent = txtOriginal;
            btn.disabled = false;
        }
    },

    cerrarWelcome() {
        const modal = document.getElementById('modal-welcome');
        if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 400); }
    },

    entrarComoAnonimo() { this.cerrarWelcome(); },

    // --- 2. GESTIÓN DE OPINIONES ---
    abrirOpinionDesdeDetalle() {
        // Verificación de seguridad por si AppStore no está cargado
        if (typeof AppStore === 'undefined') return console.error("AppStore no cargado");

        const productoActual = AppStore.getActiveProduct(); 
        if(typeof cerrarDetalle === 'function') cerrarDetalle();
        
        if (productoActual) AppStore.state.activeProduct = productoActual; 

        const modal = document.getElementById('modal-opinion');
        if (!modal) return;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        
        const nombre = localStorage.getItem('cliente_nombre');
        if (nombre && document.getElementById('cliente-nombre')) {
            document.getElementById('cliente-nombre').value = nombre;
        }
        
        AppStore.setReviewScore(0);
        this.actualizarEstrellas();
    },

    actualizarEstrellas() {
        if (typeof AppStore === 'undefined') return;
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

        const nombreEl = document.getElementById('cliente-nombre');
        const comentarioEl = document.getElementById('cliente-comentario');
        const nombre = nombreEl ? nombreEl.value : "Anónimo";
        const comentario = comentarioEl ? comentarioEl.value : "";

        const { error } = await supabaseClient.from('opiniones').insert([{
            restaurant_id: SOCIAL_RESTAURANT_ID(),
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
            // Recargar si estamos en admin
            if (typeof cargarOpiniones === 'function') cargarOpiniones();
        }
    },

    cerrarModalOpiniones() {
        const modal = document.getElementById('modal-opinion');
        if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
    },

    // --- 3. PANEL ADMIN ---
    async cargarOpiniones() {
        const { data, error } = await supabaseClient
            .from('opiniones')
            .select('*, productos(nombre, imagen_url)')
            .eq('restaurant_id', SOCIAL_RESTAURANT_ID())
            .order('created_at', { ascending: false });

        if (!error && data) {
            opinionesGlobal = data; 
            this.renderizarOpiniones(data);
            this.actualizarEstadisticasOpiniones(data);
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

    actualizarEstadisticasOpiniones(lista) {
        if (!lista || lista.length === 0) return;

        const sumaTotal = lista.reduce((acc, curr) => acc + curr.puntuacion, 0);
        const promedioGral = (sumaTotal / lista.length).toFixed(1);

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
            if (p > mejor.prom) {
                mejor = { nombre: c.nombre, prom: p };
            }
        });

        if (document.getElementById('stat-promedio')) document.getElementById('stat-promedio').textContent = promedioGral;
        if (document.getElementById('stat-total')) document.getElementById('stat-total').textContent = lista.length;
        
        const elMejor = document.getElementById('stat-mejor');
        if (elMejor) {
            elMejor.textContent = mejor.nombre;
            elMejor.title = `Promedio: ${mejor.prom.toFixed(1)}`;
        }
    },

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

    async eliminarOpinion(id) {
        if (!confirm("¿Seguro que quieres borrar esta opinión?")) return;
        
        // CORRECCIÓN: Agregamos .eq('restaurant_id', ...) para doble seguridad
        const { error } = await supabaseClient
            .from('opiniones')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', SOCIAL_RESTAURANT_ID()); // <--- Seguridad Extra

        if (error) {
            console.error("Error borrando:", error);
            showToast("Error: No tienes permiso para borrar esto.", "error");
        } else {
            showToast("Opinión eliminada", "success");
            this.cargarOpiniones(); 
        }
    },

   // --- 4. MÉTRICAS VISITAS ---
    async cargarMetricasVisitas() {
        try {
            // CORRECCIÓN: Se agregó el parámetro { rid: SOCIAL_RESTAURANT_ID() }
            const { data, error } = await supabaseClient.rpc('obtener_contadores_dashboard', { 
                rid: SOCIAL_RESTAURANT_ID() 
            });

            if (error) throw error;

            if (data && data.length > 0) {
                const c = data[0];
                this.setVal('stat-hoy', c.hoy);
                this.setVal('stat-ayer', c.ayer);
                this.setVal('stat-semana', c.semana);
                this.setVal('stat-mes', c.mes);
                this.setVal('stat-anio', c.anio);
                this.setVal('stat-unique-clients', c.total_clientes);

                const trendEl = document.getElementById('pct-hoy');
                if (trendEl && c.ayer > 0) {
                    const diff = ((c.hoy - c.ayer) / c.ayer) * 100;
                    const color = diff >= 0 ? '#00ff88' : '#ff4444';
                    trendEl.innerHTML = `<span style="color:${color}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(0)}%</span> vs ayer`;
                }
            }
            // Estas líneas no se ejecutaban porque la anterior fallaba
            this.cargarTopClientes();
            this.dibujarGraficos();
        } catch (e) { console.error("Error métricas:", e); }
    },

    // CORREGIDO: Función duplicada eliminada
    setVal(id, val) { 
        const el = document.getElementById(id); 
        if(el) el.textContent = val !== undefined ? val : 0; 
    },

    async dibujarGraficos() {
        // Verificar que Chart.js esté cargado
        if (typeof Chart === 'undefined') {
            console.warn("Chart.js no está cargado. Los gráficos no se mostrarán.");
            return;
        }

        // Gráfico de Tendencia
        const { data: tend } = await supabaseClient.rpc('obtener_tendencia_visitas', { 
    rid: SOCIAL_RESTAURANT_ID() 
});
        if (tend) {
            this.initChart('chart-visitas', {
                labels: tend.map(d => new Date(d.fecha).toLocaleDateString('es-ES', {day:'numeric', month:'short'})),
                data: tend.map(d => d.conteo),
                label: 'Visitas',
                color: '#00d4ff'
            });
        }

        // Gráfico de Horas Punta
        const { data: hrs } = await supabaseClient.rpc('obtener_horas_punta', { 
    rid: SOCIAL_RESTAURANT_ID() 
});
        if (hrs) {
            const dataFull = Array.from({length: 24}, (_, i) => ({ hora: i, conteo: 0 }));
            hrs.forEach(h => { if(dataFull[h.hora]) dataFull[h.hora].conteo = h.conteo; });

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
                scales: { 
                    y: { beginAtZero: true, grid: { color: '#333' } }, 
                    x: { grid: { display: false } } 
                }
            }
        });
    },

    async cargarTopClientes() {
        const { data, error } = await supabaseClient.rpc('obtener_top_clientes', { 
    rid: SOCIAL_RESTAURANT_ID() 
});
        const container = document.getElementById('top-clientes-list');
        
        if (error || !data) {
            if (container) container.innerHTML = '<p style="text-align:center; color:#666;">No hay datos VIP aún.</p>';
            return;
        }

        if (container) {
            container.innerHTML = data.map((c, i) => {
                const medal = ['🥇', '🥈', '🥉'][i] || '👤';
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

// EXPOSICIÓN GLOBAL (Fundamental para que el HTML encuentre las funciones)
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
if (typeof currentAdminRestaurantId !== 'undefined') {
    window.globalRestaurantId = currentAdminRestaurantId;
}