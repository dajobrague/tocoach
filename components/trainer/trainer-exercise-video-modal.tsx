"use client";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface TrainerExerciseVideoHandle {
  open: (url: string, name: string) => void;
}

interface TrainerExerciseVideoModalProps {
  onClose?: () => void;
}

export const TrainerExerciseVideoModal = forwardRef<
  TrainerExerciseVideoHandle,
  TrainerExerciseVideoModalProps
>(function TrainerExerciseVideoModal({ onClose }, ref) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [videoSrc, setVideoSrc] = useState("");
  const [exerciseName, setExerciseName] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  const handleLoadedData = useCallback(() => setStatus("ready"), []);
  const handleError = useCallback(() => setStatus("error"), []);

  useImperativeHandle(
    ref,
    () => ({
      open(url: string, name: string) {
        setVideoSrc(url);
        setExerciseName(name);
        setStatus("loading");
        setIsOpen(true);
      },
    }),
    []
  );

  const handleClose = useCallback(() => {
    const el = videoRef.current;

    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setIsOpen(false);
    setVideoSrc("");
    onClose?.();
  }, [onClose]);

  return (
    <Modal
      hideCloseButton
      backdrop="blur"
      classNames={{
        base: "bg-transparent shadow-none",
        wrapper: "items-center",
        closeButton: "hidden",
      }}
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="4xl"
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center justify-between gap-3 bg-zinc-900/95 text-white rounded-t-xl px-4 py-3">
          <span className="truncate text-base font-semibold">
            {exerciseName}
          </span>
          <button
            aria-label="Cerrar video"
            className="rounded-full p-1.5 hover:bg-white/10 transition-colors"
            type="button"
            onClick={handleClose}
          >
            <Icon icon="solar:close-circle-bold" width={24} />
          </button>
        </ModalHeader>
        <ModalBody className="p-0 bg-black rounded-b-xl">
          <div className="relative w-full aspect-video max-h-[78vh]">
            {videoSrc && (
              <video
                ref={videoRef}
                autoPlay
                controls
                playsInline
                className="absolute inset-0 w-full h-full object-contain bg-black"
                preload="metadata"
                src={videoSrc}
                onError={handleError}
                onLoadedData={handleLoadedData}
              >
                <track kind="captions" label="Spanish" srcLang="es" />
              </video>
            )}

            {status === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
                <Icon
                  className="text-white animate-spin"
                  icon="solar:refresh-bold"
                  width={40}
                />
              </div>
            )}

            {status === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-white px-6 text-center">
                <Icon
                  className="text-red-400"
                  icon="solar:videocamera-record-broken"
                  width={48}
                />
                <p className="text-sm font-medium">
                  No se pudo cargar el video.
                </p>
                <p className="text-xs text-white/60">
                  Intentá cerrar y volver a abrirlo, o pedile al cliente que
                  vuelva a subir el archivo.
                </p>
              </div>
            )}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
});
