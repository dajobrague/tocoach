"use client";

import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import { ClientScreen } from "@/components/client-dashboard/client-screen";
import {
  VerticalVideoPlayerModal,
  type VerticalVideoPlayerHandle,
} from "@/components/client-dashboard/vertical-video-player-modal";
import {
  MacroStrip,
  SoftChip,
} from "@/components/client-dashboard/meal-cycle/macro-ui";
import { normalizeOptionSnapshot } from "@/components/client-dashboard/meal-cycle/normalize-snapshot";
import { shouldShowMacrosToClient } from "@/lib/nutrition/cycles/macro-visibility";

interface RecipeOptionDetailProps {
  /** The tapped option, or `null` when the screen is closed. */
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

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="mb-2.5 flex items-center gap-2 font-heading text-xl leading-tight tracking-[-0.015em] text-foreground">
      {title}
      {count !== undefined ? (
        <span className="rounded-full bg-default-100 px-2 py-0.5 font-sans text-[13px] font-semibold tracking-normal text-default-500">
          {count}
        </span>
      ) : null}
    </h2>
  );
}

/**
 * Full recipe detail for a tapped meal option, pushed as a ClientScreen.
 * Renders entirely from the frozen `item_snapshot` — full-bleed hero photo
 * with a floating back button on a solid plate (no gradient scrim; the name
 * sits below the image), a swappable media strip, the macro strip (same
 * visual language as the day summary), the trainer's comment, a clean
 * ingredient list and numbered prep steps. Vertical video reuses the shared
 * player; macros are gated by {@link shouldShowMacrosToClient}.
 */
