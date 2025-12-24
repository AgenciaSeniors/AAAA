// js/social-service.js
let opinionesGlobal = []; // ¡Importante declarar esto!

// UTILIDADES RESCATADAS
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
    // --- BIENVENIDA Y VISITAS ---
    // Reemplaza checkWelcome en js/social-service.js
async checkWelcome() {
    const clienteId = localStorage.getItem('cliente_id');
    const nombre = localStorage.getItem('cliente_nombre');
    const modal = document.getElementById('modal-welcome');

    if (clienteId) {
        // EL USUARIO YA ESTÁ REGISTRADO:
        if (modal) modal.style.display = 'none';
        
        // Le damos el mensaje de bienvenida cada vez que entra
        if (nombre) {
            setTimeout(() => {
                showToast(`¡Qué bueno verte de nuevo, ${nombre}!`, "success");
            }, 1500); // Un pequeño retraso para que la página cargue visualmente primero
        }
    } else {
        // EL USUARIO NO ESTÁ REGISTRADO (o entró como anónimo la vez anterior):
        // Mostramos el modal SIEMPRE hasta que decida registrarse
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    }
    },

    async registrarBienvenida() {
    const nombreInput = document.getElementById('welcome-nombre').value.trim();
    const telefonoRaw = document.getElementById('welcome-phone').value;
    const telefono = limpiarTelefono(telefonoRaw);

    if (!validarEntradasRegistro(nombreInput, telefono)) return;

    try {
        // Buscamos si el teléfono ya existe
        const { data: clienteExistente } = await supabaseClient.from('clientes')
            .select('id, nombre')
            .eq('telefono', telefono)
            .single();

        let id, nombreFinal;

        if (clienteExistente) {
            // Si existe, recuperamos su ID y su nombre real de la DB
            id = clienteExistente.id;
            nombreFinal = clienteExistente.nombre;
            showToast(`¡Te reconocimos! Hola de nuevo, ${nombreFinal}`, "success");
        } else {
            // Si es nuevo, lo creamos
            const { data: nuevo } = await supabaseClient.from('clientes')
                .insert([{ nombre: nombreInput, telefono }])
                .select().single();
            id = nuevo.id;
            nombreFinal = nombreInput;
            showToast(`¡Bienvenido, ${nombreFinal}!`, "success");
        }

        localStorage.setItem('cliente_id', id);
        localStorage.setItem('cliente_nombre', nombreFinal);
        this.cerrarWelcome();
    } catch (e) {
        this.cerrarWelcome();
    }
},

    cerrarWelcome() {
        const modal = document.getElementById('modal-welcome');
        if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 400); }
    },
    abrirOpinionDesdeDetalle() {
        cerrarDetalle();
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
        });
    },

    async enviarOpinion() {
    const score = AppStore.state.reviewScore;
    const prod = AppStore.getActiveProduct();
    
    if (score === 0) return showToast("¡Marca las estrellas!", "warning");
    if (!prod) return showToast("Error: No se seleccionó un producto", "error"); // Validación extra

    const nombre = document.getElementById('cliente-nombre').value || "Anónimo";
    const comentario = document.getElementById('cliente-comentario').value;

    const { error } = await supabaseClient.from('opiniones').insert([{
        producto_id: prod.id, 
        cliente_nombre: nombre, 
        comentario: comentario, 
        puntuacion: score
    }]);

    if (error) {
        console.error("Error Supabase:", error);
        showToast("Error al enviar: " + error.message, "error");
    } else {
        showToast("¡Gracias!", "success");
        this.cerrarModalOpiniones();
        cargarMenu();
    }
},

    cerrarModalOpiniones() {
        const modal = document.getElementById('modal-opinion');
        if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
    },
    // --- OPINIONES ---
    async cargarOpiniones() {
        const { data, error } = await supabaseClient.from('opiniones').select('*, productos(nombre, imagen_url)').order('created_at', { ascending: false });
        if (!error) {
            opinionesGlobal = data;
            this.renderizarOpiniones(data);
            this.actualizarEstadisticasOpiniones(data);
        }
    },

    renderizarOpiniones(lista) {
        const container = document.getElementById('grid-opiniones');
        if (!container) return;
        container.innerHTML = lista.map(op => `
            <div class="review-card">
                <div class="review-header">
                    <img src="${op.productos?.imagen_url || 'img/logo.png'}">
                    <span>${op.productos?.nombre || 'Producto'}</span>
                </div>
                <div class="review-body">
                    <strong>${op.cliente_nombre}</strong>
                    <p>"${op.comentario}"</p>
                    <span>${"⭐".repeat(op.puntuacion)}</span>
                </div>
            </div>`).join('');
    },

    // --- MÉTRICAS ---
    async cargarMetricasVisitas() {
        const ahora = new Date();
        const { data, error } = await supabaseClient.rpc('obtener_contadores_dashboard', {
            fecha_inicio_dia: new Date(ahora.setHours(0,0,0,0)).toISOString(),
            fecha_inicio_mes: new Date(ahora.setDate(1)).toISOString()
        });
        if (!error && data) {
            if (document.getElementById('stat-hoy')) document.getElementById('stat-hoy').textContent = data.diario || 0;
            if (document.getElementById('stat-mes')) document.getElementById('stat-mes').textContent = data.mensual || 0;
        }
    },

    async cargarTopClientes() {
        const { data } = await supabaseClient.rpc('obtener_top_clientes');
        const container = document.getElementById('top-clientes-list');
        if (data && container) {
            container.innerHTML = data.map((c, i) => `<div>${['👑','🥇','🥈'][i] || '👤'} ${c.nombre} (${c.total_visitas})</div>`).join('');
        }
    },
    entrarComoAnonimo() {
    this.cerrarWelcome(); // Cierra el modal
    },
};

// COMPATIBILIDAD CON HTML
window.checkWelcome = () => SocialService.checkWelcome();
window.entrarComoAnonimo = () => SocialService.entrarComoAnonimo();
window.registrarBienvenida = () => SocialService.registrarBienvenida();
window.cargarOpiniones = () => SocialService.cargarOpiniones();
window.cargarMetricasVisitas = () => SocialService.cargarMetricasVisitas();
window.abrirOpinionDesdeDetalle = () => SocialService.abrirOpinionDesdeDetalle();
window.enviarOpinion = () => SocialService.enviarOpinion();
window.cerrarModalOpiniones = () => SocialService.cerrarModalOpiniones();
window.actualizarEstrellas = () => SocialService.actualizarEstrellas();