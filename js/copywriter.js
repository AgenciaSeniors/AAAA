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

        const temp = context.temperatura; // Asumimos que viene en °C
        const desc = (context.descripcion || "").toLowerCase();
        const hora = parseInt(context.hora.split(':')[0]); // Extraemos la hora (0-23)
        
        let mood = 'default';

        // 1. Prioridad: Lluvia
        if (desc.includes('lluvi') || desc.includes('llovizna') || desc.includes('tormenta')) {
            mood = 'rain';
        }
        // 2. Prioridad: Hora (Noche profunda)
        else if (hora >= 20 || hora <= 4) {
            mood = 'night';
        }
        // 3. Prioridad: Temperatura (Calor)
        else if (temp >= 30) {
            mood = 'heat';
        }
        // 4. Prioridad: Atardecer (18:00 - 19:59)
        else if (hora >= 18 && hora < 20) {
            mood = 'sunset';
        }
        // 5. Resto (Fresco o normal)
        else if (temp < 24) {
            mood = 'cool';
        }

        // Selección aleatoria dentro del mood
        const options = this.phrases[mood] || this.phrases['default'];
        const template = options[Math.floor(Math.random() * options.length)];

        // Inyectar producto y devolver
        return template.replace('{{PRODUCTO}}', `<span class="highlight-product">${productName}</span>`);
    }
};