"use client";

import { Icon } from "@iconify/react";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  addToast,
} from "@heroui/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

import AddTrainerModal from "@/components/admin/add-trainer-modal";
import {
  Avatar,
  MetricStrip,
  PageHeader,
  RelativeTime,
  SearchField,
  SegmentedControl,
  SkeletonRows,
  SortHeader,
  daysSince,
  formatDate,
  tableClasses,
  useSort,
} from "@/components/admin/admin-ui";
import DeleteTrainerModal from "@/components/admin/delete-trainer-modal";
import { prefetchAdmin, useAdminData } from "@/lib/admin/use-admin-data";

type SubscriptionStatus = "active" | "paused" | "cancelled";

interface Trainer {
  id: string;
  email: string;
  full_name: string;
  tenant_host: string | null;
  tenant_slug: string | null;
  tenant_status: string | null;
  subscription_status: SubscriptionStatus;
  status: "active" | "inactive";
  password_set_at: string | null;
  invited_at: string;
  last_login_at: string | null;
  created_at: string;
  onboarding_completed: boolean;
  nutrition_v2_enabled: boolean;
  clientCount: number;
  activeClients7d: number;
  activeClients30d: number;
  lastClientActivityAt: string | null;
}

type Filter = "all" | "inactive" | "onboarding" | "no_password" | "suspended";

const FILTERS: Record<Filter, (t: Trainer) => boolean> = {
  all: () => true,
  inactive: (t) => daysSince(t.last_login_at) > 30,
  onboarding: (t) => !t.onboarding_completed,
  no_password: (t) => !t.password_set_at,
  suspended: (t) => t.subscription_status !== "active",
};

type SortKey =
  | "name"
  | "clients"
  | "active"
  | "clientActivity"
  | "login"
  | "created";

const SORT_ACCESSORS: Record<SortKey, (t: Trainer) => string | number | null> =
  {
    name: (t) => t.full_name,
    clients: (t) => t.clientCount,
    active: (t) => t.activeClients7d,
    clientActivity: (t) => t.lastClientActivityAt,
    login: (t) => t.last_login_at,
    created: (t) => t.created_at,
  };

const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = {
  active: "Activa",
  paused: "Pausada",
  cancelled: "Cancelada",
};

