"use client";

// Inicio del entrenador ("Tablero", elegido entre cuatro prototipos, nov 2026).
// Arriba, las tres cifras de la semana en grande con su gráfica. Debajo, los
// pendientes como una sola superficie con filetes: una columna por tipo de
// trabajo, y cada fila lleva a lo que hay que revisar. El color solo aparece
// donde significa algo (lo que lleva dos días o más esperando).
//
// Descartadas: una lista única ordenada por urgencia (mezcla tipos de trabajo)
// y una vista por días de la semana (compleja y vacía en días futuros).

import type { InicioData, PendingItem } from "@/lib/trainer-inicio/types";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { WeekBand } from "@/components/dashboard/inicio-charts";
import { CenteredState } from "@/components/shared/centered-state";
import { MusclesAnnouncement } from "@/features/trainer/library/muscles-announcement";
import { NutritionUpdateBanner } from "@/features/trainer/nutrition-update/nutrition-update-banner";
import { usePendingVideoReviews } from "@/features/trainer/training/videos/use-pending-reviews";

interface ActivityEvent {
  id: string;
  clientName: string;
  clientId: number;
  description: string;
  timestamp: string;
}

const HOUR = 60 * 60 * 1000;
/** A partir de aquí un pendiente se tiñe: lleva demasiado esperando. */
const STALE_MS = 48 * HOUR;
/** Filas visibles por columna antes de "Ver N más". */
const CAP = 5;

const LABEL = "text-[13px] font-medium text-default-600";
const ROW =
  "flex w-full items-center gap-3 px-4 text-left outline-none transition-colors duration-150 focus-visible:bg-content2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary active:bg-default-100 [@media(hover:hover)]:hover:bg-content2";

/** "hace 20 min", "hace 5 h", "ayer", "hace 3 d". */
function ago(iso: string, now: number): string {
  const ms = Math.max(0, now - new Date(iso).getTime());

  if (ms < HOUR) return `hace ${Math.max(1, Math.round(ms / 60000))} min`;
  if (ms < 24 * HOUR) return `hace ${Math.round(ms / HOUR)} h`;
  if (ms < STALE_MS) return "ayer";

  return `hace ${Math.floor(ms / (24 * HOUR))} d`;
}

const isStale = (item: PendingItem, now: number) =>
  now - new Date(item.at).getTime() >= STALE_MS;

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

