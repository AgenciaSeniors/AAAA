// js/admin.js - VERSIÓN CORREGIDA Y ROBUSTA

let currentAdminRestaurantId = null;

// --- GESTIÓN DE ESTADO CENTRALIZADO (STORE) ---
const AdminStore = {
    state: {
        inventory: [],
        searchTimeout: null
    },
    
    setInventory(list) { this.state.inventory = list; },
    getInventory() { return this.state.inventory; },

    // Actualiza un solo producto en la lista local (Optimistic UI)
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

    refreshView() {
        const term = document.getElementById('search-inventory')?.value;
        const list = this.filterInventory(term);
        renderizarInventario(list);
    }
};

// --- LÓGICA DE IDENTIDAD ROBUSTA (CORRECCIÓN CRÍTICA) ---
async function obtenerMiRestaurante() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return null;

        // 1. Intentar obtener configuración específica de la tabla de perfiles
        const { data: perfil, error } = await supabaseClient
            .from('perfiles_admin')
            .select('restaurant_id')
            .eq('id', user.id)
            .maybeSingle(); // Usamos maybeSingle para evitar excepciones si no existe

        if (perfil && perfil.restaurant_id) {
            console.log("Restaurante cargado desde perfil de admin.");
            return perfil.restaurant_id;
        }

        // 2. FALLBACK: Si no hay perfil específico, usar la configuración global
        console.warn("Perfil de admin no encontrado. Usando configuración global.");
        if (typeof CONFIG !== 'undefined' && CONFIG.RESTAURANT_ID) {
            return CONFIG.RESTAURANT_ID;
        }

        return null;
    } catch (err) {
        console.error("Error recuperando identidad del restaurante:", err);
        // Último intento de rescate
        return (typeof CONFIG !== 'undefined') ? CONFIG.RESTAURANT_ID : null;
    }
}

// 1. AUTH & CARGA INICIAL
async function checkAuth() {
    if (typeof supabaseClient === 'undefined') return;
    
    // Verificación doble para evitar condiciones de carrera con el HTML
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.replace("login.html");
    } else {
        document.body.classList.add('auth-verified'); 
        cargarAdmin();
    }
}

