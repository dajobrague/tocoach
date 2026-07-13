"use client";

import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";

import { Modal, ModalBody, ModalContent } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import {
  VerticalVideoPlayerModal,
  type VerticalVideoPlayerHandle,
} from "@/components/client-dashboard/vertical-video-player-modal";
import { MACRO_COLORS } from "@/components/client-dashboard/meal-cycle/macro-ui";
import { normalizeOptionSnapshot } from "@/components/client-dashboard/meal-cycle/normalize-snapshot";
import { shouldShowMacrosToClient } from "@/lib/nutrition/cycles/macro-visibility";

interface RecipeOptionDetailProps {
  /** The tapped option, or `null` when the sheet is closed. */
  option: MealSlotOptionRow | null;
  onClose: () => void;
}

/** Split the free-text steps into displayable lines (verbatim, trimmed). */
function stepLines(steps: string | null): string[] {
  return (steps ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function SectionTitle({
  icon,
  title,
  meta,
}: {
  icon: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <Icon className="self-center text-default-400" icon={icon} width={16} />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {meta !== undefined ? (
        <span className="text-xs text-default-400">{meta}</span>
      ) : null}
    </div>
  );
}

/**
 * Full recipe detail for a tapped meal option. Renders entirely from the
 * frozen `item_snapshot` — hero photo with the name over a dark gradient
 * (legible on any tenant theme), a swappable media strip, the macro strip
 * (same visual language as the day summary), a clean ingredient list and
 * numbered prep steps. Vertical video reuses the shared player; macros are
 * gated by {@link shouldShowMacrosToClient}.
 */
export function RecipeOptionDetail({
  option,
  onClose,
}: RecipeOptionDetailProps) {
  const videoRef = useRef<VerticalVideoPlayerHandle>(null);
  // Defensive defaults: an option frozen before the `media` field existed has
  // no `media` (and a malformed one may lack other collections); normalize so
  // it renders what it has — photos, ingredients, macros — without crashing.
  const snapshot = option
    ? normalizeOptionSnapshot(option.item_snapshot)
    : null;
  const showMacros = shouldShowMacrosToClient();

  const photos = (snapshot?.media ?? []).filter((m) => m.type === "image");
  const videos = (snapshot?.media ?? []).filter((m) => m.type === "video");
  const totals = snapshot?.totals;
  const steps = stepLines(snapshot?.steps ?? null);
  const description = snapshot?.description ?? null;
  const trainerComment = snapshot?.trainerComment ?? null;

  // Hero = the tapped photo of the strip (reset per option).
  const [heroUrl, setHeroUrl] = useState<string | null>(null);

  useEffect(() => {
    setHeroUrl(null);
  }, [option?.id]);

  const hero = heroUrl ?? photos[0]?.url ?? null;

  const playVideo = (url: string) =>
    videoRef.current?.open(url, snapshot?.name ?? "");

  return (
    <>
      <Modal
        classNames={{
          closeButton:
            "z-20 right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 p-0 text-foreground backdrop-blur-sm hover:bg-background [&>svg]:h-4 [&>svg]:w-4",
        }}
        isOpen={option !== null}
        scrollBehavior="inside"
        size="full"
        onClose={onClose}
      >
        <ModalContent>
          {snapshot === null ? null : (
            <ModalBody className="gap-0 p-0" data-testid="recipe-detail">
              {/* Full-screen sheet; cap the content width so desktop reads
                  like a card, not an edge-to-edge stretch. */}
              <div className="mx-auto w-full max-w-2xl">
                {/* Hero — name always over a dark gradient so it reads on any
                  theme; without a photo, a quiet placeholder does the job. */}
                <div className="relative shrink-0">
                  {hero !== null ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="h-52 w-full object-cover"
                      src={hero}
                    />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center bg-content2">
                      <Icon
                        className="text-default-300"
                        icon={
                          snapshot.sourceType === "recipe"
                            ? "solar:chef-hat-linear"
                            : "solar:cup-hot-linear"
                        }
                        width={44}
                      />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 pb-3 pt-10">
                    <span className="mb-1 inline-block rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-medium text-white/90">
                      {snapshot.sourceType === "recipe" ? "Receta" : "Alimento"}
                    </span>
                    <h2 className="text-lg font-bold leading-tight text-white">
                      {snapshot.name}
                    </h2>
                  </div>
                </div>

                {/* Media strip — swap the hero, or play a video. */}
                {photos.length + videos.length > 1 || videos.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto px-4 pt-3">
                    {photos.map((m) => (
                      <button
                        key={m.url}
                        aria-label="Ver foto"
                        className={`shrink-0 overflow-hidden rounded-lg border-2 ${
                          hero === m.url
                            ? "border-primary"
                            : "border-transparent"
                        }`}
                        type="button"
                        onClick={() => setHeroUrl(m.url)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt=""
                          className="h-14 w-14 object-cover"
                          loading="lazy"
                          src={m.url}
                        />
                      </button>
                    ))}
                    {videos.map((m) => (
                      <button
                        key={m.url}
                        aria-label="Ver video"
                        className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/80"
                        type="button"
                        onClick={() => playVideo(m.url)}
                      >
                        <Icon
                          className="text-white"
                          icon="solar:play-circle-bold"
                          width={26}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-col gap-5 px-4 py-4">
                  {showMacros && totals !== undefined ? (
                    <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-default-200 bg-content2">
                      <div className="flex flex-col items-center gap-0.5 py-2.5">
                        <span className="flex items-center gap-1 text-sm font-bold text-foreground tabular-nums">
                          <Icon
                            className="text-primary"
                            icon="solar:fire-bold"
                            width={14}
                          />
                          {Math.round(totals.kcal)}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-default-400">
                          kcal
                        </span>
                      </div>
                      {(
                        [
                          ["Prot", totals.protein_g, MACRO_COLORS.protein.dot],
                          ["Carbs", totals.carbs_g, MACRO_COLORS.carbs.dot],
                          ["Grasa", totals.fat_g, MACRO_COLORS.fat.dot],
                        ] as const
                      ).map(([label, value, dot]) => (
                        <div
                          key={label}
                          className="flex flex-col items-center gap-0.5 border-l border-default-200 py-2.5"
                        >
                          <span className="flex items-center gap-1.5 text-sm font-bold text-foreground tabular-nums">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${dot}`}
                            />
                            {Math.round(value)} g
                          </span>
                          <span className="text-[10px] uppercase tracking-wide text-default-400">
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Trainer's note for THIS client — only when one was written. */}
                  {trainerComment !== null ? (
                    <div className="flex flex-col gap-2">
                      <SectionTitle
                        icon="solar:chat-round-line-linear"
                        title="Comentarios"
                      />
                      <p className="rounded-xl bg-content2 px-3.5 py-3 text-sm leading-relaxed text-default-600">
                        {trainerComment}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    <SectionTitle
                      icon="solar:checklist-minimalistic-linear"
                      title="Ingredientes"
                      {...(snapshot.ingredients.length > 0
                        ? { meta: `${snapshot.ingredients.length}` }
                        : {})}
                    />
                    {snapshot.ingredients.length === 0 ? (
                      <p className="text-xs text-default-400">
                        Sin ingredientes.
                      </p>
                    ) : (
                      <ul className="flex flex-col">
                        {snapshot.ingredients.map((ing, index) => (
                          <li
                            key={`${ing.name}-${index}`}
                            className="flex items-center justify-between gap-3 border-b border-default-100 py-2 last:border-0"
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-default-300" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm text-foreground">
                                  {ing.name}
                                </span>
                                {typeof ing.brand === "string" &&
                                ing.brand.length > 0 ? (
                                  <span className="block truncate text-xs text-default-400">
                                    {ing.brand}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <span className="shrink-0 text-sm font-medium text-default-500 tabular-nums">
                              {ing.quantity} {ing.unit}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {steps.length > 0 || description !== null ? (
                    <div className="flex flex-col gap-2 pb-2">
                      <SectionTitle
                        icon="solar:chef-hat-linear"
                        title="Preparación y notas"
                      />
                      {steps.length > 0 ? (
                        <ol className="flex flex-col gap-2.5">
                          {steps.map((step, index) => (
                            <li key={`${index}-${step}`} className="flex gap-3">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-content2 text-xs font-bold text-foreground">
                                {index + 1}
                              </span>
                              <p className="min-w-0 pt-0.5 text-sm leading-relaxed text-default-600">
                                {step}
                              </p>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                      {description !== null ? (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-default-600">
                          {description}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </ModalBody>
          )}
        </ModalContent>
      </Modal>

      <VerticalVideoPlayerModal ref={videoRef} />
    </>
  );
}
