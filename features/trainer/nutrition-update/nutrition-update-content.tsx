"use client";

import type { ClientReadiness } from "./readiness-api";
import type { ReactNode } from "react";

import { Button, Card, CardBody, Checkbox, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ClientPreviewModal } from "./client-preview-modal";
import { summarizeVerdicts } from "./readiness-api";
import {
  useNutritionUpdateAction,
  useNutritionUpdateReadiness,
} from "./use-nutrition-update";

import { RecipeImportContent } from "@/features/trainer/recipes/import/import-content";
import { useImportCandidates } from "@/features/trainer/recipes/import/use-import";

/** Announcement video (José Carlos records it for the launch); null hides it. */
const VIDEO_URL: string | null = null;

const FEATURE_BULLETS: { icon: string; title: string; body: string }[] = [
  {
    icon: "solar:chef-hat-linear",
    title: "Recetas reutilizables",
    body: "Con fotos, video y macros exactos — créalas una vez, úsalas en todos tus planes.",
  },
  {
    icon: "solar:layers-minimalistic-linear",
    title: "Planes por menús",
    body: "El cliente elige entre las alternativas que tú defines para cada comida.",
  },
  {
    icon: "solar:target-linear",
    title: "Objetivos por día",
    body: "Entrenamiento, descanso… cada día mide su progreso contra su propio objetivo.",
  },
  {
    icon: "solar:document-text-linear",
    title: "PDFs y objetivos siguen funcionando",
    body: "Cada cliente ve lo suyo: plan nuevo, su PDF de siempre o solo sus metas.",
  },
];

type StepState = "done" | "current" | "pending";

/**
 * The V1 → V2 rollout wizard: import recipes, review every client's
 * post-switch outcome (with real previews), learn the new section, and flip
 * the client-facing switch — reversibly. Entering the page auto-enables the
 * trainer tools (prepare mode); clients see nothing until step 4.
 *
 * Layout: guided funnel — a hero with overall progress, a step rail
 * (sticky on desktop, horizontal on mobile) and one anchored panel per step.
 * Steps are freely revisitable; nothing is a locked tour.
 */
