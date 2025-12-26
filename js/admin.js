// js/admin.js - Panel de Administración (Versión Instantánea)
let currentAdminRestaurantId = null;
// --- GESTIÓN DE ESTADO CENTRALIZADO (STORE) ---
const AdminStore = {
    state: {
        inventory: [],
        searchTimeout: null
    },
    
    setInventory(list) { this.state.inventory = list; },
    getInventory() { return this.state.inventory; },

    // Actualiza un solo producto en la lista local (Para velocidad instantánea)
    updateLocalItem(id, data) {
        const index = this.state.inventory.findIndex(p => p.id === id);
        if (index !== -1) {
            this.state.inventory[index] = { ...this.state.inventory[index], ...data };
            this.refreshView();
        }
    },

    filterInventory(term) {
        if (!term) return this.state.inventory;
        const lowerTerm = term.toLowerCase();
        return this.state.inventory.filter(p => 
            (p.nombre || '').toLowerCase().includes(lowerTerm) || 
            (p.descripcion || '').toLowerCase().includes(lowerTerm) ||
            (p.categoria || '').toLowerCase().includes(lowerTerm)
        );
    },

    // Re-renderiza manteniendo el filtro actual si existe
    refreshView() {
        const term = document.getElementById('search-inventory')?.value;
        const list = this.filterInventory(term);
        renderizarInventario(list);
    }
};
async function obtenerMiRestaurante() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const { data: perfil } = await supabaseClient
        .from('perfiles_admin')
        .select('restaurant_id')
        .eq('id', user.id)
        .single();

    return perfil.restaurant_id; // Este ID es seguro porque viene de la sesión autenticada
}
// UTILIDADES
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

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

// 1. AUTH & CARGA INICIAL
async function checkAuth() {
    if (typeof supabaseClient === 'undefined') return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = "login.html";
    } else {
        document.body.classList.add('auth-verified'); 
        cargarAdmin();
    }
}

// js/admin.js

async function cargarAdmin() {
    // 1. Validamos u obtenemos el ID del restaurante antes de la consulta
    if (!currentAdminRestaurantId) {
        currentAdminRestaurantId = await obtenerMiRestaurante();
    }

    // Seguridad: Si después de intentar obtenerlo sigue siendo null, detenemos la carga
    if (!currentAdminRestaurantId) {
        console.error("No se pudo cargar el ID del restaurante.");
        return showToast("Error: No tienes un restaurante asignado", "error");
    }

    // 2. Ahora la consulta usará el ID correcto
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('restaurant_id', currentAdminRestaurantId)
        .order('id', { ascending: false });

    if (error) {
        console.error("Error productos:", error);
        return showToast("Error al cargar inventario", "error");
    }
    
    AdminStore.setInventory(data);
    renderizarInventario(data);
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
}

// 2. RENDERIZADO
function renderizarInventario(lista) {
    const container = document.getElementById('lista-admin');
    if (!container) return;
    
    if (!lista || lista.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No hay productos coinciden.</p>';
        return;
    }

    const html = lista.map(item => {
        const nombreSafe = escapeHTML(item.nombre);
        const precioSafe = escapeHTML(item.precio);
        
        const esAgotado = item.estado === 'agotado';
        const statusText = esAgotado ? 'AGOTADO' : 'DISPONIBLE';
        const statusClass = esAgotado ? 'status-bad' : 'status-ok';
        const colorStar = item.destacado ? 'var(--gold)' : '#444';
        const img = item.imagen_url || 'https://via.placeholder.com/60';
        
        // Visualmente atenuamos si está eliminado (soft delete)
        const opacity = item.activo ? '' : 'opacity:0.5; filter:grayscale(1);';
        const deletedLabel = !item.activo ? '<b style="color:red; font-size:0.7rem;">(ELIMINADO)</b>' : '';
        const isChecked = !esAgotado ? 'checked' : '';

        return `
    <div class="inventory-item" style="${opacity}">
        <img src="${img}" class="item-thumb" alt="img" loading="lazy">
        <div class="item-meta">
            <span class="item-title">${nombreSafe} ${item.destacado ? '🌟' : ''} ${deletedLabel}</span>
            <span class="item-price">$${precioSafe}</span>
            <span class="item-status ${statusClass}">${statusText}</span>
        </div>
        <div class="action-btn-group">
            <button class="icon-btn" onclick="prepararEdicion(${item.id})" title="Editar"><span class="material-icons">edit</span></button>
            
            <button class="icon-btn" style="color:${colorStar}" onclick="toggleDestacado(${item.id}, ${item.destacado})" title="Destacar">
                <span class="material-icons">star</span>
            </button>
            
            <label class="switch" title="Disponibilidad">
                <input type="checkbox" ${isChecked} onchange="toggleEstado(${item.id}, this.checked)">
                <span class="slider"></span>
            </label>
            
            ${item.activo ? 
                `<button class="icon-btn btn-del" onclick="eliminarProducto(${item.id})" title="Borrar"><span class="material-icons" style="color:#ff4444">delete</span></button>` :
                `<button class="icon-btn" onclick="restaurarProducto(${item.id})" title="Restaurar"><span class="material-icons" style="color:#00C851">restore_from_trash</span></button>`
            }
        </div>
    </div>`;
    }).join('');

    container.innerHTML = html;
}

