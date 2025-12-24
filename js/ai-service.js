// js/ai-service.js

const NoirCopywriter = { // Diccionario de frases
    "standard": ["Un clásico nunca falla.", "El momento pide algo atemporal.", "Déjate llevar por la intuición."],
    "rainy": ["Día gris, copa llena. El refugio perfecto.", "Llueve fuera. Aquí dentro, el clima lo pones tú."],
    "rainy_hot": ["Lluvia y calor: trópico puro. Necesitas hielo.", "El cielo cae caliente. Enfríalo con un buen mix."],
    "late_night": ["La noche es joven para los valientes.", "Madrugada. Los mejores secretos se cuentan ahora."],
    "morning": ["El sol apenas sale. ¿Un café o empezamos fuerte?", "Mañana fresca. El día promete."],
    "sunset": ["La hora dorada. Ni día, ni noche.", "Sunset vibes. El aperitivo es obligatorio."],
    "night_party": ["La ciudad despierta ahora. ¿Estás listo?", "Es de noche. Todo está permitido."],
    "hot_day": ["El calor aprieta. La hidratación es un arte.", "Sol implacable. Mereces algo helado."],
    "pleasant_day": ["Clima perfecto. Ni frío ni calor, solo disfrute."],
    "cold_day": ["El aire muerde un poco. Calienta el espíritu.", "Abrígate o bebe algo fuerte."]
};

