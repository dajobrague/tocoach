"use client";

// Fila del feed de videos: [miniatura] [ejercicio + serie + cita del coach]
// [toggle Revisado]. El comentario se escribe en un composer que se despliega
// bajo la fila (nunca un prompt nativo — congela la página en HeroUI).
//
// Las filas revisadas se atenúan al 50% para que la vista se lea como una
// bandeja de pendientes, PERO la cita del coach queda fuera del envoltorio
// atenuado: es la información que el trainer vuelve a consultar.

import type { VideoReviewEntry } from "./videos-api";
import type { VideoFeedItem } from "./videos-format";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { ReviewComposer } from "./review-composer";
import { VideoThumb } from "./video-thumb";

type ComposerMode = "review" | "edit";

interface Props {
  item: VideoFeedItem;
  /** Revisión existente; undefined = sin revisar. */
  review: VideoReviewEntry | undefined;
  isSaving: boolean;
  onPlay: (url: string, name: string) => void;
  onSave: (item: VideoFeedItem, comment: string | null) => void;
  onUnreview: (item: VideoFeedItem) => void;
}

export function VideoRow({
  item,
  review,
  isSaving,
  onPlay,
  onSave,
  onUnreview,
}: Props) {
  const [composer, setComposer] = useState<ComposerMode | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isReviewed = review !== undefined;
  const comment = review?.comment ?? null;
  const hasComment = comment !== null && comment.trim().length > 0;

  const openComposer = (mode: ComposerMode) => {
    setComposer(mode);
  };

  const handleToggle = () => {
    if (!isReviewed) {
      openComposer("review");

      return;
    }
    // Desmarcar borra el comentario: solo se pregunta cuando hay algo que perder.
    if (hasComment) {
      setConfirmOpen(true);

      return;
    }
    onUnreview(item);
  };

  return (
    <li className="px-4 py-3">
      <div
        className={`flex items-start gap-3 ${isReviewed ? "opacity-50" : ""}`}
      >
        <VideoThumb
          label={`Ver video de ${item.exerciseName} — ${item.setLabel}`}
          url={item.videoUrl}
          onOpen={() => onPlay(item.videoUrl, item.exerciseName)}
        />

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-900">
            {item.exerciseName}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500 tabular-nums">
            {item.setLabel}
          </p>
          {item.kind === "legacy" ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <Icon icon="solar:videocamera-linear" width={11} />
              Video del ejercicio
            </span>
          ) : null}
        </div>

        <button
          className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            isReviewed
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
          }`}
          disabled={isSaving}
          title={isReviewed ? "Quitar revisado" : "Marcar como revisado"}
          type="button"
          onClick={handleToggle}
        >
          <Icon
            icon={
              isReviewed
                ? "solar:check-circle-bold"
                : "solar:check-circle-linear"
            }
            width={13}
          />
          {isReviewed ? "Revisado" : "Revisar"}
        </button>
      </div>

      {/* Cita del coach: fuera del bloque atenuado, a plena opacidad. */}
      {hasComment && composer === null ? (
        <div className="mt-2 flex items-start gap-2 border-l-[2.5px] border-emerald-500 pl-2 text-xs text-gray-500">
          <p className="min-w-0 flex-1 leading-snug">
            <span className="font-bold text-emerald-600">Coach:</span> {comment}
          </p>
          <button
            className="shrink-0 text-[11px] font-semibold text-blue-600 transition-colors hover:text-blue-700"
            type="button"
            onClick={() => openComposer("edit")}
          >
            editar
          </button>
        </div>
      ) : null}

      {composer !== null ? (
        <ReviewComposer
          initial={composer === "edit" ? (comment ?? "") : ""}
          isSaving={isSaving}
          submitLabel={composer === "edit" ? "Guardar" : "Marcar revisado"}
          onCancel={() => setComposer(null)}
          onSubmit={(text) => {
            onSave(item, text);
            setComposer(null);
          }}
        />
      ) : null}

      <Modal
        isOpen={confirmOpen}
        placement="center"
        size="sm"
        onClose={() => setConfirmOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="text-base font-semibold">
            Quitar revisado
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600">
              Si quitas la revisión de este video se eliminará el comentario y
              el cliente dejará de verlo.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              size="sm"
              variant="light"
              onPress={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              color="danger"
              size="sm"
              onPress={() => {
                setConfirmOpen(false);
                onUnreview(item);
              }}
            >
              Quitar revisado
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </li>
  );
}
