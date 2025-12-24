// js/social-service.js

const SocialService = {
    // --- BIENVENIDA Y VISITAS ---
    async checkWelcome() {
        const clienteId = localStorage.getItem('cliente_id');
        const modal = document.getElementById('modal-welcome');
        if (clienteId || sessionStorage.getItem('es_invitado') === 'true') {
            if (modal) modal.style.display = 'none';
        } else if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    },

    async registrarBienvenida() {
        const nombre = document.getElementById('welcome-nombre').value.trim();
        const telefonoRaw = document.getElementById('welcome-phone').value;
        const telefono = limpiarTelefono(telefonoRaw);

        if (!validarEntradasRegistro(nombre, telefono)) return;

        try {
            const { data: cliente } = await supabaseClient.from('clientes').select('id').eq('telefono', telefono).single();
            let id = cliente?.id;
            if (!id) {
                const { data: nuevo } = await supabaseClient.from('clientes').insert([{ nombre, telefono }]).select().single();
                id = nuevo.id;
            }
            localStorage.setItem('cliente_id', id);
            localStorage.setItem('cliente_nombre', nombre);
            this.cerrarWelcome();
            showToast(`¡Hola, ${nombre}!`, "success");
        } catch (e) {
            sessionStorage.setItem('es_invitado', 'true');
            this.cerrarWelcome();
        }
    },

    cerrarWelcome() {
        const modal = document.getElementById('modal-welcome');
        if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 400); }
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
    }
};

// COMPATIBILIDAD CON HTML
window.checkWelcome = () => SocialService.checkWelcome();
window.registrarBienvenida = () => SocialService.registrarBienvenida();
window.cargarOpiniones = () => SocialService.cargarOpiniones();
window.cargarMetricasVisitas = () => SocialService.cargarMetricasVisitas();