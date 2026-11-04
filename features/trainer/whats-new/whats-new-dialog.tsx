"use client";

// Diálogo de Novedades: a la izquierda un escenario con el producto de verdad
// (el cuerpo sombreado, los clips del catálogo, las series por músculo, el
// sticker con la marca del entrenador); a la derecha qué cambia y dónde
// encontrarlo. Se carga solo cuando toca enseñarlo (ver whats-new-modal).

import type { WhatsNewRelease, WhatsNewStage } from "./releases";

import { Button, Modal, ModalBody, ModalContent } from "@heroui/react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ensureShareFonts } from "@/components/share-card/fonts";
import { Sticker } from "@/components/share-card/sticker";
import { MuscleBody } from "@/components/shared/muscle-body";
import { MuscleVolume } from "@/components/shared/muscle-volume";
import { OutlineChip } from "@/components/shared/outline-chip";
import { useLibraryMedia } from "@/lib/hooks/use-library-media";
import {
  type ShareBody,
  sessionMuscles,
  useShareBody,
} from "@/lib/hooks/use-share-body";
import {
  SAMPLE_SESSION,
  SESSION_STATS,
  type ShareBranding,
  pickStats,
} from "@/lib/share-card/session-data";
import { muscleLabel } from "@/lib/training/muscles";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function WhatsNewDialog({
  release,
  onClose,
}: {
  release: WhatsNewRelease;
  onClose: () => void;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const { pages } = release;
  const page = pages[index];
  const last = index === pages.length - 1;
  // Precarga: clips, fuentes y firma del sticker listos antes de llegar.
  const branding = useShareBranding();
  const body = useShareBody(SAMPLE_MUSCLES);

  useLibraryMedia(CLIPS.map((c) => c.slug));

  const go = useCallback(
    (next: number) => setIndex(Math.max(0, Math.min(pages.length - 1, next))),
    [pages.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  if (!page) return null;

  const enter = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 16, scale: 0.97, filter: "blur(6px)" },
        animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, y: -8, scale: 0.99, filter: "blur(4px)" },
      };

  return (
    <Modal
      isOpen
      classNames={{ base: "overflow-hidden", body: "p-0" }}
      placement="center"
      scrollBehavior="inside"
      size="4xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalBody>
          <div className="grid md:h-[min(560px,calc(100dvh-8rem))] md:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
            {/* Escenario */}
            <div className="relative flex min-h-[340px] items-center justify-center overflow-hidden bg-default-100 px-6 py-8">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={page.stage}
                  {...enter}
                  className="flex w-full items-center justify-center"
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <Stage body={body} branding={branding} stage={page.stage} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Texto */}
            <div className="flex flex-col px-7 pb-6 pt-7 sm:px-9">
              <nav aria-label="Novedades" className="flex gap-1.5 pr-8">
                {pages.map((p, i) => (
                  <button
                    key={p.stage}
                    aria-current={i === index ? "step" : undefined}
                    className="group min-w-0 flex-1 py-1 focus-visible:outline-none"
                    type="button"
                    onClick={() => go(i)}
                  >
                    <span
                      className={`block h-1 rounded-full transition-colors duration-300 group-focus-visible:ring-2 group-focus-visible:ring-focus group-focus-visible:ring-offset-2 ${
                        i === index
                          ? "bg-primary"
                          : i < index
                            ? "bg-primary/35"
                            : "bg-default-200 group-hover:bg-default-300"
                      }`}
                    />
                    <span
                      className={`mt-2 block truncate text-left text-xs transition-colors ${
                        i === index
                          ? "font-medium text-foreground"
                          : "text-default-500 group-hover:text-default-700"
                      }`}
                    >
                      {p.label}
                    </span>
                  </button>
                ))}
              </nav>

              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={page.stage}
                  animate={{ opacity: 1, x: 0 }}
                  className="mt-7 flex flex-1 flex-col"
                  exit={{ opacity: 0, x: reduce ? 0 : -6 }}
                  initial={{ opacity: 0, x: reduce ? 0 : 10 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <h2 className="font-heading text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground [text-wrap:balance]">
                    {page.title}
                  </h2>
                  <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-default-600">
                    {page.text}
                  </p>
                  {page.action ? (
                    <Button
                      className="mt-6 self-start px-0 font-medium data-[hover=true]:bg-transparent data-[hover=true]:underline"
                      color="primary"
                      endContent={
                        <Icon icon="solar:arrow-right-linear" width={18} />
                      }
                      variant="light"
                      onPress={() => {
                        onClose();
                        router.push(page.action!.href);
                      }}
                    >
                      {page.action.label}
                    </Button>
                  ) : null}
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-default-200 pt-5">
                <span className="text-sm tabular-nums text-default-500">
                  {index + 1} de {pages.length}
                </span>
                <div className="flex gap-2">
                  {index > 0 ? (
                    <Button variant="light" onPress={() => go(index - 1)}>
                      Atrás
                    </Button>
                  ) : (
                    <Button variant="light" onPress={onClose}>
                      Ahora no
                    </Button>
                  )}
                  <Button
                    color="primary"
                    endContent={
                      last ? null : (
                        <Icon icon="solar:arrow-right-linear" width={18} />
                      )
                    }
                    onPress={() => (last ? onClose() : go(index + 1))}
                  >
                    {last ? "Empezar" : "Siguiente"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function Stage({
  stage,
  branding,
  body,
}: {
  stage: WhatsNewStage;
  branding: ShareBranding | null;
  body: ShareBody | null;
}) {
  switch (stage) {
    case "muscles":
      return <MusclesStage />;
    case "library":
      return <LibraryStage />;
    case "volume":
      return <VolumeStage />;
    case "share":
      return <ShareStage body={body} branding={branding} />;
  }
}

// ── 1. Músculos: el clip del ejercicio + sus músculos en el cuerpo ─────────

const BENCH = {
  slug: "bench-press",
  name: "Press de banca con barra",
  primary: ["pectoral"] as const,
  secondary: ["deltoides_anterior", "triceps"] as const,
};

function MusclesStage() {
  const clip = useLibraryMedia([BENCH.slug])[BENCH.slug];

  return (
    <div className="w-full max-w-[400px] overflow-hidden rounded-2xl bg-content1 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.25)]">
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-2 bg-white pr-4">
        <div className="aspect-square">
          {clip?.video ? (
            <video
              aria-hidden
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
              poster={clip.poster}
              src={clip.video}
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-default-100 motion-reduce:animate-none" />
          )}
        </div>
        <MuscleBody
          className="mx-auto w-full max-w-[104px]"
          flip={false}
          primary={BENCH.primary}
          secondary={BENCH.secondary}
        />
      </div>
      <div className="border-t border-default-200 px-5 py-4">
        <p className="text-[15px] font-semibold text-foreground">
          {BENCH.name}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {BENCH.primary.map((id) => (
            <span
              key={id}
              className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
            >
              {muscleLabel(id)}
            </span>
          ))}
          {BENCH.secondary.map((id) => (
            <OutlineChip key={id} tone="muted">
              {muscleLabel(id)}
            </OutlineChip>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 2. Biblioteca: clips del catálogo en movimiento ───────────────────────

const CLIPS = [
  { slug: "bench-press", name: "Press de banca" },
  { slug: "deadlift", name: "Peso muerto" },
  { slug: "pull-up", name: "Dominada" },
  { slug: "hip-thrust", name: "Hip thrust" },
] as const;

function LibraryStage() {
  const media = useLibraryMedia(CLIPS.map((c) => c.slug));

  return (
    <ul className="m-0 grid w-full max-w-[380px] list-none grid-cols-2 gap-3 p-0">
      {CLIPS.map((clip, i) => {
        const m = media[clip.slug];

        return (
          <motion.li
            key={clip.slug}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-xl bg-content1 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.3)]"
            initial={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.12 + i * 0.07, duration: 0.4, ease: EASE }}
          >
            <div className="aspect-square bg-white">
              {m?.video ? (
                <video
                  aria-hidden
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                  poster={m.poster}
                  src={m.video}
                />
              ) : m?.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  src={m.poster}
                />
              ) : (
                <div className="h-full w-full animate-pulse bg-default-100 motion-reduce:animate-none" />
              )}
            </div>
            <p className="truncate px-3 py-2 text-xs font-medium text-foreground">
              {clip.name}
            </p>
          </motion.li>
        );
      })}
    </ul>
  );
}

// ── 3. Series por músculo: una sesión real con su volumen ─────────────────

const VOLUME_INPUT = SAMPLE_SESSION.exercises.map((e) => ({
  sets: e.sets.length,
  primary: e.primary,
  secondary: e.secondary,
}));
const TOTAL_SETS = VOLUME_INPUT.reduce((n, e) => n + e.sets, 0);

function VolumeStage() {
  return (
    <div className="w-full max-w-[400px] rounded-2xl bg-content1 p-5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.25)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold text-foreground">
          {SAMPLE_SESSION.sessionName}
        </p>
        <p className="text-xs tabular-nums text-default-500">
          {SAMPLE_SESSION.exercises.length} ejercicios · {TOTAL_SETS} series
        </p>
      </div>
      <div className="my-4 h-px bg-default-200" />
      <MuscleVolume map exercises={VOLUME_INPUT} />
    </div>
  );
}

// ── 4. Compartir: el sticker con la marca del propio entrenador ───────────

const SHARE_STATS = pickStats(
  SESSION_STATS,
  ["duration", "volume", "sets"],
  SAMPLE_SESSION
);

// Damero oscuro (como en Ajustes → Compartir): el sticker es transparente y
// va sobre la foto del cliente.
const CHECKER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect width='24' height='24' fill='%233a3a3a'/%3E%3Crect width='12' height='12' fill='%234a4a4a'/%3E%3Crect x='12' y='12' width='12' height='12' fill='%234a4a4a'/%3E%3C/svg%3E")`;

function useShareBranding(): ShareBranding | null {
  const [branding, setBranding] = useState<ShareBranding | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fallback = { trainerName: "Tu marca" };

    Promise.all([
      fetch("/api/trainer/share-card", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      ensureShareFonts(),
    ]).then(([json]) => {
      if (cancelled) return;
      const b = json?.branding ?? fallback;
      const s = json?.settings;

      setBranding({
        name: s?.displayName || b.trainerName || "Tu marca",
        instagram: s?.instagram ?? "",
        brandColor: b.brandColor ?? null,
        logoSrc: b.logoSrc ?? null,
        showTopcoach: s?.showTopcoach ?? true,
        footer: s?.footer ?? "",
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return branding;
}

const SAMPLE_MUSCLES = sessionMuscles(SAMPLE_SESSION.exercises);

function ShareStage({
  branding,
  body,
}: {
  branding: ShareBranding | null;
  body: ShareBody | null;
}) {
  return (
    <div
      className="flex aspect-[9/16] h-[460px] max-h-[64vh] items-center justify-center overflow-hidden rounded-[28px] shadow-[0_24px_48px_-20px_rgba(0,0,0,0.45)]"
      style={{ backgroundImage: CHECKER, backgroundSize: "16px 16px" }}
    >
      {branding ? (
        <Sticker
          body={body}
          branding={branding}
          className="h-auto w-[88%]"
          exercise={null}
          id="whats-new-share"
          ink="white"
          mapMode="auto"
          session={SAMPLE_SESSION}
          shadow={false}
          stats={SHARE_STATS}
          template="musculos"
          onBrandBg={false}
        />
      ) : (
        <div className="h-1/2 w-2/3 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
      )}
    </div>
  );
}
