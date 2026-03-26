"use client";

import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

interface VerticalVideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  exerciseName: string;
}

export function VerticalVideoPlayerModal({
  isOpen,
  onClose,
  videoUrl,
  exerciseName,
}: VerticalVideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartY = useRef<number | null>(null);
  const videoTouchStartY = useRef<number | null>(null);
  const lastTapMs = useRef(0);

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const tryPlay = useCallback(() => {
    const el = videoRef.current;

    if (!el) return;
    el.play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        setIsPlaying(false);
      });
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
      hideControlsAfterDelay();
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  }, [hideControlsAfterDelay]);

  useEffect(() => {
    if (!isOpen) return;
    setMuted(true);
    setIsPlaying(true);
    hideControlsAfterDelay();

    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isOpen, videoUrl, hideControlsAfterDelay]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, togglePlayPause]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const { currentTime, duration } = videoRef.current;

    if (duration > 0) setProgress((currentTime / duration) * 100);
  };

  const handleScreenTap = () => {
    const now = Date.now();

    if (now - lastTapMs.current < 380) return;
    lastTapMs.current = now;
    setShowControls(true);
    hideControlsAfterDelay();
    togglePlayPause();
  };

  const handleVideoTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleScreenTap();
  };

  const handleVideoTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];

    if (touch) videoTouchStartY.current = touch.clientY;
  };

  const handleVideoTouchEnd = (e: React.TouchEvent) => {
    if (videoTouchStartY.current === null) return;
    const touch = e.changedTouches[0];

    if (!touch) return;
    const dy = touch.clientY - videoTouchStartY.current;

    videoTouchStartY.current = null;
    if (Math.abs(dy) < 14) {
      handleScreenTap();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];

    if (touch) touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const touch = e.changedTouches[0];

    if (touch) {
      const deltaY = touch.clientY - touchStartY.current;

      if (deltaY > 100) onClose();
    }
    touchStartY.current = null;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={handleScreenTap}
          onTouchEnd={handleTouchEnd}
          onTouchStart={handleTouchStart}
        >
          {/* Progress bar at top */}
          <div className="absolute top-0 left-0 right-0 z-10 h-1 bg-white/20">
            <motion.div
              className="h-full bg-white"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          {/* Close button */}
          <AnimatePresence>
            {showControls && (
              <motion.button
                animate={{ opacity: 1 }}
                className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/40 backdrop-blur-sm"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
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

          {/* Sound: always visible; muted default enables autoplay on iOS / Android */}
          <button
            className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black/40 backdrop-blur-sm"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMuted((m) => !m);
            }}
          >
            <Icon
              className="text-white"
              icon={
                muted ? "solar:volume-cross-bold" : "solar:volume-loud-bold"
              }
              width={26}
            />
          </button>

          {/* Play/Pause indicator */}
          <AnimatePresence>
            {showControls && !isPlaying && (
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className="absolute z-10 p-4 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none"
                exit={{ opacity: 0, scale: 0.8 }}
                initial={{ opacity: 0, scale: 0.8 }}
              >
                <Icon
                  className="text-white"
                  icon="solar:play-bold"
                  width={48}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Video: playsInline + muted allow autoplay on mobile Safari / Chrome */}
          <video
            key={videoUrl}
            ref={videoRef}
            autoPlay
            loop
            playsInline
            className="absolute inset-0 z-0 w-full h-full object-cover"
            muted={muted}
            preload="auto"
            src={videoUrl}
            onClick={handleVideoTap}
            onLoadedData={() => tryPlay()}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onTimeUpdate={handleTimeUpdate}
            onTouchEnd={handleVideoTouchEnd}
            onTouchStart={handleVideoTouchStart}
          >
            <track kind="captions" label="Spanish" srcLang="es" />
          </video>

          {/* Bottom gradient + exercise name */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                animate={{ opacity: 1 }}
                className="absolute bottom-0 left-0 right-0 z-10"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
              >
                <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-8 px-6">
                  <h3 className="text-white text-lg font-bold">
                    {exerciseName}
                  </h3>
                  <p className="text-white/60 text-sm mt-1">
                    Toca para pausar · Sonido arriba a la izquierda · Desliza
                    abajo para cerrar
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
