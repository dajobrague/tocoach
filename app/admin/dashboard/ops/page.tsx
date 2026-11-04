"use client";

import { Select, SelectItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";

import {
  Avatar,
  MetricStrip,
  PageHeader,
  Panel,
  RelativeTime,
  SkeletonRows,
  SortHeader,
  WeeklyColumnChart,
  buttonClasses,
  daysSince,
  formatRelative,
  tableClasses,
  useSort,
} from "@/components/admin/admin-ui";
import { parseTrainerFilter } from "@/lib/admin/ops-filter";
import { prefetchAdmin, useAdminData } from "@/lib/admin/use-admin-data";

interface TrainerOps {
  id: string;
  name: string | null;
  email: string;
  slug: string | null;
  last_login_at: string | null;
  clients: number;
  active7: number;
  active_prev4: number;
  training_days7: number;
  checkins7: number;
  checkins_pending: number;
  videos_pending: number;
  video_review_h: number | null;
  unread_messages: number;
  uses_nutrition: boolean;
  stopped: number;
}

interface Ops {
  generatedAt: string;
  kpis: Record<
    | "trainers"
    | "trainersLogin7d"
    | "clients"
    | "newClients30d"
    | "newClientsPrev30d"
    | "training7d"
    | "trainingPrev7d"
    | "training30d"
    | "trainingDays7d"
    | "trainingDaysPrev7d"
    | "sets7d"
    | "checkins7d"
    | "checkinsPrev7d"
    | "habits7d"
    | "videos7d"
    | "messages7d"
    | "stoppedTraining"
    | "neverTrained",
    number
  >;
  weeks: {
    end: string;
    activeClients: number;
    trainingDays: number;
    checkins: number;
    newClients: number;
  }[];
  weekday: number[];
  hour: number[];
  service: {
    videosPending14d: number;
    videosOldestPendingH: number | null;
    videoReviewMedianH: number | null;
    videosReviewed30dPct: number | null;
    checkinsPending14d: number;
    unreadClientMessages: number;
  };
  adoption: Record<
    | "trainers"
    | "programs"
    | "nutrition"
    | "checkins"
    | "habits"
    | "videos"
    | "chat",
    number
  >;
  trainers: TrainerOps[];
  /** Every trainer, regardless of the filter — feeds the selector. */
  trainerOptions: TrainerOption[];
}

interface TrainerOption {
  id: string;
  name: string;
  slug: string | null;
}

/** Multi-select in the header; empty = whole platform. */
function TrainerFilter({
  options,
  selected,
  loading,
  onChange,
}: {
  options: TrainerOption[];
  selected: string[];
  loading: boolean;
  onChange: (ids: string[]) => void;
}) {
  return (
    <>
      {selected.length > 0 ? (
        <button
          className={buttonClasses.ghost}
          type="button"
          onClick={() => onChange([])}
        >
          Limpiar
        </button>
      ) : null}
      <Select
        aria-label="Filtrar por entrenador"
        className="w-64"
        classNames={{
          trigger:
            "h-8 min-h-8 rounded-lg border border-slate-200 bg-white shadow-none data-[hover=true]:bg-slate-50",
          value: "text-[13px] text-slate-700",
        }}
        isLoading={loading}
        items={options}
        placeholder="Todos los entrenadores"
        renderValue={(items) =>
          items.length === 1
            ? items[0]?.textValue
            : `${items.length} entrenadores`
        }
        selectedKeys={new Set(selected)}
        selectionMode="multiple"
        size="sm"
        startContent={
          <Icon
            className="shrink-0 text-slate-400"
            icon="solar:users-group-rounded-linear"
            width={14}
          />
        }
        variant="flat"
        onSelectionChange={(keys) =>
          onChange(keys === "all" ? [] : [...keys].map(String))
        }
      >
        {(o) => (
          <SelectItem
            key={o.id}
            description={o.slug ? `/${o.slug}` : "sin slug"}
            textValue={o.name}
          >
            {o.name}
          </SelectItem>
        )}
      </Select>
    </>
  );
}

const nf = new Intl.NumberFormat("es-ES");
const num = (n: number) => nf.format(n);

const hours = (h: number | null) =>
  h === null ? "—" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`;

/** Week-over-week delta as a hint line ("+12 vs semana anterior"). */
function delta(now: number, prev: number, period = "semana anterior") {
  const d = now - prev;

  if (d === 0)
    return `igual que ${period === "semana anterior" ? "la" : "los"} ${period}`;

  return (
    <span className={d > 0 ? "text-emerald-600" : "text-red-600"}>
      {d > 0 ? "+" : "−"}
      {num(Math.abs(d))} <span className="text-slate-400">vs {period}</span>
    </span>
  );
}

/** Active clients this week vs the trainer's own 4-week average. */
function trend(t: TrainerOps): number | null {
  return t.active_prev4 > 0
    ? (t.active7 - t.active_prev4) / t.active_prev4
    : null;
}

function TrendCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-300">—</span>;
  const pct = Math.round(value * 100);
  const tone =
    pct <= -15
      ? "text-red-600"
      : pct >= 15
        ? "text-emerald-600"
        : "text-slate-500";

  return (
    <span className={`tabular-nums ${tone}`}>
      {pct > 0 ? "+" : pct < 0 ? "−" : ""}
      {Math.abs(pct)}%
    </span>
  );
}

/** A count that only draws the eye when it needs action. */
function Pending({ n, warnAt }: { n: number; warnAt: number }) {
  if (n === 0) return <span className="text-slate-300">0</span>;

  return (
    <span
      className={`tabular-nums ${n >= warnAt ? "font-medium text-amber-700" : "text-slate-700"}`}
    >
      {n}
    </span>
  );
}

const ALERT_RULES: {
  test: (t: TrainerOps) => boolean;
  label: (t: TrainerOps) => string;
}[] = [
  {
    test: (t) => t.active_prev4 >= 3 && t.active7 <= t.active_prev4 * 0.7,
    label: (t) =>
      `Actividad ${Math.round(((t.active7 - t.active_prev4) / t.active_prev4) * 100)}% vs su media`,
  },
  {
    test: (t) => t.clients >= 3 && t.active7 === 0 && t.active_prev4 === 0,
    label: () => "Ningún cliente entrena",
  },
  {
    test: (t) => t.videos_pending >= 15,
    label: (t) => `${t.videos_pending} vídeos sin revisar`,
  },
  {
    test: (t) => t.checkins_pending >= 10,
    label: (t) => `${t.checkins_pending} check-ins sin revisar`,
  },
  {
    test: (t) => t.unread_messages >= 3,
    label: (t) => `${t.unread_messages} mensajes sin leer`,
  },
  {
    test: (t) => t.clients >= 3 && daysSince(t.last_login_at) >= 14,
    label: (t) =>
      t.last_login_at
        ? `No entra desde ${formatRelative(t.last_login_at)}`
        : "Nunca ha entrado",
  },
];

/** Vertical bars for a distribution (weekday / hour). Peak is emphasised. */
function Distribution({
  values,
  labels,
  unit,
  showLabel = () => true,
}: {
  values: number[];
  labels: string[];
  unit: string;
  showLabel?: (i: number) => boolean;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const top = Math.max(1, ...values);
  const peak = values.indexOf(Math.max(...values));
  const active = hover ?? peak;
  const total = values.reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <div className="flex h-28 items-end gap-1 border-b border-slate-200">
        {values.map((v, i) => (
          <button
            key={i}
            aria-label={`${labels[i]}: ${v} ${unit}`}
            className="group/col flex h-full flex-1 items-end"
            type="button"
            onBlur={() => setHover(null)}
            onFocus={() => setHover(i)}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span
              className={`block w-full rounded-t-[3px] transition-colors duration-100 ${
                i === active
                  ? "bg-emerald-600"
                  : "bg-emerald-500/35 group-hover/col:bg-emerald-500/60"
              }`}
              style={{
                height: `${(v / top) * 100}%`,
                minHeight: v > 0 ? 2 : 0,
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 text-[11px] text-slate-400">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center tabular-nums">
            {showLabel(i) ? l : ""}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-slate-600">
        <span className="font-semibold text-slate-900">{labels[active]}</span> ·{" "}
        {num(values[active] ?? 0)} {unit} (
        {Math.round(((values[active] ?? 0) / total) * 100)}%)
      </p>
    </div>
  );
}

function StatList({
  rows,
}: {
  rows: {
    label: string;
    value: React.ReactNode;
    hint?: string;
    warn?: boolean;
  }[];
}) {
  return (
    <dl className="divide-y divide-slate-100">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="text-[13px] text-slate-600">
            {r.label}
            {r.hint ? (
              <span className="block text-[12px] text-slate-400">{r.hint}</span>
            ) : null}
          </dt>
          <dd
            className={`text-[17px] font-semibold tabular-nums ${r.warn ? "text-amber-700" : "text-slate-900"}`}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOURS = Array.from({ length: 24 }, (_, h) => `${h}h`);

type SortKey =
  | "name"
  | "clients"
  | "active"
  | "trend"
  | "days"
  | "checkins"
  | "checkinsPending"
  | "videos"
  | "review"
  | "unread"
  | "stopped"
  | "login";

const ACCESSORS: Record<SortKey, (t: TrainerOps) => string | number | null> = {
  name: (t) => t.name ?? t.email,
  clients: (t) => t.clients,
  active: (t) => t.active7,
  trend: trend,
  days: (t) => t.training_days7,
  checkins: (t) => t.checkins7,
  checkinsPending: (t) => t.checkins_pending,
  videos: (t) => t.videos_pending,
  review: (t) => t.video_review_h,
  unread: (t) => t.unread_messages,
  stopped: (t) => t.stopped,
  login: (t) => t.last_login_at,
};

// useSearchParams needs a Suspense boundary for the static shell.
export default function OpsPage() {
  return (
    <React.Suspense fallback={null}>
      <OpsPanel />
    </React.Suspense>
  );
}

function OpsPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Selection lives in ?trainers= so it survives reloads and can be shared.
  const trainersParam = searchParams.get("trainers");
  const selected = React.useMemo(() => {
    const f = parseTrainerFilter(trainersParam);

    return f.ok ? (f.ids ?? []) : [];
  }, [trainersParam]);
  const setSelected = (ids: string[]) => {
    const q = new URLSearchParams(searchParams.toString());

    if (ids.length) q.set("trainers", ids.join(","));
    else q.delete("trainers");
    const qs = q.toString();

    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const {
    data: fresh,
    error,
    refresh,
  } = useAdminData<Ops>(
    selected.length
      ? `/api/admin/ops?trainers=${selected.join(",")}`
      : "/api/admin/ops"
  );
  // Keep the previous selection's numbers on screen while the new ones load,
  // dimmed, instead of collapsing everything back to skeletons.
  const [last, setLast] = React.useState<Ops | undefined>(undefined);

  React.useEffect(() => {
    if (fresh) setLast(fresh);
  }, [fresh]);
  const data = fresh ?? last;
  const isLoading = !data && !error;
  const refetching = !fresh && !!data && !error;
  const scope = selected.length
    ? selected.length === 1
      ? "1 entrenador"
      : `${selected.length} entrenadores`
    : "Toda la plataforma";
  const filter = (
    <TrainerFilter
      loading={refetching}
      options={data?.trainerOptions ?? []}
      selected={selected}
      onChange={setSelected}
    />
  );
  const [refreshing, setRefreshing] = React.useState(false);
  const trainers = React.useMemo(() => data?.trainers ?? [], [data]);
  const { sorted, sort, toggle } = useSort(trainers, ACCESSORS, {
    key: "active",
    dir: "desc",
  });

  const alerts = React.useMemo(
    () =>
      trainers
        .map((t) => ({
          t,
          reasons: ALERT_RULES.filter((r) => r.test(t)).map((r) => r.label(t)),
        }))
        .filter((a) => a.reasons.length > 0)
        .sort(
          (a, b) =>
            b.reasons.length - a.reasons.length || b.t.clients - a.t.clients
        ),
    [trainers]
  );

  const open = (t: TrainerOps) =>
    router.push(`/admin/dashboard/trainers/${t.id}`);
  const warm = (t: TrainerOps) => {
    router.prefetch(`/admin/dashboard/trainers/${t.id}`);
    prefetchAdmin(`/api/admin/trainers/${t.id}`);
    prefetchAdmin(`/api/admin/trainers/${t.id}/clients`);
  };

  if (error) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-6 px-10 py-8">
        <PageHeader actions={filter} title="Operaciones" />
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      </div>
    );
  }

  const k = data?.kpis;
  const s = data?.service;
  const a = data?.adoption;
  const dash = (v: (kp: Ops["kpis"]) => React.ReactNode) => (k ? v(k) : "—");
  const weeks = data?.weeks ?? [];

  return (
    <div
      aria-busy={refetching}
      className={`mx-auto max-w-[1440px] space-y-6 px-10 py-8 [&>*]:transition-opacity [&>*]:duration-150 ${refetching ? "[&>*:not(header)]:opacity-60" : ""}`}
    >
      <PageHeader
        actions={
          <>
            {filter}
            <button
              className={buttonClasses.secondary}
              disabled={refreshing}
              type="button"
              onClick={async () => {
                setRefreshing(true);
                await refresh();
                setRefreshing(false);
              }}
            >
              <Icon
                className={refreshing ? "animate-spin" : ""}
                icon="solar:refresh-linear"
                width={14}
              />
              Actualizar
            </button>
          </>
        }
        subtitle={
          data ? (
            <>
              {scope} · actualizado{" "}
              {formatRelative(data.generatedAt).toLowerCase()}
            </>
          ) : (
            scope
          )
        }
        title="Operaciones"
      />

      <MetricStrip
        items={[
          {
            label: "Clientes entrenando · 7 d",
            value: dash((kp) => num(kp.training7d)),
            hint: k ? delta(k.training7d, k.trainingPrev7d) : undefined,
          },
          {
            label: "Días de entreno · 7 d",
            value: dash((kp) => num(kp.trainingDays7d)),
            hint: k ? delta(k.trainingDays7d, k.trainingDaysPrev7d) : undefined,
          },
          {
            label: "Series registradas · 7 d",
            value: dash((kp) => num(kp.sets7d)),
            hint: k ? `${num(k.videos7d)} vídeos subidos` : undefined,
          },
          {
            label: "Check-ins · 7 d",
            value: dash((kp) => num(kp.checkins7d)),
            hint: k ? delta(k.checkins7d, k.checkinsPrev7d) : undefined,
          },
          {
            label: "Nuevos clientes · 30 d",
            value: dash((kp) => num(kp.newClients30d)),
            hint: k
              ? delta(k.newClients30d, k.newClientsPrev30d, "30 d anteriores")
              : undefined,
          },
          {
            label: "Entrenadores activos · 7 d",
            value: dash((kp) => `${kp.trainersLogin7d}`),
            hint: k ? `de ${k.trainers} entraron al panel` : undefined,
          },
        ]}
      />

      <div className="grid grid-cols-3 gap-6">
        <Panel
          className="col-span-2"
          subtitle="semanas móviles de 7 días"
          title="Clientes que entrenaron cada semana"
        >
          {weeks.length ? (
            <div key="ready" className="admin-fade-in">
              <WeeklyColumnChart
                points={weeks.map((w) => ({
                  weekEnd: w.end,
                  value: w.activeClients,
                  detail: `${num(w.trainingDays)} días de entreno · ${w.checkins} check-ins`,
                }))}
                unit="clientes"
              />
            </div>
          ) : (
            <div className="h-56 animate-pulse rounded-lg bg-slate-50" />
          )}
        </Panel>
        <Panel subtitle="altas por semana" title="Nuevos clientes">
          {weeks.length ? (
            <div key="ready" className="admin-fade-in">
              <WeeklyColumnChart
                points={weeks.map((w) => ({
                  weekEnd: w.end,
                  value: w.newClients,
                }))}
                unit="altas"
              />
            </div>
          ) : (
            <div className="h-56 animate-pulse rounded-lg bg-slate-50" />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Panel
          subtitle={scope.toLowerCase()}
          title="Servicio de los entrenadores"
        >
          {s ? (
            <StatList
              rows={[
                {
                  label: "Vídeos sin revisar",
                  hint: s.videosOldestPendingH
                    ? `subidos en 14 d · el más antiguo hace ${hours(s.videosOldestPendingH)}`
                    : "subidos en 14 d",
                  value: num(s.videosPending14d),
                  warn: s.videosPending14d > 0,
                },
                {
                  label: "Tiempo de revisión de vídeo",
                  hint: "mediana · 30 d",
                  value: hours(s.videoReviewMedianH),
                },
                {
                  label: "Vídeos revisados",
                  hint: "subidos en 30 d",
                  value:
                    s.videosReviewed30dPct === null
                      ? "—"
                      : `${s.videosReviewed30dPct}%`,
                },
                {
                  label: "Check-ins sin revisar",
                  hint: "enviados en 14 d",
                  value: num(s.checkinsPending14d),
                  warn: s.checkinsPending14d > 0,
                },
                {
                  label: "Mensajes de clientes sin leer",
                  value: num(s.unreadClientMessages),
                  warn: s.unreadClientMessages > 0,
                },
              ]}
            />
          ) : (
            <div className="h-56 animate-pulse rounded-lg bg-slate-50" />
          )}
        </Panel>

        <Panel
          subtitle={k ? `${num(k.clients)} clientes` : undefined}
          title="Retención"
        >
          {k ? (
            <StatList
              rows={[
                {
                  label: "Entrenaron en 30 días",
                  hint: `${Math.round((k.training30d / Math.max(1, k.clients)) * 100)}% del total`,
                  value: num(k.training30d),
                },
                {
                  label: "Entrenaron esta semana",
                  hint: `${Math.round((k.training7d / Math.max(1, k.training30d)) * 100)}% de los activos del mes`,
                  value: num(k.training7d),
                },
                {
                  label: "Dejaron de entrenar",
                  hint: "último entreno hace 14–60 días",
                  value: num(k.stoppedTraining),
                  warn: k.stoppedTraining > 0,
                },
                {
                  label: "Nunca han entrenado",
                  hint: "dados de alta hace más de 14 días",
                  value: num(k.neverTrained),
                },
                {
                  label: "Hábitos registrados · 7 d",
                  value: num(k.habits7d),
                },
              ]}
            />
          ) : (
            <div className="h-56 animate-pulse rounded-lg bg-slate-50" />
          )}
        </Panel>

        <Panel
          subtitle="entrenadores que la usan"
          title="Adopción de funciones"
        >
          {a ? (
            <ul className="space-y-3">
              {(
                [
                  ["Programas activos", a.programs],
                  ["Hábitos", a.habits],
                  ["Check-ins", a.checkins],
                  ["Nutrición", a.nutrition],
                  ["Revisión de vídeo", a.videos],
                  ["Chat", a.chat],
                ] as const
              ).map(([label, n]) => (
                <li key={label}>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="text-slate-600">{label}</span>
                    <span className="tabular-nums text-slate-900">
                      {n}
                      <span className="text-slate-400"> / {a.trainers}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${(n / Math.max(1, a.trainers)) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
              <li className="pt-1 text-[12px] text-slate-400">
                Uso en los últimos 30 días; programas y nutrición, activos hoy.
              </li>
            </ul>
          ) : (
            <div className="h-56 animate-pulse rounded-lg bg-slate-50" />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Panel
          subtitle="días de entreno · últimas 8 semanas"
          title="Qué días entrenan"
        >
          {data ? (
            <Distribution
              labels={WEEKDAYS}
              unit="días de entreno"
              values={data.weekday}
            />
          ) : (
            <div className="h-40 animate-pulse rounded-lg bg-slate-50" />
          )}
        </Panel>
        <Panel
          subtitle="hora de España · últimas 8 semanas"
          title="A qué hora registran"
        >
          {data ? (
            <Distribution
              labels={HOURS}
              showLabel={(i) => i % 3 === 0}
              unit="entrenos"
              values={data.hour}
            />
          ) : (
            <div className="h-40 animate-pulse rounded-lg bg-slate-50" />
          )}
        </Panel>
      </div>

      {alerts.length > 0 ? (
        <Panel
          subtitle={`${alerts.length} entrenadores`}
          title="Necesitan atención"
        >
          <ul className="grid grid-cols-2 gap-x-8">
            {alerts.map(({ t, reasons }) => (
              <li key={t.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50 active:bg-slate-100"
                  type="button"
                  onClick={() => open(t)}
                  onPointerEnter={() => warm(t)}
                >
                  <Avatar name={t.name ?? t.email} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-900">
                      {t.name ?? t.email}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {reasons.map((r) => (
                        <span
                          key={r}
                          className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700"
                        >
                          {r}
                        </span>
                      ))}
                    </span>
                  </span>
                  <Icon
                    className="shrink-0 text-slate-300"
                    icon="solar:alt-arrow-right-linear"
                    width={14}
                  />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <section>
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold text-slate-900">
            Por entrenador
          </h2>
          <span className="text-[12px] text-slate-400">
            Tendencia = activos esta semana vs su media de las 4 anteriores
          </span>
        </header>
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead className={tableClasses.thead}>
              <tr>
                <SortHeader
                  label="Entrenador"
                  sort={sort}
                  sortKey="name"
                  onSort={toggle}
                />
                <SortHeader
                  align="right"
                  label="Clientes"
                  sort={sort}
                  sortKey="clients"
                  onSort={toggle}
                />
                <SortHeader
                  align="right"
                  label="Activos 7 d"
                  sort={sort}
                  sortKey="active"
                  onSort={toggle}
                />
                <SortHeader
                  align="right"
                  label="Tendencia"
                  sort={sort}
                  sortKey="trend"
                  onSort={toggle}
                />
                <SortHeader
                  align="right"
                  label="Días entreno"
                  sort={sort}
                  sortKey="days"
                  onSort={toggle}
                />
                <SortHeader
                  align="right"
                  label="Check-ins 7 d"
                  sort={sort}
                  sortKey="checkins"
                  onSort={toggle}
                />
                <SortHeader
                  align="right"
                  label="Check-ins sin rev."
                  sort={sort}
                  sortKey="checkinsPending"
                  onSort={toggle}
                />
                <SortHeader
                  align="right"
                  label="Vídeos sin rev."
                  sort={sort}
                  sortKey="videos"
                  onSort={toggle}
                />
                <SortHeader
                  align="right"
                  label="Revisión vídeo"
                  sort={sort}
                  sortKey="review"
                  onSort={toggle}
                />
                <SortHeader
                  align="right"
                  label="Sin leer"
                  sort={sort}
                  sortKey="unread"
                  onSort={toggle}
                />
                <SortHeader
                  align="right"
                  label="Dejaron"
                  sort={sort}
                  sortKey="stopped"
                  onSort={toggle}
                />
                <SortHeader
                  label="Acceso"
                  sort={sort}
                  sortKey="login"
                  onSort={toggle}
                />
              </tr>
            </thead>
            <tbody
              key={isLoading ? "loading" : "ready"}
              className="admin-fade-in"
            >
              {isLoading ? (
                <SkeletonRows cols={12} />
              ) : (
                sorted.map((t) => (
                  <tr
                    key={t.id}
                    className={tableClasses.row}
                    onClick={() => open(t)}
                    onPointerEnter={() => warm(t)}
                  >
                    <td className={tableClasses.cell}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={t.name ?? t.email} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate font-medium text-slate-900">
                            {t.name ?? t.email}
                            {t.uses_nutrition ? (
                              <Icon
                                aria-label="Usa nutrición"
                                className="shrink-0 text-emerald-600"
                                icon="solar:leaf-linear"
                                width={13}
                              />
                            ) : null}
                          </div>
                          <div className="truncate text-[12px] text-slate-400">
                            /{t.slug ?? "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      className={`${tableClasses.cell} text-right tabular-nums`}
                    >
                      {t.clients}
                    </td>
                    <td
                      className={`${tableClasses.cell} text-right tabular-nums font-medium text-slate-900`}
                    >
                      {t.active7}
                    </td>
                    <td className={`${tableClasses.cell} text-right`}>
                      <TrendCell value={trend(t)} />
                    </td>
                    <td
                      className={`${tableClasses.cell} text-right tabular-nums text-slate-600`}
                    >
                      {t.training_days7}
                    </td>
                    <td
                      className={`${tableClasses.cell} text-right tabular-nums text-slate-600`}
                    >
                      {t.checkins7}
                    </td>
                    <td className={`${tableClasses.cell} text-right`}>
                      <Pending n={t.checkins_pending} warnAt={10} />
                    </td>
                    <td className={`${tableClasses.cell} text-right`}>
                      <Pending n={t.videos_pending} warnAt={15} />
                    </td>
                    <td
                      className={`${tableClasses.cell} text-right tabular-nums text-slate-600`}
                    >
                      {hours(t.video_review_h)}
                    </td>
                    <td className={`${tableClasses.cell} text-right`}>
                      <Pending n={t.unread_messages} warnAt={3} />
                    </td>
                    <td
                      className={`${tableClasses.cell} text-right tabular-nums text-slate-600`}
                    >
                      {t.stopped || <span className="text-slate-300">0</span>}
                    </td>
                    <td
                      className={`${tableClasses.cell} whitespace-nowrap text-slate-500`}
                    >
                      <RelativeTime iso={t.last_login_at} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
