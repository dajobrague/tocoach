"use client";

import type { MuscleId } from "@/lib/training/muscles";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import { MuscleMap } from "./muscle-map";

import { useBodyMedia } from "@/lib/hooks/use-library-media";
import { hitMuscle } from "@/lib/training/body-hit";
import {
  BODY_HEIGHT,
  BODY_OVERLAYS,
  BODY_WIDTH,
  bestView,
  bodyFile,
  overlayRanks,
  type BodyView,
} from "@/lib/training/body-overlays";

// Shaded anatomical figure (RepDB heatmap kit): a base body plus one overlay
// per worked muscle, primary solid and secondary light. Front and back sit on
// two faces of a card that flips. Falls back to the flat SVG map until the
// kit loads (or when it isn't available), so it never renders empty.
export function MuscleBody({
  primary,
  secondary,
  client = false,
  flip = true,
  onToggle,
  onHover,
  highlight = null,
  className = "",
}: {
  primary: readonly MuscleId[];
  secondary: readonly MuscleId[];
  /** Client portal: the server picks the figure of the client's own sex. */
  client?: boolean;
  /** Show the front/back button; off for small thumbnails (best side only). */
  flip?: boolean;
  /** Makes the muscles tappable (picker): the muscle under the tap. */
  onToggle?: (id: MuscleId) => void;
  /** Muscle under the pointer, for a caller-side label. */
  onHover?: (id: MuscleId | null) => void;
  /** Lightly marks one muscle, e.g. the chip being hovered. */
  highlight?: MuscleId | null;
  className?: string;
}) {
  const { sex, files } = useBodyMedia({ client });
  const [chosen, setChosen] = useState<BodyView | null>(null);
  const view = chosen ?? bestView(primary, secondary);
  const stage = useRef<HTMLDivElement>(null);
  const lastHover = useRef<MuscleId | null>(null);

  // A highlighted muscle that only exists on the other side turns the body.
  useEffect(() => {
    if (!highlight) return;
    const other: BodyView = view === "front" ? "back" : "front";

    if (!BODY_OVERLAYS[highlight][view] && BODY_OVERLAYS[highlight][other]) {
      setChosen(other);
    }
  }, [highlight, view]);

  const pointed = async (event: React.PointerEvent | React.MouseEvent) => {
    const rect = stage.current?.getBoundingClientRect();

    if (!rect || rect.width === 0 || !sex) return null;

    // The face may be shorter than the stage (the taller side sets the stage).
    const faceHeight = (rect.width * BODY_HEIGHT[sex][view]) / BODY_WIDTH;
    const v = (event.clientY - rect.top) / faceHeight;

    return v > 1
      ? null
      : hitMuscle(view, files, (event.clientX - rect.left) / rect.width, v);
  };

  if (!sex || !files["front_base.webp"] || !files["back_base.webp"]) {
    return (
      <MuscleMap
        className={className}
        highlight={highlight}
        labels={false}
        outlineWidth={1}
        primary={primary}
        secondary={secondary}
        {...(onHover ? { onHover } : {})}
        {...(onToggle ? { onToggle } : {})}
      />
    );
  }

  const face = (side: BodyView) => {
    const ranks = overlayRanks(side, primary, secondary);
    // Hint for the highlighted muscle unless it is already lit.
    const hinted = (highlight ? (BODY_OVERLAYS[highlight][side] ?? []) : [])
      .map((name) => bodyFile(side, name))
      .filter((file) => !ranks.has(file));

    return (
      <div
        className="absolute inset-0 [backface-visibility:hidden]"
        style={{
          transform: side === "back" ? "rotateY(180deg)" : undefined,
        }}
      >
        {/* The face keeps its own proportions; the stage is the taller side. */}
        <div
          className="relative w-full"
          style={{ aspectRatio: `${BODY_WIDTH} / ${BODY_HEIGHT[sex][side]}` }}
        >
          {/* eslint-disable @next/next/no-img-element */}
          <img
            alt=""
            className="absolute inset-0 h-full w-full"
            decoding="async"
            src={files[`${side}_base.webp`]}
          />
          {[...ranks, ...hinted.map((file) => [file, 0] as const)].map(
            ([file, rank]) =>
              files[file] ? (
                <img
                  key={file}
                  alt=""
                  className="absolute inset-0 h-full w-full transition-opacity duration-150"
                  decoding="async"
                  src={files[file]}
                  style={{ opacity: rank === 2 ? 1 : rank === 1 ? 0.45 : 0.3 }}
                />
              ) : null
          )}
          {/* eslint-enable @next/next/no-img-element */}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {/* Pointer picking is a mouse/touch extra: keyboard and screen-reader
          users pick muscles from the chips next to the figure. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={stage}
        aria-label={`Cuerpo de ${view === "front" ? "frente" : "espalda"} con los músculos trabajados`}
        className={`w-full [perspective:900px] ${onToggle ? "cursor-pointer" : ""}`}
        role="img"
        onClick={
          onToggle
            ? (event) => void pointed(event).then((id) => id && onToggle(id))
            : undefined
        }
        onPointerLeave={
          onHover
            ? () => {
                lastHover.current = null;
                onHover(null);
              }
            : undefined
        }
        onPointerMove={
          onHover
            ? (event) =>
                void pointed(event).then((id) => {
                  if (id !== lastHover.current) {
                    lastHover.current = id;
                    onHover(id);
                  }
                })
            : undefined
        }
      >
        <div
          className="relative w-full transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none"
          style={{
            aspectRatio: `${BODY_WIDTH} / ${Math.max(BODY_HEIGHT[sex].front, BODY_HEIGHT[sex].back)}`,
            transform: view === "back" ? "rotateY(180deg)" : undefined,
          }}
        >
          {face("front")}
          {face("back")}
        </div>
      </div>
      {flip ? (
        <button
          className="inline-flex items-center gap-1 rounded-full bg-default-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-default-600 active:scale-[0.97] motion-reduce:transform-none"
          type="button"
          onClick={() => setChosen(view === "front" ? "back" : "front")}
        >
          <Icon aria-hidden icon="solar:refresh-linear" width={13} />
          {view === "front" ? "Ver espalda" : "Ver frente"}
        </button>
      ) : null}
    </div>
  );
}
