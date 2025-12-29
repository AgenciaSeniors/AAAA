// js/ai-service.js - VERSIÓN CORREGIDA Y ROBUSTA

const NoirCopywriter = { 
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
        // Coordenadas Sancti Spíritus por defecto
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
    
    // --- MARIDAJE (PAIRING) ---
    async askPairing(nombreProducto) {
        const modal = document.getElementById('modal-match');
        const loading = document.getElementById('match-loading');
        const content = document.getElementById('match-content');
        
        if (!modal) return;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        loading.style.display = 'block';
        content.style.display = 'none';

        try {
            const response = await fetch(CONFIG.URL_SCRIPT, {
                method: 'POST',
                redirect: "follow",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ 
                    action: "pairing", 
                    producto: nombreProducto, 
                    token: "DLV_SECURE_TOKEN_2025_X9" 
                })
            });

            const res = await response.json();

            if (res.success) {
                // LÓGICA DE RECUPERACIÓN (FALLBACK)
                let recomendado = AppStore.getProducts().find(p => p.id == res.data.id_elegido);
                
                // Si no encuentra por ID, busca por nombre (normalizando)
                if (!recomendado && res.data.recomendacion) {
                    const nombreBusqueda = res.data.recomendacion.toLowerCase();
                    recomendado = AppStore.getProducts().find(p => p.nombre.toLowerCase().includes(nombreBusqueda));
                }

                if (recomendado) {
                    this.renderMatchUI(nombreProducto, recomendado, res.data.copy_venta);
                    loading.style.display = 'none';
                    content.style.display = 'block';
                } else {
                    throw new Error("Producto recomendado no disponible en menú local");
                }
            } else {
                throw new Error(res.error || "Error en respuesta IA");
            }
        } catch (e) { 
            console.error("Error Pairing:", e);
            this.cerrarMatch(); 
            showToast("El Sommelier está ocupado, intenta luego.", "error"); 
        }
    },

    renderMatchUI(platoBase, recomendado, justificacion) {
        document.getElementById('match-plato-base').textContent = platoBase;
        document.getElementById('match-img').src = recomendado.imagen_url || 'img/logo.png';
        document.getElementById('match-producto-nombre').textContent = recomendado.nombre;
        document.getElementById('match-justificacion').textContent = justificacion;
        
        document.getElementById('match-btn-action').onclick = () => {
            this.cerrarMatch();
            abrirDetalle(recomendado.id);
        };
    },

    cerrarMatch() {
        const modal = document.getElementById('modal-match');
        if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
    },

    // --- SHAKER IA (CORREGIDO) ---
    abrirShaker() {
        const modal = document.getElementById('modal-shaker');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
            AppStore.resetShaker();
            this.renderizarEsencias();
            this.actualizarEstadoShaker();
            
            // INTENTO DE ACTIVAR SENSORES (Solo funcionará si fue click directo, si no, fallará silenciosamente)
            // Se recomienda añadir un botón explícito en la UI para "Activar Sensor" si esto falla
            this.iniciarDetectorMovimiento();
        }
    },

    cerrarShaker() {
        this.detenerDetectorMovimiento();
        const modal = document.getElementById('modal-shaker');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
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
        if (status) status.textContent = shaker.selected.length > 0 ? "¡Agita el teléfono o pulsa abajo!" : "Elige hasta 3 esencias...";
        if (btn) btn.disabled = shaker.selected.length === 0;
    },

    async procesarMezcla() {
        const shaker = AppStore.getShakerState();
        if (shaker.isProcessing) return; // Evitar doble submit
        shaker.isProcessing = true;
        
        // 1. UI DE CARGA
        const shakerImg = document.getElementById('shaker-img');
        const statusText = document.getElementById('shaker-status');
        const btn = document.getElementById('btn-mix-manual');
        
        if(shakerImg) {
            shakerImg.classList.remove('ready');
            shakerImg.classList.add('shaking');
        }
        if(statusText) statusText.textContent = "🌪️ El Sommelier está pensando...";
        if(btn) {
            btn.disabled = true;
            btn.innerHTML = "Mezclando... <span class='material-icons fa-spin'>autorenew</span>";
        }

        this.detenerDetectorMovimiento(); // Parar sensores para ahorrar batería y evitar dobles llamadas

        try {
            // 2. PETICIÓN A GOOGLE APPS SCRIPT
            const [response] = await Promise.all([
                fetch(CONFIG.URL_SCRIPT, {
                    method: 'POST',
                    redirect: "follow",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ 
                        action: "shaker", 
                        sabor: shaker.selected.join(', '), 
                        token: "DLV_SECURE_TOKEN_2025_X9" 
                    })
                }),
                new Promise(resolve => setTimeout(resolve, 1500)) // Espera mínima visual
            ]);

            const res = await response.json();
            
            // 3. VALIDACIÓN INTELIGENTE (LA PARTE CLAVE)
            if (res.success) {
                this.mostrarResultadoShaker(res.data.recomendacion, res.data.id_elegido);
            } else {
                throw new Error(res.error || "No hubo respuesta clara");
            }

        } catch (e) {
            console.error("Fallo IA Shaker:", e);
            if(statusText) statusText.textContent = "❌ Error de conexión. Intenta manual.";
            showToast("El Sommelier no responde. Intenta manual.", "error");
        } finally { 
            // Restaurar estado
            shaker.isProcessing = false; 
            if(shakerImg) shakerImg.classList.remove('shaking');
            if(btn) {
                btn.disabled = false;
                btn.textContent = "¡MEZCLAR AHORA! 🌪️";
            }
        }
    },

    mostrarResultadoShaker(nombreIA, idOpcional) {
        const productos = AppStore.getProducts();
        
        // 1. Intento por ID exacto
        let elegido = idOpcional ? productos.find(p => p.id == idOpcional) : null;
        
        // 2. Intento por Nombre (Fuzzy search)
        if (!elegido && nombreIA) {
            const nombreBusqueda = nombreIA.toLowerCase().trim();
            elegido = productos.find(p => p.nombre.toLowerCase().includes(nombreBusqueda));
        }

        // 3. Intento de Fallback (Si la IA recomienda algo raro, dar un trago random)
        if (!elegido) {
            console.warn("Producto IA no encontrado localmente. Usando fallback.");
            const tragos = productos.filter(p => (p.categoria || '').toUpperCase() === 'TRAGOS');
            if (tragos.length > 0) {
                elegido = tragos[Math.floor(Math.random() * tragos.length)];
                showToast("Sugerencia del bartender (IA no disponible)", "info");
            }
        }

        if (elegido) {
            this.cerrarShaker();
            // Pequeño delay para que la transición del modal se vea bien
            setTimeout(() => abrirDetalle(elegido.id), 350);
        } else {
            showToast("No encontramos ese coctel en el menú hoy.", "warning");
        }
    },
    
    // --- GESTIÓN DE SENSORES (ACELERÓMETRO) ---
    iniciarDetectorMovimiento() {
        this.detenerDetectorMovimiento();

        window.motionHandler = (e) => {
            const acc = e.accelerationIncludingGravity || e.acceleration;
            if (!acc) return;
            
            // Umbral de sensibilidad
            const totalAcc = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);
            if (totalAcc > 25) { // Ajustado a 25 para evitar disparos accidentales
                // Debounce simple
                const now = Date.now();
                if (now - (this.lastShake || 0) > 2000) { 
                    this.lastShake = now;
                    this.procesarMezcla();
                }
            }
        };

        // Permisos para iOS 13+
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        window.addEventListener('devicemotion', window.motionHandler, true);
                    } else {
                        console.warn("Permiso acelerómetro denegado. Usar botón manual.");
                        const status = document.getElementById('shaker-status');
                        if(status) status.textContent = "Usa el botón para mezclar 👇";
                    }
                })
                .catch(err => {
                    console.error("Error pidiendo permisos:", err);
                    // Esto pasa si no se llama desde un evento de usuario explícito
                });
        } else {
            // Android / Navegadores estándar
            window.addEventListener('devicemotion', window.motionHandler, true);
        }
    },

    detenerDetectorMovimiento() {
        if (window.motionHandler) {
            window.removeEventListener('devicemotion', window.motionHandler, true);
            window.motionHandler = null;
        }
    },

    // --- HERO DINÁMICO ---
    async loadDynamicHero() {
        const container = document.getElementById('hero-ai-container');
        if (!container) return;

        // Esperar a que los productos carguen
        const productos = AppStore.getProducts();
        if (!productos || productos.length === 0) { 
            setTimeout(() => this.loadDynamicHero(), 1000); 
            return; 
        }

        const context = await this.getUserContext();
        const mensajeNoir = this.getNoirMessage(context);
        
        // Filtro de seguridad
        const recomendados = productos.filter(p => 
            p.destacado && 
            p.estado !== 'agotado' && 
            (p.categoria || '').toUpperCase() !== 'AGREGOS'
        );
        
        // Fallback si no hay destacados
        const poolSeguro = recomendados.length > 0 ? recomendados : productos.filter(p => (p.categoria || '').toUpperCase() === 'TRAGOS');
        const elegido = poolSeguro[Math.floor(Math.random() * poolSeguro.length)];

        if (elegido) {
            this.renderHeroHTML({ copy_venta: mensajeNoir, id_elegido: elegido.id }, context);
            container.classList.remove('hidden');
        }
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

    // --- ATMÓSFERA ---
    setAtmosphere(context) {
        const body = document.body;
        body.classList.remove('mode-heat', 'mode-rain', 'mode-night');
        if (context.isRaining) body.classList.add('mode-rain');
        else if (context.temp >= 30) body.classList.add('mode-heat');
        else if (context.hora >= 20 || context.hora <= 5) body.classList.add('mode-night');
    }
};

// COMPATIBILIDAD GLOBAL
window.abrirShaker = () => AIService.abrirShaker();
window.cerrarShaker = () => AIService.cerrarShaker();
window.procesarMezcla = () => AIService.procesarMezcla();
window.loadDynamicHero = () => AIService.loadDynamicHero();
window.askPairing = (n, b) => AIService.askPairing(n, b);
window.cerrarMatch = () => AIService.cerrarMatch();