function buscarInventario(e) {
    clearTimeout(AdminStore.state.searchTimeout);
    const term = e.target.value;
    
    // Búsqueda con debounce para no saturar
    AdminStore.state.searchTimeout = setTimeout(() => {
        AdminStore.refreshView();
    }, 150);
}

// 3. ACCIONES INSTANTÁNEAS (Aquí está la magia)

async function toggleDestacado(id, valorActual) {
    const nuevoValor = !valorActual;
    
    // 1. Cambio visual INMEDIATO
    AdminStore.updateLocalItem(id, { destacado: nuevoValor });
    showToast(nuevoValor ? "¡Destacado!" : "Ya no es destacado", "success");

    // 2. Guardado en segundo plano
    try {
        const { error } = await supabaseClient.from('productos').update({ destacado: nuevoValor }).eq('id', id);
        if (error) throw error;
    } catch (err) {
        // Si falla, revertimos visualmente
        AdminStore.updateLocalItem(id, { destacado: valorActual });
        showToast("Error al guardar cambios", "error");
    }
}

async function toggleEstado(id, isChecked) {
    const nuevoEstado = isChecked ? 'disponible' : 'agotado';
    
    // 1. Cambio visual INMEDIATO
    AdminStore.updateLocalItem(id, { estado: nuevoEstado });

    // 2. Guardado en segundo plano
    try {
        const { error } = await supabaseClient.from('productos').update({ estado: nuevoEstado }).eq('id', id);
        if (error) throw error;
    } catch (err) {
        AdminStore.updateLocalItem(id, { estado: !isChecked ? 'disponible' : 'agotado' });
        showToast("Error de conexión", "error");
    }
}

async function eliminarProducto(id) {
    if (!confirm("¿Seguro que quieres eliminar este producto? (Se ocultará del menú)")) return;

    // 1. Cambio visual INMEDIATO
    AdminStore.updateLocalItem(id, { activo: false });
    
    // 2. Guardado
    try {
        const { error } = await supabaseClient.from('productos').update({ activo: false }).eq('id', id);
        if (error) throw error;
        showToast("Producto eliminado", "warning");
    } catch (err) {
        AdminStore.updateLocalItem(id, { activo: true });
        showToast("No se pudo eliminar", "error");
    }
}

async function restaurarProducto(id) {
    // 1. Cambio visual
    AdminStore.updateLocalItem(id, { activo: true });

    // 2. Guardado
    try {
        const { error } = await supabaseClient.from('productos').update({ activo: true }).eq('id', id);
        if (error) throw error;
        showToast("Producto restaurado", "success");
    } catch (err) {
        AdminStore.updateLocalItem(id, { activo: false });
        showToast("Error al restaurar", "error");
    }
}

// 4. EDICIÓN Y FORMULARIO

function prepararEdicion(id) {
    const prod = AdminStore.getInventory().find(p => p.id === id);
    if (!prod) return;

    document.getElementById('edit-id').value = prod.id;
    document.getElementById('nombre').value = prod.nombre || ''; // Añade || ''
    document.getElementById('precio').value = prod.precio || 0;  // Añade || 0
    document.getElementById('categoria').value = prod.categoria || 'cocteles';
    document.getElementById('descripcion').value = prod.descripcion || '';
    document.getElementById('curiosidad').value = prod.curiosidad || '';
    document.getElementById('destacado').checked = !!prod.destacado; // Asegura booleano

    // UI del Formulario
    const btnSubmit = document.getElementById('btn-submit');
    btnSubmit.textContent = "ACTUALIZAR PRODUCTO";
    btnSubmit.classList.add('btn-update-mode'); // Opcional para CSS
    
    document.getElementById('btn-cancelar').style.display = "block";
    
    // Scroll arriba y cambiar tab
    cambiarVista('inventario');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    document.getElementById('form-producto').reset();
    document.getElementById('edit-id').value = ""; 
    document.getElementById('btn-submit').textContent = "GUARDAR PRODUCTO";
    document.getElementById('btn-cancelar').style.display = "none";
}

