async function getUserContext() {
    const ahora = new Date();
    const hora = ahora.getHours() + ":" + ahora.getMinutes();
    
    const API_KEY = "3bc237701499f9b6b03de6f10e1e65d6"; 
    const LAT = "21.9297"; 
    const LON = "-79.4440"; 
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${API_KEY}&units=metric`;

    let temp = 28; 
    let climaDesc = "despejado";
    let isRaining = false;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.main) {
            temp = Math.round(data.main.temp);
            climaDesc = data.weather[0].description;
            // Detectamos lluvia basándonos en los códigos de OpenWeather o el texto
            isRaining = data.weather[0].main === "Rain" || climaDesc.includes("rain") || climaDesc.includes("lluvia");
            console.log(`🌤️ Clima real: ${temp}°C, ${climaDesc} (Lluvia: ${isRaining})`);
        }
    } catch (e) {
        console.warn("Usando estimación horaria.");
        const esDeDia = ahora.getHours() > 8 && ahora.getHours() < 19;
        temp = esDeDia ? 32 : 24;
    }

    // Devolvemos 'temp' para que copywriter.js lo entienda
    return { hora, temp, temperatura: temp, isRaining, descripcion: climaDesc };
}

async function loadDynamicHero() {
    const container = document.getElementById('hero-ai-container');
    if (!container) return;

    try {
        // No esperamos con un while, usamos los productos ya cargados
        const productos = AppStore.getProducts();
        if (productos.length === 0) {
            // Si no hay productos aún, reintentamos en 500ms una sola vez
            setTimeout(loadDynamicHero, 500);
            return;
        }

        const context = await getUserContext();
        const ahora = new Date();
        
        // Obtenemos el mensaje Noir directamente del frontend (copywriter.js)
        const mensajeNoir = getNoirMessage(context, ahora.getHours(), ahora.getMinutes());

        // Lógica de elección de producto local (Rápida y eficiente)
        // Elegimos un producto destacado que encaje con el clima o uno aleatorio "HOT"
        const recomendados = productos.filter(p => p.destacado && p.estado !== 'agotado');
        const elegido = recomendados[Math.floor(Math.random() * recomendados.length)] || productos[0];

        renderHeroHTML({
            copy_venta: mensajeNoir,
            id_elegido: elegido.id
        }, context);
        
        container.classList.remove('hidden');
    } catch (e) {
        console.error("Fallo el Sommelier Local:", e);
    }
}
function renderHeroHTML(aiData, context) {
    const container = document.getElementById('hero-ai-container');
    if (!container) return;

    const productoReal = AppStore.getProducts().find(p => p.id == aiData.id_elegido);
    if (!productoReal) return container.classList.add('hidden');

    const imagenFinal = productoReal.imagen_url || 'img/logo.png';
    let mensajeNoir = aiData.copy_venta;
    
    if (typeof getNoirMessage === 'function') {
        const ahora = new Date();
        mensajeNoir = getNoirMessage(context, ahora.getHours(), ahora.getMinutes());
    }

    container.innerHTML = `
        <div class="hero-glass-card">
            <div class="hero-status-bar">
                <span class="location-tag">📍 Sancti Spíritus</span>
                <span class="temp-tag">${context.temp}°C • ${context.descripcion}</span>
            </div>

            <div class="hero-main-layout">
                <div class="hero-text-side">
                    <h2 class="noir-title-massive">${mensajeNoir}</h2>
                    <p class="hero-hint">El Sommelier recomienda: <span class="highlight">${productoReal.nombre}</span></p>
                    <button onclick="abrirDetalle(${productoReal.id})" class="btn-neon-pill">
                        REVELAR SECRETO <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                
                <div class="hero-visual-side">
                    <div class="image-glow-container">
                        <img src="${imagenFinal}" alt="${productoReal.nombre}" class="floating-img">
                    </div>
                </div>
            </div>
        </div>
    `;
}
function abrirShaker() {
    const modal = document.getElementById('modal-shaker');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    AppStore.resetShaker();
    renderizarEsencias();
    actualizarEstadoShaker();
    iniciarDetectorMovimiento();
}

function cerrarShaker() {
    const modal = document.getElementById('modal-shaker');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
    detenerDetectorMovimiento();
}
function renderizarEsencias() {
    const grid = document.getElementById('essences-grid');
    grid.innerHTML = '';
    const shaker = AppStore.getShakerState();
    
    ESENCIAS.forEach(esencia => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'essence-btn';
        
        // Accesibilidad
        const isSelected = shaker.selected.includes(esencia.nombre);
        if (isSelected) btn.classList.add('selected');
        btn.setAttribute('aria-pressed', isSelected);
        
        btn.innerHTML = `<span>${esencia.icono}</span><small>${esencia.nombre}</small>`;
        btn.onclick = () => toggleEsencia(esencia, btn);
        grid.appendChild(btn);
    });
}

function toggleEsencia(esencia, btnElement) {
    const shaker = AppStore.getShakerState();
    const index = shaker.selected.indexOf(esencia.nombre);
    
    if (index > -1) {
        shaker.selected.splice(index, 1);
        btnElement.classList.remove('selected');
        btnElement.setAttribute('aria-pressed', 'false');
    } else {
        if (shaker.selected.length < 3) {
            shaker.selected.push(esencia.nombre);
            btnElement.classList.add('selected');
            btnElement.setAttribute('aria-pressed', 'true');
        } else {
            showToast("Máximo 3 ingredientes", "warning");
        }
    }
    actualizarEstadoShaker();
}

function actualizarEstadoShaker() {
    const shaker = AppStore.getShakerState();
    const count = shaker.selected.length;
    const visual = document.getElementById('shaker-img');
    const status = document.getElementById('shaker-status');
    const btn = document.getElementById('btn-mix-manual');
    const icon = visual.querySelector('.material-icons');

    if (count === 0) {
        status.textContent = "Añade ingredientes...";
        visual.classList.remove('ready');
        icon.style.color = "#ccc";
        btn.disabled = true;
        btn.style.opacity = "0.5";
    } else {
        status.textContent = `${count}/3 Ingredientes`;
        icon.style.color = "white";
        
        if (count >= 1) {
            visual.classList.add('ready');
            status.textContent = "¡Agita tu móvil o pulsa el botón!";
            status.style.color = "var(--gold)";
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
}
function iniciarDetectorMovimiento() {
    // 1. LIMPIEZA PREVENTIVA (Defensa contra fugas)
    // Antes de crear nada, nos aseguramos de matar cualquier listener anterior.
    detenerDetectorMovimiento();

    const umbral = 15; 
    let lastX = 0, lastY = 0, lastZ = 0;

    // 2. Definimos el handler y lo guardamos en la variable global
    motionHandler = (event) => {
        const shaker = AppStore.getShakerState();
        
        // Si ya estamos procesando, ignoramos movimientos para no saturar
        if (shaker.isProcessing || shaker.selected.length === 0) return;

        // Soporte cruzado para aceleración con o sin gravedad
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc) return;

        const deltaX = Math.abs(acc.x - lastX);
        const deltaY = Math.abs(acc.y - lastY);
        const deltaZ = Math.abs(acc.z - lastZ);

        // Detectar sacudida fuerte
        if (deltaX + deltaY + deltaZ > umbral) {
            shaker.shakeCount++;
            
            // Feedback visual inmediato
            const imgShaker = document.getElementById('shaker-img');
            if(imgShaker) imgShaker.classList.add('shaking');
            
            // Umbral de activación (5 sacudidas)
            if (shaker.shakeCount > 5) {
                procesarMezcla();
                shaker.shakeCount = 0; // Reset inmediato para evitar disparos dobles
            }
            
            // Limpieza visual
            clearTimeout(shaker.shakeTimer);
            shaker.shakeTimer = setTimeout(() => {
                if(imgShaker) imgShaker.classList.remove('shaking');
            }, 300);
        }

        lastX = acc.x; lastY = acc.y; lastZ = acc.z;
    };

    // 3. Solicitud de Permisos (iOS 13+) y Activación
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
            .then(state => {
                if (state === 'granted') {
                    window.addEventListener('devicemotion', motionHandler, true);
                    console.log("📡 Sensor activado (iOS)");
                }
            })
            .catch(console.error);
    } else {
        // Android y navegadores estándar
        window.addEventListener('devicemotion', motionHandler, true);
        console.log("📡 Sensor activado (Android/Std)");
    }
}

function detenerDetectorMovimiento() {
    // Solo intentamos remover si existe una referencia válida
    if (motionHandler) {
        window.removeEventListener('devicemotion', motionHandler, true);
        motionHandler = null; // Liberamos la memoria
        console.log("🛑 Sensor detenido y memoria liberada");
    }
}
async function procesarMezcla() {
    const shaker = AppStore.getShakerState();
    if (shaker.isProcessing) return; // Evitar dobles clics
    
    shaker.isProcessing = true;
    detenerDetectorMovimiento(); 

    // Referencias al DOM
    const btn = document.getElementById('btn-mix-manual');
    const status = document.getElementById('shaker-status');
    const visual = document.getElementById('shaker-img');
    
    // Estado de "Cargando"
    if(btn) { btn.textContent = "Mezclando..."; btn.disabled = true; }
    if(status) status.textContent = "El Sommelier está pensando...";
    if(visual) visual.classList.add('shaking');

    // URL del script (usa CONFIG si existe)
    const scriptUrl = (typeof CONFIG !== 'undefined') ? CONFIG.URL_SCRIPT : "https://script.google.com/macros/s/AKfycbzzXvv1KtxUpBZVNfkhkZ6rI4iQEfk8SXHOgHeAa4jdH6-lLfKE-wswfMXtfaoeVMJC/exec";

    try {
        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "shaker",
                sabor: shaker.selected.join(', '),
                token: "DLV_SECURE_TOKEN_2025_X9"
            })
        });

        const res = await response.json();
        
        if (res.success && res.data) {
            // MEJORA: Pasamos tanto el nombre como el ID (si el backend lo devuelve)
            // Esto soluciona la fragilidad si el backend empieza a enviar IDs.
            mostrarResultadoShaker(res.data.recomendacion, res.data.id_elegido);
            if(status) status.textContent = "¡Listo!";
        } else {
            throw new Error("Respuesta de IA vacía o inválida");
        }

    } catch (error) {
        console.warn("Fallo en la IA, usando Sommelier Local (Fallback):", error);
        
        // Lógica Fallback: Elegimos algo rico localmente si falla internet
        const productos = AppStore.getProducts();
        // Preferimos destacados que no estén agotados
        const pool = productos.filter(p => p.destacado && p.estado !== 'agotado');
        // Si no hay, usamos cualquiera
        const candidatos = pool.length > 0 ? pool : productos;
        
        if (candidatos.length > 0) {
            const random = candidatos[Math.floor(Math.random() * candidatos.length)];
            // Pasamos el ID explícito para asegurar el match
            mostrarResultadoShaker(random.nombre, random.id);
        } else {
            showToast("No pudimos preparar nada. Intenta de nuevo.", "error");
        }

    } finally {
        // Restaurar estado UI
        shaker.isProcessing = false;
        if(visual) visual.classList.remove('shaking');
        if(btn) { btn.textContent = "¡MEZCLAR DE NUEVO!"; btn.disabled = false; }
    }
}

function mostrarResultadoShaker(nombreIA, idOpcional) {
    const productos = AppStore.getProducts();
    let elegido = null;

    // ESTRATEGIA 1: Búsqueda Directa por ID (Infalible)
    if (idOpcional) {
        elegido = productos.find(p => p.id == idOpcional);
    }

    // ESTRATEGIA 2: Búsqueda Inteligente por Texto (Si falla el ID)
    if (!elegido && nombreIA) {
        const textoIA = normalizarTexto(nombreIA);
        
        // A. Intento exacto
        elegido = productos.find(p => normalizarTexto(p.nombre) === textoIA);
        
        // B. Intento por palabras clave (Scoring)
        if (!elegido) {
            const palabrasIA = textoIA.split(' ').filter(w => w.length > 3);
            let mejorPuntuacion = 0;

            productos.forEach(prod => {
                // Buscamos en nombre, descripción y categoría
                const textoBD = normalizarTexto(`${prod.nombre} ${prod.descripcion} ${prod.categoria}`);
                let puntos = 0;
                palabrasIA.forEach(palabra => {
                    if (textoBD.includes(palabra)) puntos++;
                });

                if (puntos > mejorPuntuacion) {
                    mejorPuntuacion = puntos;
                    elegido = prod;
                }
            });
        }
    }

    cerrarShaker();

    if (elegido) {
        showToast(`✨ Combinación perfecta: ${elegido.nombre}`);
        abrirDetalle(elegido.id);
    } else {
        // Fallback final por si todo falla (muy raro con la lógica nueva)
        showToast("¡Sorpresa! Prueba nuestra recomendación", "info");
        const random = productos[Math.floor(Math.random() * productos.length)];
        if(random) abrirDetalle(random.id);
    }

    // Asegurar que el flag de proceso se apague
    AppStore.state.shaker.isProcessing = false;
}
async function askPairing(nombreProducto, btn) {
    const modal = document.getElementById('modal-match');
    const loading = document.getElementById('match-loading');
    const content = document.getElementById('match-content');
    
    // 1. Mostrar modal y estado de carga
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    loading.style.display = 'block';
    content.style.display = 'none';

    const scriptUrl = CONFIG.URL_SCRIPT;

    try {
        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "pairing",
                producto: nombreProducto,
                token: "DLV_SECURE_TOKEN_2025_X9" 
            })
        });

        const res = await response.json();
        
        if (res.success && res.data) {
            // Buscamos el producto recomendado en nuestro inventario local
            const recomendado = AppStore.getProducts().find(p => p.id == res.data.id_elegido);
            
            if (recomendado) {
                // Rellenar datos en el modal de Match
                document.getElementById('match-plato-base').textContent = nombreProducto;
                document.getElementById('match-img').src = recomendado.imagen_url || 'img/logo.png';
                document.getElementById('match-producto-nombre').textContent = recomendado.nombre;
                document.getElementById('match-justificacion').textContent = res.data.copy_venta;
                
                // Configurar el botón de acción final
                document.getElementById('match-btn-action').onclick = () => {
                    cerrarMatch();
                    abrirDetalle(recomendado.id, res.data.copy_venta);
                };

                // Cambiar de "Cargando" a "Resultado"
                loading.style.display = 'none';
                content.style.display = 'block';
            }
        }
    } catch (error) {
        console.error("Error en Match:", error);
        showToast("Error conectando con el Sommelier.", "error");
        cerrarMatch();
    }
}

function cerrarMatch() {
    const modal = document.getElementById('modal-match');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}
async function generarCuriosidadIA() {
    const nameInput = document.getElementById('nombre');
    const curiosityInput = document.getElementById('curiosidad');
    const btn = document.getElementById('btn-ia');

    if (!nameInput || !nameInput.value.trim()) {
        showToast("Escribe el nombre del producto", "warning");
        return;
    }

    btn.textContent = "🔮 ..."; btn.disabled = true;

    try {
        const response = await fetch(CONFIG.URL_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({
                // Cambiamos a una acción que genere más texto descriptivo
                action: "pairing", 
                producto: nameInput.value,
                token: "DLV_SECURE_TOKEN_2025_X9"
            })
        });
        
        const res = await response.json();
        
        if (res.success && res.data) {
            // PRIORIDAD: 
            // 1. copy_venta (usado en maridajes)
            // 2. justificacion (explicación del porqué)
            // 3. recomendacion (nombre del producto - último recurso)
            const textoFinal = res.data.copy_venta || res.data.justificacion || res.data.recomendacion;
            
            curiosityInput.value = textoFinal.replace(/^"|"$/g, '');
            showToast("Curiosidad generada", "success");
        }
    } catch (error) {
        console.error("Error IA:", error);
        showToast("Error con la IA", "error");
    } finally {
        btn.textContent = "Generar"; btn.disabled = false;
    }
}
function getNoirMessage(weatherData, currentHour, currentMinute) {
  // 1. Logging de entrada para depuración
  console.log(`[DEBUG] Sommelier Input -> Hora: ${currentHour}:${currentMinute} | Temp: ${weatherData.temp}°C | Lluvia: ${weatherData.isRaining}`);

  const temp = weatherData.temp;
  const isRaining = weatherData.isRaining;
  
  // Normalizamos el tiempo a "minutos del día" para comparar rangos precisos
  // Ejemplo: 17:30 = (17 * 60) + 30 = 1050 minutos
  const minutesOfDay = (currentHour * 60) + currentMinute;
  
  let selectedMood = "standard";

  // --- ARBOL DE DECISIÓN ---

  // 1. LA LLUVIA MANDA (Prioridad absoluta)
  if (isRaining) {
    // Sub-condición: ¿Lluvia fría o tropical?
    if (temp >= 28) {
      selectedMood = "rainy_hot";
    } else {
      selectedMood = "rainy";
    }
  } 
  
  // 2. MOMENTOS DEL DÍA (Si no llueve)
  
  // Madrugada (00:00 a 04:59)
  else if (currentHour < 5) {
    selectedMood = "late_night";
  }
  // Mañana (05:00 a 07:59)
  else if (currentHour >= 5 && currentHour < 8) {
    selectedMood = "morning";
  }
  // Sunset Extendido (17:00 a 19:59)
  // 17:00 = 1020 min, 20:00 = 1200 min
  else if (minutesOfDay >= 1020 && minutesOfDay < 1200) {
    selectedMood = "sunset";
  }
  // Noche Fiesta (20:00 en adelante)
  else if (currentHour >= 20) {
    selectedMood = "night_party";
  }
  
  // 3. CLIMA DIURNO (08:00 a 16:59)
  // Solo llegamos aquí si no llueve y no estamos en los horarios especiales de arriba
  else {
    if (temp >= 28) {
      selectedMood = "hot_day";
    } 
    // Gap corregido: Días agradables
    else if (temp >= 24 && temp < 28) {
      selectedMood = "pleasant_day";
    } 
    else {
      // Menos de 24°C
      selectedMood = "cold_day";
    }
  }

  // 2. Logging de decisión final
  console.log(`[DEBUG] Mood Calculado: ${selectedMood}`);

  // Selección aleatoria del mensaje dentro del mood
  const messages = NoirCopywriter[selectedMood] || NoirCopywriter["standard"];
  const finalMessage = messages[Math.floor(Math.random() * messages.length)];
  
  return finalMessage;
}
const AtmosphereController = {
    // Inicializar efectos
    init() {
        // Crear el div de lluvia si no existe
        if (!document.getElementById('rain-overlay')) {
            const rainDiv = document.createElement('div');
            rainDiv.id = 'rain-overlay';
            document.body.prepend(rainDiv); // Lo ponemos al principio del body
        }
    },

    // Función Principal: Cambiar el "Mood" de la web
    setAtmosphere(context) {
        if (!context) return;
        
        this.init(); // Asegurarnos de que los elementos existen

        const temp = context.temperatura;
        const desc = (context.descripcion || "").toLowerCase();
        const hora = parseInt(context.hora.split(':')[0]);
        const body = document.body;

        // 1. Limpiar clases previas (Reset)
        body.classList.remove('mode-heat', 'mode-rain', 'mode-night', 'mode-sunset');

        // 2. Lógica de Decisión (Similar al Copywriter para coherencia)
        
        // CASO: LLUVIA (Prioridad máxima visual)
        if (desc.includes('lluvi') || desc.includes('llovizna') || desc.includes('tormenta')) {
            console.log("🌧️ Modo Atmósfera: LLUVIA");
            body.classList.add('mode-rain');
            this.setHeroGlow('var(--neon-cyan)');
        }
        
        // CASO: CALOR EXTREMO (+30°C y es de día)
        else if (temp >= 30 && hora < 19) {
            console.log("🔥 Modo Atmósfera: CALOR");
            body.classList.add('mode-heat');
            this.setHeroGlow('#ff4500'); // Naranja rojizo directo
        }
        
        // CASO: NOCHE (Oscuridad total)
        else if (hora >= 20 || hora <= 5) {
            console.log("🌑 Modo Atmósfera: NOCHE");
            body.classList.add('mode-night');
            this.setHeroGlow('var(--neon-cyan)');
        }

        // CASO: ATARDECER (Golden Hour - Opcional si quieres añadirlo al CSS luego)
        else if (hora >= 18 && hora < 20) {
            // body.classList.add('mode-sunset'); // Requiere CSS adicional
        }
        
        // Si no cumple nada, se queda en el estilo por defecto (Default CSS)
    },

    // Helper para cambiar el resplandor de la imagen del Hero
    setHeroGlow(color) {
        const heroImg = document.querySelector('.hero-image-glow img');
        if (heroImg) {
            heroImg.style.filter = `drop-shadow(0 0 20px ${color})`;
            heroImg.style.transition = "filter 2s ease";
        }
    }
};