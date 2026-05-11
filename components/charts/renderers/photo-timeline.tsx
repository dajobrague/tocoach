/**
 * <PhotoTimelineRenderer>
 *
 * Renders a horizontal strip of dated photo thumbnails for a
 * `chart_type: "photo_timeline"` chart. Click a thumbnail to open a
 * full-screen lightbox with prev/next navigation.
 *
 * Photos arrive pre-sorted oldest → newest from the adapter and are
 * shown left → right so progress reads naturally over time. The strip
 * scrolls horizontally on overflow; touch-friendly snap is applied so
 * each thumbnail aligns to the viewport edge on swipe.
 */

"use client";

import type { PhotoPoint } from "@/lib/charts/types";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface Props {
  photos: ReadonlyArray<PhotoPoint>;
}

const THUMB_CLASS =
  "relative flex-shrink-0 w-20 h-24 rounded-md overflow-hidden border-2 border-default-200 hover:border-foreground/40 transition-colors snap-start";

export function PhotoTimelineRenderer({ photos }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-foreground/40">
        <Icon icon="solar:gallery-bold" width={28} />
        <p className="text-xs font-medium">Aún sin fotos en este período</p>
      </div>
    );
  }

  const active = activeIdx !== null ? photos[activeIdx] : null;

  const goPrev = () => {
    if (activeIdx === null) return;
    setActiveIdx(activeIdx > 0 ? activeIdx - 1 : photos.length - 1);
  };
  const goNext = () => {
    if (activeIdx === null) return;
    setActiveIdx(activeIdx < photos.length - 1 ? activeIdx + 1 : 0);
  };

  return (
    <>
      <div
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {photos.map((p, i) => (
          <button
            key={`${p.date}-${i}`}
            aria-label={`Ver foto del ${p.label}`}
            className={THUMB_CLASS}
            type="button"
            onClick={() => setActiveIdx(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- public
                URL with arbitrary host (Supabase storage); Next/Image would
                require domain allowlisting and we want zero-config for now. */}
            <img
              alt={p.label}
              className="w-full h-full object-cover"
              loading="lazy"
              src={p.url}
            />
            <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[9px] font-medium text-center py-0.5 uppercase tracking-wider">
              {p.label}
            </span>
          </button>
        ))}
      </div>

      <Modal
        backdrop="blur"
        isOpen={active !== null}
        size="3xl"
        onClose={() => setActiveIdx(null)}
      >
        <ModalContent>
          {active ? (
            <>
              <ModalHeader className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{active.label}</span>
                <span className="text-[10px] text-foreground/50">
                  {activeIdx !== null ? activeIdx + 1 : 0} / {photos.length}
                </span>
              </ModalHeader>
              <ModalBody className="pb-6">
                <div className="relative flex items-center justify-center">
                  {photos.length > 1 ? (
                    <button
                      aria-label="Anterior"
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
                      type="button"
                      onClick={goPrev}
                    >
                      <Icon icon="solar:alt-arrow-left-bold" width={18} />
                    </button>
                  ) : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={active.label}
                    className="max-h-[70vh] w-auto rounded-lg object-contain"
                    src={active.url}
                  />
                  {photos.length > 1 ? (
                    <button
                      aria-label="Siguiente"
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
                      type="button"
                      onClick={goNext}
                    >
                      <Icon icon="solar:alt-arrow-right-bold" width={18} />
                    </button>
                  ) : null}
                </div>
              </ModalBody>
            </>
          ) : null}
        </ModalContent>
      </Modal>
    </>
  );
}
