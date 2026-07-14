"use client";

import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface PdfDietViewProps {
  url: string;
  name: string;
}

/**
 * The PDF rung of the client's nutrition delivery ladder: the trainer shares
 * the diet as a document instead of a structured plan. Mirrors the legacy
 * viewer UX — inline preview plus prominent open/download actions, because
 * mobile browsers (especially iOS Safari) render embedded PDFs inconsistently
 * and the buttons must always be enough on their own.
 */
export function PdfDietView({ url, name }: PdfDietViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger-50 text-danger">
              <Icon icon="solar:document-text-bold" width={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {name}
              </p>
              <p className="text-xs text-default-500">
                Tu entrenador te ha compartido tu plan de nutrición en PDF.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              as="a"
              className="flex-1"
              color="primary"
              href={url}
              rel="noopener noreferrer"
              startContent={<Icon icon="solar:eye-linear" width={18} />}
              target="_blank"
            >
              Abrir PDF
            </Button>
            <Button
              as="a"
              className="flex-1"
              download={name}
              href={url}
              rel="noopener noreferrer"
              startContent={
                <Icon icon="solar:download-minimalistic-linear" width={18} />
              }
              target="_blank"
              variant="flat"
            >
              Descargar
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Inline preview — best-effort; some mobile browsers show only the
          first page (or nothing), hence the buttons above. */}
      <div className="overflow-hidden rounded-2xl border border-default-200">
        <iframe
          className="h-[70vh] w-full bg-content2"
          src={`${url}#toolbar=1`}
          title={name}
        />
      </div>
    </div>
  );
}
