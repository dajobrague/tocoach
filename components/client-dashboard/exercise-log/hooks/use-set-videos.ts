// Maneja la subida + borrado de video POR SERIE en el formulario de
// fuerza. El estado real (videoUrl/videoPath) vive dentro de
// formData.sets[i] para que se persista junto con el draft y se
// recupere al reabrir el modal. Acá solo encapsulamos:
//   - cuál índice está actualmente subiendo (spinner por fila)
//   - llamadas al endpoint de upload/delete
//   - mutación del set correspondiente en formData
//
// Cardio sigue usando useExerciseVideo (un solo video por log) — no
// tiene series, así que no aplica este hook.

/* eslint-disable no-console */
import type { Dispatch, SetStateAction } from "react";
import type { ExerciseLogFormDraft } from "@/lib/client/exercise-log-draft";

import { useCallback, useState } from "react";

import { clientFetch } from "@/lib/auth/client-token-storage";

interface Args {
  clientId: string;
  setFormData: Dispatch<SetStateAction<ExerciseLogFormDraft>>;
}

interface Return {
  // setIndex actualmente en curso (null si no hay nada subiendo).
  uploadingIndex: number | null;
  onPickFile: (setIndex: number, file: File) => Promise<void>;
  onRemove: (setIndex: number) => Promise<void>;
}

export function useSetVideos({ clientId, setFormData }: Args): Return {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const onPickFile = useCallback(
    async (setIndex: number, file: File) => {
      try {
        setUploadingIndex(setIndex);
        const fd = new FormData();

        fd.append("file", file);
        const response = await clientFetch(
          `/api/clients/${clientId}/exercise-logs/upload-video`,
          { method: "POST", body: fd }
        );
        const data = await response.json();

        if (!data.success) {
          alert("Error al subir video: " + (data.error || "Error desconocido"));

          return;
        }
        setFormData((prev) => {
          const sets = [...prev.sets];
          const target = sets[setIndex];

          if (!target) return prev;
          sets[setIndex] = {
            ...target,
            videoUrl: data.url,
            videoPath: data.path,
          };

          return { ...prev, sets };
        });
      } catch (err) {
        console.error("[useSetVideos] upload error:", err);
        alert("Error al subir video");
      } finally {
        setUploadingIndex(null);
      }
    },
    [clientId, setFormData]
  );

  const onRemove = useCallback(
    async (setIndex: number) => {
      let videoPath: string | undefined;

      setFormData((prev) => {
        const sets = [...prev.sets];
        const target = sets[setIndex];

        if (!target) return prev;
        videoPath = target.videoPath;
        // Construir un nuevo set sin las claves de video — bajo
        // exactOptionalPropertyTypes no podemos setearlas a undefined,
        // así que copiamos solo reps/weight.
        sets[setIndex] = { reps: target.reps, weight: target.weight };

        return { ...prev, sets };
      });

      // Best-effort cleanup en storage. Si videoPath no existe (caso
      // legacy o video que vino del servidor sin path local), no
      // intentamos borrar — la URL queda huérfana pero no rompe nada.
      if (videoPath) {
        try {
          await clientFetch(
            `/api/clients/${clientId}/exercise-logs/upload-video?path=${encodeURIComponent(videoPath)}`,
            { method: "DELETE" }
          );
        } catch {
          // ignorar — el cleanup de huérfanos puede correr aparte
        }
      }
    },
    [clientId, setFormData]
  );

  return { uploadingIndex, onPickFile, onRemove };
}
