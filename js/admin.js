// js/admin.js - Panel de Administración (Refactorizado con Store y Seguridad)

// --- GESTIÓN DE ESTADO CENTRALIZADO (STORE) ---
const AdminStore = {
    state: {
        inventory: [],
        searchTimeout: null,
        currentEditId: null
    },

    setInventory(list) { this.state.inventory = list; },
    getInventory() { return this.state.inventory; },

    filterInventory(term) {
        if (!term) return this.state.inventory;
        const lowerTerm = term.toLowerCase();
        return this.state.inventory.filter(p => 
            (p.nombre || '').toLowerCase().includes(lowerTerm) || 
            (p.descripcion || '').toLowerCase().includes(lowerTerm) ||
            (p.categoria || '').toLowerCase().includes(lowerTerm)
        );
    }
};

// FUNCIÓN AUXILIAR DE NOTIFICACIONES (Autorreparable)
function showToast(msg, tipo = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast ${tipo}`;
    t.innerHTML = `<span class="toast-msg">${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => { 
        t.style.animation = 'fadeOut 0.4s forwards'; 
        setTimeout(() => t.remove(), 400); 
    }, 3000);
}

// FUNCIÓN DE SEGURIDAD (Sanitización)
function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

// 1. VERIFICACIÓN AUTH
async function checkAuth() {
    if (typeof supabaseClient === 'undefined') return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) window.location.href = "login.html";
    else cargarAdmin();
}

async function cargarAdmin() {
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error("Error productos:", error);
        showToast("Error al cargar inventario", "error");
        return;
    }
    
    AdminStore.setInventory(data);
    renderizarInventario(AdminStore.getInventory());
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}

// 2. TABS
function cambiarVista(vista) {
    document.querySelectorAll('.vista-seccion').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const target = document.getElementById(`vista-${vista}`);
    if (target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
    }

    const map = { 'inventario': 0, 'opiniones': 1, 'visitas': 2 };
    const btns = document.querySelectorAll('.tab-btn');
    if(btns[map[vista]]) btns[map[vista]].classList.add('active');

    if (vista === 'visitas' && typeof cargarMetricasVisitas === 'function') cargarMetricasVisitas();
    if (vista === 'opiniones' && typeof cargarOpiniones === 'function') cargarOpiniones(); 
}

