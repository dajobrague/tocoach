"use client";

// "Compartir" estilo Strava (prototipo aprobado por JC, 14 oct). El cliente
// elige qué comparte (la sesión o un ejercicio), desliza plantillas, pone
// fondo (transparente, su foto, su vídeo o un color), hasta 3 datos, color,
// tamaño y posición. El entrenador solo firma (logo, nombre, Instagram).
//
// La imagen la dibuja el propio móvil (components/share-card): vista previa
// al instante y el PNG exportado es el mismo SVG. Instagram:
//   - Fondo transparente o vídeo → se copia el sticker al portapapeles y se
//     abre la cámara de historias para pegarlo encima (como Strava). Desde
//     web no se puede exportar vídeo ni elegir la app del menú de compartir.
//   - Fondo foto o color → se comparte la historia ya montada (9:16).

import type {
  ExerciseStatKey,
  SessionStatKey,
  SharePayload,
} from "@/lib/share-card/session-data";

import {
  Button,
  ModalBody,
  ModalContent,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "@tanstack/react-query";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ClientSheet,
  ClientSheetGrabber,
} from "@/components/client-dashboard/client-sheet";
import { ClientScreen } from "@/components/client-dashboard/client-screen";
import { type MapMode } from "@/components/share-card/body-figure";
import {
  STICKER_SHARE,
  type Background,
  canCopyImage,
  canShareFile,
  copyPng,
  downloadBlob,
  renderSticker,
  renderStory,
  shareFileName,
} from "@/components/share-card/export";
import { ensureShareFonts } from "@/components/share-card/fonts";
import {
  type Ink,
  type TemplateDef,
  type TemplateId,
  Sticker,
  brandAccent,
  exerciseTemplatesFor,
  sessionTemplatesFor,
} from "@/components/share-card/sticker";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { clientFetch } from "@/lib/auth/client-token-storage";
import {
  EXERCISE_STATS,
  MAX_STATS,
  SESSION_STATS,
  availableStats,
  defaultStats,
  pickStats,
} from "@/lib/share-card/session-data";

type Scope = "session" | "exercise";

// (ancho del carrusel − ancho de la tarjeta) / 2 − gap.
const SPACER =
  "h-px shrink-0 basis-[calc(50cqw-min(100cqh,128cqw)*0.28125-12px)]";

type BgKind =
  | "transparent"
  | "photo"
  | "video"
  | "setVideo"
  | "black"
  | "brand";

// Colores del lienzo de la historia (contenido de la imagen, no UI).
const STORY_BLACK = "#0e0e10";
const CHECKER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect width='24' height='24' fill='%233a3a3a'/%3E%3Crect width='12' height='12' fill='%234a4a4a'/%3E%3Crect x='12' y='12' width='12' height='12' fill='%234a4a4a'/%3E%3C/svg%3E")`;

interface ShareScreenProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledDate: string;
  sessionId: string;
  initialScope?: Scope;
  /** exercise_id del ejercicio desde el que se abrió (alcance "ejercicio"). */
  initialExerciseId?: string | null;
}

