// js/social-service.js
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
        const nombre = document.getElementById('welcome-nombre').value.trim();
        const telefonoRaw = document.getElementById('welcome-phone').value;
        const telefono = limpiarTelefono(telefonoRaw);

        if (!validarEntradasRegistro(nombre, telefono)) return;

        try {
            const { data: cliente } = await supabaseClient.from('clientes').select('id, nombre').eq('telefono', telefono).maybeSingle();
            
            let id, nombreFinal;
            if (cliente) {
                id = cliente.id;
                nombreFinal = cliente.nombre;
                showToast(`¡Te reconocimos! Hola, ${nombreFinal}`, "success");
            } else {
                const { data: nuevo } = await supabaseClient.from('clientes').insert([{ nombre, telefono }]).select().single();
                id = nuevo.id;
                nombreFinal = nombre;
                showToast(`¡Bienvenido, ${nombreFinal}!`, "success");
            }
            
            localStorage.setItem('cliente_id', id);
            localStorage.setItem('cliente_nombre', nombreFinal);
            this.cerrarWelcome();
        } catch (e) {
            sessionStorage.setItem('es_invitado', 'true');
            this.cerrarWelcome();
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
            if (typeof cargarOpiniones === 'function') cargarOpiniones(); // Refrescar si es admin
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
    actualizarEstadisticasOpiniones(lista) {
        if (!lista || lista.length === 0) return;

        // A. Promedio
        const suma = lista.reduce((acc, curr) => acc + curr.puntuacion, 0);
        const promedio = (suma / lista.length).toFixed(1);

        // B. Mejor Producto
        const conteo = {};
        lista.forEach(op => {
            const pid = op.producto_id;
            const pNombre = op.productos?.nombre || 'Desc';
            if (!conteo[pid]) conteo[pid] = { nombre: pNombre, suma: 0, votos: 0 };
            conteo[pid].suma += op.puntuacion;
            conteo[pid].votos += 1;
        });

        let mejor = { nombre: 'N/A', prom: 0 };
        Object.values(conteo).forEach(c => {
            if (c.votos > 1) { 
                const p = c.suma / c.votos;
                if (p > mejor.prom) mejor = { nombre: c.nombre, prom: p };
            }
        });

        if (document.getElementById('stat-promedio')) document.getElementById('stat-promedio').textContent = promedio;
        if (document.getElementById('stat-total')) document.getElementById('stat-total').textContent = lista.length;
        if (document.getElementById('stat-mejor')) document.getElementById('stat-mejor').textContent = mejor.nombre;
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
    // Corregimos la mutación de fechas creando objetos independientes
    const hoyInicio = new Date();
    hoyInicio.setHours(0,0,0,0);
    
    const mesInicio = new Date();
    mesInicio.setDate(1);
    mesInicio.setHours(0,0,0,0);

    try {
        const { data, error } = await supabaseClient.rpc('obtener_contadores_dashboard', {
            fecha_inicio_dia: hoyInicio.toISOString(),
            fecha_inicio_mes: mesInicio.toISOString()
        });
        
        if (error) throw error;

        if (data && data[0]) {
            if (document.getElementById('stat-hoy')) document.getElementById('stat-hoy').textContent = data[0].diario || 0;
            if (document.getElementById('stat-mes')) document.getElementById('stat-mes').textContent = data[0].mensual || 0;
        }
    } catch (err) {
        console.error("Error en métricas:", err);
    }
    this.cargarTopClientes();
},

    async cargarTopClientes() {
    const { data, error } = await supabaseClient.rpc('obtener_top_clientes');
    const container = document.getElementById('top-clientes-list');
    
    if (error || !data) {
        container.innerHTML = '<p style="text-align:center; color:#666;">No hay datos VIP aún.</p>';
        return;
    }

    // Cambiamos el renderizado para usar clases de reviews.css y mejorar la estética
    container.innerHTML = data.map((c, i) => {
        const medal = ['🥇', '🥈', '🥉'][i] || '👤';
        return `
            <div class="review-card" style="margin-bottom:10px; padding:15px; flex-direction:row; align-items:center; gap:15px;">
                <div class="user-avatar" style="width:50px; height:50px; font-size:1.5rem;">${medal}</div>
                <div style="flex-grow:1;">
                    <h4 style="margin:0; color:white;">${c.nombre}</h4>
                    <span style="font-size:0.75rem; color:var(--gold);">CLIENTE FRECUENTE</span>
                </div>
                <div class="review-rating" style="background:rgba(255,215,0,0.1); color:var(--gold); border:1px solid var(--gold);">
                    ${c.total_visitas} visitas
                </div>
            </div>`;
    }).join('');
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