// 3. RENDER INVENTARIO (SEGURO)
function renderizarInventario(lista) {
    const container = document.getElementById('lista-admin');
    if (!container) return;
    
    if (!lista || lista.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No hay productos.</p>';
        return;
    }

    const html = lista.map(item => {
        const nombreSafe = escapeHTML(item.nombre);
        const precioSafe = escapeHTML(item.precio);
        
        const esAgotado = item.estado === 'agotado';
        const statusText = esAgotado ? 'AGOTADO' : 'DISPONIBLE';
        const statusClass = esAgotado ? 'status-bad' : 'status-ok';
        const iconState = esAgotado ? 'toggle_off' : 'toggle_on';
        const colorState = esAgotado ? '#666' : 'var(--green-success)';
        const colorStar = item.destacado ? 'var(--gold)' : '#444';
        const img = item.imagen_url || 'https://via.placeholder.com/60';
        const opacity = item.activo ? '' : 'opacity:0.5; filter:grayscale(1);';
        const deletedLabel = !item.activo ? '<small style="color:red">(ELIMINADO)</small>' : '';

        return `
            <div class="inventory-item" style="${opacity}">
                <img src="${img}" class="item-thumb" alt="img">
                <div class="item-meta">
                    <span class="item-title">${nombreSafe} ${item.destacado ? '🌟' : ''} ${deletedLabel}</span>
                    <span class="item-price">$${precioSafe}</span>
                    <span class="item-status ${statusClass}">${statusText}</span>
                </div>
                <div class="action-btn-group">
                    <button class="icon-btn" onclick="prepararEdicion(${item.id})"><span class="material-icons">edit</span></button>
                    <button class="icon-btn" style="color:${colorStar}" onclick="toggleDestacado(${item.id}, ${item.destacado})"><span class="material-icons">star</span></button>
                    <button class="icon-btn" style="color:${colorState}" onclick="toggleEstado(${item.id}, '${item.estado, this}')"><span class="material-icons">${iconState}</span></button>
                    ${item.activo ? 
                        `<button class="icon-btn btn-del" onclick="eliminarProducto(${item.id})"><span class="material-icons">delete</span></button>` :
                        `<button class="icon-btn" style="color:green" onclick="restaurarProducto(${item.id})"><span class="material-icons">restore_from_trash</span></button>`
                    }
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function buscarInventario(e) {
    clearTimeout(AdminStore.state.searchTimeout);
    const term = e.target.value;
    
    AdminStore.state.searchTimeout = setTimeout(() => {
        const filtrada = AdminStore.filterInventory(term);
        renderizarInventario(filtrada);
    }, 300);
}

// 4. EDICIÓN / CREACIÓN
function prepararEdicion(id) {
    const prod = AdminStore.getInventory().find(p => p.id === id);
    if (!prod) return;

    document.getElementById('edit-id').value = prod.id;
    document.getElementById('nombre').value = prod.nombre;
    document.getElementById('precio').value = prod.precio;
    document.getElementById('categoria').value = prod.categoria;
    document.getElementById('descripcion').value = prod.descripcion || '';
    document.getElementById('curiosidad').value = prod.curiosidad || '';
    document.getElementById('destacado').checked = prod.destacado;

    document.getElementById('btn-submit').textContent = "ACTUALIZAR PRODUCTO";
    document.getElementById('btn-cancelar').style.display = "block";
    
    cambiarVista('inventario');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    document.getElementById('form-producto').reset();
    document.getElementById('edit-id').value = ""; 
    document.getElementById('btn-submit').textContent = "GUARDAR PRODUCTO";
    document.getElementById('btn-cancelar').style.display = "none";
}

// 5. SUBMIT FORMULARIO
const form = document.getElementById('form-producto');
if(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit');
        const txtOriginal = btn.textContent;
        btn.textContent = "Guardando..."; btn.disabled = true;

        try {
            const id = document.getElementById('edit-id').value;
            const datos = {
                nombre: document.getElementById('nombre').value,
                precio: document.getElementById('precio').value,
                categoria: document.getElementById('categoria').value,
                descripcion: document.getElementById('descripcion').value,
                curiosidad: document.getElementById('curiosidad').value,
                destacado: document.getElementById('destacado').checked
            };

            const fileInput = document.getElementById('imagen-file');
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const fileName = `prod_${Date.now()}.${file.name.split('.').pop()}`;
                const { error: upErr } = await supabaseClient.storage.from('imagenes').upload(fileName, file);
                if (upErr) throw upErr;
                const { data } = supabaseClient.storage.from('imagenes').getPublicUrl(fileName);
                datos.imagen_url = data.publicUrl;
            }

            let errorDb;
            if (id) {
                const { error } = await supabaseClient.from('productos').update(datos).eq('id', id);
                errorDb = error;
            } else {
                datos.estado = 'disponible';
                datos.activo = true;
                const { error } = await supabaseClient.from('productos').insert([datos]);
                errorDb = error;
            }

            if (errorDb) throw errorDb;
            showToast(id ? "Producto Actualizado" : "Producto Creado", "success");
            cancelarEdicion();
            cargarAdmin();

        } catch (err) {
            showToast("Error: " + err.message, "error");
        } finally {
            btn.textContent = txtOriginal; btn.disabled = false;
        }
    });
}

// 6. TOGGLES (Versiones Seguras)
async function toggleDestacado(id, val) {
    try {
        const { error } = await supabaseClient
            .from('productos')
            .update({ destacado: !val })
            .eq('id', id);

        if (error) throw error;

        showToast(val ? "Quitado de destacados" : "¡Destacado activado!", "success");
        await cargarAdmin(); 

    } catch (err) {
        console.error("Error toggleDestacado:", err);
        showToast("Error de conexión.", "error");
    }
}

// js/admin.js

async function toggleEstado(id, estadoActual, btnElement) {
    // 1. UI OPTIMISTA: Cambiamos visualmente AHORA MISMO
    const icono = btnElement.querySelector('.material-icons');
    const esDisponible = estadoActual === 'disponible';
    
    // Simulamos el cambio visual inmediato
    icono.textContent = esDisponible ? 'toggle_off' : 'toggle_on';
    btnElement.style.color = esDisponible ? '#666' : 'var(--green-success)'; // Gris o Verde
    
    try {
        const nuevoEstado = esDisponible ? 'agotado' : 'disponible';
        
        // 2. Enviamos a la base de datos en segundo plano
        const { error } = await supabaseClient
            .from('productos')
            .update({ estado: nuevoEstado })
            .eq('id', id);

        if (error) throw error;

        // Feedback sutil y recarga real para confirmar
        showToast(nuevoEstado === 'agotado' ? "Marcado como AGOTADO" : "Marcado como DISPONIBLE", "success");
        
        // Opcional: Si quieres que sea muy rápido, puedes quitar cargarAdmin() 
        // pero es mejor dejarlo para asegurar que los datos son reales.
        await cargarAdmin();

    } catch (err) {
        console.error("Error toggleEstado:", err);
        showToast("Error de conexión. Revirtiendo...", "error");
        
        // 3. REVERTIR SI FALLA (Rollback visual)
        icono.textContent = esDisponible ? 'toggle_on' : 'toggle_off';
        btnElement.style.color = esDisponible ? 'var(--green-success)' : '#666';
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

async function generarCuriosidadIA() {
    const nameInput = document.getElementById('nombre');
    const curiosityInput = document.getElementById('curiosidad');
    const btn = document.getElementById('btn-ia');

    if (!nameInput || !nameInput.value.trim()) {
        showToast("Escribe primero el nombre del producto.", "warning");
        if(nameInput) nameInput.focus();
        return;
    }

    const originalText = btn.textContent;
    btn.textContent = "🔮 ..."; btn.disabled = true;

    try {
        const scriptUrl = (typeof CONFIG !== 'undefined') ? CONFIG.URL_SCRIPT : "";
        if (!scriptUrl) throw new Error("URL de script no configurada");

        const nombreCodificado = encodeURIComponent(nameInput.value);
        const response = await fetch(`${scriptUrl}?action=getCuriosity&productName=${nombreCodificado}`);
        const data = await response.json();

        if (data.success) {
            curiosityInput.value = data.texto.replace(/^"|"$/g, '');
            showToast("Curiosidad generada", "success");
        } else {
            showToast("La IA no respondió correctamente", "warning");
        }
    } catch (error) {
        console.error("Error IA:", error);
        showToast("Error conectando con la IA", "error");
    } finally {
        btn.textContent = originalText; btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', checkAuth);