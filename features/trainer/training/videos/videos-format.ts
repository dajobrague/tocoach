// Helpers puros del feed de videos: derivación de items a partir de los logs,
// agrupación por fecha, formato de etiquetas y parcheo optimista del cache.
// Sin React ni fetch — todo esto es testeable en aislamiento.

import type {
  FeedLog,
  FeedLogSet,
  VideoFeed,
  VideoReviewInput,
  VideoReviewMap,
} from "./videos-api";

/** "set" = video de una serie concreta; "legacy" = video del log completo. */
export type VideoItemKind = "set" | "legacy";

export interface VideoFeedItem {
  videoUrl: string;
  exerciseName: string;
  /** exercise_logs.id — lo manda el PUT para atar la revisión al log. */
  exerciseLogId: string;
  /** Línea secundaria: "Serie 2 · 10 reps × 60 kg". */
  setLabel: string;
  /** YYYY-MM-DD; "" cuando el log no tiene sesión programada asociada. */
  scheduledDate: string;
  sessionId: string | null;
  kind: VideoItemKind;
}

export interface VideoDateGroup {
  date: string;
  /** Sesión del primer item del grupo (para resolver el nombre). */
  sessionId: string | null;
  items: VideoFeedItem[];
}

/** Formato es-ES para kilos: 82.5 → "82,5". */
function formatKg(value: number): string {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

/** "Serie 2 · 10 reps × 60 kg" — omite las partes que faltan. */
function setLabelFor(set: FeedLogSet): string {
  const detail = [
    set.reps != null ? `${set.reps} reps` : null,
    set.weight_kg != null ? `${formatKg(set.weight_kg)} kg` : null,
  ].filter((part): part is string => part !== null);

  return detail.length > 0
    ? `Serie ${set.set_number} · ${detail.join(" × ")}`
    : `Serie ${set.set_number}`;
}

/** "3 series · mejor: 10 × 60 kg" para el video legacy de todo el ejercicio. */
function legacyLabelFor(sets: FeedLogSet[]): string {
  if (sets.length === 0) return "Sin series registradas";

  const count = `${sets.length} ${sets.length === 1 ? "serie" : "series"}`;
  const best = sets.reduce<FeedLogSet | null>((acc, set) => {
    if (set.weight_kg == null) return acc;
    if (acc?.weight_kg == null || set.weight_kg > acc.weight_kg) return set;

    return acc;
  }, null);

  if (best?.weight_kg == null) return count;

  return `${count} · mejor: ${best.reps ?? "—"} × ${formatKg(best.weight_kg)} kg`;
}

function exerciseNameOf(log: FeedLog): string {
  const name = log.exercises?.name;

  return name !== undefined && name.length > 0 ? name : "Ejercicio";
}

/**
 * Un item por video: primero los videos por serie; si el log NO tiene ninguno
 * pero sí un `video_url` propio, cae al item legacy. Dedupe por URL (gana el
 * primero) y orden de más reciente a más antiguo.
 */
export function buildVideoFeed(logs: FeedLog[]): VideoFeedItem[] {
  const items: VideoFeedItem[] = [];
  const seen = new Set<string>();

  const push = (item: VideoFeedItem) => {
    if (seen.has(item.videoUrl)) return;
    seen.add(item.videoUrl);
    items.push(item);
  };

  for (const log of logs) {
    const sets = log.sets ?? [];
    const scheduledDate = log.scheduled_date ?? "";
    const sessionId = log.session_id ?? null;
    const exerciseName = exerciseNameOf(log);
    const setVideos = sets.flatMap((set) => {
      const url = set.video_url;

      return typeof url === "string" && url.length > 0 ? [{ set, url }] : [];
    });

    for (const { set, url } of setVideos) {
      push({
        videoUrl: url,
        exerciseName,
        exerciseLogId: log.id,
        setLabel: setLabelFor(set),
        scheduledDate,
        sessionId,
        kind: "set",
      });
    }

    if (
      setVideos.length === 0 &&
      typeof log.video_url === "string" &&
      log.video_url.length > 0
    ) {
      push({
        videoUrl: log.video_url,
        exerciseName,
        exerciseLogId: log.id,
        setLabel: legacyLabelFor(sets),
        scheduledDate,
        sessionId,
        kind: "legacy",
      });
    }
  }

  // Fechas vacías al final; el resto, más reciente primero (ISO ordena bien).
  return items.sort((a, b) => {
    if (a.scheduledDate === b.scheduledDate) return 0;
    if (a.scheduledDate === "") return 1;
    if (b.scheduledDate === "") return -1;

    return a.scheduledDate < b.scheduledDate ? 1 : -1;
  });
}

/** Agrupa por fecha conservando el orden ya calculado (reciente → antiguo). */
export function groupVideosByDate(items: VideoFeedItem[]): VideoDateGroup[] {
  const groups: VideoDateGroup[] = [];
  const byDate = new Map<string, VideoDateGroup>();

  for (const item of items) {
    const existing = byDate.get(item.scheduledDate);

    if (existing === undefined) {
      const group: VideoDateGroup = {
        date: item.scheduledDate,
        sessionId: item.sessionId,
        items: [item],
      };

      byDate.set(item.scheduledDate, group);
      groups.push(group);
      continue;
    }

    existing.items.push(item);
  }

  return groups;
}

/** "Lunes 27 de julio" (es-ES, primera letra en mayúscula). */
export function formatGroupDate(date: string): string {
  if (date.length === 0) return "Sin fecha";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return date;

  const weekday = parsed.toLocaleDateString("es-ES", { weekday: "long" });
  const rest = parsed.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
  });

  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${rest}`;
}

/** Cuántos videos caen dentro de los últimos `days` días (inclusive hoy). */
export function countRecentVideos(
  items: VideoFeedItem[],
  days: number
): number {
  const from = new Date();

  from.setDate(from.getDate() - days);
  const fromIso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;

  return items.filter(
    (item) => item.scheduledDate !== "" && item.scheduledDate >= fromIso
  ).length;
}

/** Un video está revisado si tiene entrada en el mapa de revisiones. */
export function isReviewed(reviews: VideoReviewMap, videoUrl: string): boolean {
  return reviews[videoUrl] !== undefined;
}

/**
 * Parche optimista del cache: refleja el PUT en el mapa de revisiones antes de
 * que responda el servidor (al desmarcar, la entrada desaparece con su
 * comentario — es exactamente lo que hace el backend).
 */
export function applyReviewToFeed(
  feed: VideoFeed,
  input: VideoReviewInput
): VideoFeed {
  const next: VideoReviewMap = { ...feed.videoReviews };

  if (input.reviewed) {
    const previous = next[input.videoUrl];

    next[input.videoUrl] = {
      reviewed_at: previous?.reviewed_at ?? new Date().toISOString(),
      comment:
        input.comment !== undefined
          ? input.comment
          : (previous?.comment ?? null),
    };
  } else {
    delete next[input.videoUrl];
  }

  return { ...feed, videoReviews: next };
}
