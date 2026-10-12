"use client";

import { Icon } from "@iconify/react";
import { addToast } from "@heroui/react";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import React from "react";

import {
  Avatar,
  MetricStrip,
  MiniBars,
  PageHeader,
  Panel,
  RelativeTime,
  SearchField,
  SegmentedControl,
  SkeletonRows,
  SortHeader,
  StatusDot,
  WeeklyColumnChart,
  daysAgoForDay,
  formatDate,
  formatDayRelative,
  tableClasses,
  useSort,
} from "@/components/admin/admin-ui";
import { useAdminData } from "@/lib/admin/use-admin-data";

interface Trainer {
  id: string;
  email: string;
  full_name: string;
  tenant_slug: string | null;
  subscription_status: "active" | "paused" | "cancelled";
  password_set_at: string | null;
  last_login_at: string | null;
  created_at: string;
  onboarding_completed: boolean;
  nutrition_v2_enabled: boolean;
  clientCount: number;
}

interface Client {
  id: number;
  email: string;
  name: string | null;
  last_name: string | null;
  status: string | null;
  last_login_at: string | null;
  sign_up_date: string | null;
  hasPassword: boolean;
  trainingDays28: number;
  weeks4: number[];
  lastTrainingDay: string | null;
  checkins28: number;
  habits28: number;
  lastCheckinAt: string | null;
}

interface Week {
  weekEnd: string;
  clients: number;
  trainingDays: number;
}

/** Trained before but not in this many days → "needs attention". */
const STALE_DAYS = 10;

const sinceTraining = (c: Client) =>
  c.lastTrainingDay ? daysAgoForDay(c.lastTrainingDay) : Infinity;

type Filter = "all" | "training" | "stale" | "never" | "no_password";

const FILTERS: Record<Filter, (c: Client) => boolean> = {
  all: () => true,
  training: (c) => sinceTraining(c) < STALE_DAYS,
  // Trained in the 12-week window, but not lately.
  stale: (c) => c.lastTrainingDay !== null && sinceTraining(c) >= STALE_DAYS,
  never: (c) => c.lastTrainingDay === null,
  no_password: (c) => !c.hasPassword,
};

type SortKey =
  | "name"
  | "training"
  | "lastTraining"
  | "checkins"
  | "login"
  | "signup";

const fullName = (c: Client) =>
  `${c.name ?? ""} ${c.last_name ?? ""}`.trim() || c.email;

const SORT_ACCESSORS: Record<SortKey, (c: Client) => string | number | null> = {
  name: fullName,
  training: (c) => c.trainingDays28,
  lastTraining: (c) => c.lastTrainingDay,
  checkins: (c) => c.checkins28,
  login: (c) => c.last_login_at,
  signup: (c) => c.sign_up_date,
};

function statusTone(status: string | null) {
  if (!status) return "gray" as const;
  if (status === "Activo" || status === "Onboarding Completado")
    return "green" as const;
  if (status.toLowerCase().includes("inactiv")) return "red" as const;

  return "amber" as const;
}

async function impersonate(url: string, failMessage: string) {
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Error al generar enlace");
    window.open(data.url, "_blank");
  } catch (err) {
    console.error(failMessage, err);
    addToast({ title: failMessage, color: "danger" });
  }
}

function ClientList({
  rows,
  empty,
}: {
  rows: { client: Client; value: React.ReactNode; bar?: number }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-slate-400">{empty}</p>
    );
  }

  return (
    <ol className="space-y-2.5">
      {rows.map(({ client, value, bar }) => (
        <li key={client.id} className="flex items-center gap-3 text-[13px]">
          <Avatar name={fullName(client)} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">
              {fullName(client)}
            </p>
            {bar !== undefined ? (
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-emerald-500"
                  style={{ width: `${bar * 100}%` }}
                />
              </span>
            ) : null}
          </div>
          <span className="shrink-0 tabular-nums text-slate-600">{value}</span>
        </li>
      ))}
    </ol>
  );
}

