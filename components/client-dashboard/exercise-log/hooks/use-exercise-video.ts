// Encapsula la subida + borrado de video del registro de ejercicio.
// La compresión sucede en el servidor (ver lib/utils/server-video-compression.ts);
// aquí solo manejamos el upload del archivo crudo y el borrado del path en
// storage cuando el usuario quita el video.

/* eslint-disable no-console */
import { useEffect, useRef, useState } from "react";

import { clientFetch } from "@/lib/auth/client-token-storage";

interface UseExerciseVideoArgs {
  isOpen: boolean;
  clientId: string;
  initialVideoUrl: string | null;
}

interface UseExerciseVideoReturn {
  videoUrl: string | null;
  isUploading: boolean;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onPickFile: (file: File) => void;
  onRemove: () => void;
}

export function useExerciseVideo({
  isOpen,
  clientId,
  initialVideoUrl,
}: UseExerciseVideoArgs): UseExerciseVideoReturn {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Resetea el video cuando cambia el ejercicio o se cierra/reabre el modal.
  useEffect(() => {
    if (!isOpen) return;
    setVideoUrl(initialVideoUrl);
    setVideoPath(null);
  }, [isOpen, initialVideoUrl]);

  const onPickFile = async (file: File) => {
    try {
      setIsUploading(true);
      const fd = new FormData();

      fd.append("file", file);
      const response = await clientFetch(
        `/api/clients/${clientId}/exercise-logs/upload-video`,
        { method: "POST", body: fd }
      );
      const data = await response.json();

      if (data.success) {
        setVideoUrl(data.url);
        setVideoPath(data.path);
      } else {
        alert("Error al subir video: " + (data.error || "Error desconocido"));
      }
    } catch (err) {
      console.error("[useExerciseVideo] upload error:", err);
      alert("Error al subir video");
    } finally {
      setIsUploading(false);
    }
  };

  const onRemove = async () => {
    if (videoPath) {
      try {
        await clientFetch(
          `/api/clients/${clientId}/exercise-logs/upload-video?path=${encodeURIComponent(videoPath)}`,
          { method: "DELETE" }
        );
      } catch {
        // best effort — el storage puede quedar con un huérfano si falla.
      }
    }
    setVideoUrl(null);
    setVideoPath(null);
  };

  return {
    videoUrl,
    isUploading,
    fileInputRef,
    onPickFile,
    onRemove,
  };
}
