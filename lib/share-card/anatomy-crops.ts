// Plantilla "Anatomía" del sticker: un recorte cuadrado del cuerpo sombreado
// por grupo muscular. Las cajas son el contorno (alfa > 40) de los overlays
// del grupo en el kit de 640 px de ancho (build-body.mjs), medidas sobre los
// archivos reales; si se reconstruye el kit con otro encuadre, hay que
// volver a medirlas. La vista es la que más superficie del grupo enseña.

import type { MuscleId } from "@/lib/training/muscles";

import {
  BODY_HEIGHT,
  BODY_WIDTH,
  type BodyView,
} from "@/lib/training/body-overlays";

type Box = readonly [x0: number, y0: number, x1: number, y1: number];

export const ANATOMY_VIEW: Record<MuscleId, BodyView> = {
  pectoral: "front",
  deltoides_anterior: "front",
  deltoides_lateral: "front",
  deltoides_posterior: "back",
  biceps: "front",
  triceps: "back",
  antebrazo: "front",
  trapecio: "back",
  dorsal: "back",
  erectores: "back",
  abdomen: "front",
  gluteo: "back",
  aductores: "front",
  cuadriceps: "front",
  isquiotibiales: "back",
  gemelos: "back",
};

const BOXES: Record<"male" | "female", Record<MuscleId, Box>> = {
  male: {
    pectoral: [133, 295, 506, 476],
    deltoides_anterior: [55, 287, 584, 441],
    deltoides_lateral: [55, 287, 584, 441],
    deltoides_posterior: [56, 280, 583, 420],
    biceps: [61, 421, 578, 619],
    triceps: [41, 385, 598, 646],
    antebrazo: [12, 594, 627, 853],
    trapecio: [166, 150, 473, 496],
    dorsal: [140, 416, 499, 655],
    erectores: [251, 560, 388, 693],
    abdomen: [151, 458, 488, 743],
    gluteo: [167, 591, 472, 904],
    aductores: [216, 886, 423, 1242],
    cuadriceps: [116, 858, 523, 1187],
    isquiotibiales: [145, 898, 494, 1205],
    gemelos: [124, 1169, 515, 1615],
  },
  female: {
    pectoral: [144, 330, 495, 523],
    deltoides_anterior: [77, 320, 562, 487],
    deltoides_lateral: [77, 320, 562, 487],
    deltoides_posterior: [79, 305, 560, 455],
    biceps: [74, 424, 565, 661],
    triceps: [58, 406, 581, 681],
    antebrazo: [24, 631, 615, 898],
    trapecio: [178, 167, 461, 534],
    dorsal: [152, 428, 487, 693],
    erectores: [260, 604, 379, 729],
    abdomen: [173, 578, 466, 821],
    gluteo: [144, 584, 495, 957],
    aductores: [189, 981, 450, 1345],
    cuadriceps: [99, 969, 540, 1292],
    isquiotibiales: [130, 965, 509, 1302],
    gemelos: [124, 1243, 515, 1723],
  },
};

const PAD = 36;
/** Lado mínimo: sin él los grupos pequeños (erectores) se ven pixelados. */
const MIN_SIDE = 320;

/** Cuadrado (en px del kit) centrado en el grupo, con margen, dentro del cuerpo. */
export function anatomyCrop(sex: "male" | "female", id: MuscleId) {
  const view = ANATOMY_VIEW[id];
  const [x0, y0, x1, y1] = BOXES[sex][id];
  const height = BODY_HEIGHT[sex][view];
  const side = Math.min(
    BODY_WIDTH,
    Math.max(MIN_SIDE, x1 - x0 + PAD * 2, y1 - y0 + PAD * 2)
  );
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));

  return {
    view,
    x: clamp((x0 + x1) / 2 - side / 2, BODY_WIDTH - side),
    y: clamp((y0 + y1) / 2 - side / 2, height - side),
    side,
  };
}