export function RecipeOptionDetail({
  option,
  onClose,
}: RecipeOptionDetailProps) {
  const videoRef = useRef<VerticalVideoPlayerHandle>(null);
  // Keep painting the last option while the screen slides out (the parent
  // clears `option` on close, before the exit animation ends).
  const [shown, setShown] = useState(option);

  useEffect(() => {
    if (option !== null) setShown(option);
  }, [option]);

  const current = option ?? shown;
  // Defensive defaults: an option frozen before the `media` field existed has
  // no `media` (and a malformed one may lack other collections); normalize so
  // it renders what it has — photos, ingredients, macros — without crashing.
  const snapshot = current
    ? normalizeOptionSnapshot(current.item_snapshot)
    : null;
  const showMacros = shouldShowMacrosToClient();

  const photos = (snapshot?.media ?? []).filter((m) => m.type === "image");
  const videos = (snapshot?.media ?? []).filter((m) => m.type === "video");
  const totals = snapshot?.totals;
  const steps = stepLines(snapshot?.steps ?? null);
  const description = snapshot?.description ?? null;
  const trainerComment = snapshot?.trainerComment ?? null;
  const isRecipe = snapshot?.sourceType === "recipe";

  // Hero = the tapped photo of the strip (reset per option).
  const [heroUrl, setHeroUrl] = useState<string | null>(null);

  useEffect(() => {
    setHeroUrl(null);
  }, [current?.id]);

  const hero = heroUrl ?? photos[0]?.url ?? null;

  // The player handles its own Esc; don't let it also close this screen.
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const playVideo = (url: string) => {
    setIsVideoOpen(true);
    videoRef.current?.open(url, snapshot?.name ?? "");
  };

  return (
    <>
      <ClientScreen
        ariaLabel={snapshot?.name ?? "Receta"}
        bar={false}
        closeOnEscape={!isVideoOpen}
        isOpen={option !== null}
        onClose={onClose}
      >
        {snapshot === null ? null : (
          <div
            className="pb-[calc(env(safe-area-inset-bottom)+40px)]"
            data-testid="recipe-detail"
          >
            {/* Hero — full-bleed photo; without one, a quiet placeholder. */}
            <div className="relative">
              {hero !== null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                  decoding="async"
                  src={hero}
                />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-default-100">
                  <Icon
                    className="text-default-400"
                    icon={
                      isRecipe
                        ? "solar:chef-hat-linear"
                        : "solar:cup-hot-linear"
                    }
                    width={64}
                  />
                </div>
              )}
              <button
                aria-label="Atrás"
                className="absolute left-3 top-[calc(env(safe-area-inset-top)+10px)] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm active:scale-[0.94] motion-reduce:transform-none"
                type="button"
                onClick={onClose}
              >
                <Icon icon="solar:alt-arrow-left-linear" width={22} />
              </button>
            </div>

            <div className="flex flex-col gap-6 px-4 pt-[18px]">
              <div>
                <SoftChip>{isRecipe ? "Receta" : "Alimento"}</SoftChip>
                <h1 className="mt-2.5 font-heading text-[28px] leading-[1.1] tracking-[-0.02em] text-foreground [text-wrap:balance]">
                  {snapshot.name}
                </h1>
                {snapshot.brand !== null && (
                  <p className="mt-1 text-[15px] text-default-500">
                    {snapshot.brand}
                  </p>
                )}
              </div>

              {/* Media strip — swap the hero, or play a video. */}
              {photos.length + videos.length > 1 || videos.length > 0 ? (
                <div className="-mx-4 -mt-2 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {photos.map((m) => (
                    <button
                      key={m.url}
                      aria-label="Ver foto"
                      aria-pressed={hero === m.url}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-[14px] active:scale-[0.97] motion-reduce:transform-none ${
                        hero === m.url
                          ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                          : ""
                      }`}
                      type="button"
                      onClick={() => setHeroUrl(m.url)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        decoding="async"
                        loading="lazy"
                        src={m.url}
                      />
                    </button>
                  ))}
                  {videos.map((m) => (
                    <button
                      key={m.url}
                      aria-label="Ver vídeo"
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-black/85 text-white active:scale-[0.97] motion-reduce:transform-none"
                      type="button"
                      onClick={() => playVideo(m.url)}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                        <Icon icon="solar:play-bold" width={14} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {showMacros && totals !== undefined ? (
                <div className="-mt-2">
                  <MacroStrip
                    carbs_g={totals.carbs_g}
                    fat_g={totals.fat_g}
                    kcal={totals.kcal}
                    labels={["kcal", "Prot", "Carbs", "Grasa"]}
                    protein_g={totals.protein_g}
                  />
                </div>
              ) : null}

              {/* Trainer's note for THIS client — only when one was written. */}
              {trainerComment !== null ? (
                <section>
                  <SectionTitle title="Comentarios" />
                  <p className="rounded-large bg-content1 p-3.5 text-[15px] leading-relaxed text-foreground shadow-small">
                    {trainerComment}
                  </p>
                </section>
              ) : null}

              <section>
                <SectionTitle
                  title="Ingredientes"
                  {...(snapshot.ingredients.length > 0
                    ? { count: snapshot.ingredients.length }
                    : {})}
                />
                {snapshot.ingredients.length === 0 ? (
                  <p className="rounded-[14px] bg-default-100 p-3.5 text-center text-sm text-default-500">
                    Sin ingredientes.
                  </p>
                ) : (
                  <ul className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small">
                    {snapshot.ingredients.map((ing, index) => (
                      <li
                        key={`${ing.name}-${index}`}
                        className="flex min-h-14 items-center gap-3 px-4 py-2.5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold text-foreground">
                            {ing.name}
                          </span>
                          {typeof ing.brand === "string" &&
                          ing.brand.length > 0 ? (
                            <span className="block text-[13px] text-default-500">
                              {ing.brand}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-[15px] font-semibold text-foreground tabular-nums">
                          {ing.quantity} {ing.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {steps.length > 0 || description !== null ? (
                <section>
                  <SectionTitle title="Preparación y notas" />
                  {steps.length > 0 ? (
                    <ol className="flex flex-col gap-3">
                      {steps.map((step, index) => (
                        <li key={`${index}-${step}`} className="flex gap-3">
                          <span className="-mt-px flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-default-200 text-[13px] font-bold text-foreground">
                            {index + 1}
                          </span>
                          <p className="min-w-0 text-[15px] leading-relaxed text-foreground">
                            {step}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {description !== null ? (
                    <p
                      className={`whitespace-pre-line rounded-[14px] bg-default-100 px-3.5 py-3 text-sm leading-relaxed text-default-500 ${
                        steps.length > 0 ? "mt-3.5" : ""
                      }`}
                    >
                      {description}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>
        )}
      </ClientScreen>

      <VerticalVideoPlayerModal
        ref={videoRef}
        onClose={() => setIsVideoOpen(false)}
      />
    </>
  );
}
