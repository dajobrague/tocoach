"use client";

// Compositor del comentario de revisión — compartido entre la fila del tab
// Videos (video-row) y la cola "Videos por revisar" de métricas. El estado del
// borrador vive aquí; el caller solo decide cuándo montarlo y qué hacer al
// guardar (comentario ya recortado; vacío → null).

import { Button, Textarea } from "@heroui/react";
import { useState } from "react";

interface Props {
  /** Texto inicial (editar un comentario existente). */
  initial?: string;
  isSaving: boolean;
  /** "Marcar revisado" al revisar; "Guardar" al editar. */
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (comment: string | null) => void;
}

export function ReviewComposer({
  initial = "",
  isSaving,
  submitLabel,
  onCancel,
  onSubmit,
}: Props) {
  const [draft, setDraft] = useState(initial);

  const submit = () => {
    const trimmed = draft.trim();

    onSubmit(trimmed.length > 0 ? trimmed : null);
  };

  return (
    <div className="mt-2.5 rounded-large border border-gray-200 bg-gray-50/60 p-3">
      <p className="mb-1.5 text-[11px] font-semibold text-gray-600">
        Comentario para el cliente (opcional)
      </p>
      <Textarea
        autoFocus
        classNames={{ inputWrapper: "bg-white" }}
        maxRows={3}
        minRows={2}
        placeholder="Ej: buena profundidad, cuida que la espalda no se redondee al subir."
        value={draft}
        variant="bordered"
        onValueChange={setDraft}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button size="sm" variant="light" onPress={onCancel}>
          Cancelar
        </Button>
        <Button
          className="bg-emerald-600 text-white"
          isLoading={isSaving}
          size="sm"
          onPress={submit}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
