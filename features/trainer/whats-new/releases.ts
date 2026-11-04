// Novedades que ve el entrenador al entrar tras una actualización (JC, 28 oct).
// Para una versión nueva: cambia `id` y las páginas. Cada `id` sale una vez.

export interface WhatsNewPage {
  icon: string;
  title: string;
  text: string;
}

export interface WhatsNewRelease {
  id: string;
  pages: WhatsNewPage[];
}

export const LATEST_RELEASE: WhatsNewRelease = {
  id: "2026-11-musculos",
  pages: [
    {
      icon: "solar:body-bold",
      title: "Músculos en cada ejercicio",
      text: "Marca el músculo principal y los secundarios. Filtra tu biblioteca por músculo y el asistente te los completa en segundos.",
    },
    {
      icon: "solar:videocamera-record-linear",
      title: "Biblioteca de ejercicios con vídeo",
      text: "Más de 700 ejercicios con su animación, en versión hombre y mujer. Añádelos a tu biblioteca con un clic desde «Biblioteca».",
    },
    {
      icon: "solar:chart-2-linear",
      title: "Series por músculo",
      text: "Al programar una sesión ves cuántas series trabaja cada grupo muscular, y tu cliente lo ve en su entreno.",
    },
    {
      icon: "solar:share-linear",
      title: "Tus clientes comparten con tu marca",
      text: "Al terminar un entreno crean su imagen para Instagram con tu nombre, tu logo y el pie que elijas en Ajustes → Compartir.",
    },
  ],
};
