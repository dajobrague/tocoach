// Nota del entrenador para el ejercicio. Antes vivía como una línea
// italic debajo del nombre, pero notas largas rompían visualmente el
// hero/identity. Ahora es una card propia debajo de "Datos del
// programa" con preview clamped y toggle "Ver más / menos".
//
// Heurística: si la nota es corta (≤140 chars) la mostramos completa
// sin toggle. Si es larga, clamp a 3 líneas + botón.

"use client";

import { useState } from "react";

const LONG_NOTE_THRESHOLD = 140;

interface Props {
  note: string;
}

export function TrainerNoteCard({ note }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isLong = note.length > LONG_NOTE_THRESHOLD;

  return (
    <div className="rounded-lg border border-default-200 bg-content1 px-3 py-2.5">
      <p className="text-[11px] uppercase font-semibold text-foreground/50 font-body mb-1.5">
        Nota del entrenador
      </p>
      <p
        className={`text-sm font-body text-foreground/80 whitespace-pre-line break-words ${
          !expanded && isLong ? "line-clamp-3" : ""
        }`}
      >
        {note}
      </p>
      {isLong ? (
        <button
          className="mt-1.5 text-xs font-body font-medium text-primary hover:underline"
          type="button"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      ) : null}
    </div>
  );
}
