// Novedades que ve el entrenador al entrar tras una actualización (JC, 28 oct).
// Para una versión nueva: cambia `id` y las páginas. Cada `id` sale una vez.
// `stage` elige la escena en vivo de whats-new-dialog.tsx.

export type WhatsNewStage = "muscles" | "library" | "volume" | "share";

export interface WhatsNewPage {
  stage: WhatsNewStage;
  /** Nombre corto para la navegación. */
  label: string;
  title: string;
  text: string;
  action?: { label: string; href: string };
}

export interface WhatsNewRelease {
  id: string;
  pages: WhatsNewPage[];
}

const LIBRARY = "/trainer/dashboard/exercise-library";

export const LATEST_RELEASE: WhatsNewRelease = {
  id: "2026-11-musculos",
  pages: [
    {
      stage: "muscles",
      label: "Músculos",
      title: "Cada ejercicio sabe qué músculos trabaja",
      text: "Marca el principal y los secundarios sobre el cuerpo y filtra tu biblioteca por músculo. Para los ejercicios que ya tenías, el asistente te los propone y tú solo revisas.",
      action: { label: "Completar mi biblioteca", href: LIBRARY },
    },
    {
      stage: "library",
      label: "Biblioteca",
      title: "700 ejercicios con su vídeo, listos para usar",
      text: "Busca en el catálogo, mira la técnica en movimiento y añádelo a tu biblioteca con un clic. Cada cliente ve el vídeo con la figura de su sexo.",
      action: { label: "Abrir el catálogo", href: LIBRARY },
    },
    {
      stage: "volume",
      label: "Volumen",
      title: "El volumen de cada sesión, mientras programas",
      text: "Cada serie suma 1 a su músculo principal y 0,5 a los secundarios. Lo ves al desplegar una sesión del programa, y tu cliente en su entreno.",
    },
    {
      stage: "share",
      label: "Compartir",
      title: "Tus clientes presumen de entreno, con tu marca",
      text: "Al terminar, crean su imagen para Instagram con lo que trabajaron. Lleva tu logo, tu nombre y el pie que tú elijas.",
      action: {
        label: "Ajustar mi firma",
        href: "/trainer/settings?tab=share-card",
      },
    },
  ],
};
