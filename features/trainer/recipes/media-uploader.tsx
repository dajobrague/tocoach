"use client";

import type { RecipeMediaItem } from "./recipe-api";

import { Button, Image, Select, SelectItem, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { DeleteConfirmButton } from "./delete-confirm-button";

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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [orientation, setOrientation] = useState<Orientation>("vertical");

  const photos = media.filter((item) => item.type === "image");
  const videos = media.filter((item) => item.type === "video");

  const pickPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file !== undefined) onUpload(file);
    event.target.value = "";
  };

  const pickVideo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file !== undefined) onUpload(file, orientation);
    event.target.value = "";
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Photos — required. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-default-500">
            Fotos
            <span className="rounded-full bg-danger-50 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-danger-600">
              Obligatorio
            </span>
          </span>
          <Button
            className="bg-black text-white"
            color="primary"
            isDisabled={busy}
            size="sm"
            startContent={
              busy ? (
                <Spinner color="current" size="sm" />
              ) : (
                <Icon icon="solar:gallery-add-linear" width={16} />
              )
            }
            onPress={() => photoInputRef.current?.click()}
          >
            Subir foto
          </Button>
        </div>

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((item) => (
              <MediaTile
                key={item.id}
                busy={busy}
                mediaId={item.id}
                onRemove={onRemove}
              >
                <Image
                  removeWrapper
                  alt="Foto de receta"
                  className="aspect-square w-full object-cover"
                  src={item.url}
                />
              </MediaTile>
            ))}
          </div>
        ) : (
          <button
            className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-300 bg-gray-50/60 py-7 text-center transition-colors hover:border-gray-400 hover:bg-gray-100 disabled:opacity-60"
            disabled={busy}
            type="button"
            onClick={() => photoInputRef.current?.click()}
          >
            <Icon
              className="text-default-300"
              icon="solar:gallery-add-linear"
              width={28}
            />
            <span className="px-6 text-sm text-default-500">
              Añade al menos una foto de la receta
            </span>
          </button>
        )}

        <input
          ref={photoInputRef}
          accept="image/*"
          className="hidden"
          type="file"
          onChange={pickPhoto}
        />
      </div>

      <div className="border-t border-gray-100" />

      {/* Videos — optional; orientation applies to video only. */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-default-500">
          Videos
          <span className="ml-1 normal-case tracking-normal text-default-400">
            (opcional)
          </span>
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Orientación del video"
            className="max-w-[170px]"
            selectedKeys={[orientation]}
            size="sm"
            startContent={
              <Icon
                className="text-default-400"
                icon="solar:smartphone-rotate-2-linear"
                width={16}
              />
            }
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
            isDisabled={busy}
            size="sm"
            startContent={
              busy ? (
                <Spinner color="current" size="sm" />
              ) : (
                <Icon icon="solar:videocamera-add-linear" width={16} />
              )
            }
            variant="flat"
            onPress={() => videoInputRef.current?.click()}
          >
            Subir video
          </Button>
        </div>

        {videos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {videos.map((item) => (
              <MediaTile
                key={item.id}
                busy={busy}
                mediaId={item.id}
                onRemove={onRemove}
              >
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-slate-100">
                  <Icon
                    className="text-slate-400"
                    icon="solar:videocamera-linear"
                    width={28}
                  />
                  {item.orientation !== null && (
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {item.orientation === "vertical"
                        ? "Vertical"
                        : "Horizontal"}
                    </span>
                  )}
                </div>
              </MediaTile>
            ))}
          </div>
        )}

        <input
          ref={videoInputRef}
          accept="video/*"
          className="hidden"
          type="file"
          onChange={pickVideo}
        />
      </div>
    </div>
  );
}

function MediaTile({
  busy,
  mediaId,
  onRemove,
  children,
}: {
  busy: boolean;
  mediaId: string;
  onRemove: (mediaId: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-medium border border-gray-200 bg-slate-100">
      {/* z-0 keeps the media (HeroUI Image ships its own z-index) below the
          delete control, which sits in a higher layer so it stays clickable. */}
      <div className="relative z-0">{children}</div>
      {/* Revealed on hover; stays visible while its confirm popover is open
          (aria-expanded) or on keyboard focus so it never vanishes mid-action. */}
      <DeleteConfirmButton
        ariaLabel="Eliminar media"
        className="absolute right-1 top-1 z-20 opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100"
        iconWidth={16}
        isDisabled={busy}
        message="¿Eliminar este archivo?"
        placement="bottom-end"
        variant="solid"
        onConfirm={() => onRemove(mediaId)}
      />
    </div>
  );
}