export default function TrainerDetailPage() {
  const params = useParams();
  const trainerId = params.trainerId as string;

  const trainerQ = useAdminData<{ trainer: Trainer }>(
    `/api/admin/trainers/${trainerId}`
  );
  const clientsQ = useAdminData<{ clients: Client[]; weeks: Week[] }>(
    `/api/admin/trainers/${trainerId}/clients`
  );
  const trainer = trainerQ.data?.trainer ?? null;
  const clients = React.useMemo(
    () => clientsQ.data?.clients ?? [],
    [clientsQ.data]
  );
  const weeks = React.useMemo(
    () => clientsQ.data?.weeks ?? [],
    [clientsQ.data]
  );
  // The header can render from the trainer response while activity loads.
  const isLoading = clientsQ.isLoading;
  const error = trainerQ.error ?? clientsQ.error;
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [busy, setBusy] = React.useState<string | number | null>(null);

  const run = async (key: string | number, fn: () => Promise<void>) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(FILTERS) as Filter[]).map((k) => [
          k,
          clients.filter(FILTERS[k]).length,
        ])
      ) as Record<Filter, number>,
    [clients]
  );

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase();

    return clients.filter(
      (c) =>
        FILTERS[filter](c) &&
        (!term ||
          fullName(c).toLowerCase().includes(term) ||
          (c.email ?? "").toLowerCase().includes(term))
    );
  }, [clients, filter, search]);

  const { sorted, sort, toggle } = useSort(visible, SORT_ACCESSORS, {
    key: "training",
    dir: "desc",
  });

  const insights = React.useMemo(() => {
    const thisWeek = weeks.at(-1);
    const lastWeek = weeks.at(-2);
    const trainers28 = clients.filter((c) => c.trainingDays28 > 0);
    const days28 = trainers28.reduce((n, c) => n + c.trainingDays28, 0);
    const top = [...trainers28]
      .sort((a, b) => b.trainingDays28 - a.trainingDays28)
      .slice(0, 5);
    const stale = clients
      .filter(FILTERS.stale)
      .sort((a, b) => sinceTraining(a) - sinceTraining(b))
      .slice(0, 10);

    return {
      thisWeek: thisWeek?.clients ?? 0,
      delta: (thisWeek?.clients ?? 0) - (lastWeek?.clients ?? 0),
      avgPerWeek: trainers28.length ? days28 / trainers28.length / 4 : 0,
      checkins28: clients.reduce((n, c) => n + c.checkins28, 0),
      habits28: clients.reduce((n, c) => n + c.habits28, 0),
      top,
      topMax: top[0]?.trainingDays28 ?? 1,
      stale,
    };
  }, [clients, weeks]);

  const breadcrumb = (
    <NextLink
      className="mb-1 inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900"
      href="/admin/dashboard/trainers"
    >
      <Icon icon="solar:alt-arrow-left-linear" width={14} />
      Entrenadores
    </NextLink>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-6 px-10 py-8">
        {breadcrumb}
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      </div>
    );
  }

  const dash = (v: React.ReactNode) => (isLoading ? "—" : v);

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-10 py-8">
      <PageHeader
        actions={
          trainer ? (
            <>
              {trainer.tenant_slug ? (
                <a
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                  href={`/${trainer.tenant_slug}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Portal /{trainer.tenant_slug}
                  <Icon icon="solar:arrow-right-up-linear" width={14} />
                </a>
              ) : null}
              <button
                className="flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[13px] font-medium text-white transition-transform duration-100 hover:bg-slate-800 active:scale-[0.97] disabled:opacity-60"
                disabled={busy === "trainer"}
                type="button"
                onClick={() =>
                  run("trainer", () =>
                    impersonate(
                      `/api/admin/trainers/${trainerId}/impersonate`,
                      "No se pudo acceder a la cuenta del entrenador"
                    )
                  )
                }
              >
                <Icon icon="solar:login-3-linear" width={16} />
                Entrar como entrenador
              </button>
            </>
          ) : null
        }
        breadcrumb={breadcrumb}
        subtitle={
          trainer ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{trainer.email}</span>
              <span className="text-slate-300">·</span>
              <span>
                Último acceso <RelativeTime iso={trainer.last_login_at} />
              </span>
              <span className="text-slate-300">·</span>
              <span>Alta {formatDate(trainer.created_at)}</span>
              <span className="text-slate-300">·</span>
              <StatusDot
                label={
                  trainer.onboarding_completed
                    ? "Onboarding completo"
                    : "Onboarding pendiente"
                }
                tone={trainer.onboarding_completed ? "green" : "amber"}
              />
              <StatusDot
                label={
                  trainer.password_set_at
                    ? "Contraseña configurada"
                    : "Sin contraseña"
                }
                tone={trainer.password_set_at ? "green" : "amber"}
              />
            </span>
          ) : (
            "Cargando…"
          )
        }
        title={trainer?.full_name ?? " "}
      />

      <MetricStrip
        items={[
          {
            label: "Clientes",
            value: dash(clients.length),
            hint: isLoading ? null : `${counts.no_password} sin contraseña`,
          },
          {
            label: "Entrenaron · 7 días",
            value: dash(insights.thisWeek),
            hint: isLoading
              ? null
              : insights.delta === 0
                ? "igual que la semana anterior"
                : `${insights.delta > 0 ? "+" : "−"}${Math.abs(insights.delta)} vs semana anterior`,
          },
          {
            label: "Entrenos por semana",
            value: dash(insights.avgPerWeek.toFixed(1).replace(".", ",")),
            hint: isLoading ? null : "media por cliente que entrena · 28 días",
          },
          {
            label: "Check-ins · 28 días",
            value: dash(insights.checkins28),
            hint: isLoading
              ? null
              : `${insights.habits28} formularios de hábitos`,
          },
          {
            label: "Dejaron de entrenar",
            value: dash(counts.stale),
            hint: isLoading
              ? null
              : `${counts.never} sin ningún entreno en 12 semanas`,
          },
        ]}
      />

      <div className="grid grid-cols-3 gap-4">
        <Panel
          className="col-span-2"
          subtitle="últimas 12 semanas · pasa el ratón por una barra"
          title="Clientes que entrenaron cada semana"
        >
          {isLoading ? (
            <div className="h-56 animate-pulse rounded-lg bg-slate-50" />
          ) : (
            <div className="admin-fade-in">
              <WeeklyColumnChart
                max={clients.length}
                points={weeks.map((w) => ({
                  weekEnd: w.weekEnd,
                  value: w.clients,
                  detail: `${w.trainingDays} días de entreno`,
                }))}
                unit={`de ${clients.length} clientes entrenaron`}
              />
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel subtitle="días entrenados · 28 d" title="Más activos">
            {isLoading ? (
              <div className="h-32 animate-pulse rounded-lg bg-slate-50" />
            ) : (
              <div className="admin-fade-in">
                <ClientList
                  empty="Nadie ha entrenado en 28 días."
                  rows={insights.top.map((c) => ({
                    client: c,
                    value: `${c.trainingDays28} d`,
                    bar: c.trainingDays28 / insights.topMax,
                  }))}
                />
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Panel
        subtitle={`entrenaban y llevan ${STALE_DAYS}+ días sin registrar entreno`}
        title="Necesitan atención"
      >
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-slate-50" />
        ) : insights.stale.length === 0 ? (
          <p className="text-[13px] text-slate-400">
            Todos los que entrenan lo han hecho en los últimos {STALE_DAYS}{" "}
            días.
          </p>
        ) : (
          <ul className="grid grid-cols-5 gap-3">
            {insights.stale.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px]"
              >
                <Avatar name={fullName(c)} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {fullName(c)}
                  </p>
                  <p className="text-[12px] text-amber-700">
                    {Math.floor(sinceTraining(c))} días sin entrenar
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="flex items-center justify-between gap-4 pt-2">
        <SegmentedControl
          segments={[
            { key: "all", label: "Todos", count: counts.all },
            { key: "training", label: "Entrenando", count: counts.training },
            {
              key: "stale",
              label: "Dejaron de entrenar",
              count: counts.stale,
            },
            { key: "never", label: "Sin entrenos", count: counts.never },
            {
              key: "no_password",
              label: "Sin contraseña",
              count: counts.no_password,
            },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <SearchField
          placeholder="Buscar cliente por nombre o email"
          value={search}
          onChange={setSearch}
        />
      </div>

      <div className={tableClasses.wrapper}>
        <table className={tableClasses.table}>
          <thead className={tableClasses.thead}>
            <tr>
              <SortHeader
                className="pl-4"
                label="Cliente"
                sort={sort}
                sortKey="name"
                onSort={toggle}
              />
              <SortHeader
                label="Entrenos · 28 d"
                sort={sort}
                sortKey="training"
                onSort={toggle}
              />
              <SortHeader
                label="Último entreno"
                sort={sort}
                sortKey="lastTraining"
                onSort={toggle}
              />
              <SortHeader
                label="Check-ins · 28 d"
                sort={sort}
                sortKey="checkins"
                onSort={toggle}
              />
              <SortHeader
                label="Último acceso app"
                sort={sort}
                sortKey="login"
                onSort={toggle}
              />
              <SortHeader
                label="Alta"
                sort={sort}
                sortKey="signup"
                onSort={toggle}
              />
              <th className="w-40 px-3 py-2" scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody
            key={isLoading ? "loading" : "ready"}
            className={isLoading ? undefined : "admin-fade-in"}
          >
            {isLoading ? (
              <SkeletonRows cols={7} />
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-16 text-center text-slate-500"
                  colSpan={7}
                >
                  {clients.length === 0
                    ? "Este entrenador aún no tiene clientes."
                    : search
                      ? `Nada coincide con “${search}”.`
                      : "Ningún cliente en este filtro."}
                </td>
              </tr>
            ) : (
              sorted.map((client) => {
                const enter = () =>
                  run(client.id, () =>
                    impersonate(
                      `/api/admin/trainers/${trainerId}/clients/${client.id}/impersonate`,
                      "No se pudo acceder a la cuenta del cliente"
                    )
                  );
                const stale = sinceTraining(client) >= STALE_DAYS;

                return (
                  <tr
                    key={client.id}
                    className={tableClasses.row.replace("cursor-pointer ", "")}
                    onDoubleClick={enter}
                  >
                    <td className={`${tableClasses.cell} pl-4`}>
                      <div className="flex items-center gap-3">
                        <Avatar name={fullName(client)} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate font-medium text-slate-900">
                              {fullName(client)}
                            </p>
                            {client.status ? (
                              <span title={`Estado: ${client.status}`}>
                                <StatusDot
                                  label=""
                                  tone={statusTone(client.status)}
                                />
                              </span>
                            ) : null}
                            {!client.hasPassword ? (
                              <span className="inline-flex h-[18px] items-center rounded bg-amber-50 px-1.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/15">
                                Sin contraseña
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-[12px] text-slate-500">
                            {client.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={tableClasses.cell}>
                      <div className="flex items-center gap-2.5">
                        <MiniBars
                          label={`Días entrenados por semana, últimas 4: ${client.weeks4.join(", ")}`}
                          values={client.weeks4}
                        />
                        <span
                          className={`tabular-nums ${client.trainingDays28 ? "font-medium text-slate-900" : "text-slate-400"}`}
                        >
                          {client.trainingDays28}
                        </span>
                      </div>
                    </td>
                    <td className={tableClasses.cell}>
                      {client.lastTrainingDay ? (
                        <span
                          className={
                            stale ? "text-amber-700" : "text-slate-700"
                          }
                        >
                          {formatDayRelative(client.lastTrainingDay)}
                        </span>
                      ) : (
                        <span
                          className="text-slate-400"
                          title="Sin entrenos en las últimas 12 semanas"
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className={`${tableClasses.cell} tabular-nums`}>
                      <span
                        className={
                          client.checkins28
                            ? "text-slate-700"
                            : "text-slate-400"
                        }
                      >
                        {client.checkins28}
                      </span>
                      {client.lastCheckinAt ? (
                        <span className="ml-2 text-[12px] text-slate-400">
                          último{" "}
                          <RelativeTime
                            iso={client.lastCheckinAt}
                            staleAfterDays={365}
                          />
                        </span>
                      ) : null}
                    </td>
                    <td className={tableClasses.cell}>
                      <RelativeTime iso={client.last_login_at} />
                    </td>
                    <td className={`${tableClasses.cell} text-slate-500`}>
                      {formatDate(client.sign_up_date)}
                    </td>
                    <td className={`${tableClasses.cell} pr-3 text-right`}>
                      <button
                        className="h-7 rounded-md px-2 text-[12px] font-medium text-slate-600 opacity-0 transition-opacity hover:bg-slate-200/60 hover:text-slate-900 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                        disabled={busy === client.id}
                        type="button"
                        onClick={enter}
                      >
                        Entrar como cliente
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && clients.length > 0 ? (
        <p className="text-[12px] text-slate-400 tabular-nums">
          Mostrando {sorted.length} de {clients.length} · un día de entreno = un
          día con al menos un ejercicio registrado · doble clic en una fila para
          entrar como ese cliente
        </p>
      ) : null}
    </div>
  );
}
