// js/reviews.js - Opiniones (Seguro)

let opinionesGlobal = [];

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

async function cargarOpiniones() {
    const grid = document.getElementById('grid-opiniones');
    if(!grid) return;

    grid.innerHTML = '<p style="text-align:center; color:#666;">Cargando...</p>';

    const { data, error } = await supabaseClient
        .from('opiniones')
        .select(`
            id, puntuacion, comentario, cliente_nombre, created_at,
            productos(nombre, imagen_url)
        `)
        .order('created_at', { ascending: false });

    if(error) {
        grid.innerHTML = '<p style="color:red; text-align:center">Error al cargar.</p>';
        return;
    }

    opinionesGlobal = data || [];
    renderizarOpiniones(opinionesGlobal);
    calcularMetricas(opinionesGlobal);
}

function renderizarOpiniones(lista) {
    const grid = document.getElementById('grid-opiniones');
    grid.innerHTML = '';

    if(lista.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:#666;">Sin opiniones.</p>';
        return;
    }

    grid.innerHTML = lista.map(op => {
        // SEGURIDAD: Limpiamos datos
        const nombreProd = escapeHTML(op.productos?.nombre || 'Producto eliminado');
        const cliente = escapeHTML(op.cliente_nombre || 'Anónimo');
        const comentario = escapeHTML(op.comentario || 'Sin comentario');
        const img = op.productos?.imagen_url || 'https://via.placeholder.com/40';
        const estrellas = '★'.repeat(op.puntuacion) + '☆'.repeat(5 - op.puntuacion);
        const fecha = new Date(op.created_at).toLocaleDateString();

        return `
            <div class="review-card">
                <div class="review-header">
                    <span class="review-stars">${estrellas}</span>
                    <span class="review-date">${fecha}</span>
                </div>
                <div class="review-product">
                    <img src="${img}" class="review-prod-img">
                    <span class="review-prod-name">${nombreProd}</span>
                </div>
                <p class="review-body">"${comentario}"</p>
                <div class="review-footer">
                    <span class="review-author">${cliente}</span>
                    <button class="btn-delete-review" onclick="borrarOpinion(${op.id})">
                        <span class="material-icons">delete_outline</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function calcularMetricas(lista) {
    if(lista.length === 0) return;
    
    // Promedio
    const suma = lista.reduce((a, b) => a + b.puntuacion, 0);
    const prom = (suma / lista.length).toFixed(1);
    const elProm = document.getElementById('stat-promedio');
    if(elProm) {
        elProm.textContent = `★ ${prom}`;
        elProm.style.color = prom >= 4.5 ? 'var(--green-success)' : (prom < 3 ? 'red' : 'gold');
    }

    // Total
    const elTotal = document.getElementById('stat-total');
    if(elTotal) elTotal.textContent = lista.length;

    // Mejor Plato
    const counts = {};
    lista.filter(o => o.puntuacion === 5).forEach(o => {
        const n = o.productos?.nombre || 'X';
        counts[n] = (counts[n] || 0) + 1;
    });
    const mejor = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, "N/A");
    const elMejor = document.getElementById('stat-mejor');
    if(elMejor) elMejor.textContent = mejor;
}

async function borrarOpinion(id) {
    if(confirm("¿Borrar opinión?")) {
        await supabaseClient.from('opiniones').delete().eq('id', id);
        cargarOpiniones();
    }
}