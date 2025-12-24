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
        // 1. Rescatamos el producto ANTES de cerrar el detalle
        const productoActual = AppStore.getActiveProduct();
        
        cerrarDetalle(); // Esto borra el activeProduct en script.js, pero ya tenemos copia
        
        // 2. Lo restauramos inmediatamente para que 'enviarOpinion' sepa qué estamos calificando
        if (productoActual) {
            AppStore.state.activeProduct = productoActual;
        }

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
        const { data, error } = await supabaseClient
            .from('opiniones')
            .select('*, productos(nombre, imagen_url)') // Nos aseguramos de traer el nombre del producto
            .order('created_at', { ascending: false });

        if (!error) {
            opinionesGlobal = data; // Guardamos copia para filtrar luego sin recargar
            this.renderizarOpiniones(data);
            
            // ¡ESTA LÍNEA ES LA CLAVE!
            this.actualizarEstadisticasOpiniones(data); 
        }
    },

    renderizarOpiniones(lista) {
        const container = document.getElementById('grid-opiniones');
        if (!container) return;
        
        if (!lista || lista.length === 0) {
            container.innerHTML = '<p style="color:#666; text-align:center; width:100%;">No hay opiniones aún.</p>';
            return;
        }

        container.innerHTML = lista.map(op => {
            // Formateo de fecha
            const fecha = new Date(op.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
            // Inicial para el avatar
            const inicial = op.cliente_nombre ? op.cliente_nombre.charAt(0).toUpperCase() : '?';
            // Color de las estrellas según la nota
            const colorEstrella = op.puntuacion >= 4 ? 'var(--gold)' : (op.puntuacion < 3 ? 'var(--neon-red)' : '#ccc');

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
                    <div class="review-rating" style="color: ${colorEstrella}">
                        ${"★".repeat(op.puntuacion)}
                    </div>
                </div>

                <div class="review-body">
                    <p class="review-text">"${op.comentario}"</p>
                </div>

                <div class="review-footer">
                    <div class="product-tag">
                        <img src="${op.productos?.imagen_url || 'img/logo.png'}" alt="prod">
                        <span>${op.productos?.nombre || 'Producto eliminado'}</span>
                    </div>
                    <button class="btn-delete-icon" onclick="eliminarOpinion(${op.id})" title="Borrar opinión">
                        <span class="material-icons">delete_outline</span>
                    </button>
                </div>
            </div>`;
        }).join('');
    },
    // --- LÓGICA DE FILTRADO Y ESTADÍSTICAS ---

    filtrarOpiniones(criterio, btnHTML) {
        // 1. Gestión visual de los botones (Píldoras)
        if (btnHTML) {
            document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
            btnHTML.classList.add('active');
        }

        // 2. Lógica de filtrado sobre los datos globales
        let filtradas = [];
        if (criterio === 'todas') {
            filtradas = opinionesGlobal;
        } else if (criterio === '5') {
            filtradas = opinionesGlobal.filter(op => op.puntuacion === 5);
        } else if (criterio === 'alertas') {
            filtradas = opinionesGlobal.filter(op => op.puntuacion <= 2);
        }

        // 3. Renderizamos solo lo que cumple el criterio
        this.renderizarOpiniones(filtradas);
    },

    actualizarEstadisticasOpiniones(lista) {
        if (!lista || lista.length === 0) return;

        // A) Calcular Promedio General
        const sumaTotal = lista.reduce((acc, curr) => acc + curr.puntuacion, 0);
        const promedio = (sumaTotal / lista.length).toFixed(1);
        
        // B) Encontrar el MEJOR producto (Promedio ponderado)
        const productosMap = {};

        lista.forEach(op => {
            const pid = op.producto_id;
            const pNombre = op.productos?.nombre || 'Producto';
            
            if (!productosMap[pid]) {
                productosMap[pid] = { nombre: pNombre, suma: 0, votos: 0 };
            }
            productosMap[pid].suma += op.puntuacion;
            productosMap[pid].votos += 1;
        });

        let mejorProducto = { nombre: '--', promedio: 0 };

        Object.values(productosMap).forEach(prod => {
            // Filtro: Solo consideramos productos con al menos 2 votos para evitar "falsos positivos"
            if (prod.votos >= 1) { 
                const prom = prod.suma / prod.votos;
                if (prom > mejorProducto.promedio) {
                    mejorProducto = { nombre: prod.nombre, promedio: prom };
                }
            }
        });

        // C) Actualizar el HTML del Dashboard
        const elPromedio = document.getElementById('stat-promedio');
        const elTotal = document.getElementById('stat-total');
        const elMejor = document.getElementById('stat-mejor');

        if (elPromedio) elPromedio.textContent = promedio;
        if (elTotal) elTotal.textContent = lista.length;
        if (elMejor) elMejor.textContent = `${mejorProducto.nombre}`; // Muestra el nombre
    },

    // AÑADE TAMBIÉN ESTA FUNCIÓN NUEVA DENTRO DE SocialService PARA PODER BORRAR
    async eliminarOpinion(id) {
        if(!confirm("¿Borrar esta opinión permanentemente?")) return;
        
        const { error } = await supabaseClient.from('opiniones').delete().eq('id', id);
        if (error) {
            alert("Error al borrar: " + error.message);
        } else {
            // Recargamos la lista visualmente
            this.cargarOpiniones(); 
            // Opcional: mostrar un toast si tienes la función disponible
            if(typeof showToast === 'function') showToast("Opinión eliminada", "success");
        }
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
window.eliminarOpinion = (id) => SocialService.eliminarOpinion(id);
window.entrarComoAnonimo = () => SocialService.entrarComoAnonimo();
window.registrarBienvenida = () => SocialService.registrarBienvenida();
window.cargarOpiniones = () => SocialService.cargarOpiniones();
window.cargarMetricasVisitas = () => SocialService.cargarMetricasVisitas();
window.abrirOpinionDesdeDetalle = () => SocialService.abrirOpinionDesdeDetalle();
window.enviarOpinion = () => SocialService.enviarOpinion();
window.cerrarModalOpiniones = () => SocialService.cerrarModalOpiniones();
window.actualizarEstrellas = () => SocialService.actualizarEstrellas();
window.filtrarOpiniones = (c, b) => SocialService.filtrarOpiniones(c, b);