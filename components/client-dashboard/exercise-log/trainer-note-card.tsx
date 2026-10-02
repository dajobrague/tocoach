// Nota del entrenador para el ejercicio. Antes vivía como una línea
// italic debajo del nombre, pero notas largas rompían visualmente el
// hero/identity. Ahora es una card propia debajo de "Datos del
// programa" con preview clamped y toggle "Ver más / menos".
//
// Compacta: va justo encima de las series. Si la nota es corta (≤100
// chars) se ve completa; si es larga, clamp a 2 líneas + "Ver más".

"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

const LONG_NOTE_THRESHOLD = 100;

interface Props {
  note: string;
}

export function TrainerNoteCard({ note }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isLong = note.length > LONG_NOTE_THRESHOLD;

  return (
    <div className="flex items-start gap-2 rounded-medium bg-default-100 px-3 py-2">
      <Icon
        aria-hidden
        className="mt-0.5 shrink-0 text-default-500"
        icon="solar:chat-round-line-linear"
        width={16}
      />
      <div className="min-w-0 flex-1">
        <p className="sr-only">Nota del entrenador</p>
        <p
          className={`text-sm text-default-700 whitespace-pre-line break-words ${
            !expanded && isLong ? "line-clamp-2" : ""
          }`}
        >
          {note}
        </p>
        {isLong ? (
          <button
            aria-expanded={expanded}
            className="mt-1 min-h-8 text-xs font-medium text-primary hover:underline"
            type="button"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Ver menos" : "Ver más"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
