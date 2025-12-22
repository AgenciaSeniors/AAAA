// js/copywriter.js - El Redactor Noir

const NoirCopywriter = {
    // --- DICCIONARIO DE ESTADOS (Plantillas de Texto) ---
    // {{PRODUCTO}} será reemplazado por el nombre de la recomendación
    phrases: {
        // ESCENARIO 1: CALOR EXTREMO (+30°C)
        heat: [
            "El asfalto arde afuera, pero aquí el hielo es ley. Tu salvación: {{PRODUCTO}}.",
            "El sol no tiene piedad hoy. Refúgiate en la sombra con un {{PRODUCTO}}.",
            "Combate el fuego con frío. Nuestra sugerencia: {{PRODUCTO}}.",
            "La ciudad es un horno. Escápate con un {{PRODUCTO}} bien helado.",
            "Sudor y ruido afuera. Aire y sabor adentro. Prueba: {{PRODUCTO}}."
        ],

        // ESCENARIO 2: LLUVIA O TORMENTA
        rain: [
            "La ciudad llora neón. Es momento de un {{PRODUCTO}}.",
            "Que llueva lo que quiera. Tú estás a salvo con tu {{PRODUCTO}}.",
            "El sonido de la lluvia pide algo fuerte. ¿Quizás un {{PRODUCTO}}?",
            "Gris afuera, vibrante adentro. Dale color a la tarde con: {{PRODUCTO}}.",
            "Tormenta eléctrica y un buen trago. El match perfecto es {{PRODUCTO}}."
        ],

        // ESCENARIO 3: NOCHE (Después de las 8 PM)
        night: [
            "La noche es joven y cómplice. Empieza con {{PRODUCTO}}.",
            "Las sombras se alargan, la sed despierta. Sacia tu instinto con {{PRODUCTO}}.",
            "Bajo la luz de neón, todo sabe mejor. Especialmente el {{PRODUCTO}}.",
            "Secretos, música y un {{PRODUCTO}}. La receta de una gran noche.",
            "Sancti Spíritus duerme, nosotros despertamos. Tu combustible: {{PRODUCTO}}."
        ],

        // ESCENARIO 4: TARDE / ATARDECER (Golden Hour)
        sunset: [
            "El sol cae, el ánimo sube. Celebra el atardecer con {{PRODUCTO}}.",
            "La hora dorada merece un sabor dorado. Recomendamos: {{PRODUCTO}}.",
            "Antes de que caiga la noche, refréscate con {{PRODUCTO}}."
        ],

        // ESCENARIO 5: FRESCO / TEMPLADO (Raro, pero posible)
        cool: [
            "Una brisa fresca y un trago en mano. Nada supera al {{PRODUCTO}}.",
            "Noche clara, mente clara. Disfruta un {{PRODUCTO}}."
        ],
        
        // DEFAULT (Por si falla el clima)
        default: [
            "Una elección clásica para alguien con estilo: {{PRODUCTO}}.",
            "El Sommelier ha hablado. Tu destino es un {{PRODUCTO}}.",
            "Simple. Elegante. Delicioso. Tienes que probar el {{PRODUCTO}}."
        ]
    },

    // --- LÓGICA DE SELECCIÓN ---
    getNoirMessage(context, productName) {
        if (!context || !productName) return "El misterio aguarda.";

        // Convertimos a número para asegurar comparaciones correctas
        const temp = parseFloat(context.temperatura); 
        const desc = (context.descripcion || "").toLowerCase();
        const hora = parseInt(context.hora.split(':')[0]); // Hora militar (0-23)
        
        let mood = 'default';

        // 1. PRIORIDAD ABSOLUTA: Lluvia o Tormenta
        // (La lluvia mata cualquier otro mood)
        if (desc.includes('lluvi') || desc.includes('llovizna') || desc.includes('tormenta')) {
            mood = 'rain';
        }
        
        // 2. PRIORIDAD URGENTE: Calor Extremo (Corrige el sesgo)
        // Si hace más de 33°C, no importa si es de noche; el calor es el protagonista.
        else if (temp >= 33) {
            mood = 'heat';
        }
        
        // 3. PRIORIDAD TEMPORAL: Atardecer (Golden Hour)
        // Momento específico (18:00 - 19:59) que merece su propio copy antes que la "noche" genérica
        else if (hora >= 18 && hora < 20) {
            mood = 'sunset';
        }

        // 4. PRIORIDAD AMBIENTAL: Noche
        // Si no es lluvia, ni calor extremo, ni atardecer... entonces es Noche Noir.
        else if (hora >= 20 || hora <= 4) {
            mood = 'night';
        }
        
        // 5. PRIORIDAD DIURNA: Calor Estándar
        // Si es de día y hace calor normal (pero no extremo)
        else if (temp >= 28) {
            mood = 'heat';
        }
        
        // 6. PRIORIDAD CLIMÁTICA: Fresco
        // Raro en Cuba, pero posible
        else if (temp < 24) {
            mood = 'cool';
        }

        // Selección aleatoria dentro del mood detectado
        const options = this.phrases[mood] || this.phrases['default'];
        const template = options[Math.floor(Math.random() * options.length)];

        // Inyectar producto y devolver con formato HTML
        return template.replace('{{PRODUCTO}}', `<span class="highlight-product">${productName}</span>`);
    }
};