function Badge({
  tone,
  children,
}: {
  tone: "amber" | "red" | "gray";
  children: React.ReactNode;
}) {
  const cls = {
    amber: "bg-amber-50 text-amber-700 ring-amber-600/15",
    red: "bg-red-50 text-red-700 ring-red-600/15",
    gray: "bg-slate-50 text-slate-500 ring-slate-500/15",
  }[tone];

  return (
    <span
      className={`inline-flex h-[18px] items-center rounded px-1.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  );
}

function pct(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export default function TrainersManagementPage() {
  const router = useRouter();
  const {
    data,
    error: loadError,
    isLoading,
    refresh: fetchTrainers,
  } = useAdminData<{ trainers: Trainer[] }>("/api/admin/trainers");
  const trainers = React.useMemo(() => data?.trainers ?? [], [data]);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [trainerToDelete, setTrainerToDelete] = React.useState<Trainer | null>(
    null
  );

  const handleUpdateSubscription = async (
    trainerId: string,
    newStatus: SubscriptionStatus
  ) => {
    setBusyId(trainerId);

    try {
      const response = await fetch(`/api/admin/trainers/${trainerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subscriptionStatus: newStatus }),
      });

      if (!response.ok) throw new Error("Error updating subscription");
      await fetchTrainers();
      addToast({
        title: `Suscripción ${SUBSCRIPTION_LABEL[newStatus].toLowerCase()}`,
        color: "success",
      });
    } catch (error) {
      console.error("Error updating subscription:", error);
      addToast({
        title: "No se pudo actualizar la suscripción",
        color: "danger",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleImpersonate = async (trainerId: string) => {
    setBusyId(trainerId);

    try {
      const response = await fetch(
        `/api/admin/trainers/${trainerId}/impersonate`,
        { method: "POST", credentials: "include" }
      );
      const data = await response.json();

      if (!response.ok)
        throw new Error(data.error || "Error al generar enlace");
      window.open(data.url, "_blank");
    } catch (error) {
      console.error("Error impersonating trainer:", error);
      addToast({
        title: "No se pudo acceder a la cuenta del entrenador",
        color: "danger",
      });
    } finally {
      setBusyId(null);
    }
  };

  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(FILTERS) as Filter[]).map((k) => [
          k,
          trainers.filter(FILTERS[k]).length,
        ])
      ) as Record<Filter, number>,
    [trainers]
  );

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase();

    return trainers.filter(
      (t) =>
        FILTERS[filter](t) &&
        (!term ||
          [t.full_name, t.email, t.tenant_slug ?? ""].some((v) =>
            v.toLowerCase().includes(term)
          ))
    );
  }, [trainers, filter, search]);

  const { sorted, sort, toggle } = useSort(visible, SORT_ACCESSORS, {
    key: "clients",
    dir: "desc",
  });

  const totals = React.useMemo(() => {
    const clients = trainers.reduce((n, t) => n + t.clientCount, 0);
    const active7 = trainers.reduce((n, t) => n + t.activeClients7d, 0);
    const active30 = trainers.reduce((n, t) => n + t.activeClients30d, 0);
    const trainersActive = trainers.filter(
      (t) => daysSince(t.last_login_at) <= 30
    ).length;

    return { clients, active7, active30, trainersActive };
  }, [trainers]);

  const segments = [
    { key: "all" as const, label: "Todos", count: counts.all },
    {
      key: "inactive" as const,
      label: "Sin acceso 30 d",
      count: counts.inactive,
    },
    {
      key: "onboarding" as const,
      label: "Onboarding pendiente",
      count: counts.onboarding,
    },
    {
      key: "no_password" as const,
      label: "Sin contraseña",
      count: counts.no_password,
    },
    ...(counts.suspended > 0
      ? [
          {
            key: "suspended" as const,
            label: "Pausados o cancelados",
            count: counts.suspended,
          },
        ]
      : []),
  ];

  const taken = React.useMemo(
    () => ({
      emails: new Set(trainers.map((t) => t.email.toLowerCase())),
      slugs: new Set(
        trainers.flatMap((t) =>
          [t.tenant_slug, t.tenant_host].filter((v): v is string => !!v)
        )
      ),
    }),
    [trainers]
  );

  const loading = isLoading && trainers.length === 0;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-10 py-8">
      <PageHeader
        actions={
          <button
            className="flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[13px] font-medium text-white transition-transform duration-100 hover:bg-slate-800 active:scale-[0.97]"
            type="button"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Icon icon="solar:add-circle-linear" width={16} />
            Nuevo entrenador
          </button>
        }
        subtitle={
          loading
            ? "Cargando…"
            : `${trainers.length} entrenadores · ${totals.clients} clientes`
        }
        title="Entrenadores"
      />

      <MetricStrip
        items={[
          {
            label: "Entrenadores",
            value: loading ? "—" : trainers.length,
            hint: loading
              ? null
              : `${totals.trainersActive} con acceso en 30 días`,
          },
          {
            label: "Clientes",
            value: loading ? "—" : totals.clients,
            hint: loading
              ? null
              : `${(totals.clients / Math.max(trainers.length, 1)).toFixed(1)} por entrenador`,
          },
          {
            label: "Clientes activos · 7 días",
            value: loading ? "—" : totals.active7,
            hint: loading
              ? null
              : `${pct(totals.active7, totals.clients)}% del total`,
          },
          {
            label: "Clientes activos · 30 días",
            value: loading ? "—" : totals.active30,
            hint: loading
              ? null
              : `${pct(totals.active30, totals.clients)}% del total`,
          },
          {
            label: "Onboarding pendiente",
            value: loading ? "—" : counts.onboarding,
            hint: loading ? null : `${counts.no_password} sin contraseña`,
          },
        ]}
      />

      <div className="flex items-center justify-between gap-4">
        <SegmentedControl
          segments={segments}
          value={filter}
          onChange={setFilter}
        />
        <SearchField
          placeholder="Buscar nombre, email o portal"
          value={search}
          onChange={setSearch}
        />
      </div>

      {loadError ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          No se pudieron cargar los entrenadores.
          <button
            className="font-medium underline-offset-2 hover:underline"
            type="button"
            onClick={fetchTrainers}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      <div className={tableClasses.wrapper}>
        <table className={tableClasses.table}>
          <thead className={tableClasses.thead}>
            <tr>
              <SortHeader
                className="pl-4"
                label="Entrenador"
                sort={sort}
                sortKey="name"
                onSort={toggle}
              />
              <th className="px-3 py-2 text-left font-medium" scope="col">
                Portal
              </th>
              <SortHeader
                align="right"
                label="Clientes"
                sort={sort}
                sortKey="clients"
                onSort={toggle}
              />
              <SortHeader
                label="Activos 7 d"
                sort={sort}
                sortKey="active"
                onSort={toggle}
              />
              <SortHeader
                label="Actividad clientes"
                sort={sort}
                sortKey="clientActivity"
                onSort={toggle}
              />
              <SortHeader
                label="Acceso entrenador"
                sort={sort}
                sortKey="login"
                onSort={toggle}
              />
              <SortHeader
                label="Alta"
                sort={sort}
                sortKey="created"
                onSort={toggle}
              />
              <th className="w-24 px-3 py-2" scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody
            key={loading ? "loading" : "ready"}
            className={loading ? undefined : "admin-fade-in"}
          >
            {loading ? (
              <SkeletonRows cols={8} />
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-16 text-center text-slate-500"
                  colSpan={8}
                >
                  {search
                    ? `Nada coincide con “${search}”.`
                    : "No hay entrenadores en este filtro."}
                </td>
              </tr>
            ) : (
              sorted.map((t) => {
                const href = `/admin/dashboard/trainers/${t.id}`;
                const share = pct(t.activeClients7d, t.clientCount);

                return (
                  <tr
                    key={t.id}
                    className={tableClasses.row}
                    onClick={() => router.push(href)}
                    onPointerEnter={() => {
                      // Warm the detail page so the click opens with data.
                      router.prefetch(href);
                      prefetchAdmin(`/api/admin/trainers/${t.id}`);
                      prefetchAdmin(`/api/admin/trainers/${t.id}/clients`);
                    }}
                  >
                    <td className={`${tableClasses.cell} pl-4`}>
                      <div className="flex items-center gap-3">
                        <Avatar name={t.full_name} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <NextLink
                              className="truncate font-medium text-slate-900"
                              href={href}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {t.full_name}
                            </NextLink>
                            {t.subscription_status !== "active" ? (
                              <Badge tone="red">
                                {SUBSCRIPTION_LABEL[t.subscription_status]}
                              </Badge>
                            ) : null}
                            {!t.onboarding_completed ? (
                              <Badge tone="amber">Onboarding</Badge>
                            ) : null}
                            {!t.password_set_at ? (
                              <Badge tone="amber">Sin contraseña</Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-[12px] text-slate-500">
                            {t.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={tableClasses.cell}>
                      {t.tenant_slug ? (
                        <a
                          className="inline-flex items-center gap-1 font-mono text-[12px] text-slate-500 hover:text-slate-900"
                          href={`/${t.tenant_slug}`}
                          rel="noopener noreferrer"
                          target="_blank"
                          title="Abrir portal del cliente"
                          onClick={(e) => e.stopPropagation()}
                        >
                          /{t.tenant_slug}
                          <Icon
                            className="opacity-0 group-hover:opacity-100"
                            icon="solar:arrow-right-up-linear"
                            width={12}
                          />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td
                      className={`${tableClasses.cell} text-right font-medium tabular-nums ${t.clientCount === 0 ? "text-slate-400" : "text-slate-900"}`}
                    >
                      {t.clientCount}
                    </td>
                    <td className={tableClasses.cell}>
                      {t.clientCount === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-right tabular-nums text-slate-700">
                            {t.activeClients7d}
                          </span>
                          <span className="h-1 w-16 overflow-hidden rounded-full bg-slate-100">
                            <span
                              className="block h-full rounded-full bg-emerald-500"
                              style={{ width: `${share}%` }}
                            />
                          </span>
                          <span className="text-[12px] tabular-nums text-slate-400">
                            {share}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className={tableClasses.cell}>
                      <RelativeTime
                        iso={t.lastClientActivityAt}
                        staleAfterDays={7}
                      />
                    </td>
                    <td className={tableClasses.cell}>
                      <RelativeTime iso={t.last_login_at} />
                    </td>
                    <td className={`${tableClasses.cell} text-slate-500`}>
                      {formatDate(t.created_at)}
                    </td>
                    <td
                      className={`${tableClasses.cell} pr-3`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="h-7 rounded-md px-2 text-[12px] font-medium text-slate-600 opacity-0 transition-opacity hover:bg-slate-200/60 hover:text-slate-900 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                          disabled={busyId === t.id}
                          title="Abrir su panel en una pestaña nueva"
                          type="button"
                          onClick={() => handleImpersonate(t.id)}
                        >
                          Entrar
                        </button>
                        <Dropdown placement="bottom-end">
                          <DropdownTrigger>
                            <button
                              aria-label={`Más acciones para ${t.full_name}`}
                              className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-900"
                              type="button"
                            >
                              <Icon icon="solar:menu-dots-bold" width={16} />
                            </button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Acciones">
                            <DropdownSection showDivider>
                              <DropdownItem
                                key="details"
                                startContent={<Icon icon="solar:eye-linear" />}
                                onPress={() => router.push(href)}
                              >
                                Ver detalle y clientes
                              </DropdownItem>
                              <DropdownItem
                                key="impersonate"
                                startContent={
                                  <Icon icon="solar:login-3-linear" />
                                }
                                onPress={() => handleImpersonate(t.id)}
                              >
                                Entrar como entrenador
                              </DropdownItem>
                            </DropdownSection>
                            <DropdownSection showDivider title="Suscripción">
                              {(["active", "paused", "cancelled"] as const)
                                .filter((s) => s !== t.subscription_status)
                                .map((s) => (
                                  <DropdownItem
                                    key={s}
                                    onPress={() =>
                                      handleUpdateSubscription(t.id, s)
                                    }
                                  >
                                    {s === "active"
                                      ? "Activar"
                                      : s === "paused"
                                        ? "Pausar"
                                        : "Cancelar"}
                                  </DropdownItem>
                                ))}
                            </DropdownSection>
                            <DropdownSection>
                              <DropdownItem
                                key="delete"
                                className="text-danger"
                                color="danger"
                                startContent={
                                  <Icon icon="solar:trash-bin-trash-linear" />
                                }
                                onPress={() => setTrainerToDelete(t)}
                              >
                                Eliminar permanentemente
                              </DropdownItem>
                            </DropdownSection>
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && trainers.length > 0 ? (
        <p className="text-[12px] text-slate-400 tabular-nums">
          Mostrando {sorted.length} de {trainers.length}
        </p>
      ) : null}

      <AddTrainerModal
        isOpen={isAddModalOpen}
        takenEmails={taken.emails}
        takenSlugs={taken.slugs}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={fetchTrainers}
      />

      {trainerToDelete && (
        <DeleteTrainerModal
          isOpen={!!trainerToDelete}
          trainerId={trainerToDelete.id}
          trainerName={trainerToDelete.full_name}
          onClose={() => setTrainerToDelete(null)}
          onSuccess={() => {
            setTrainerToDelete(null);
            fetchTrainers();
          }}
        />
      )}
    </div>
  );
}