export function NutritionUpdateContent() {
  const { data, isPending, isError } = useNutritionUpdateReadiness();
  // Shares the react-query cache with the embedded importer — no extra fetch.
  const { data: candidates } = useImportCandidates();
  const action = useNutritionUpdateAction();
  const [preview, setPreview] = useState<ClientReadiness | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  // Fire the prepare-mode enable exactly once per visit.
  const enabledOnce = useRef(false);

  useEffect(() => {
    if (
      enabledOnce.current === false &&
      data !== undefined &&
      data.flags.trainerEnabled === false
    ) {
      enabledOnce.current = true;
      action.mutate("enable_trainer");
    }
  }, [data, action]);

  if (isPending) {
    return (
      <div className="flex justify-center py-24">
        <Spinner color="primary" />
      </div>
    );
  }

  if (isError || data === undefined) {
    return (
      <Card className="mx-auto mt-10 max-w-xl border border-gray-200 bg-white">
        <CardBody className="p-8 text-center text-sm text-default-500">
          No pudimos cargar el estado de la actualización. Vuelve a intentarlo
          en un momento.
        </CardBody>
      </Card>
    );
  }

  const { flags, clients } = data;
  const counts = summarizeVerdicts(clients);
  const live = flags.enabled;

  const totalCandidates = candidates?.length ?? 0;
  const importedCount =
    candidates?.filter((candidate) => candidate.alreadyImported === true)
      .length ?? 0;
  const importDone = totalCandidates > 0 && importedCount > 0;

  // Step states drive the rail + section badges. Nothing is ever locked.
  const stepStates: StepState[] = live
    ? ["done", "done", "done", "done"]
    : [
        importDone ? "done" : "current",
        counts.atRisk === 0 && clients.length > 0 ? "done" : "pending",
        "pending",
        "pending",
      ];
  const doneCount = stepStates.filter((state) => state === "done").length;

  const steps = [
    { id: "paso-1", title: "Importa tus recetas" },
    { id: "paso-2", title: "Revisa a tus clientes" },
    { id: "paso-3", title: "Conoce la nueva nutrición" },
    { id: "paso-4", title: "Activa el cambio" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Hero — dark band: title, promise, status and overall progress. */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">
              <Icon icon="solar:magic-stick-3-linear" width={14} />
              Nutrición 2.0
            </span>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              Actualización a Nutrición 2.0
            </h1>
            <p className="max-w-xl text-sm text-slate-300">
              Prepara todo a tu ritmo y en el orden que quieras. Tus clientes no
              ven ningún cambio hasta que tú actives el paso 4 — y siempre
              puedes volver atrás.
            </p>
          </div>
          <Chip
            classNames={{
              base: live
                ? "bg-emerald-400/15 border border-emerald-300/30"
                : "bg-white/10 border border-white/15",
              content: live ? "text-emerald-300" : "text-slate-200",
            }}
            startContent={
              <Icon
                icon={
                  live
                    ? "solar:check-circle-bold"
                    : "solar:hourglass-line-linear"
                }
                width={16}
              />
            }
            variant="flat"
          >
            {live ? "Activa para tus clientes" : "Modo preparación"}
          </Chip>
        </div>

        {/* Overall progress — 4 segments, one per step. */}
        <div className="mt-6 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Tu progreso</span>
            <span className="tabular-nums">{doneCount} de 4 pasos</span>
          </div>
          <div className="flex gap-1.5" role="presentation">
            {stepStates.map((state, index) => (
              <span
                key={steps[index]?.id ?? index}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  state === "done"
                    ? "bg-emerald-400"
                    : state === "current"
                      ? "bg-white/70"
                      : "bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[220px,minmax(0,1fr)]">
        {/* Step rail — sticky vertical on desktop, horizontal scroll on mobile. */}
        <nav
          aria-label="Pasos de la actualización"
          className="lg:sticky lg:top-6 lg:self-start"
        >
          <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible">
            {steps.map((step, index) => (
              <li key={step.id} className="lg:relative lg:pb-2">
                {/* Connector line (desktop only). */}
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute left-[15px] top-9 hidden h-[calc(100%-2rem)] w-px bg-gray-200 lg:block"
                  />
                ) : null}
                <a
                  className="flex shrink-0 cursor-pointer items-center gap-3 rounded-large px-2 py-2 transition-colors duration-200 hover:bg-gray-100"
                  href={`#${step.id}`}
                >
                  <StepBullet
                    index={index}
                    state={stepStates[index] ?? "pending"}
                  />
                  <span
                    className={`whitespace-nowrap text-sm lg:whitespace-normal ${
                      stepStates[index] === "pending"
                        ? "text-default-400"
                        : "font-medium text-gray-900"
                    }`}
                  >
                    {step.title}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <StepSection
            id="paso-1"
            index={0}
            state={stepStates[0] ?? "pending"}
            status={
              totalCandidates > 0
                ? `${importedCount} de ${totalCandidates} importadas`
                : undefined
            }
            subtitle="Convierte las comidas de tus planes antiguos en recetas de tu biblioteca. Los totales del plan original se conservan exactos, y repetir este paso nunca crea duplicados."
            title="Importa tus recetas"
          >
            <RecipeImportContent />
          </StepSection>

          <StepSection
            id="paso-2"
            index={1}
            state={stepStates[1] ?? "pending"}
            status={
              clients.length > 0
                ? `${clients.length} ${clients.length === 1 ? "cliente" : "clientes"}`
                : undefined
            }
            subtitle="Qué verá cada cliente en su sección de Nutrición tras el cambio. Toca «Vista previa» para verlo con sus datos reales."
            title="Revisa a tus clientes"
          >
            <ClientReviewStep
              clients={clients}
              counts={counts}
              onPreview={setPreview}
            />
          </StepSection>

          <StepSection
            id="paso-3"
            index={2}
            state={stepStates[2] ?? "pending"}
            subtitle="Lo esencial de la nueva sección, en un minuto."
            title="Conoce la nueva nutrición"
          >
            <div className="flex flex-col gap-4">
              {VIDEO_URL !== null ? (
                <div className="overflow-hidden rounded-2xl border border-gray-200">
                  <iframe
                    allowFullScreen
                    className="aspect-video w-full"
                    src={VIDEO_URL}
                    title="Nutrición 2.0"
                  />
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {FEATURE_BULLETS.map((feature) => (
                  <div
                    key={feature.title}
                    className="flex gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 transition-colors duration-200 hover:border-gray-200"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <Icon icon={feature.icon} width={18} />
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="text-sm font-semibold text-gray-900">
                        {feature.title}
                      </p>
                      <p className="text-xs leading-relaxed text-default-500">
                        {feature.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </StepSection>

          <StepSection
            id="paso-4"
            index={3}
            state={stepStates[3] ?? "pending"}
            subtitle={
              live
                ? "Tus clientes ya usan la nueva nutrición."
                : "Cuando actives, cada cliente verá lo del paso 2 — al instante."
            }
            title="Activa el cambio"
          >
            <ActivateStep
              acknowledged={acknowledged}
              atRisk={counts.atRisk}
              busy={action.isPending}
              live={live}
              onAcknowledge={setAcknowledged}
              onActivate={() => action.mutate("activate_clients")}
              onRollback={() => action.mutate("deactivate_clients")}
            />
          </StepSection>
        </div>
      </div>

      <ClientPreviewModal client={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

// ─── Step scaffolding ────────────────────────────────────────────────────────

function StepBullet({ index, state }: { index: number; state: StepState }) {
  return (
    <span
      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-200 ${
        state === "done"
          ? "bg-emerald-500 text-white"
          : state === "current"
            ? "bg-slate-900 text-white"
            : "border border-gray-300 bg-white text-default-400"
      }`}
    >
      {state === "done" ? (
        <Icon icon="solar:check-read-linear" width={18} />
      ) : (
        index + 1
      )}
    </span>
  );
}

function StepSection({
  id,
  index,
  state,
  title,
  subtitle,
  status,
  children,
}: {
  id: string;
  index: number;
  state: StepState;
  title: string;
  subtitle: string;
  status?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
      id={id}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4">
        <StepBullet index={index} state={state} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2
            className="text-base font-semibold text-gray-900"
            id={`${id}-title`}
          >
            {title}
          </h2>
          <p className="text-xs text-default-500">{subtitle}</p>
        </div>
        {status !== undefined ? (
          <Chip size="sm" variant="flat">
            {status}
          </Chip>
        ) : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ─── Step 2: client review ───────────────────────────────────────────────────

const VERDICT_UI: Record<
  ClientReadiness["verdict"],
  {
    label: string;
    icon: string;
    chip: "success" | "primary" | "warning" | "default";
  }
> = {
  plan_v2: {
    label: "Plan nuevo activo",
    icon: "solar:clipboard-check-linear",
    chip: "default",
  },
  pdf: {
    label: "Verá su PDF",
    icon: "solar:document-text-linear",
    chip: "success",
  },
  goals: {
    label: "Verá sus objetivos",
    icon: "solar:target-linear",
    chip: "primary",
  },
  at_risk: {
    label: "Sin dieta visible",
    icon: "solar:danger-triangle-bold",
    chip: "warning",
  },
  none: {
    label: "Sin dieta actual",
    icon: "solar:plate-linear",
    chip: "default",
  },
};

function ClientReviewStep({
  clients,
  counts,
  onPreview,
}: {
  clients: ClientReadiness[];
  counts: ReturnType<typeof summarizeVerdicts>;
  onPreview: (client: ClientReadiness) => void;
}) {
  if (clients.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-default-500">
        Aún no tienes clientes activos.
      </p>
    );
  }

  const tiles = [
    {
      key: "atRisk",
      count: counts.atRisk,
      label: "sin dieta visible",
      icon: "solar:danger-triangle-bold",
      tone: "text-warning-600 bg-warning-50 border-warning-200",
      hidden: counts.atRisk === 0,
    },
    {
      key: "pdf",
      count: counts.pdf,
      label: "con PDF",
      icon: "solar:document-text-linear",
      tone: "text-success-600 bg-success-50 border-success-200",
      hidden: false,
    },
    {
      key: "goals",
      count: counts.goals,
      label: "con objetivos",
      icon: "solar:target-linear",
      tone: "text-primary bg-primary-50 border-primary-100",
      hidden: false,
    },
    {
      key: "planV2",
      count: counts.planV2,
      label: "con plan nuevo",
      icon: "solar:clipboard-check-linear",
      tone: "text-default-600 bg-gray-50 border-gray-200",
      hidden: false,
    },
    {
      key: "none",
      count: counts.none,
      label: "sin dieta actual",
      icon: "solar:plate-linear",
      tone: "text-default-500 bg-gray-50 border-gray-200",
      hidden: counts.none === 0,
    },
  ].filter((tile) => tile.hidden === false);

  const atRisk = clients.filter((client) => client.verdict === "at_risk");
  const ready = clients.filter((client) => client.verdict !== "at_risk");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${tile.tone}`}
          >
            <Icon className="shrink-0" icon={tile.icon} width={18} />
            <span className="text-lg font-bold tabular-nums">{tile.count}</span>
            <span className="text-xs leading-tight">{tile.label}</span>
          </div>
        ))}
      </div>

      {atRisk.length > 0 ? (
        <ClientGroup
          icon="solar:danger-triangle-bold"
          iconClass="text-warning-500"
          title="Necesitan tu atención antes de activar"
        >
          {atRisk.map((client) => (
            <ClientRow
              key={client.clientId}
              client={client}
              onPreview={onPreview}
            />
          ))}
        </ClientGroup>
      ) : null}

      <ClientGroup
        icon="solar:check-circle-linear"
        iconClass="text-success-500"
        title="Listos para el cambio"
      >
        {ready.map((client) => (
          <ClientRow
            key={client.clientId}
            client={client}
            onPreview={onPreview}
          />
        ))}
      </ClientGroup>
    </div>
  );
}

function ClientGroup({
  title,
  icon,
  iconClass,
  children,
}: {
  title: string;
  icon: string;
  iconClass: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-default-500">
        <Icon className={iconClass} icon={icon} width={14} />
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

/** Initials avatar — consistent tint per name, no photos needed. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function ClientRow({
  client,
  onPreview,
}: {
  client: ClientReadiness;
  onPreview: (client: ClientReadiness) => void;
}) {
  const ui = VERDICT_UI[client.verdict];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 transition-colors duration-200 hover:border-gray-300 hover:bg-gray-50/60">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
        {initialsOf(client.name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
        {client.name}
      </span>
      <Chip
        color={ui.chip}
        size="sm"
        startContent={<Icon icon={ui.icon} width={13} />}
        variant="flat"
      >
        {ui.label}
      </Chip>
      {client.verdict === "at_risk" ? (
        <Button
          as={Link}
          color="warning"
          href={`/trainer/dashboard/clients/${client.clientId}?tab=nutrition`}
          size="sm"
          startContent={<Icon icon="solar:add-circle-linear" width={15} />}
          variant="flat"
        >
          Crear plan
        </Button>
      ) : (
        <Button
          size="sm"
          startContent={<Icon icon="solar:smartphone-linear" width={15} />}
          variant="bordered"
          onPress={() => onPreview(client)}
        >
          Vista previa
        </Button>
      )}
    </div>
  );
}

// ─── Step 4: activation ──────────────────────────────────────────────────────

function ActivateStep({
  live,
  atRisk,
  acknowledged,
  busy,
  onAcknowledge,
  onActivate,
  onRollback,
}: {
  live: boolean;
  atRisk: number;
  acknowledged: boolean;
  busy: boolean;
  onAcknowledge: (value: boolean) => void;
  onActivate: () => void;
  onRollback: () => void;
}) {
  if (live) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-success-50 px-6 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-500 text-white">
          <Icon icon="solar:check-read-linear" width={26} />
        </span>
        <p className="text-base font-semibold text-success-700">
          Nutrición 2.0 activa para tus clientes
        </p>
        <p className="max-w-sm text-xs text-default-500">
          Volver no borra nada: tus recetas, planes y PDFs se conservan y puedes
          reactivar cuando quieras.
        </p>
        <Button
          isLoading={busy}
          size="sm"
          variant="bordered"
          onPress={onRollback}
        >
          Volver a la versión anterior
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {atRisk > 0 ? (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-warning-200 bg-warning-50 p-4">
          <p className="flex items-start gap-2 text-sm text-warning-700">
            <Icon
              className="mt-0.5 shrink-0"
              icon="solar:danger-triangle-bold"
              width={17}
            />
            <span>
              <span className="font-semibold">
                {atRisk} {atRisk === 1 ? "cliente" : "clientes"} con plan
                antiguo estructurado
              </span>{" "}
              — se quedarán sin dieta visible hasta que les crees un plan nuevo
              o les subas un PDF.
            </span>
          </p>
          <Checkbox
            isSelected={acknowledged}
            size="sm"
            onValueChange={onAcknowledge}
          >
            <span className="text-xs">
              Lo entiendo, quiero activar de todas formas
            </span>
          </Checkbox>
        </div>
      ) : null}

      <div className="flex flex-col items-start gap-3 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
        <p className="text-sm text-slate-300">
          Todo listo. Al activar, cada cliente verá exactamente lo que revisaste
          en el paso 2 — al instante y sin perder nada.
        </p>
        <Button
          className="bg-white font-semibold text-slate-900"
          isDisabled={atRisk > 0 && acknowledged === false}
          isLoading={busy}
          size="lg"
          startContent={
            busy ? null : <Icon icon="solar:rocket-2-linear" width={18} />
          }
          onPress={onActivate}
        >
          Activar Nutrición 2.0 para mis clientes
        </Button>
        <p className="text-xs text-slate-400">
          Puedes volver a la versión anterior cuando quieras — no se pierde
          nada.
        </p>
      </div>
    </div>
  );
}
