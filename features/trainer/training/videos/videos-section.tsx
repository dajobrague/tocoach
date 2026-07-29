"use client";

// Rebanada "Videos": bandeja de revisión de los videos que sube el cliente.
// El orden de lectura es el del mockup aprobado — chips de filtro en la fila
// de pills (por portal), franja de stats con separadores finos, y el feed
// agrupado por día (una tarjeta por día, una fila por video).
//
// El filtro por defecto es "Sin revisar" porque esta pantalla es una cola de
// trabajo, no un archivo: lo revisado se atenúa y sale de la vista.

import type { VideoFeedItem } from "./videos-format";
import type { TrainerExerciseVideoHandle } from "@/components/trainer/trainer-exercise-video-modal";

import { Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { usePrograms } from "../programa/use-training";

import { VideoRow } from "./video-row";
import { useVideoFeed, useVideoReviewMutation } from "./use-videos";
import {
  countRecentVideos,
  formatGroupDate,
  groupVideosByDate,
  isReviewed,
} from "./videos-format";

import { TrainerExerciseVideoModal } from "@/components/trainer/trainer-exercise-video-modal";

const FILTERS = [
  { key: "pending", label: "Sin revisar" },
  { key: "all", label: "Todos" },
  { key: "reviewed", label: "Revisados" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "emerald" | "neutral";
}) {
  const valueColor =
    tone === "blue"
      ? "text-blue-600"
      : tone === "emerald"
        ? "text-emerald-600"
        : "text-gray-900";

  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className={`text-[20px] font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}

export function VideosSection({ clientId }: { clientId: string }) {
  const { items, reviews, isLoading, error, refetch } = useVideoFeed(clientId);
  const reviewM = useVideoReviewMutation(clientId);
  const { programs } = usePrograms(clientId);

  const [filter, setFilter] = useState<FilterKey>("pending");
  // Slot del shell (fila de pills) donde viven los chips de filtro; si no
  // existe (tests, otros hosts) caen en línea sobre la franja de stats.
  const [toolbarEl, setToolbarEl] = useState<HTMLElement | null>(null);
  const videoModalRef = useRef<TrainerExerciseVideoHandle>(null);

  useEffect(() => {
    setToolbarEl(document.getElementById("training-videos-toolbar"));
  }, []);

  // Nombre de sesión por id: solo de los programas ya cargados; si la sesión
  // no está en ninguno (programa borrado o pausado) el grupo va sin nombre.
  const sessionNames = useMemo(() => {
    const map = new Map<string, string>();

    for (const program of programs) {
      for (const session of program.sessions) {
        map.set(session.id, session.name);
      }
    }

    return map;
  }, [programs]);

  const reviewedCount = items.filter((item) =>
    isReviewed(reviews, item.videoUrl)
  ).length;
  const pendingCount = items.length - reviewedCount;
  const recentCount = countRecentVideos(items, 30);

  const visible = items.filter((item) => {
    if (filter === "all") return true;
    const reviewed = isReviewed(reviews, item.videoUrl);

    return filter === "reviewed" ? reviewed : !reviewed;
  });
  const groups = groupVideosByDate(visible);

  const playVideo = (url: string, name: string) => {
    videoModalRef.current?.open(url, name);
  };

  const saveReview = (item: VideoFeedItem, comment: string | null) => {
    reviewM.mutate({
      videoUrl: item.videoUrl,
      reviewed: true,
      comment,
      exerciseLogId: item.exerciseLogId,
      context: {
        exerciseName: item.exerciseName,
        setLabel: item.setLabel,
        scheduledDate: item.scheduledDate,
      },
    });
  };

  const unreview = (item: VideoFeedItem) => {
    reviewM.mutate({
      videoUrl: item.videoUrl,
      reviewed: false,
      exerciseLogId: item.exerciseLogId,
    });
  };

  const toolbar = (
    <div className="flex items-center gap-1.5">
      {FILTERS.map((entry) => (
        <button
          key={entry.key}
          className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
            filter === entry.key
              ? "border-blue-500 bg-blue-50 font-semibold text-blue-600"
              : "border-gray-200 bg-white text-gray-500 hover:text-gray-700"
          }`}
          type="button"
          onClick={() => setFilter(entry.key)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[78px] w-full rounded-large" />
        <Skeleton className="h-40 w-full rounded-large" />
        <Skeleton className="h-40 w-full rounded-large" />
      </div>
    );
  }

  if (error != null) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-large border border-danger-200 bg-danger-50 p-4">
        <p className="flex items-center gap-2 text-sm text-danger-700">
          <Icon icon="solar:danger-bold" width={18} />
          {error instanceof Error
            ? error.message
            : "No se pudieron cargar los videos"}
        </p>
        <button
          className="text-[12px] font-semibold text-danger-700 underline"
          type="button"
          onClick={refetch}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {toolbarEl !== null ? createPortal(toolbar, toolbarEl) : null}

      {items.length === 0 ? (
        <section className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-200 bg-gray-50/60 px-4 py-10 text-center">
          <Icon
            className="text-default-300"
            icon="solar:videocamera-record-broken"
            width={26}
          />
          <p className="text-sm text-gray-600">
            El cliente todavía no subió videos
          </p>
        </section>
      ) : (
        <>
          {toolbarEl === null ? toolbar : null}

          <div className="overflow-hidden rounded-large border border-gray-200">
            <div className="grid grid-cols-3 gap-px bg-gray-100">
              <StatCell label="Sin revisar" tone="blue" value={pendingCount} />
              <StatCell
                label="Revisados"
                tone="emerald"
                value={reviewedCount}
              />
              <StatCell
                label="Últimos 30 días"
                tone="neutral"
                value={recentCount}
              />
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="px-1 py-6 text-center text-[13px] text-gray-400">
              {filter === "pending"
                ? "No hay videos sin revisar 🎉"
                : "No hay videos revisados todavía"}
            </p>
          ) : (
            groups.map((group) => {
              const sessionName =
                group.sessionId !== null
                  ? sessionNames.get(group.sessionId)
                  : undefined;

              return (
                <section
                  key={group.date}
                  className="overflow-hidden rounded-large border border-gray-200 bg-white shadow-sm"
                >
                  <header className="flex flex-wrap items-baseline gap-2 border-b border-gray-100 px-4 py-2.5">
                    <p className="text-[13px] font-bold text-gray-900">
                      {formatGroupDate(group.date)}
                    </p>
                    {sessionName !== undefined ? (
                      <p className="text-[11.5px] text-gray-400">
                        {sessionName}
                      </p>
                    ) : null}
                  </header>

                  <ul className="divide-y divide-gray-100">
                    {group.items.map((item) => (
                      <VideoRow
                        key={item.videoUrl}
                        isSaving={
                          reviewM.isPending &&
                          reviewM.variables?.videoUrl === item.videoUrl
                        }
                        item={item}
                        review={reviews[item.videoUrl]}
                        onPlay={playVideo}
                        onSave={saveReview}
                        onUnreview={unreview}
                      />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </>
      )}

      <TrainerExerciseVideoModal ref={videoModalRef} />
    </div>
  );
}