async function fetchShareData(date: string, sessionId: string) {
  const res = await clientFetch(
    `/api/client/scheduled-sessions/${date}/share-data?sessionId=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" }
  );
  const body = await res.json().catch(() => null);

  if (!res.ok || body?.success !== true) {
    throw new Error(body?.error ?? "No se pudieron cargar los datos");
  }

  return body.data as SharePayload;
}

export function ShareScreen({
  isOpen,
  onClose,
  scheduledDate,
  sessionId,
  initialScope = "session",
  initialExerciseId = null,
}: ShareScreenProps) {
  const query = useQuery({
    queryKey: ["share-data", scheduledDate, sessionId],
    queryFn: () => fetchShareData(scheduledDate, sessionId),
    enabled: isOpen,
    staleTime: 30_000,
  });
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    if (isOpen) void ensureShareFonts().then(() => setFontsReady(true));
  }, [isOpen]);

  return (
    <ClientScreen
      fill
      backLabel="Cerrar"
      closeOnEscape={false}
      isOpen={isOpen}
      title="Compartir"
      onClose={onClose}
    >
      {query.isLoading || !fontsReady ? (
        <div className="flex h-[60dvh] items-center justify-center">
          <Spinner />
        </div>
      ) : query.isError || !query.data ? (
        <p className="px-6 py-16 text-center text-sm text-default-500">
          {query.error instanceof Error
            ? query.error.message
            : "No se pudieron cargar los datos."}
        </p>
      ) : query.data.session.exercises.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-default-500">
          Todavía no hay ejercicios finalizados en esta sesión.
        </p>
      ) : (
        <ShareComposer
          data={query.data}
          initialExerciseId={initialExerciseId}
          initialScope={initialScope}
        />
      )}
    </ClientScreen>
  );
}

export function ShareComposer({
  data,
  initialScope,
  initialExerciseId,
}: {
  data: SharePayload;
  initialScope: Scope;
  initialExerciseId: string | null;
}) {
  const { session, branding } = data;
  const brand = brandAccent(branding);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [exId, setExId] = useState(
    () =>
      session.exercises.find((e) => e.exerciseId === initialExerciseId)?.id ??
      session.exercises[0]!.id
  );
  const exercise =
    session.exercises.find((e) => e.id === exId) ?? session.exercises[0]!;
  const [active, setActive] = useState(0);
  const [bg, setBg] = useState<BgKind>("transparent");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [ink, setInk] = useState<Ink>("white");
  const [size, setSize] = useState(1);
  const [mapMode, setMapMode] = useState<MapMode>("auto");
  const [offsets, setOffsets] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [sessionStats, setSessionStats] = useState<SessionStatKey[]>(() =>
    defaultStats(
      SESSION_STATS,
      ["duration", "volume", "sets", "exercises"],
      session
    )
  );
  const [exerciseStats, setExerciseStats] = useState<ExerciseStatKey[]>([]);
  const [customizing, setCustomizing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [ready, setReady] = useState<File | null>(null);
  const stickers = useRef(new Map<TemplateId, SVGSVGElement>());
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const track = useRef<HTMLDivElement>(null);

  // Los datos del ejercicio cambian con el ejercicio: defaults si no hay.
  useEffect(() => {
    setExerciseStats((current) => {
      const available = new Set(availableStats(EXERCISE_STATS, exercise));
      const kept = current.filter((key) => available.has(key));

      return kept.length > 0
        ? kept
        : defaultStats(
            EXERCISE_STATS,
            ["best", "sets", "volume", "cardio", "distance"],
            exercise
          );
    });
  }, [exercise]);

  // Si el vídeo de la serie deja de existir al cambiar de ejercicio.
  useEffect(() => {
    if (bg === "setVideo" && (scope !== "exercise" || !exercise.videoUrl))
      setBg("transparent");
  }, [bg, scope, exercise.videoUrl]);

  const templates: TemplateDef<TemplateId>[] =
    scope === "session"
      ? sessionTemplatesFor(session)
      : exerciseTemplatesFor(exercise);
  const activeTemplate = templates[Math.min(active, templates.length - 1)]!;
  const stats =
    scope === "session"
      ? pickStats(SESSION_STATS, sessionStats, session)
      : pickStats(EXERCISE_STATS, exerciseStats, exercise);
  const draggable = bg !== "transparent";
  const onBrandBg = bg === "brand";
  const shadow =
    (bg === "photo" || bg === "video" || bg === "setVideo") && ink !== "dark";
  const storyBg: Background | null =
    bg === "photo" && photoUrl
      ? { kind: "photo", url: photoUrl }
      : bg === "black"
        ? { kind: "color", color: STORY_BLACK }
        : bg === "brand"
          ? { kind: "color", color: brand }
          : null;
  const title = scope === "session" ? session.sessionName : exercise.name;
  const fileName = shareFileName(title, session.date);
  const offsetKey = (t: TemplateId) => `${scope}:${t}`;
  const placement = (t: TemplateDef<TemplateId>) => {
    const o = offsets[offsetKey(t.id)] ?? { x: 0, y: 0 };

    return { x: 0.5 + o.x, y: t.y + o.y, scale: size };
  };

  // Vuelve al principio del carrusel al cambiar de alcance o ejercicio.
  useEffect(() => {
    setActive(0);
    track.current?.scrollTo({ left: 0 });
  }, [scope, exId]);

  // Tarjeta activa = la que está centrada en el carrusel.
  useEffect(() => {
    const root = track.current;

    if (!root) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio > 0.6) {
            setActive(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { root, threshold: [0.6] }
    );

    root.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [templates.length, scope, exId]);

  const exportImage = (): Promise<Blob> => {
    const svg = stickers.current.get(activeTemplate.id);

    if (!svg) return Promise.reject(new Error("Sin imagen"));

    return storyBg
      ? renderStory(svg, storyBg, placement(activeTemplate))
      : renderSticker(svg);
  };

  // navigator.share pide el archivo listo en el gesto: se prepara en cuanto
  // la imagen deja de cambiar.
  useEffect(() => {
    setReady(null);
    const timer = window.setTimeout(() => {
      exportImage()
        .then((blob) =>
          setReady(new File([blob], fileName, { type: "image/png" }))
        )
        .catch((error) => console.warn("[Share] render failed:", error));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    scope,
    exId,
    active,
    bg,
    photoUrl,
    ink,
    size,
    mapMode,
    offsets,
    sessionStats,
    exerciseStats,
  ]);

  const flash = (text: string) => {
    setStatus(text);
    window.setTimeout(() => setStatus((s) => (s === text ? null : s)), 4500);
  };

  const copySticker = (thenOpenInstagram: boolean) => {
    const svg = stickers.current.get(activeTemplate.id);

    if (!svg || !canCopyImage()) {
      flash("Tu navegador no deja copiar imágenes. Usa «Guardar».");

      return;
    }
    copyPng(renderSticker(svg))
      .then(() => {
        flash(
          thenOpenInstagram
            ? "Sticker copiado. En tu historia, mantén pulsado y elige «Pegar»."
            : "Sticker copiado. Pégalo en tu historia de Instagram."
        );
        if (thenOpenInstagram)
          window.location.href = "instagram://story-camera";
      })
      .catch(() =>
        flash("No se pudo copiar. Usa «Guardar» y añádelo desde tu galería.")
      );
  };

  const shareFile = () => {
    if (!ready) return;
    if (!canShareFile(ready)) {
      downloadBlob(ready, fileName);

      return;
    }
    navigator.share({ files: [ready] }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      downloadBlob(ready, fileName);
    });
  };

  const instagram = () => (storyBg ? shareFile() : copySticker(true));

  const onDrag =
    (t: TemplateDef<TemplateId>) =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggable || t.id !== activeTemplate.id) return;
      const card = event.currentTarget.parentElement!.getBoundingClientRect();
      const start = offsets[offsetKey(t.id)] ?? { x: 0, y: 0 };
      const x0 = event.clientX;
      const y0 = event.clientY;
      const el = event.currentTarget;

      el.setPointerCapture(event.pointerId);
      const move = (e: PointerEvent) => {
        const clamp = (v: number) => Math.max(-0.45, Math.min(0.45, v));

        setOffsets((o) => ({
          ...o,
          [offsetKey(t.id)]: {
            x: clamp(start.x + (e.clientX - x0) / card.width),
            y: clamp(start.y + (e.clientY - y0) / card.height),
          },
        }));
      };
      const up = () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      };

      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    };

  const pickFile =
    (kind: "photo" | "video") =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      event.target.value = "";
      if (!file) return;
      const url = URL.createObjectURL(file);

      if (kind === "photo") {
        if (photoUrl) URL.revokeObjectURL(photoUrl);
        setPhotoUrl(url);
        setBg("photo");
      } else {
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        setVideoUrl(url);
        setBg("video");
        flash(
          "El vídeo es para ver cómo queda: copia el sticker y pégalo sobre tu vídeo en Instagram."
        );
      }
    };

  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    },
    // Solo al desmontar.

    []
  );

  const swatches: {
    key: BgKind;
    label: string;
    face: React.ReactNode;
    onPick?: () => void;
  }[] = [
    {
      key: "transparent",
      label: "Transparente",
      face: (
        <span className="h-full w-full" style={{ backgroundImage: CHECKER }} />
      ),
    },
    {
      key: "photo",
      label: "Tu foto",
      face: photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-full w-full object-cover" src={photoUrl} />
      ) : (
        <Icon icon="solar:gallery-linear" width={22} />
      ),
      onPick: () => photoInput.current?.click(),
    },
    {
      key: "video",
      label: "Tu vídeo",
      face: <Icon icon="solar:videocamera-record-linear" width={22} />,
      onPick: () => videoInput.current?.click(),
    },
    ...(scope === "exercise" && exercise.videoUrl
      ? [
          {
            key: "setVideo" as const,
            label: "Tu serie",
            face: <Icon icon="solar:play-circle-linear" width={22} />,
          },
        ]
      : []),
    {
      key: "black",
      label: "Negro",
      face: (
        <span className="h-full w-full" style={{ background: STORY_BLACK }} />
      ),
    },
    {
      key: "brand",
      label: "Marca",
      face: <span className="h-full w-full" style={{ background: brand }} />,
    },
  ];

  const statOptions =
    scope === "session"
      ? availableStats(SESSION_STATS, session).map((key) => ({
          key,
          label: SESSION_STATS[key].label,
        }))
      : availableStats(EXERCISE_STATS, exercise).map((key) => ({
          key,
          label: EXERCISE_STATS[key].label,
        }));
  const selectedStats: string[] =
    scope === "session" ? sessionStats : exerciseStats;
  const toggleStat = (key: string) => {
    const next = selectedStats.includes(key)
      ? selectedStats.filter((k) => k !== key)
      : selectedStats.length < MAX_STATS
        ? [...selectedStats, key]
        : selectedStats;

    if (scope === "session") setSessionStats(next as SessionStatKey[]);
    else setExerciseStats(next as ExerciseStatKey[]);
  };

  const backgroundLayer = useMemo(() => {
    switch (bg) {
      case "photo":
        return photoUrl ? (
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            src={photoUrl}
          />
        ) : null;
      case "video":
      case "setVideo": {
        const src = bg === "video" ? videoUrl : exercise.videoUrl;

        return src ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            src={src}
          />
        ) : null;
      }
      case "black":
        return (
          <div
            className="absolute inset-0"
            style={{ background: STORY_BLACK }}
          />
        );
      case "brand":
        return (
          <div className="absolute inset-0" style={{ background: brand }} />
        );
      default:
        return (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: CHECKER, backgroundSize: "18px 18px" }}
          />
        );
    }
  }, [bg, photoUrl, videoUrl, exercise.videoUrl, brand]);

  return (
    // Todo en una pantalla, sin scroll: el carrusel se queda con el alto que
    // sobra y las tarjetas se miden por alto (container query), no por ancho.
    <div className="flex h-full flex-col gap-3 pt-3">
      <div className="shrink-0 px-4">
        <SegmentedControl
          ariaLabel="Qué compartir"
          className="w-full"
          options={[
            { key: "session", label: "Sesión completa" },
            { key: "exercise", label: "Un ejercicio" },
          ]}
          value={scope}
          onChange={setScope}
        />
      </div>

      {scope === "exercise" ? (
        <div className="flex shrink-0 gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {session.exercises.map((e) => (
            <button
              key={e.id}
              aria-pressed={e.id === exId}
              className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${
                e.id === exId
                  ? "bg-foreground text-background"
                  : "bg-default-100 text-default-600"
              }`}
              type="button"
              onClick={() => setExId(e.id)}
            >
              {e.name}
              {e.videoUrl ? (
                <span
                  aria-label="Tiene vídeo"
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* Carrusel de plantillas (scroll-snap); la centrada es la activa. */}
      <div
        ref={track}
        className="flex min-h-0 flex-1 snap-x snap-mandatory items-center gap-3 overflow-x-auto overscroll-x-contain [container-type:size] [scrollbar-width:none]"
      >
        {/* Tarjeta 9:16 = todo el alto del carrusel, sin pasar del 72% del
            ancho. Los espaciadores centran la primera y la última. */}
        <div aria-hidden className={SPACER} />
        {templates.map((t, index) => {
          const p = placement(t);

          return (
            <div
              key={`${scope}-${exId}-${t.id}`}
              className="relative h-[min(100cqh,128cqw)] w-[calc(min(100cqh,128cqw)*0.5625)] shrink-0 snap-center overflow-hidden rounded-2xl bg-black shadow-medium"
              data-index={index}
            >
              {backgroundLayer}
              {bg === "transparent" ? (
                <span className="absolute left-3 top-3 z-[3] rounded-md border border-white/80 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Transparente
                </span>
              ) : null}
              <span className="absolute right-3 top-3 z-[3] text-[11px] font-semibold text-white/75 [text-shadow:0_1px_4px_rgba(0,0,0,.4)]">
                {t.name}
              </span>
              <div
                className={`absolute z-[2] ${draggable && index === active ? "cursor-grab touch-none" : ""}`}
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  width: `${STICKER_SHARE * size * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onPointerDown={onDrag(t)}
              >
                <Sticker
                  ref={(el) => {
                    if (el) stickers.current.set(t.id, el);
                  }}
                  branding={branding}
                  className="block h-auto w-full"
                  exercise={scope === "exercise" ? exercise : null}
                  id={`st-${scope}-${t.id}`}
                  ink={ink}
                  mapMode={mapMode}
                  session={session}
                  shadow={shadow}
                  stats={stats}
                  template={t.id}
                  onBrandBg={onBrandBg}
                />
              </div>
            </div>
          );
        })}
        <div aria-hidden className={SPACER} />
      </div>

      <div aria-hidden className="flex shrink-0 justify-center gap-2">
        {templates.map((t, i) => (
          <span
            key={t.id}
            className={`h-1.5 w-1.5 rounded-full transition-[background-color,transform] duration-200 ${
              i === active ? "scale-125 bg-foreground" : "bg-default-300"
            }`}
          />
        ))}
      </div>

      <p
        className="-mt-1 min-h-[1.125rem] shrink-0 px-6 text-center text-xs leading-[1.125rem] text-default-500"
        role="status"
      >
        {status ?? (draggable ? "Arrastra la tarjeta para colocarla." : "")}
      </p>

      <div className="flex shrink-0 flex-col gap-2 px-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-default-500">
            Fondo
          </span>
          <Button
            className="h-8 gap-1.5 px-2 text-[13px] font-semibold text-foreground"
            radius="full"
            size="sm"
            startContent={<Icon icon="solar:tuning-2-linear" width={16} />}
            variant="light"
            onPress={() => setCustomizing(true)}
          >
            Personalizar
          </Button>
        </div>
        <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
          {swatches.map((s) => (
            <button
              key={s.key}
              aria-pressed={bg === s.key}
              className="flex w-[52px] shrink-0 flex-col items-center gap-1 text-[11px] text-default-500 aria-pressed:text-foreground"
              type="button"
              onClick={() => (s.onPick ? s.onPick() : setBg(s.key))}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-default-100 text-default-600 transition-[box-shadow,transform] duration-150 active:scale-[0.94] ${
                  bg === s.key
                    ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    : ""
                }`}
              >
                {s.face}
              </span>
              {s.label}
            </button>
          ))}
        </div>
        <input
          ref={photoInput}
          hidden
          accept="image/*"
          type="file"
          onChange={pickFile("photo")}
        />
        <input
          ref={videoInput}
          hidden
          accept="video/*"
          type="file"
          onChange={pickFile("video")}
        />
      </div>

      {/* Barra de acciones fija abajo (dentro del alto, con safe area). */}
      <div className="grid shrink-0 grid-cols-4 gap-2 border-t border-default-200 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <ShareAction
          primary
          icon="mdi:instagram"
          label="Instagram"
          onPress={instagram}
        />
        <ShareAction
          icon="solar:copy-linear"
          label="Copiar sticker"
          onPress={() => copySticker(false)}
        />
        <ShareAction
          disabled={!ready}
          icon="solar:download-minimalistic-linear"
          label="Guardar"
          onPress={() => ready && downloadBlob(ready, fileName)}
        />
        <ShareAction
          disabled={!ready}
          icon="solar:share-linear"
          label="Más"
          onPress={shareFile}
        />
      </div>

      <ClientSheet
        hideCloseButton
        isOpen={customizing}
        size="sm"
        onClose={() => setCustomizing(false)}
      >
        <ModalContent>
          {(close) => (
            <>
              <ClientSheetGrabber onClose={close} />
              <ModalHeader className="flex items-center justify-between pt-1">
                <span className="font-heading text-lg">Personalizar</span>
                <Button
                  className="font-semibold"
                  color="primary"
                  size="sm"
                  variant="light"
                  onPress={close}
                >
                  Listo
                </Button>
              </ModalHeader>
              <ModalBody className="gap-6 pb-6">
                <section className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold text-default-500">
                      Datos en la imagen
                    </span>
                    <span className="text-xs tabular-nums text-default-400">
                      {selectedStats.length} de {MAX_STATS}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {statOptions.map((option) => {
                      const order = selectedStats.indexOf(option.key);
                      const full =
                        order < 0 && selectedStats.length >= MAX_STATS;

                      return (
                        <button
                          key={option.key}
                          aria-pressed={order >= 0}
                          className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-[background-color,color,opacity,transform] duration-150 active:scale-[0.96] ${
                            order >= 0
                              ? "bg-foreground text-background"
                              : "bg-default-100 text-default-600"
                          } ${full ? "opacity-40" : ""}`}
                          type="button"
                          onClick={() => toggleStat(option.key)}
                        >
                          {order >= 0 ? (
                            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-background text-[11px] font-bold text-foreground">
                              {order + 1}
                            </span>
                          ) : null}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-default-400">
                    Hasta {MAX_STATS}. Salen en el orden en que los eliges.
                  </p>
                </section>

                <section className="flex flex-col gap-2.5">
                  <span className="text-[13px] font-semibold text-default-500">
                    Color del texto
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["white", "Blanco", "#ffffff"],
                        ["dark", "Negro", "#121212"],
                        ["brand", "Marca", brand],
                      ] as const
                    ).map(([key, label, swatch]) => (
                      <OptionButton
                        key={key}
                        disabled={key === "brand" && onBrandBg}
                        selected={ink === key}
                        onPress={() => setInk(key)}
                      >
                        <i
                          className="h-3.5 w-3.5 rounded-full shadow-[inset_0_0_0_1px_rgba(127,127,127,.5)]"
                          style={{ background: swatch }}
                        />
                        {label}
                      </OptionButton>
                    ))}
                  </div>
                </section>

                <section className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between">
                    <label
                      className="text-[13px] font-semibold text-default-500"
                      htmlFor="share-size"
                    >
                      Tamaño
                    </label>
                    <span className="text-xs tabular-nums text-default-400">
                      {Math.round(size * 100)}%
                    </span>
                  </div>
                  <input
                    className="w-full accent-[hsl(var(--heroui-foreground))]"
                    id="share-size"
                    max={130}
                    min={70}
                    step={1}
                    type="range"
                    value={Math.round(size * 100)}
                    onChange={(e) => setSize(Number(e.target.value) / 100)}
                  />
                  <button
                    className="self-start text-sm font-semibold text-primary"
                    type="button"
                    onClick={() => setOffsets({})}
                  >
                    Centrar posición
                  </button>
                </section>

                <section className="flex flex-col gap-2.5">
                  <span className="text-[13px] font-semibold text-default-500">
                    Mapa muscular
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["auto", "Auto"],
                        ["both", "Frente y espalda"],
                        ["none", "Ninguno"],
                      ] as const
                    ).map(([key, label]) => (
                      <OptionButton
                        key={key}
                        selected={mapMode === key}
                        onPress={() => setMapMode(key)}
                      >
                        {label}
                      </OptionButton>
                    ))}
                  </div>
                  <p className="text-xs text-default-400">
                    Auto enseña solo el lado que trabajaste.
                  </p>
                </section>

                <p className="flex items-start gap-2.5 rounded-xl bg-default-100 p-3 text-[13px] text-default-600">
                  <Icon
                    className="mt-0.5 shrink-0"
                    icon="solar:lock-keyhole-minimalistic-linear"
                    width={16}
                  />
                  <span>
                    <b className="font-semibold text-foreground">
                      Logo, nombre e Instagram
                    </b>{" "}
                    los pone tu entrenador y salen siempre.
                  </span>
                </p>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </ClientSheet>
    </div>
  );
}

function OptionButton({
  selected,
  disabled = false,
  onPress,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-pressed={selected}
      className={`flex h-10 items-center justify-center gap-2 rounded-xl px-2 text-[13px] font-semibold transition-[background-color,color] duration-150 disabled:opacity-40 ${
        selected
          ? "bg-foreground text-background"
          : "bg-default-100 text-default-600"
      }`}
      disabled={disabled}
      type="button"
      onClick={onPress}
    >
      {children}
    </button>
  );
}

function ShareAction({
  icon,
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className="flex flex-col items-center gap-1.5 text-center text-[11.5px] leading-tight text-foreground disabled:opacity-40"
      disabled={disabled}
      type="button"
      onClick={onPress}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-150 active:scale-[0.94] ${
          primary
            ? "bg-primary text-primary-foreground"
            : "bg-default-100 text-foreground"
        }`}
      >
        <Icon icon={icon} width={22} />
      </span>
      {label}
    </button>
  );
}
