// js/admin.js - Panel de Administración (Corregido y Seguro)

let inventarioGlobal = []; 
let searchTimeout; 

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
        return;
    }
    
    inventarioGlobal = data;
    renderizarInventario(inventarioGlobal);
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
        // Sanitizamos TODO lo que viene de la BD
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
                    <button class="icon-btn" style="color:${colorState}" onclick="toggleEstado(${item.id}, '${item.estado}')"><span class="material-icons">${iconState}</span></button>
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
    clearTimeout(searchTimeout);
    const term = e.target.value.toLowerCase();
    searchTimeout = setTimeout(() => {
        const filtrada = inventarioGlobal.filter(p => 
            (p.nombre || '').toLowerCase().includes(term) || 
            (p.descripcion || '').toLowerCase().includes(term) ||
            (p.categoria || '').toLowerCase().includes(term)
        );
        renderizarInventario(filtrada);
    }, 300);
}

// 4. EDICIÓN / CREACIÓN
function prepararEdicion(id) {
    const prod = inventarioGlobal.find(p => p.id === id);
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

            // Imagen
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
            alert(id ? "Actualizado" : "Creado");
            cancelarEdicion();
            cargarAdmin();

        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            btn.textContent = txtOriginal; btn.disabled = false;
        }
    });
}

// 6. TOGGLES
async function toggleDestacado(id, val) {
    await supabaseClient.from('productos').update({ destacado: !val }).eq('id', id);
    cargarAdmin();
}
async function toggleEstado(id, val) {
    const nuevo = val === 'disponible' ? 'agotado' : 'disponible';
    await supabaseClient.from('productos').update({ estado: nuevo }).eq('id', id);
    cargarAdmin();
}
async function eliminarProducto(id) {
    if(confirm("¿Eliminar?")) {
        await supabaseClient.from('productos').update({ activo: false }).eq('id', id);
        cargarAdmin();
    }
}
async function restaurarProducto(id) {
    await supabaseClient.from('productos').update({ activo: true }).eq('id', id);
    cargarAdmin();
}

// IA CURIOSIDAD (Mantenido igual)
async function generarCuriosidad() {
    const nombre = document.getElementById('nombre').value;
    const out = document.getElementById('curiosidad');
    const btn = document.getElementById('btn-ia');
    const loader = document.getElementById('loader-ia');

    if(!nombre) { alert("Pon un nombre primero"); return; }
    
    const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbwfGlwmuKVSy630EnyWR4gJ0k-5hPVIwWg_bXS07m0v79KahgZ8J3Eyvi_DQu1-MbOg/exec";

    btn.disabled = true; loader.style.display = "inline"; out.value = "Pensando...";

    try {
        const res = await fetch(URL_SCRIPT, { method:'POST', body: JSON.stringify({producto:nombre})});
        const json = await res.json();
        out.value = json.curiosidad || "Sin respuesta";
    } catch(e) {
        out.value = "Error conexión IA";
    } finally {
        btn.disabled = false; loader.style.display = "none";
    }
}

document.addEventListener('DOMContentLoaded', checkAuth);