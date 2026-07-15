"use client";

import type { ClientReadiness } from "./readiness-api";
import type { ReactNode } from "react";

import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Chip,
  Progress,
  Spinner,
} from "@heroui/react";
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

/** Wizard steps configuration — mirrors the platform setup wizard. */
const STEPS = [
  { key: 1, title: "Recetas", description: "Importa tu biblioteca" },
  { key: 2, title: "Clientes", description: "Qué verá cada uno" },
  { key: 3, title: "Novedades", description: "La nueva sección" },
  { key: 4, title: "Activar", description: "El cambio final" },
];

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

/**
 * The V1 → V2 rollout wizard: import recipes, review every client's
 * post-switch outcome (with real previews), learn the new section, and flip
 * the client-facing switch — reversibly. Entering the page auto-enables the
 * trainer tools (prepare mode); clients see nothing until step 4.
 *
 * One step per view with Atrás/Siguiente, progress bar and step pills —
 * the same pattern (and palette) as the platform setup wizard.
 */
export function NutritionUpdateContent() {
  const { data, isPending, isError } = useNutritionUpdateReadiness();
  // Shares the react-query cache with the embedded importer — no extra fetch.
  const { data: candidates } = useImportCandidates();
  const action = useNutritionUpdateAction();
  const [currentStep, setCurrentStep] = useState(1);
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

  const goBack = () => setCurrentStep((step) => Math.max(1, step - 1));
  const goNext = () =>
    setCurrentStep((step) => Math.min(STEPS.length, step + 1));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* Header — title + progress, setup-wizard style. */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-heading font-bold text-black">
                Actualización a Nutrición 2.0
              </h1>
              <p className="font-body text-gray-600">
                Prepara todo a tu ritmo — tus clientes no ven ningún cambio
                hasta el último paso.
              </p>
            </div>
            <Chip
              color={live ? "success" : "default"}
              size="sm"
              startContent={
                <Icon
                  icon={
                    live
                      ? "solar:check-circle-bold"
                      : "solar:hourglass-line-linear"
                  }
                  width={14}
                />
              }
              variant="flat"
            >
              {live ? "Activa" : "Preparación"}
            </Chip>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Paso {currentStep} de {STEPS.length}
              </span>
              <span className="text-gray-600">
                {Math.round((currentStep / STEPS.length) * 100)}%
              </span>
            </div>
            <Progress
              aria-label="Progreso de la actualización"
              className="w-full"
              value={(currentStep / STEPS.length) * 100}
            />
          </div>

          {/* Step pills — clickable; done = green, current = black circle. */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STEPS.map((step) => (
              <button
                key={step.key}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors duration-200 ${
                  currentStep === step.key
                    ? "bg-slate-100 border-slate-200"
                    : currentStep > step.key
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-200"
                }`}
                type="button"
                onClick={() => setCurrentStep(step.key)}
              >
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    currentStep === step.key
                      ? "bg-black text-white"
                      : currentStep > step.key
                        ? "bg-green-600 text-white"
                        : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {currentStep > step.key ? (
                    <Icon className="text-xs" icon="solar:unread-linear" />
                  ) : (
                    step.key
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm font-medium ${
                      currentStep >= step.key ? "text-black" : "text-gray-500"
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {step.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Step content — one step per view. */}
        <div className="p-6">
          {currentStep === 1 ? (
            <StepPanel
              status={
                totalCandidates > 0
                  ? `${importedCount} de ${totalCandidates} importadas`
                  : undefined
              }
              subtitle="Convierte las comidas de tus planes antiguos en recetas de tu biblioteca. Los totales del plan original se conservan exactos, y repetir este paso nunca crea duplicados."
              title="Importa tus recetas"
            >
              <RecipeImportContent />
            </StepPanel>
          ) : null}

          {currentStep === 2 ? (
            <StepPanel
              subtitle="Qué verá cada cliente en su sección de Nutrición tras el cambio. Toca «Vista previa» para verlo con sus datos reales."
              title="Revisa a tus clientes"
            >
              <ClientReviewStep
                clients={clients}
                counts={counts}
                onPreview={setPreview}
              />
            </StepPanel>
          ) : null}

          {currentStep === 3 ? (
            <StepPanel
              subtitle="Lo esencial de la nueva sección, en un minuto."
              title="Conoce la nueva nutrición"
            >
              <div className="flex flex-col gap-4">
                {VIDEO_URL !== null ? (
                  <div className="overflow-hidden rounded-xl border border-gray-200">
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
                      className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black text-white">
                        <Icon icon={feature.icon} width={18} />
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-medium text-black">
                          {feature.title}
                        </span>
                        <span className="text-xs leading-relaxed text-gray-500">
                          {feature.body}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </StepPanel>
          ) : null}

          {currentStep === 4 ? (
            <StepPanel
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
            </StepPanel>
          ) : null}
        </div>

        {/* Footer navigation — Atrás / Siguiente, setup-wizard style. */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <Button
            isDisabled={currentStep === 1}
            startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
            variant="light"
            onPress={goBack}
          >
            Atrás
          </Button>
          {currentStep < STEPS.length ? (
            <Button
              className="bg-slate-900 text-white"
              color="primary"
              endContent={<Icon icon="solar:arrow-right-linear" width={16} />}
              onPress={goNext}
            >
              Siguiente
            </Button>
          ) : null}
        </div>
      </div>

      <ClientPreviewModal client={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

/** A step's content area: heading + helper text + body. */
function StepPanel({
  title,
  subtitle,
  status,
  children,
}: {
  title: string;
  subtitle: string;
  status?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-black">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        {status !== undefined ? (
          <Chip size="sm" variant="flat">
            {status}
          </Chip>
        ) : null}
      </div>
      {children}
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
      <p className="py-4 text-center text-sm text-gray-500">
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
      iconClass: "text-warning-500",
      hidden: counts.atRisk === 0,
    },
    {
      key: "pdf",
      count: counts.pdf,
      label: "con PDF",
      icon: "solar:document-text-linear",
      iconClass: "text-green-600",
      hidden: false,
    },
    {
      key: "goals",
      count: counts.goals,
      label: "con objetivos",
      icon: "solar:target-linear",
      iconClass: "text-primary",
      hidden: false,
    },
    {
      key: "planV2",
      count: counts.planV2,
      label: "con plan nuevo",
      icon: "solar:clipboard-check-linear",
      iconClass: "text-gray-600",
      hidden: false,
    },
    {
      key: "none",
      count: counts.none,
      label: "sin dieta actual",
      icon: "solar:plate-linear",
      iconClass: "text-gray-400",
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
            className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
          >
            <Icon
              className={`shrink-0 ${tile.iconClass}`}
              icon={tile.icon}
              width={18}
            />
            <span className="text-lg font-bold text-black tabular-nums">
              {tile.count}
            </span>
            <span className="text-xs leading-tight text-gray-600">
              {tile.label}
            </span>
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
        iconClass="text-green-600"
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
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Icon className={iconClass} icon={icon} width={14} />
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

/** Initials avatar — consistent look without photos. */
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
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-colors duration-200 hover:bg-gray-50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
        {initialsOf(client.name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-black">
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
      <div className="flex flex-col items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-6 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white">
          <Icon icon="solar:check-read-linear" width={26} />
        </span>
        <p className="text-base font-semibold text-green-700">
          Nutrición 2.0 activa para tus clientes
        </p>
        <p className="max-w-sm text-xs text-gray-500">
          Volver no borra nada: tus recetas, planes y PDFs se conservan y puedes
          reactivar cuando quieras.
        </p>
        <div className="mt-1 flex flex-col items-center gap-2 sm:flex-row">
          <Button
            as={Link}
            className="bg-slate-900 text-white"
            color="primary"
            href="/trainer/dashboard/recipes"
            startContent={<Icon icon="solar:chef-hat-linear" width={16} />}
          >
            Ir a mis recetas
          </Button>
          <Button
            isLoading={busy}
            size="sm"
            variant="light"
            onPress={onRollback}
          >
            Volver a la versión anterior
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {atRisk > 0 ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-warning-200 bg-warning-50 p-4">
          <p className="flex items-start gap-2 text-sm text-gray-700">
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

      <div className="flex flex-col items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <p className="text-sm text-gray-600">
          Todo listo. Al activar, cada cliente verá exactamente lo que revisaste
          en el paso 2 — al instante y sin perder nada.
        </p>
        <Button
          className="bg-slate-900 text-white"
          color="primary"
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
        <p className="text-xs text-gray-500">
          Puedes volver a la versión anterior cuando quieras — no se pierde
          nada.
        </p>
      </div>
    </div>
  );
}
