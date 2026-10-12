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
    <section className="rounded-large bg-content1 p-4 shadow-small">
      <h3 className="mb-1.5 text-[15px] font-semibold text-foreground">
        Nota del entrenador
      </h3>
      <p
        className={`whitespace-pre-line break-words text-[15px] leading-normal text-foreground ${
          !expanded && isLong ? "line-clamp-3" : ""
        }`}
      >
        {note}
      </p>
      {isLong ? (
        <button
          aria-expanded={expanded}
          className="mt-1 min-h-9 text-[15px] font-semibold text-primary active:opacity-60"
          type="button"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      ) : null}
    </section>
  );
}
