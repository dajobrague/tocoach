"use client";

import {
  Button,
  Card,
  CardBody,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

const PDF_MAX_BYTES = 20 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface NutritionPlanPdfBlockProps {
  planId: string;
  pdfUrl: string | null | undefined;
  pdfName: string | null | undefined;
  onSuccess: () => void;
}

export function NutritionPlanPdfBlock({
  planId,
  pdfUrl,
  pdfName,
  onSuccess,
}: NutritionPlanPdfBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [headSizeLabel, setHeadSizeLabel] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!pdfUrl) {
      setHeadSizeLabel(null);

      return;
    }

    let cancelled = false;

    fetch(pdfUrl, { method: "HEAD" })
      .then((res) => {
        const len = res.headers.get("content-length");

        if (!cancelled && len) {
          const n = parseInt(len, 10);

          if (!Number.isNaN(n)) setHeadSizeLabel(formatFileSize(n));
        }
      })
      .catch(() => {
        if (!cancelled) setHeadSizeLabel(null);
      });

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  const uploadFile = useCallback(
    (file: File) => {
      setUploadError(null);

      if (file.type !== "application/pdf") {
        setUploadError("El archivo debe ser un PDF.");

        return;
      }

      if (file.size > PDF_MAX_BYTES) {
        setUploadError("El PDF no puede superar 20MB.");

        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();

      formData.append("pdf", file);

      const xhr = new XMLHttpRequest();

      xhr.open("POST", `/api/nutrition/plans/${planId}/pdf`);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        setUploadProgress(null);

        try {
          const result = JSON.parse(xhr.responseText || "{}");

          if (xhr.status >= 200 && xhr.status < 300 && result.success) {
            onSuccess();
          } else {
            setUploadError(
              result.error || "Error al subir el PDF. Intenta de nuevo."
            );
          }
        } catch {
          setUploadError("Error al subir el PDF. Intenta de nuevo.");
        }
      };

      xhr.onerror = () => {
        setIsUploading(false);
        setUploadProgress(null);
        setUploadError("Error de red al subir el PDF.");
      };

      xhr.send(formData);
    },
    [planId, onSuccess]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];

    if (file) uploadFile(file);
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/nutrition/plans/${planId}/pdf`, {
        method: "DELETE",
      });
      const result = await res.json();

      if (result.success) {
        setDeleteOpen(false);
        onSuccess();
      } else {
        setUploadError(result.error || "No se pudo eliminar el PDF.");
      }
    } catch {
      setUploadError("Error al eliminar el PDF.");
    } finally {
      setIsDeleting(false);
    }
  };

  const hasPdf = Boolean(pdfUrl);

  return (
    <div className="space-y-3">
      {uploadError && (
        <div className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-lg px-3 py-2">
          {uploadError}
        </div>
      )}

      {!hasPdf ? (
        <label
          className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors cursor-pointer ${
            isDragging
              ? "border-slate-500 bg-slate-100"
              : "border-slate-300 bg-slate-50/80 hover:border-slate-400 hover:bg-slate-50"
          } ${isUploading ? "pointer-events-none opacity-70" : ""}`}
          htmlFor={`nutrition-pdf-upload-${planId}`}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            accept="application/pdf,.pdf"
            className="sr-only"
            id={`nutrition-pdf-upload-${planId}`}
            type="file"
            onChange={handleInputChange}
          />
          <Icon
            className="text-slate-500"
            icon="solar:document-text-bold"
            width={40}
          />
          <p className="text-sm font-semibold text-gray-900 text-center">
            Subir plan nutricional (PDF)
          </p>
          <p className="text-xs text-gray-500 text-center max-w-sm">
            PDF de hasta 20MB. También puedes arrastrar el archivo aquí.
          </p>
        </label>
      ) : (
        <Card className="border border-slate-200 shadow-sm">
          <CardBody className="flex flex-row flex-wrap items-center gap-4 p-4">
            <div className="bg-slate-100 p-3 rounded-lg shrink-0">
              <Icon
                className="text-red-600"
                icon="solar:document-text-bold"
                width={32}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {pdfName || "documento.pdf"}
              </p>
              {headSizeLabel && (
                <p className="text-xs text-gray-500 mt-0.5">{headSizeLabel}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                as="a"
                href={pdfUrl!}
                rel="noopener noreferrer"
                size="sm"
                startContent={<Icon icon="solar:eye-bold" width={18} />}
                target="_blank"
                variant="flat"
              >
                Ver PDF
              </Button>
              <Button
                color="danger"
                size="sm"
                startContent={
                  <Icon icon="solar:trash-bin-trash-linear" width={18} />
                }
                variant="flat"
                onPress={() => setDeleteOpen(true)}
              >
                Eliminar
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {isUploading && uploadProgress !== null && (
        <Progress
          aria-label="Progreso de subida"
          className="max-w-md"
          size="sm"
          value={uploadProgress}
        />
      )}
      {isUploading && uploadProgress === null && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Icon className="animate-spin" icon="solar:refresh-bold" width={18} />
          Subiendo…
        </div>
      )}

      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <ModalContent>
          <ModalHeader>Eliminar PDF</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600">
              ¿Seguro que quieres eliminar el PDF de este plan? Esta acción no
              se puede deshacer.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="danger"
              isLoading={isDeleting}
              onPress={handleDelete}
            >
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
