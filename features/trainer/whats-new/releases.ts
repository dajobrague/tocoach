import type { SceneId } from "./scenes";

// Novedades que ve el entrenador al entrar tras una actualización.
// Para una versión nueva: cambia `id` y las páginas. Cada `id` sale una vez.
// Una página es una escena en vivo (`stage`, ver whats-new-dialog.tsx) o una
// lista de varias novedades (`items`).

export type WhatsNewStage = "muscles" | "library" | "volume" | "share";

export interface WhatsNewItem {
  /** Fragmento de la app que enseña la novedad (ver scenes.tsx). */
  scene: SceneId;
  title: string;
  text: string;
  action?: { label: string; href: string };
}

export interface WhatsNewPage {
  /** Escena en vivo a la izquierda; sin ella la página es una lista. */
  stage?: WhatsNewStage;
  /** Nombre corto para la navegación. */
  label: string;
  title: string;
  text?: string;
  action?: { label: string; href: string };
  items?: WhatsNewItem[];
}

export interface WhatsNewRelease {
  id: string;
  pages: WhatsNewPage[];
}

const FORMS = "/trainer/settings/forms";

export const LATEST_RELEASE: WhatsNewRelease = {
  id: "2026-11-18-novedades",
  pages: [
    {
      label: "Inicio",
      title: "Tu Inicio, convertido en tablero",
      items: [
        {
          scene: "week-figures",
          title: "Las cifras de la semana, con su gráfica",
          text: "Arriba, en grande, las sesiones hechas, los check-ins recibidos y los clientes activos, cada uno con su evolución.",
        },
        {
          scene: "pending-board",
          title: "Todo lo pendiente en un solo sitio",
          text: "Debajo, una columna por tipo de trabajo: check-ins por revisar y sin enviar, vídeos, mensajes y sesiones sin terminar. Cada fila te lleva directo a lo que hay que revisar.",
          action: { label: "Ir a Inicio", href: "/trainer/dashboard/inicio" },
        },
        {
          scene: "merged-chart",
          title: "Una gráfica con datos de dos formularios",
          text: "Si pasas una medida (por ejemplo el peso) del check-in al registro diario, la gráfica no pierde el histórico: en el editor de la gráfica, «Incluir también datos de» suma la misma medida del otro formulario.",
          action: {
            label: "Abrir mis gráficas",
            href: "/trainer/dashboard/charts-template",
          },
        },
      ],
    },
    {
      label: "Check-ins",
      title: "Check-ins con fechas reales y avisos que llegan",
      items: [
        {
          scene: "next-checkin",
          title: "Ves cuándo toca cada uno",
          text: "La fecha del próximo check-in aparece en tu lista de clientes y en su ficha. Tu cliente ve cuándo se abre el siguiente y hasta qué día puede enviarlo.",
        },
        {
          scene: "checkin-calendar",
          title: "Primer check-in y excepciones",
          text: "En el horario de cada cliente puedes fijar la fecha de su primer check-in (el ritmo cuenta desde ahí) y mover o quitar uno concreto, por ejemplo por vacaciones.",
        },
        {
          scene: "checkin-alerts",
          title: "Avisos de apertura y de cierre",
          text: "Tu cliente recibe un aviso cuando se abre su check-in y otro antes de que cierre si aún no lo ha enviado. El recordatorio diario del registro de hábitos también le llega cada mañana.",
        },
        {
          scene: "checkin-status",
          title: "«Expirado» y aplicar a todos sin perder nada",
          text: "La lista marca «Expirado» cuando un check-in se cerró sin respuesta. Y aplicar tu horario por defecto a todos ya no borra lo que hayas ajustado para cada cliente.",
        },
      ],
    },
    {
      label: "Formularios",
      title: "Formularios más completos",
      items: [
        {
          scene: "intake-form",
          title: "Formulario inicial para clientes nuevos",
          text: "Un formulario que tu cliente rellena una sola vez al empezar: objetivo, experiencia, lesiones, alergias… Lo editas y lo activas en Plantillas › Formulario inicial, y sus respuestas aparecen arriba en la pestaña Formularios de su ficha.",
          action: {
            label: "Configurar el formulario inicial",
            href: `${FORMS}/intake`,
          },
        },
        {
          scene: "scale",
          title: "Nueva pregunta: escala del 0 al 10",
          text: "Para el dolor, el esfuerzo o el cansancio: tu cliente toca un número en vez de escribirlo, y puedes explicar qué significa el 0 y qué el 10.",
        },
        {
          scene: "conditional",
          title: "Preguntas que aparecen solo cuando toca",
          text: "En el menú de una pregunta, «Mostrar solo si…»: sale solo según lo que tu cliente responda antes. Por ejemplo, las preguntas sobre la sesión, solo si ha entrenado.",
        },
        {
          scene: "export",
          title: "Descarga las respuestas",
          text: "Con el botón «Descargar respuestas» de cada formulario obtienes un archivo con las respuestas de todos tus clientes (o de uno, desde su ficha), listo para Excel o Google Sheets.",
        },
      ],
    },
    {
      label: "Entreno",
      title: "Entrenamiento más claro para tu cliente",
      items: [
        {
          scene: "session-focus",
          title: "La sesión gira alrededor del ejercicio que toca",
          text: "Tu cliente ve el ejercicio actual en grande, con su imagen o animación y un solo botón para registrarlo; el resto va en filas cortas y los hechos se pliegan. El descanso es una banda fija arriba (+15 s, reiniciar, parar) y el cronómetro ya no arranca solo.",
        },
        {
          scene: "rir-sides",
          title: "RIR por serie y repeticiones por lado",
          text: "Si pones un RIR en un ejercicio, tu cliente anota el suyo en cada serie. Con la nueva opción «Por lado» anota las repeticiones de la derecha y de la izquierda por separado. Lo ves en la tabla de series del día.",
        },
        {
          scene: "weekly-volume",
          title: "Volumen semanal",
          text: "En Seguimiento, debajo de la semana, ves el volumen total del cliente (kilos × repeticiones).",
        },
        {
          scene: "library",
          title: "Biblioteca",
          text: "La figura hombre/mujer se elige con dos botones y la categoría «Flexibilidad» pasa a llamarse «Movilidad».",
        },
      ],
    },
    {
      label: "Nutrición",
      title: "Nutrición",
      items: [
        {
          scene: "diet-pdfs",
          title: "Varios PDFs de dieta por cliente",
          text: "Sube más de uno, por ejemplo para días de entreno y días de descanso. Tu cliente los ve todos.",
        },
        {
          scene: "duplicate-recipe",
          title: "Duplicar una receta",
          text: "Botón «Duplicar» en el editor de recetas para crear una variante sin empezar de cero.",
        },
        {
          scene: "food-search",
          title: "Más alimentos y mejor búsqueda",
          text: "132 alimentos habituales más en la base propia, y los básicos (pollo, arroz, lentejas…) salen antes que los platos de marca.",
        },
      ],
    },
    {
      label: "Y además",
      title: "Y además",
      items: [
        {
          scene: "dark-mode",
          title: "Modo oscuro para tus clientes",
          text: "Pueden elegir claro, oscuro o automático en su perfil. Tus colores de marca se mantienen.",
        },
        {
          scene: "brand-preview",
          title: "Vista previa real en el asistente",
          text: "Al configurar tu marca ves la app de tu cliente tal cual, con tus colores, tu tipografía y tu logo. También desde el móvil.",
        },
        {
          scene: "video",
          title: "Vídeos sin cortes",
          text: "Los vídeos de tus clientes ya no se quedan congelados al reproducirlos.",
        },
        {
          scene: "details",
          title: "Pequeños detalles",
          text: "El historial de un ejercicio cabe en pantallas bajas, la pregunta de pasos se ve aunque el cliente no use NEAT, y los avisos de los formularios ya no aparecen en tu campana.",
        },
      ],
    },
  ],
};
