// js/atmosphere.js - Controlador Visual de Atmósfera

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