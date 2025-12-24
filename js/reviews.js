// js/reviews.js - Gestión de Feedback y Opiniones
let opinionesGlobal = [];






// --- GRÁFICO 1: TENDENCIA (Últimos 7 días) ---


function setText(id, val) {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
}