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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartY = useRef<number | null>(null);
  const lastTapMs = useRef(0);

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const attemptPlay = useCallback(() => {
    const el = videoRef.current;

    if (!el) return;

    // Force muted on the DOM element directly — React's muted prop
    // does NOT reliably set the HTML attribute on iOS Safari.
    el.defaultMuted = true;
    el.muted = true;

    const promise = el.play();

    if (promise) {
      promise
        .then(() => {
          setIsPlaying(true);
          hideControlsAfterDelay();
        })
        .catch(() => {
          setIsPlaying(false);
          setShowControls(true);
        });
    }
  }, [hideControlsAfterDelay]);

  // Ref callback: runs once when the <video> mounts into the DOM.
  // Sets muted directly on the element so Safari sees the attribute.
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current =
      node;
    if (node) {
      node.defaultMuted = true;
      node.muted = true;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
      setIsPlaying(false);
      setProgress(0);

      return;
    }

    setIsMuted(true);
    setShowControls(true);
    // Small delay lets the DOM settle after AnimatePresence mounts the element
    const id = setTimeout(() => attemptPlay(), 120);

    return () => {
      clearTimeout(id);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isOpen, videoUrl, attemptPlay]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const togglePlayPause = useCallback(() => {
    const el = videoRef.current;

    if (!el) return;
    if (el.paused) {
      el.muted = isMuted;
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
      hideControlsAfterDelay();
    } else {
      el.pause();
      setIsPlaying(false);
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  }, [isMuted, hideControlsAfterDelay]);

  const handleTap = useCallback(() => {
    const now = Date.now();

    if (now - lastTapMs.current < 350) return;
    lastTapMs.current = now;
    setShowControls(true);
    hideControlsAfterDelay();
    togglePlayPause();
  }, [togglePlayPause, hideControlsAfterDelay]);

  const handleTimeUpdate = () => {
    const el = videoRef.current;

    if (!el) return;
    if (el.duration > 0) setProgress((el.currentTime / el.duration) * 100);
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isMuted;

    setIsMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
  };

  // Touch handling: short swipe = tap, long swipe down = close
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
      onClose();
    } else if (Math.abs(dy) < 20) {
      handleTap();
    }
  };

  if (!isOpen) return null;

  return (
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

          {/* Close button */}
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

          {/* Sound toggle — always visible */}
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

          {/*
            Video element:
            - ref callback forces .muted=true on the DOM node (React bug workaround)
            - muted HTML attribute written via dangerouslySetInnerHTML is not needed
              because we use the ref callback + attemptPlay
            - playsInline is critical for iOS (prevents fullscreen takeover)
            - preload="auto" helps Safari buffer
            - onCanPlayThrough is more reliable than onLoadedData on mobile
          */}
          <video
            key={videoUrl}
            ref={setVideoRef}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 z-10 w-full h-full object-cover"
            preload="auto"
            src={videoUrl}
            onCanPlayThrough={() => {
              if (isOpen && videoRef.current?.paused) attemptPlay();
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTap();
            }}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onTimeUpdate={handleTimeUpdate}
          />

          {/* Bottom gradient + exercise name */}
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
  );
}
