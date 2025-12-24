/**
 * DICCIONARIO DE COPYS (NoirCopywriter)
 * Contiene todas las variantes de texto según el "mood" detectado.
 */
const NoirCopywriter = {
  // Fallback por seguridad
  "standard": [
    "Un clásico nunca falla.",
    "El momento pide algo atemporal.",
    "Déjate llevar por la intuición."
  ],

  // NIVEL 1: Lluvia (Prioridad Alta)
  "rainy": [
    "Día gris, copa llena. El refugio perfecto.",
    "Llueve fuera. Aquí dentro, el clima lo pones tú.",
    "El sonido de la lluvia pide un trago con carácter."
  ],
  "rainy_hot": [ // Nuevo: Lluvia tropical
    "Lluvia y calor: trópico puro. Necesitas hielo.",
    "Humedad alta y gotas cayendo. Algo refrescante es vital.",
    "El cielo cae caliente. Enfríalo con un buen mix."
  ],

  // NIVEL 2: Horarios Específicos
  "late_night": [ // 00:00 - 05:00
    "La noche es joven para los valientes.",
    "Madrugada. Los mejores secretos se cuentan ahora.",
    "Silencio y un buen trago. No hace falta más."
  ],
  "morning": [ // 05:00 - 08:00
    "El sol apenas sale. ¿Un café o empezamos fuerte?",
    "Mañana fresca. El día promete.",
    "Despierta. El mundo ya giró bastante sin ti."
  ],
  "sunset": [ // 17:00 - 20:00 (Ventana extendida)
    "La hora dorada. Ni día, ni noche: el limbo perfecto.",
    "Cae el sol. Es el momento de cambiar el ritmo.",
    "Sunset vibes. El aperitivo es obligatorio."
  ],
  "night_party": [ // 20:00 - 23:59
    "La ciudad despierta ahora. ¿Estás listo?",
    "Noche cerrada. Música, luces y tu bebida favorita.",
    "Es de noche. Todo está permitido."
  ],

  // NIVEL 3: Temperaturas Diurnas (08:00 - 17:00)
  "hot_day": [ // >= 28°C
    "El calor aprieta. La hidratación es un arte.",
    "Sol implacable. Mereces algo helado.",
    "Temperaturas altas exigen medidas refrescantes."
  ],
  "pleasant_day": [ // 24°C - 27.9°C (Gap cerrado)
    "Clima perfecto. Ni frío ni calor, solo disfrute.",
    "Un día impecable. Cualquier elección será la correcta.",
    "Temperatura ideal. El equilibrio en su máxima expresión."
  ],
  "cold_day": [ // < 24°C
    "El aire muerde un poco. Calienta el espíritu.",
    "Día fresco. Un trago con cuerpo viene bien.",
    "Abrígate o bebe algo fuerte. Tú eliges."
  ]
};

/**
 * LÓGICA DEL SOMMELIER (getNoirMessage)
 * Determina el mood basado en clima y hora, y devuelve un copy aleatorio.
 * * @param {Object} weatherData - Objeto con { temp: number, isRaining: boolean }
 * @param {number} currentHour - Hora actual (0-23)
 * @param {number} currentMinute - Minuto actual (0-59)
 */