async function optimizarImagenLocal(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const scaleSize = MAX_WIDTH / img.width;
                
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Exportamos a WebP (muy similar a AVIF pero con soporte nativo más rápido en Canvas)
                // Usamos calidad 0.7 para asegurar que pese menos de 40kb
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/webp', 0.7); 
            };
        };
    });
}
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
                let file = fileInput.files[0];
                
                showToast("Optimizando instantáneamente...", "info");
                
                // Compresión local en milisegundos antes de subir
                const blobOptimizado = await optimizarImagenLocal(file);
                
                // Forzamos extensión .webp
                const fileName = `prod_${Date.now()}.webp`; 
                
                const { error: upErr } = await supabaseClient.storage
                    .from('imagenes')
                    .upload(fileName, blobOptimizado, {
                        contentType: 'image/webp',
                        upsert: true
                    });

                if (upErr) throw upErr;
                
                const { data } = supabaseClient.storage.from('imagenes').getPublicUrl(fileName);
                datos.imagen_url = data.publicUrl;
            }

            let dataRes;
            if (id) {
                // UPDATE: Pedimos el registro actualizado (.select().single())
                const { data, error } = await supabaseClient
                    .from('productos')
                    .update(datos)
                    .eq('id', id)
                    .select()
                    .single();
                if (error) throw error;
                dataRes = data;
                showToast("Producto Actualizado", "success");
            } else {
                // INSERT
                datos.estado = 'disponible';
                datos.activo = true;
                datos.restaurant_id = currentAdminRestaurantId;
                const { data, error } = await supabaseClient
                    .from('productos')
                    .insert([datos])
                    .select()
                    .single();
                if (error) throw error;
                dataRes = data;
                showToast("Producto Creado", "success");
            }

            // ACTUALIZACIÓN LOCAL (Sin recargar toda la tabla)
            if (id) {
                AdminStore.updateLocalItem(parseInt(id), dataRes);
            } else {
                // Si es nuevo, lo ponemos al principio
                const current = AdminStore.getInventory();
                current.unshift(dataRes);
                AdminStore.setInventory(current);
                renderizarInventario(current);
            }

            cancelarEdicion();

        } catch (err) {
            console.error(err);
            showToast("Error: " + err.message, "error");
        } finally {
            btn.textContent = txtOriginal; btn.disabled = false;
        }
    });
}

async function generarCuriosidadIA() {
    const nombre = document.getElementById('nombre').value;
    const desc = document.getElementById('descripcion').value;
    if (!nombre) return showToast("Escribe un nombre primero", "warning");

    const loader = document.getElementById('loader-ia');
    const txtArea = document.getElementById('curiosidad');
    
    if(loader) loader.style.display = 'block';
    txtArea.value = "Generando curiosidad creativa...";
    try {
        const response = await fetch(CONFIG.URL_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "curiosidad", 
                producto: nombre, 
                descripcion: desc,
                token: "DLV_SECURE_TOKEN_2025_X9" 
            })
        });

        const res = await response.json();

        if (res.success) {
            // Buscamos el texto en varias propiedades posibles para evitar el 'undefined'
            const textoFinal = res.data.texto || res.data.curiosidad || res.data.answer || (typeof res.data === 'string' ? res.data : "");
            
            if (textoFinal && textoFinal !== "undefined") {
                txtArea.value = textoFinal;
                showToast("¡Curiosidad generada!", "success");
            } else {
                txtArea.value = "";
                showToast("La IA no devolvió un texto claro", "warning");
            }
        }
    } catch (err) {
        console.error("Fallo IA:", err);
        txtArea.value = "";
        showToast("Error de conexión con la IA", "error");
    } finally {
        if(loader) loader.style.display = 'none';
    }
}

// 5. NAVEGACIÓN TABS
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

    // Cargas perezosas de otras pestañas
    if (vista === 'visitas' && typeof window.cargarMetricasVisitas === 'function') window.cargarMetricasVisitas();
    if (vista === 'opiniones' && typeof window.cargarOpiniones === 'function') window.cargarOpiniones(); 
    if (vista === 'opiniones' && typeof cargarOpiniones === 'function') {
        cargarOpiniones(); 
    }
}

// EXPORTAR FUNCIONES AL HTML (Crucial para que los onclick funcionen)
window.prepararEdicion = prepararEdicion;
window.toggleDestacado = toggleDestacado;
window.toggleEstado = toggleEstado;
window.eliminarProducto = eliminarProducto;
window.restaurarProducto = restaurarProducto;
window.cambiarVista = cambiarVista;
window.buscarInventario = buscarInventario;
window.cancelarEdicion = cancelarEdicion;
window.generarCuriosidadIA = generarCuriosidadIA;
window.cerrarSesion = cerrarSesion;

// INICIO
document.addEventListener('DOMContentLoaded', checkAuth);