"use client";

import type { RecipeMediaItem } from "./recipe-api";

import { Button, Image, Select, SelectItem, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

type Orientation = "vertical" | "horizontal";

interface MediaUploaderProps {
  media: RecipeMediaItem[];
  busy: boolean;
  onUpload: (file: File, orientation?: Orientation) => void;
  onRemove: (mediaId: string) => void;
}

export function MediaUploader({
  media,
  busy,
  onUpload,
  onRemove,
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [orientation, setOrientation] = useState<Orientation>("vertical");

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file !== undefined) {
      const isVideo = file.type.startsWith("video/");

      onUpload(file, isVideo ? orientation : undefined);
    }

    // Reset so the same file can be re-selected.
    event.target.value = "";
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Orientación del video"
          className="max-w-[180px]"
          selectedKeys={[orientation]}
          size="sm"
          variant="bordered"
          onSelectionChange={(keys) => {
            const first = keys === "all" ? undefined : Array.from(keys)[0];

            if (first === "vertical" || first === "horizontal") {
              setOrientation(first);
            }
          }}
        >
          <SelectItem key="vertical">Vertical</SelectItem>
          <SelectItem key="horizontal">Horizontal</SelectItem>
        </Select>

        <Button
          color="primary"
          isDisabled={busy}
          startContent={
            busy ? (
              <Spinner color="current" size="sm" />
            ) : (
              <Icon icon="solar:upload-linear" width={18} />
            )
          }
          variant="flat"
          onPress={() => inputRef.current?.click()}
        >
          Subir foto o video
        </Button>

        <input
          ref={inputRef}
          accept="image/*,video/*"
          className="hidden"
          type="file"
          onChange={handlePick}
        />
      </div>

      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-medium border border-gray-200 bg-slate-100"
            >
              {item.type === "image" ? (
                <Image
                  removeWrapper
                  alt="Media de receta"
                  className="aspect-square w-full object-cover"
                  src={item.url}
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center">
                  <Icon
                    className="text-slate-400"
                    icon="solar:videocamera-linear"
                    width={32}
                  />
                </div>
              )}

              <Button
                isIconOnly
                aria-label="Eliminar media"
                className="absolute right-1 top-1"
                color="danger"
                isDisabled={busy}
                size="sm"
                variant="solid"
                onPress={() => onRemove(item.id)}
              >
                <Icon icon="solar:trash-bin-trash-linear" width={16} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
