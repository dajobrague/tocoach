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
  id: "2026-11-25-biseries",
  pages: [
    {
      label: "Biseries",
      title: "Biseries, triseries y circuitos",
      items: [
        {
          scene: "group-make",
          title: "Junta ejercicios que se hacen alternando",
          text: "En el programa de tu cliente, abre una sesión y pulsa «Hacer biserie». Marca los ejercicios que van seguidos y confirma. Dos ejercicios forman una biserie, tres una triserie y de cuatro a seis un circuito: el nombre cambia solo.",
        },
        {
          scene: "group-drag",
          title: "O hazlo arrastrando",
          text: "Al arrastrar un ejercicio aparecen recuadros punteados que te dicen qué pasa si lo sueltas ahí: al final de otro ejercicio suelto, para hacer una biserie; dentro de una biserie, para añadirlo; y debajo de ella, para sacarlo y dejarlo suelto. «Deshacer» separa el grupo entero.",
        },
        {
          scene: "group-client",
          title: "Tu cliente la registra en una sola pantalla",
          text: "Ve los ejercicios juntos y anota serie a serie: en cada serie, una de cada ejercicio, en el orden en que se hacen. Puede grabar vídeo de cada serie, y si pusiste RIR o «Por lado» en un ejercicio, le aparece ahí. El descanso es el del último ejercicio, después de hacerlos todos.",
        },
        {
          scene: "group-info",
          title: "Cómo se hace, sin salir del registro",
          text: "Al tocar el nombre de un ejercicio se abre una hoja con su imagen o animación, tu vídeo de demostración y la nota que le hayas dejado. Al cerrarla sigue donde estaba.",
        },
      ],
    },
    {
      label: "Entreno",
      title: "Entrenar sin volver atrás",
      items: [
        {
          scene: "next-exercise",
          title: "Botón «Siguiente» al terminar un ejercicio",
          text: "Cuando tu cliente finaliza un ejercicio, «Siguiente» le abre el próximo pendiente en el orden que tú pusiste, sin pasar por la pantalla de la sesión. Compartir sigue a mano, en pequeño.",
        },
        {
          scene: "share-logo",
          title: "Tu logo, entero, en la tarjeta para compartir",
          text: "La tarjeta que tus clientes suben a sus historias ya no recorta el logo en un círculo: se ve tal cual lo subiste, con su forma y su transparencia.",
        },
      ],
    },
    {
      label: "Formularios",
      title: "Formularios y clientes nuevos",
      items: [
        {
          scene: "fix-answer",
          title: "Corrige una respuesta de tu cliente",
          text: "Si se equivoca al escribir un dato (un 7,4 en vez de 74), ábrelo en la pestaña Formularios de su ficha y pulsa el lápiz junto a la respuesta. La gráfica y la media se corrigen al guardar. Sirve para números, escalas, valoraciones y textos.",
        },
        {
          scene: "intake-form",
          title: "El formulario inicial es lo primero que ve",
          text: "A un cliente nuevo se le abre solo la primera vez que entra. Al enviarlo ve un mensaje de agradecimiento, y a ti te aparece en Inicio, en «Check-ins y formularios por revisar», hasta que lo marques como revisado en su ficha.",
          action: {
            label: "Configurar el formulario inicial",
            href: `${FORMS}/intake`,
          },
        },
        {
          scene: "plan-access",
          title: "Tú decides cuándo ve su plan",
          text: "Si tienes activado el formulario inicial, un cliente nuevo no ve su entrenamiento ni su nutrición hasta que pulses «Dar acceso al plan» en su ficha; mientras tanto ve que su plan está en preparación. Así puedes prepararlo todo y enseñárselo en la llamada. Tus clientes actuales no cambian.",
        },
      ],
    },
    {
      label: "Gráficas",
      title: "Gráficas ordenadas",
      items: [
        {
          scene: "chart-sections",
          title: "Agrupa las gráficas en pestañas",
          text: "En el editor de cada gráfica hay un campo nuevo, «Sección». Las gráficas con la misma sección (Medidas, Energía, Entreno…) se ven juntas en una pestaña, tanto para ti como para tu cliente, que ya no tiene que bajar por todas.",
          action: {
            label: "Abrir mis gráficas",
            href: "/trainer/dashboard/charts-template",
          },
        },
        {
          scene: "details",
          title: "Pequeños detalles",
          text: "El eje de las gráficas muestra como mucho un decimal. Y el margen de días para rellenar el registro diario, que eliges en Plantillas › Hábitos diarios, ahora funciona también si pones más de cinco.",
        },
      ],
    },
  ],
};