async function cargarAdmin() {
    // 1. Validamos u obtenemos el ID del restaurante
    if (!currentAdminRestaurantId) {
        currentAdminRestaurantId = await obtenerMiRestaurante();
    }

    if (!currentAdminRestaurantId) {
        console.error("FATAL: No se pudo identificar el restaurante.");
        return showToast("Error crítico: Identidad desconocida.", "error");
    }

    // --- PUENTE CRÍTICO ---
    // Esto permite que SocialService sepa qué ID usar sin leer config.js
    window.globalRestaurantId = currentAdminRestaurantId; 
    // ---------------------

    // 2. Carga de Inventario (Existente)
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('restaurant_id', currentAdminRestaurantId)
        .order('id', { ascending: false })
        .limit(100);

    if (!error) {
        AdminStore.setInventory(data || []);
        renderizarInventario(data || []);
    }

    // 3. Carga de Módulos Sociales (Usando SocialService)
    console.log("Cargando módulos sociales...");
    
    if (typeof window.cargarOpiniones === 'function') {
        window.cargarOpiniones();
    }
    
    if (typeof window.cargarMetricasVisitas === 'function') {
        // Pequeño delay para asegurar que Chart.js esté listo
        setTimeout(() => window.cargarMetricasVisitas(), 500); 
    }
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
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No hay productos cargados.</p>';
        return;
    }

    const html = lista.map(item => {
        const nombreSafe = escapeHTML(item.nombre);
        const precioSafe = escapeHTML(item.precio);
        
        const esAgotado = item.estado === 'agotado';
        const statusText = esAgotado ? 'AGOTADO' : 'DISPONIBLE';
        const statusClass = esAgotado ? 'status-bad' : 'status-ok';
        const colorStar = item.destacado ? 'var(--gold)' : '#444';
        const img = item.imagen_url || 'https://via.placeholder.com/60?text=Sin+Foto';
        
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
    
    AdminStore.state.searchTimeout = setTimeout(() => {
        AdminStore.refreshView();
    }, 150);
}

// 3. ACCIONES Y EDICIÓN

async function toggleDestacado(id, valorActual) {
    const nuevoValor = !valorActual;
    AdminStore.updateLocalItem(id, { destacado: nuevoValor });
    showToast(nuevoValor ? "¡Destacado!" : "Ya no es destacado", "success");

    try {
        const { error } = await supabaseClient.from('productos').update({ destacado: nuevoValor }).eq('id', id);
        if (error) throw error;
    } catch (err) {
        AdminStore.updateLocalItem(id, { destacado: valorActual });
        showToast("Error al guardar cambios", "error");
    }
}

async function toggleEstado(id, isChecked) {
    const nuevoEstado = isChecked ? 'disponible' : 'agotado';
    AdminStore.updateLocalItem(id, { estado: nuevoEstado });

    try {
        const { error } = await supabaseClient.from('productos').update({ estado: nuevoEstado }).eq('id', id);
        if (error) throw error;
    } catch (err) {
        AdminStore.updateLocalItem(id, { estado: !isChecked ? 'disponible' : 'agotado' });
        showToast("Error de conexión", "error");
    }
}

async function eliminarProducto(id) {
    if (!confirm("¿Seguro que quieres eliminar este producto?")) return;
    AdminStore.updateLocalItem(id, { activo: false });
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
    AdminStore.updateLocalItem(id, { activo: true });
    try {
        const { error } = await supabaseClient.from('productos').update({ activo: true }).eq('id', id);
        if (error) throw error;
        showToast("Producto restaurado", "success");
    } catch (err) {
        AdminStore.updateLocalItem(id, { activo: false });
        showToast("Error al restaurar", "error");
    }
}

// 4. FORMULARIO Y SUBIDA DE IMÁGENES

function prepararEdicion(id) {
    const prod = AdminStore.getInventory().find(p => p.id === id);
    if (!prod) return;

    document.getElementById('edit-id').value = prod.id;
    document.getElementById('nombre').value = prod.nombre || '';
    document.getElementById('precio').value = prod.precio || 0;
    document.getElementById('categoria').value = prod.categoria || 'tragos';
    document.getElementById('descripcion').value = prod.descripcion || '';
    document.getElementById('curiosidad').value = prod.curiosidad || '';
    document.getElementById('destacado').checked = !!prod.destacado;

    const btnSubmit = document.getElementById('btn-submit');
    btnSubmit.textContent = "ACTUALIZAR PRODUCTO";
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

// Función auxiliar para optimización local de imagen
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
                // Compresión WebP al 70%
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.7); 
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
            
            // Subida de imagen con manejo de errores mejorado
            if (fileInput.files.length > 0) {
                try {
                    showToast("Optimizando imagen...", "info");
                    const blobOptimizado = await optimizarImagenLocal(fileInput.files[0]);
                    const fileName = `prod_${Date.now()}.webp`; 
                    
                    const { error: upErr } = await supabaseClient.storage
                        .from('imagenes')
                        .upload(fileName, blobOptimizado, { contentType: 'image/webp', upsert: true });

                    if (upErr) throw upErr;
                    
                    const { data } = supabaseClient.storage.from('imagenes').getPublicUrl(fileName);
                    datos.imagen_url = data.publicUrl;
                } catch (imgError) {
                    console.error("Error subiendo imagen:", imgError);
                    showToast("Error subiendo imagen (Revise permisos)", "warning");
                    // No detenemos el proceso, guardamos el producto sin imagen nueva
                }
            }

            let dataRes;
            if (id) {
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

            // Actualización local sin recarga
            if (id) {
                AdminStore.updateLocalItem(parseInt(id), dataRes);
            } else {
                const current = AdminStore.getInventory();
                current.unshift(dataRes);
                AdminStore.setInventory(current);
                renderizarInventario(current);
            }
            cancelarEdicion();

        } catch (err) {
            console.error(err);
            showToast("Error al guardar: " + err.message, "error");
        } finally {
            btn.textContent = txtOriginal; btn.disabled = false;
        }
    });
}

// 5. IA Y UTILIDADES

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
            const textoFinal = res.data.texto || res.data.curiosidad || res.data.answer || "";
            if (textoFinal) {
                txtArea.value = textoFinal;
                showToast("¡Curiosidad generada!", "success");
            } else {
                txtArea.value = "";
                showToast("La IA no devolvió texto", "warning");
            }
        }
    } catch (err) {
        console.error("Fallo IA:", err);
        txtArea.value = "";
        showToast("Error conectando con IA", "error");
    } finally {
        if(loader) loader.style.display = 'none';
    }
}

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
}

// Utilidades UI
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

// EXPORTAR AL SCOPE GLOBAL
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