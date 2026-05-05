// Encapsula la subida + borrado de video del registro de ejercicio:
// estados (uploading, compressing, progress), upload con compresión
// opcional, y limpieza del path en storage cuando el usuario quita el
// video. La compresión browser-side es best-effort: si el navegador no
// la soporta, sube el archivo crudo.

/* eslint-disable no-console */
import { useEffect, useRef, useState } from "react";

import { clientFetch } from "@/lib/auth/client-token-storage";
import {
  compressVideo,
  isCompressionSupported,
} from "@/lib/utils/video-compression";

interface UseExerciseVideoArgs {
  isOpen: boolean;
  clientId: string;
  initialVideoUrl: string | null;
}

interface UseExerciseVideoReturn {
  videoUrl: string | null;
  isUploading: boolean;
  isCompressing: boolean;
  compressionProgress: number;
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
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Resetea el video cuando cambia el ejercicio o se cierra/reabre el modal.
  useEffect(() => {
    if (!isOpen) return;
    setVideoUrl(initialVideoUrl);
    setVideoPath(null);
  }, [isOpen, initialVideoUrl]);

  const onPickFile = async (file: File) => {
    try {
      let fileToUpload = file;

      if (isCompressionSupported()) {
        setIsCompressing(true);
        setCompressionProgress(0);
        fileToUpload = await compressVideo(file, (percent) =>
          setCompressionProgress(percent)
        );
        setIsCompressing(false);
      }
      setIsUploading(true);
      const fd = new FormData();

      fd.append("file", fileToUpload);
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
      setIsCompressing(false);
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
    isCompressing,
    compressionProgress,
    fileInputRef,
    onPickFile,
    onRemove,
  };
}