function Column({
  label,
  list,
  now,
  lead = false,
  loading = false,
}: {
  label: string;
  list: PendingItem[];
  now: number;
  /** La columna del trabajo principal: más ancha y con avatar. */
  lead?: boolean;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? list : list.slice(0, CAP);
  const hidden = list.length - shown.length;

  return (
    <section
      className={`flex min-w-0 flex-col bg-content1 ${
        lead ? "md:col-span-2 xl:col-span-1" : ""
      }`}
    >
      <header className="flex h-11 items-center justify-between gap-3 border-b border-default-200 px-4">
        <h3
          className={`min-w-0 truncate text-[13px] ${
            lead
              ? "font-semibold text-foreground"
              : "font-medium text-default-600"
          }`}
        >
          {label}
        </h3>
        <span className="text-[13px] tabular-nums text-default-400">
          {loading ? "" : list.length}
        </span>
      </header>
      {loading ? (
        <div aria-busy="true" className="space-y-2 p-4">
          <div className="h-4 w-2/3 animate-pulse rounded bg-default-100 motion-reduce:animate-none" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-default-100 motion-reduce:animate-none" />
        </div>
      ) : list.length === 0 ? (
        <p className="px-4 py-3 text-sm text-default-400">Nada pendiente.</p>
      ) : (
        <ul className="divide-y divide-default-100">
          {shown.map((item) => (
            <li key={item.id}>
              <Link
                className={`${ROW} ${lead ? "py-3" : "py-2.5"}`}
                href={item.href}
              >
                {lead ? (
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-default-100 text-xs font-semibold text-default-600"
                  >
                    {initials(item.client)}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span
                      className={`min-w-0 flex-1 truncate text-sm text-foreground ${
                        lead ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {item.client}
                    </span>
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        isStale(item, now)
                          ? "font-medium text-warning-700"
                          : "text-default-400"
                      }`}
                    >
                      {ago(item.at, now)}
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 block text-[13px] leading-snug text-default-500 ${
                      lead ? "truncate" : "line-clamp-2"
                    }`}
                  >
                    {item.detail}
                  </span>
                </span>
                {lead ? (
                  <Icon
                    aria-hidden
                    className="shrink-0 text-default-300"
                    icon="solar:alt-arrow-right-linear"
                    width={16}
                  />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 || open ? (
        <button
          className="flex h-9 w-full items-center px-4 text-left text-[13px] font-medium text-default-500 outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          type="button"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Ver menos" : `Ver ${hidden} más`}
        </button>
      ) : null}
    </section>
  );
}

export default function InicioContent() {
  // La fecha y las antigüedades dependen del reloj del navegador: se pintan
  // tras montar para no desajustar la hidratación con el servidor.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => setNow(Date.now()), []);

  const inicio = useQuery<InicioData>({
    queryKey: ["trainer", "inicio"],
    queryFn: async () => {
      const res = await fetch("/api/trainer/inicio", { cache: "no-store" });

      if (!res.ok) throw new Error(`inicio ${res.status}`);

      return (await res.json()) as InicioData;
    },
    staleTime: 60_000,
  });
  const activity = useQuery<ActivityEvent[]>({
    queryKey: ["trainer", "inicio", "activity"],
    queryFn: async () => {
      const res = await fetch("/api/metrics/dashboard", { cache: "no-store" });

      if (!res.ok) throw new Error(`metrics ${res.status}`);
      const body = (await res.json()) as { recentActivity?: ActivityEvent[] };

      return body.recentActivity ?? [];
    },
    staleTime: 60_000,
  });
  const videos = usePendingVideoReviews();

  const clock = now ?? 0;
  const pending = inicio.data?.pending;
  const videoItems: PendingItem[] = videos.pending.map((v) => ({
    id: `video-${v.exerciseLogId}-${v.videoUrl}`,
    clientId: v.clientId,
    client: v.clientName,
    detail: [v.exerciseName, v.setLabel].filter(Boolean).join(" · "),
    // Sin fecha de sesión no se sabe cuánto lleva: cuenta desde ahora.
    at: v.scheduledDate
      ? `${v.scheduledDate}T12:00:00`
      : new Date(clock).toISOString(),
    href: `/trainer/dashboard/clients/${v.clientId}?tab=training&sub=videos`,
  }));
  const columns = pending
    ? [
        pending.review,
        pending.expired,
        videoItems,
        pending.message,
        pending.unfinished,
      ]
    : [];
  const total = columns.reduce((n, list) => n + list.length, 0);
  const stale = columns
    .flat()
    .filter((item) => now !== null && isStale(item, now)).length;
  const loading = inicio.isPending;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Inicio
        </h1>
        <p className="text-sm text-default-500 first-letter:uppercase">
          {now === null
            ? ""
            : new Date(now).toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
        </p>
      </div>

      <MusclesAnnouncement />
      <NutritionUpdateBanner />

      {inicio.isError ? (
        <CenteredState
          action={
            <Button
              color="primary"
              variant="flat"
              onPress={() => inicio.refetch()}
            >
              Reintentar
            </Button>
          }
          icon="solar:danger-triangle-linear"
          subtitle="No se pudieron cargar las cifras ni los pendientes."
          title="Algo falló al cargar Inicio"
        />
      ) : (
        <>
          {inicio.data ? (
            <WeekBand data={inicio.data} />
          ) : (
            <div
              aria-busy="true"
              className="h-[188px] animate-pulse rounded-large border border-default-200 bg-content1 motion-reduce:animate-none"
            />
          )}

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
                Pendientes
              </h2>
              {loading ? null : (
                <p className="text-sm text-default-600">
                  {total === 0 ? (
                    "Nadie espera respuesta tuya ahora mismo."
                  ) : (
                    <>
                      <span className="font-semibold tabular-nums text-foreground">
                        {total}
                      </span>{" "}
                      en total
                      {stale > 0 ? (
                        <>
                          ,{" "}
                          <span className="font-medium text-warning-700">
                            {stale} {stale === 1 ? "lleva" : "llevan"} dos días
                            o más esperando
                          </span>
                        </>
                      ) : null}
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-large border border-default-200 bg-default-200 md:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,1fr))]">
              <Column
                lead
                label="Check-ins por revisar"
                list={pending?.review ?? []}
                loading={loading}
                now={clock}
              />
              <Column
                label="Check-ins sin enviar"
                list={pending?.expired ?? []}
                loading={loading}
                now={clock}
              />
              <Column
                label="Vídeos por revisar"
                list={videoItems}
                loading={videos.isLoading}
                now={clock}
              />
              <Column
                label="Mensajes sin leer"
                list={pending?.message ?? []}
                loading={loading}
                now={clock}
              />
              <Column
                label="Sesiones sin terminar"
                list={pending?.unfinished ?? []}
                loading={loading}
                now={clock}
              />
            </div>
          </div>
        </>
      )}

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={LABEL}>Actividad reciente</h2>
          <Link
            className="rounded text-[13px] font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary"
            href="/trainer/dashboard/clients"
          >
            Ver clientes
          </Link>
        </div>
        {activity.isPending ? (
          <div
            aria-busy="true"
            className="mt-2 h-24 animate-pulse rounded-medium bg-default-100 motion-reduce:animate-none"
          />
        ) : (activity.data ?? []).length === 0 ? (
          <p className="mt-2 border-t border-default-200 py-3 text-sm text-default-400">
            Sin actividad en los últimos siete días.
          </p>
        ) : (
          // Ancho completo, en dos columnas desde xl para que la hora no
          // quede lejos del texto.
          <ul className="mt-2 grid grid-cols-1 gap-x-10 border-t border-default-200 xl:grid-cols-2 [&>li]:border-b [&>li]:border-default-100">
            {(activity.data ?? []).map((event) => (
              <li key={event.id}>
                <Link
                  className="flex items-baseline gap-3 py-2 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary [@media(hover:hover)]:hover:bg-content2"
                  href={`/trainer/dashboard/clients/${event.clientId}`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-foreground">
                      {event.clientName}
                    </span>{" "}
                    <span className="text-default-500">
                      {event.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-default-400">
                    {now === null ? "" : ago(event.timestamp, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
