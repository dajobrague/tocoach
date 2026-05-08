// Hero del modal de registro: ocupa ~1/3 del viewport con la imagen
// del ejercicio (estilo Airbnb detail page). Si no hay imagen, fallback
// a un bloque tintado con el icono del tipo de ejercicio.
//
// Sobre la imagen flota un botón de cerrar (X). Un gradiente sutil en
// la base ayuda a leer cualquier overlay si lo hay.

import { Icon } from "@iconify/react";

import { getSessionTypeStyle } from "@/components/client-dashboard/workouts/session-type-style";

interface Props {
  imageUrl?: string | null;
  isCardio: boolean;
  onClose: () => void;
}

export function ExerciseLogHero({ imageUrl, isCardio, onClose }: Props) {
  const typeStyle = getSessionTypeStyle(isCardio ? "cardio" : "strength");

  return (
    <div className="relative w-full h-[33vh] min-h-[180px] max-h-[320px] overflow-hidden">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="w-full h-full object-cover" src={imageUrl} />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center ${typeStyle.iconBgClass}`}
        >
          <Icon
            aria-hidden="true"
            className={typeStyle.iconColorClass}
            icon={typeStyle.icon}
            width={72}
          />
        </div>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none"
      />

      <button
        aria-label="Volver"
        className="absolute top-3 left-3 inline-flex items-center justify-center h-9 w-9 rounded-full text-white drop-shadow-md hover:bg-white/10 transition-colors"
        type="button"
        onClick={onClose}
      >
        <Icon icon="solar:alt-arrow-left-linear" width={26} />
      </button>
    </div>
  );
}