const AIService = {
    // --- CONTEXTO Y CLIMA ---
    async getUserContext() {
        const ahora = new Date();
        const API_KEY = "3bc237701499f9b6b03de6f10e1e65d6"; 
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=21.9297&lon=-79.4440&appid=${API_KEY}&units=metric`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            const desc = data.weather?.[0].description || "despejado";
            return {
                temp: Math.round(data.main?.temp || 28),
                isRaining: data.weather?.[0].main === "Rain" || desc.includes("lluvia"),
                descripcion: desc,
                hora: ahora.getHours(),
                minutos: ahora.getMinutes()
            };
        } catch (e) {
            return { temp: 28, isRaining: false, descripcion: "estimado", hora: ahora.getHours(), minutos: ahora.getMinutes() };
        }
    },

    getNoirMessage(context) {
        let mood = "standard";
        const minutesOfDay = (context.hora * 60) + (context.minutos || 0);
        if (context.isRaining) mood = context.temp >= 28 ? "rainy_hot" : "rainy";
        else if (context.hora < 5) mood = "late_night";
        else if (context.hora < 8) mood = "morning";
        else if (minutesOfDay >= 1020 && minutesOfDay < 1200) mood = "sunset";
        else if (context.hora >= 20) mood = "night_party";
        else mood = context.temp >= 28 ? "hot_day" : (context.temp >= 24 ? "pleasant_day" : "cold_day");

        const msgs = NoirCopywriter[mood] || NoirCopywriter["standard"];
        return msgs[Math.floor(Math.random() * msgs.length)];
    },

    // --- HERO DINÁMICO ---
    async loadDynamicHero() {
        const container = document.getElementById('hero-ai-container');
        if (!container) return;
        const productos = AppStore.getProducts();
        if (productos.length === 0) { setTimeout(() => this.loadDynamicHero(), 500); return; }

        const context = await this.getUserContext();
        const mensajeNoir = this.getNoirMessage(context);
        const recomendados = productos.filter(p => p.destacado && p.estado !== 'agotado');
        const elegido = recomendados[Math.floor(Math.random() * recomendados.length)] || productos[0];

        this.renderHeroHTML({ copy_venta: mensajeNoir, id_elegido: elegido.id }, context);
        container.classList.remove('hidden');
    },

    renderHeroHTML(aiData, context) {
        const container = document.getElementById('hero-ai-container');
        const productoReal = AppStore.getProducts().find(p => p.id == aiData.id_elegido);
        if (!productoReal) return;
        const imagenFinal = productoReal.imagen_url || 'img/logo.png';

        container.innerHTML = `
            <div class="hero-glass-card">
                <div class="hero-status-bar">
                    <span class="location-tag">📍 Sancti Spíritus</span>
                    <span class="temp-tag">${context.temp}°C • ${context.descripcion}</span>
                </div>
                <div class="hero-main-layout">
                    <div class="hero-text-side">
                        <h2 class="noir-title-massive">${aiData.copy_venta}</h2>
                        <p class="hero-hint">El Sommelier recomienda: <span class="highlight">${productoReal.nombre}</span></p>
                        <button onclick="abrirDetalle(${productoReal.id})" class="btn-neon-pill">REVELAR SECRETO</button>
                    </div>
                    <div class="hero-visual-side"><img src="${imagenFinal}" class="floating-img"></div>
                </div>
            </div>`;
    },

    // --- SHAKER IA ---
    abrirShaker() {
        const modal = document.getElementById('modal-shaker');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
            AppStore.resetShaker();
            this.renderizarEsencias();
            this.actualizarEstadoShaker();
            this.iniciarDetectorMovimiento();
        }
    },

    renderizarEsencias() {
        const grid = document.getElementById('essences-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const shaker = AppStore.getShakerState();
        ESENCIAS.forEach(esencia => {
            const btn = document.createElement('button');
            btn.className = `essence-btn ${shaker.selected.includes(esencia.nombre) ? 'selected' : ''}`;
            btn.innerHTML = `<span>${esencia.icono}</span><small>${esencia.nombre}</small>`;
            btn.onclick = () => {
                const idx = shaker.selected.indexOf(esencia.nombre);
                if (idx > -1) shaker.selected.splice(idx, 1);
                else if (shaker.selected.length < 3) shaker.selected.push(esencia.nombre);
                this.renderizarEsencias();
                this.actualizarEstadoShaker();
            };
            grid.appendChild(btn);
        });
    },

    actualizarEstadoShaker() {
        const shaker = AppStore.getShakerState();
        const status = document.getElementById('shaker-status');
        const btn = document.getElementById('btn-mix-manual');
        if (status) status.textContent = shaker.selected.length > 0 ? "¡Agita o pulsa el botón!" : "Añade ingredientes...";
        if (btn) btn.disabled = shaker.selected.length === 0;
    },

    async procesarMezcla() {
        const shaker = AppStore.getShakerState();
        if (shaker.isProcessing) return;
        shaker.isProcessing = true;
        this.detenerDetectorMovimiento();
        try {
            const response = await fetch(CONFIG.URL_SCRIPT, {
                method: 'POST',
                body: JSON.stringify({ action: "shaker", sabor: shaker.selected.join(', '), token: "DLV_SECURE_TOKEN_2025_X9" })
            });
            const res = await response.json();
            this.mostrarResultadoShaker(res.data.recomendacion, res.data.id_elegido);
        } catch (e) {
            console.error("Fallo IA:", e);
        } finally { shaker.isProcessing = false; }
    },

    mostrarResultadoShaker(nombreIA, idOpcional) {
        const elegido = idOpcional ? AppStore.getProducts().find(p => p.id == idOpcional) : null;
        const modal = document.getElementById('modal-shaker');
        if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
        if (elegido) abrirDetalle(elegido.id);
    },

    // --- SENSORES ---
    iniciarDetectorMovimiento() {
        this.detenerDetectorMovimiento();
        window.motionHandler = (e) => {
            const acc = e.accelerationIncludingGravity || e.acceleration;
            if (acc && (Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z) > 15)) {
                this.procesarMezcla();
            }
        };
        window.addEventListener('devicemotion', window.motionHandler, true);
    },

    detenerDetectorMovimiento() {
        if (window.motionHandler) {
            window.removeEventListener('devicemotion', window.motionHandler, true);
            window.motionHandler = null;
        }
    },

    // --- ATMÓSFERA ---
    setAtmosphere(context) {
        const body = document.body;
        body.classList.remove('mode-heat', 'mode-rain', 'mode-night');
        if (context.isRaining) body.classList.add('mode-rain');
        else if (context.temp >= 30) body.classList.add('mode-heat');
        else if (context.hora >= 20 || context.hora <= 5) body.classList.add('mode-night');
    },

    async askPairing(nombreProducto) {
        // Lógica de maridaje movida aquí...
    }
};

// COMPATIBILIDAD CON HTML
window.abrirShaker = () => AIService.abrirShaker();
window.procesarMezcla = () => AIService.procesarMezcla();
window.loadDynamicHero = () => AIService.loadDynamicHero();
window.askPairing = (n, b) => AIService.askPairing(n, b);