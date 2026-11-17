"use client";

import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { useDeleteDietPdf, useDietPdf, useUploadDietPdf } from "./use-cycles";

import { PDF_MAX_BYTES } from "@/lib/nutrition/pdf-storage";

interface DietPdfSectionProps {
  clientId: number;
}

/**
 * The "Dieta PDF" tab of the client's nutrition area: upload / remove the PDFs
 * the client sees when they have NO active meal plan (the delivery ladder's
 * second rung). A client can have several (e.g. training days + rest days).
 * A PDF inherited from the legacy system is shown read-only — uploading here
 * shadows it with v2 copies and never touches legacy data; removing every v2
 * PDF reveals the legacy one again.
 */
export function DietPdfSection({ clientId }: DietPdfSectionProps) {
  const { data, isPending } = useDietPdf(clientId);
  const upload = useUploadDietPdf(clientId);
  const remove = useDeleteDietPdf(clientId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const pdfs = data ?? [];
  const onlyLegacy =
    pdfs.length > 0 && pdfs.every((p) => p.source === "legacy");
  const busy = upload.isPending || remove.isPending;

  const pickFile = () => inputRef.current?.click();

  const onFile = (file: File | null) => {
    setLocalError(null);

    if (file === null) {
      return;
    }

    if (file.type !== "application/pdf") {
      setLocalError("El archivo debe ser un PDF.");

      return;
    }

    if (file.size > PDF_MAX_BYTES) {
      setLocalError("El PDF no puede superar 20MB.");

      return;
    }

    upload.mutate(file);
  };

  const errorText =
    localError ??
    (upload.isError ? "No se pudo subir el PDF. Inténtalo de nuevo." : null) ??
    (remove.isError ? "No se pudo quitar el PDF. Inténtalo de nuevo." : null);

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-gray-900">Dieta en PDF</h3>
          <p className="text-xs text-default-500">
            El cliente verá estos documentos en su sección de Nutrición mientras
            no tenga un plan de comidas activo. Puedes subir varios, por ejemplo
            uno para días de entreno y otro para días de descanso.
          </p>
        </div>

        <input
          ref={inputRef}
          accept="application/pdf"
          className="hidden"
          type="file"
          onChange={(event) => {
            onFile(event.target.files?.[0] ?? null);
            // Allow re-picking the same file after an error.
            event.target.value = "";
          }}
        />

        {isPending ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : pdfs.length === 0 ? (
          <button
            className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-300 bg-gray-50/50 px-6 py-10 text-center transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
            disabled={busy}
            type="button"
            onClick={pickFile}
          >
            <Icon
              className="text-default-300"
              icon="solar:document-add-linear"
              width={32}
            />
            <span className="text-sm font-medium text-gray-900">
              Subir PDF de la dieta
            </span>
            <span className="text-xs text-default-400">
              Solo PDF, máximo 20MB
            </span>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            {pdfs.map((pdf) => (
              <div
                key={pdf.id ?? pdf.url}
                className="flex flex-wrap items-center gap-3 rounded-large border border-gray-200 p-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-large bg-danger-50 text-danger">
                  <Icon icon="solar:document-text-bold" width={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {pdf.name}
                  </p>
                  {pdf.source === "legacy" ? (
                    <p className="text-xs text-default-400">
                      Subido desde el sistema anterior. Al subir uno nuevo, el
                      cliente verá el nuevo documento.
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    as="a"
                    href={pdf.url}
                    rel="noopener noreferrer"
                    size="sm"
                    startContent={<Icon icon="solar:eye-linear" width={16} />}
                    target="_blank"
                    variant="bordered"
                  >
                    Ver
                  </Button>
                  {pdf.id !== null ? (
                    <Button
                      color="danger"
                      isDisabled={busy}
                      isLoading={
                        remove.isPending && remove.variables === pdf.id
                      }
                      size="sm"
                      startContent={
                        remove.isPending &&
                        remove.variables === pdf.id ? null : (
                          <Icon
                            icon="solar:trash-bin-trash-linear"
                            width={16}
                          />
                        )
                      }
                      variant="light"
                      onPress={() => {
                        if (pdf.id !== null) remove.mutate(pdf.id);
                      }}
                    >
                      Quitar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}

            <div>
              <Button
                isDisabled={busy}
                isLoading={upload.isPending}
                size="sm"
                startContent={
                  upload.isPending ? null : (
                    <Icon icon="solar:add-circle-linear" width={16} />
                  )
                }
                variant="bordered"
                onPress={pickFile}
              >
                {onlyLegacy ? "Subir PDF nuevo" : "Añadir otro PDF"}
              </Button>
            </div>
          </div>
        )}

        {upload.isPending ? (
          <p className="text-xs text-default-500">Subiendo PDF…</p>
        ) : null}

        {errorText !== null ? (
          <p className="text-xs text-danger">{errorText}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
