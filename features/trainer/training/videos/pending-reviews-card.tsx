"use client";

// Tarjeta "Videos por revisar" de la página de métricas: cola transversal de
// todos los clientes. Cada fila = miniatura + cliente + ejercicio/serie, con
// el mismo compositor de revisión del tab Videos; el nombre del cliente
// navega a su tab Videos. Al revisar, la fila desaparece (optimista).

import { Avatar, Card, CardBody, CardHeader, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ReviewComposer } from "./review-composer";
import {
  usePendingReviewMutation,
  usePendingVideoReviews,
  type PendingVideoReview,
} from "./use-pending-reviews";
import { VideoThumb } from "./video-thumb";

import {
  TrainerExerciseVideoModal,
  type TrainerExerciseVideoHandle,
} from "@/components/trainer/trainer-exercise-video-modal";

function formatShortDate(ymd: string): string {
  if (ymd.length === 0) return "";
  const parsed = new Date(`${ymd}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return ymd;

  return parsed.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function PendingRow({
  item,
  isSaving,
  onPlay,
  onReview,
  onOpenClient,
}: {
  item: PendingVideoReview;
  isSaving: boolean;
  onPlay: (url: string, name: string) => void;
  onReview: (item: PendingVideoReview, comment: string | null) => void;
  onOpenClient: (item: PendingVideoReview) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <VideoThumb
          label={`Ver video de ${item.clientName} — ${item.exerciseName}`}
          url={item.videoUrl}
          onOpen={() => onPlay(item.videoUrl, item.exerciseName)}
        />

        <div className="min-w-0 flex-1">
          <button
            className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 transition-colors hover:text-blue-600"
            type="button"
            onClick={() => onOpenClient(item)}
          >
            <Avatar
              className="h-5 w-5 shrink-0 text-[9px]"
              name={item.clientName}
              {...(item.clientAvatar ? { src: item.clientAvatar } : {})}
            />
            <span className="truncate">{item.clientName}</span>
            <Icon
              className="shrink-0 text-gray-400"
              icon="solar:alt-arrow-right-linear"
              width={12}
            />
          </button>
          <p className="mt-0.5 truncate text-[11px] text-gray-500 tabular-nums">
            {item.exerciseName} · {item.setLabel}
            {item.scheduledDate !== ""
              ? ` · ${formatShortDate(item.scheduledDate)}`
              : ""}
          </p>
        </div>

        <button
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
          disabled={isSaving}
          type="button"
          onClick={() => setComposerOpen((open) => !open)}
        >
          <Icon icon="solar:check-circle-linear" width={13} />
          Revisar
        </button>
      </div>

      {composerOpen ? (
        <ReviewComposer
          isSaving={isSaving}
          submitLabel="Marcar revisado"
          onCancel={() => setComposerOpen(false)}
          onSubmit={(comment) => {
            onReview(item, comment);
            setComposerOpen(false);
          }}
        />
      ) : null}
    </li>
  );
}

export function PendingReviewsCard() {
  const router = useRouter();
  const { pending, totalPending, isLoading, error } = usePendingVideoReviews();
  const reviewM = usePendingReviewMutation();
  const videoModalRef = useRef<TrainerExerciseVideoHandle>(null);

  const openClient = (item: PendingVideoReview) => {
    router.push(
      `/trainer/dashboard/clients/${item.clientId}?tab=training&sub=videos`
    );
  };

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardHeader className="flex items-center justify-between gap-2 pb-0">
        <div className="flex items-center gap-2">
          <Icon
            className="text-blue-600"
            icon="solar:videocamera-record-broken"
            width={18}
          />
          <h3 className="font-heading text-base font-semibold text-gray-900">
            Videos por revisar
          </h3>
          {totalPending > 0 ? (
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10.5px] font-bold leading-none text-white tabular-nums">
              {totalPending}
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardBody className="pt-3">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-large" />
            <Skeleton className="h-16 w-full rounded-large" />
          </div>
        ) : error != null ? (
          <p className="py-4 text-center text-[13px] text-danger-600">
            No se pudieron cargar los videos pendientes
          </p>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center">
            <Icon
              className="text-emerald-500"
              icon="solar:check-circle-bold"
              width={22}
            />
            <p className="text-[13px] text-gray-500">
              No hay videos pendientes de revisión
            </p>
          </div>
        ) : (
          <ul className="-mx-4 divide-y divide-gray-100">
            {pending.map((item) => (
              <PendingRow
                key={item.videoUrl}
                isSaving={
                  reviewM.isPending &&
                  reviewM.variables?.item.videoUrl === item.videoUrl
                }
                item={item}
                onOpenClient={openClient}
                onPlay={(url, name) => videoModalRef.current?.open(url, name)}
                onReview={(target, comment) =>
                  reviewM.mutate({ item: target, comment })
                }
              />
            ))}
          </ul>
        )}

        {totalPending > pending.length ? (
          <p className="pt-2 text-center text-[11.5px] text-gray-400">
            Mostrando {pending.length} de {totalPending} — revisa desde el
            perfil de cada cliente para ver el resto
          </p>
        ) : null}
      </CardBody>

      <TrainerExerciseVideoModal ref={videoModalRef} />
    </Card>
  );
}
