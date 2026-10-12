"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { SectionHeader } from "@/components/client-dashboard/client-page";
import { IconTile } from "@/components/shared/icon-tile";

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
    <section>
      <SectionHeader title="Tu plan en PDF" />
      <article className="rounded-large bg-content1 p-4 shadow-small">
        <div className="flex items-center gap-3">
          <IconTile icon="solar:document-text-linear" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-foreground">
              {name}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-default-500">
              Tu entrenador te ha compartido tu plan de nutrición en PDF.
            </p>
          </div>
        </div>

        {/* Inline preview — best-effort; some mobile browsers show only the
            first page (or nothing), hence the buttons below. */}
        <div className="my-3.5 overflow-hidden rounded-[14px] bg-default-100">
          <iframe
            className="h-[60vh] w-full"
            src={`${url}#toolbar=1`}
            title={name}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Button
            as="a"
            className="h-[52px] rounded-medium text-base font-semibold"
            color="primary"
            href={url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Abrir PDF
          </Button>
          <Button
            as="a"
            className="h-[52px] rounded-medium bg-default-100 text-base font-semibold text-foreground"
            download={name}
            href={url}
            rel="noopener noreferrer"
            startContent={
              <Icon icon="solar:download-minimalistic-linear" width={20} />
            }
            target="_blank"
            variant="flat"
          >
            Descargar
          </Button>
        </div>
      </article>
    </section>
  );
}
