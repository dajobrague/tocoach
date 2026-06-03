"use client";

import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";
import type { SnapshotMedia } from "@/lib/nutrition/cycles/option-snapshot";

import {
  Chip,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef } from "react";

import {
  VerticalVideoPlayerModal,
  type VerticalVideoPlayerHandle,
} from "@/components/client-dashboard/vertical-video-player-modal";
import { normalizeOptionSnapshot } from "@/components/client-dashboard/meal-cycle/normalize-snapshot";
import { shouldShowMacrosToClient } from "@/lib/nutrition/cycles/macro-visibility";

interface RecipeOptionDetailProps {
  /** The tapped option, or `null` when the sheet is closed. */
  option: MealSlotOptionRow | null;
  onClose: () => void;
}

function MacroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-content2 px-2 py-2">
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-default-400">
        {label}
      </span>
    </div>
  );
}

function PhotoTile({ url }: { url: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="h-40 w-auto shrink-0 rounded-xl object-cover"
      src={url}
    />
  );
}

function VideoTile({
  media,
  onPlay,
}: {
  media: SnapshotMedia;
  onPlay: (url: string) => void;
}) {
  return (
    <button
      className="relative flex h-40 w-24 shrink-0 items-center justify-center rounded-xl bg-black/80"
      type="button"
      onClick={() => onPlay(media.url)}
    >
      <Icon className="text-white" icon="solar:play-circle-bold" width={40} />
      <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-white/80">
        Video
      </span>
    </button>
  );
}

/**
 * Full recipe detail for a tapped meal option (T3). Renders entirely from the
 * frozen `item_snapshot` — name, photos, vertical video, ingredients with
 * quantities, prep steps, and macros — with no join back to the recipe library.
 * Vertical video reuses the shared {@link VerticalVideoPlayerModal} for parity
 * with the training side. Macros are gated by {@link shouldShowMacrosToClient}.
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

  const playVideo = (url: string) =>
    videoRef.current?.open(url, snapshot?.name ?? "");

  return (
    <>
      <Modal
        isOpen={option !== null}
        placement="bottom"
        scrollBehavior="inside"
        size="lg"
        onClose={onClose}
      >
        <ModalContent>
          {snapshot === null ? null : (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-lg font-bold">{snapshot.name}</span>
                <Chip
                  color={
                    snapshot.sourceType === "recipe" ? "primary" : "default"
                  }
                  size="sm"
                  variant="flat"
                >
                  {snapshot.sourceType === "recipe" ? "Receta" : "Alimento"}
                </Chip>
              </ModalHeader>
              <ModalBody className="gap-4 pb-6" data-testid="recipe-detail">
                {photos.length > 0 || videos.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto">
                    {photos.map((m) => (
                      <PhotoTile key={m.url} url={m.url} />
                    ))}
                    {videos.map((m) => (
                      <VideoTile key={m.url} media={m} onPlay={playVideo} />
                    ))}
                  </div>
                ) : null}

                {showMacros && totals !== undefined ? (
                  <div className="grid grid-cols-4 gap-2">
                    <MacroStat
                      label="kcal"
                      value={`${Math.round(totals.kcal)}`}
                    />
                    <MacroStat
                      label="Prot"
                      value={`${Math.round(totals.protein_g)} g`}
                    />
                    <MacroStat
                      label="Carbs"
                      value={`${Math.round(totals.carbs_g)} g`}
                    />
                    <MacroStat
                      label="Grasa"
                      value={`${Math.round(totals.fat_g)} g`}
                    />
                  </div>
                ) : null}

                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">
                    Ingredientes
                  </p>
                  {snapshot.ingredients.length === 0 ? (
                    <p className="text-xs text-default-400">
                      Sin ingredientes.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {snapshot.ingredients.map((ing, index) => (
                        <li
                          key={`${ing.name}-${index}`}
                          className="flex justify-between text-sm text-default-600"
                        >
                          <span>{ing.name}</span>
                          <span className="text-default-400">
                            {ing.quantity} {ing.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {snapshot.steps !== null ? (
                  <>
                    <Divider />
                    <div>
                      <p className="mb-2 text-sm font-semibold text-foreground">
                        Preparación
                      </p>
                      <p className="whitespace-pre-line text-sm text-default-600">
                        {snapshot.steps}
                      </p>
                    </div>
                  </>
                ) : null}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      <VerticalVideoPlayerModal ref={videoRef} />
    </>
  );
}
