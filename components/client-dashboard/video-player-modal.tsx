"use client";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { Icon } from "@iconify/react";

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  exerciseName: string;
}

export function VideoPlayerModal({
  isOpen,
  onClose,
  videoUrl,
  exerciseName,
}: VideoPlayerModalProps) {
  // Extract video ID and platform
  const getVideoEmbed = (url: string) => {
    // YouTube
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      let videoId = "";

      if (url.includes("youtu.be/")) {
        const parts = url.split("youtu.be/")[1];

        videoId = parts ? parts.split("?")[0] || "" : "";
      } else if (url.includes("youtube.com")) {
        const urlParams = new URLSearchParams(new URL(url).search);

        videoId = urlParams.get("v") || "";
      }

      return {
        type: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`,
      };
    }

    // Vimeo
    if (url.includes("vimeo.com")) {
      const parts = url.split("vimeo.com/")[1];
      const videoId = parts ? parts.split("?")[0] || "" : "";

      return {
        type: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
      };
    }

    // Direct video file
    if (url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg")) {
      return {
        type: "direct",
        embedUrl: url,
      };
    }

    // Default: try iframe
    return {
      type: "iframe",
      embedUrl: url,
    };
  };

  const videoData = getVideoEmbed(videoUrl);

  return (
    <Modal
      classNames={{
        base: "max-h-[90vh]",
        header: "border-b border-default-200",
        body: "p-0",
      }}
      isOpen={isOpen}
      placement="center"
      size="3xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-lg">
              <Icon
                className="text-white text-xl"
                icon="solar:play-circle-bold"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-heading font-bold text-foreground">
                {exerciseName}
              </h3>
              <p className="text-sm text-foreground/60 font-body font-normal">
                Video Tutorial
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            {videoData.type === "direct" ? (
              <video
                controls
                className="absolute inset-0 w-full h-full"
                src={videoData.embedUrl}
              >
                <track kind="captions" label="Spanish" srcLang="es" />
                Tu navegador no soporta el elemento de video.
              </video>
            ) : (
              <iframe
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                src={videoData.embedUrl}
                title={exerciseName}
              />
            )}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
