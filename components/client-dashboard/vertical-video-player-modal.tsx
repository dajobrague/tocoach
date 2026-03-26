"use client";

import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface VerticalVideoPlayerHandle {
  open: (url: string, name: string) => void;
}

interface VerticalVideoPlayerModalProps {
  onClose?: () => void;
}

export const VerticalVideoPlayerModal = forwardRef<
  VerticalVideoPlayerHandle,
  VerticalVideoPlayerModalProps
>(function VerticalVideoPlayerModal({ onClose }, ref) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [exerciseName, setExerciseName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartY = useRef<number | null>(null);
  const lastTapMs = useRef(0);

  const scheduleHideControls = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // Force muted attribute on the DOM node (React bug workaround for Safari)
  const setVideoNode = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node) {
      node.defaultMuted = true;
      node.muted = true;
    }
  }, []);

  // Called synchronously from the parent's click handler — within user gesture.
  useImperativeHandle(
    ref,
    () => ({
      open(url: string, name: string) {
        const el = videoRef.current;

        if (!el) return;

        setExerciseName(name);
        setProgress(0);
        setShowControls(true);
        setIsMuted(false);

        // Set src and unmute SYNCHRONOUSLY in the user gesture call stack.
        el.src = url;
        el.muted = false;
        el.currentTime = 0;
        el.play()
          .then(() => {
            setIsPlaying(true);
            setIsOpen(true);
            scheduleHideControls();
          })
          .catch(() => {
            // Unmuted play blocked — retry muted
            el.muted = true;
            setIsMuted(true);
            el.play()
              .then(() => {
                setIsPlaying(true);
                setIsOpen(true);
                scheduleHideControls();
              })
              .catch(() => {
                setIsPlaying(false);
                setIsOpen(true);
              });
          });
      },
    }),
    [scheduleHideControls]
  );

  const close = useCallback(() => {
    const el = videoRef.current;

    if (el) {
      el.pause();
    }
    setIsOpen(false);
    setIsPlaying(false);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === " ") {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  const togglePlayPause = useCallback(() => {
    const el = videoRef.current;

    if (!el) return;
    if (el.paused) {
      el.muted = isMuted;
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
      scheduleHideControls();
    } else {
      el.pause();
      setIsPlaying(false);
      setShowControls(true);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    }
  }, [isMuted, scheduleHideControls]);

  const handleTap = useCallback(() => {
    const now = Date.now();

    if (now - lastTapMs.current < 350) return;
    lastTapMs.current = now;
    setShowControls(true);
    scheduleHideControls();
    togglePlayPause();
  }, [togglePlayPause, scheduleHideControls]);

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isMuted;

    setIsMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
  };

  const handleTimeUpdate = () => {
    const el = videoRef.current;

    if (el && el.duration > 0)
      setProgress((el.currentTime / el.duration) * 100);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];

    if (t) touchStartY.current = t.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const t = e.changedTouches[0];

    if (!t) {
      touchStartY.current = null;

      return;
    }
    const dy = t.clientY - touchStartY.current;

    touchStartY.current = null;
    if (dy > 100) {
      close();
    } else if (Math.abs(dy) < 20) {
      handleTap();
    }
  };

  return (
    <>
      {/* Hidden video — always in the DOM so play() works in user gesture */}
      {!isOpen && (
        <video
          ref={setVideoNode}
          loop
          muted
          playsInline
          preload="none"
          style={{
            position: "fixed",
            width: 0,
            height: 0,
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <track kind="captions" label="Spanish" srcLang="es" />
        </video>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[9999] bg-black"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onTouchEnd={handleTouchEnd}
            onTouchStart={handleTouchStart}
          >
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 z-20 h-1 bg-white/20">
              <div
                className="h-full bg-white transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Close */}
            <AnimatePresence>
              {showControls && (
                <motion.button
                  animate={{ opacity: 1 }}
                  className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/50 backdrop-blur-sm"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                  }}
                >
                  <Icon
                    className="text-white"
                    icon="solar:close-circle-bold"
                    width={28}
                  />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Sound toggle */}
            <button
              className="absolute top-4 left-4 z-30 p-2 rounded-full bg-black/50 backdrop-blur-sm"
              type="button"
              onClick={handleToggleMute}
            >
              <Icon
                className="text-white"
                icon={
                  isMuted ? "solar:volume-cross-bold" : "solar:volume-loud-bold"
                }
                width={26}
              />
            </button>

            {/* Play indicator */}
            <AnimatePresence>
              {showControls && !isPlaying && (
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                  exit={{ opacity: 0, scale: 0.8 }}
                  initial={{ opacity: 0, scale: 0.8 }}
                >
                  <div className="p-5 rounded-full bg-black/50 backdrop-blur-sm">
                    <Icon
                      className="text-white"
                      icon="solar:play-bold"
                      width={48}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Visible video */}
            <video
              ref={setVideoNode}
              loop
              playsInline
              className="absolute inset-0 z-10 w-full h-full object-cover"
              muted={isMuted}
              preload="auto"
              onClick={(e) => {
                e.stopPropagation();
                handleTap();
              }}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onTimeUpdate={handleTimeUpdate}
            >
              <track kind="captions" label="Spanish" srcLang="es" />
            </video>

            {/* Bottom gradient */}
            <AnimatePresence>
              {showControls && (
                <motion.div
                  animate={{ opacity: 1 }}
                  className="absolute bottom-0 left-0 right-0 z-20"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                >
                  <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-8 px-6">
                    <h3 className="text-white text-lg font-bold">
                      {exerciseName}
                    </h3>
                    <p className="text-white/60 text-sm mt-1">
                      Toca para pausar · Desliza abajo para cerrar
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
