"use client";

import { Modal, ModalBody, ModalContent, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQueryClient } from "@tanstack/react-query";
import { type MouseEvent, useEffect, useRef, useState } from "react";

type OptionImageTrainerFieldProps = {
  optionId: string;
  imageUrl?: string | null | undefined;
  onAfterChange: () => void | Promise<void>;
  disabled?: boolean;
};

export function OptionImageTrainerField({
  optionId,
  imageUrl,
  onAfterChange,
  disabled = false,
}: OptionImageTrainerFieldProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setLocalUrl(imageUrl ?? null);
  }, [imageUrl]);

  const runAfterChange = async () => {
    await queryClient.invalidateQueries({ queryKey: ["client", "nutrition"] });
    await onAfterChange();
  };

  const handleFileSelected = async (file: File | null) => {
    if (disabled || !file) return;
    setUploading(true);
    try {
      const formData = new FormData();

      formData.append("image", file);
      const response = await fetch(`/api/nutrition/options/${optionId}/image`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (data.success && data.imageUrl) {
        setLocalUrl(data.imageUrl);
        await runAfterChange();
      } else {
        alert(data.error || "Error al subir la imagen");
      }
    } catch {
      alert("Error al subir la imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled) return;
    setUploading(true);
    try {
      const response = await fetch(`/api/nutrition/options/${optionId}/image`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        setLocalUrl(null);
        await runAfterChange();
      } else {
        alert(data.error || "Error al eliminar la imagen");
      }
    } catch {
      alert("Error al eliminar la imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
        className="hidden"
        type="file"
        onChange={(ev) => handleFileSelected(ev.target.files?.[0] ?? null)}
      />

      <div className="w-[100px] flex-shrink-0">
        {disabled ? (
          <div className="w-[100px] h-[100px] rounded-xl border-2 border-dashed border-gray-200 bg-gray-100/80 flex flex-col items-center justify-center gap-1 p-2">
            <Icon
              className="text-gray-400"
              icon="solar:camera-bold"
              width={22}
            />
            <span className="text-[8px] text-gray-500 text-center leading-tight">
              Guarda la opción para foto
            </span>
          </div>
        ) : uploading ? (
          <div className="w-[100px] h-[100px] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-2">
            <Spinner color="default" size="sm" />
            <span className="text-[9px] text-gray-500 text-center px-1">
              Subiendo…
            </span>
          </div>
        ) : localUrl ? (
          <div className="relative w-[100px] h-[100px] rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shadow-sm">
            <button
              className="absolute inset-0 w-full h-full p-0 border-0 cursor-zoom-in block"
              type="button"
              onClick={() => setPreviewOpen(true)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="w-full h-full object-cover"
                src={localUrl}
              />
            </button>
            <button
              aria-label="Quitar imagen"
              className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
              type="button"
              onClick={handleRemove}
            >
              <Icon icon="solar:close-circle-bold" width={16} />
            </button>
          </div>
        ) : (
          <button
            className="w-[100px] h-[100px] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 flex flex-col items-center justify-center gap-1 p-2 transition-colors"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <Icon
              className="text-gray-500"
              icon="solar:camera-bold"
              width={24}
            />
            <span className="text-[9px] text-gray-600 text-center leading-tight font-medium">
              Foto de la opción
            </span>
          </button>
        )}
      </div>

      <Modal
        isOpen={previewOpen}
        placement="center"
        size="2xl"
        onClose={() => setPreviewOpen(false)}
      >
        <ModalContent>
          <ModalBody className="p-4 flex justify-center">
            {localUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain mx-auto"
                src={localUrl}
              />
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
