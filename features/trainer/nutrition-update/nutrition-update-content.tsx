"use client";

import type { ClientReadiness } from "./readiness-api";

import { Button, Card, CardBody, Checkbox, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ClientPreviewModal } from "./client-preview-modal";
import { summarizeVerdicts } from "./readiness-api";
import {
  useNutritionUpdateAction,
  useNutritionUpdateReadiness,
} from "./use-nutrition-update";

import { RecipeImportContent } from "@/features/trainer/recipes/import/import-content";

/** Announcement video (José Carlos records it for the launch); null hides it. */
const VIDEO_URL: string | null = null;

const FEATURE_BULLETS = [
  "Recetas reutilizables con fotos, video y macros exactos.",
  "Planes por menús: el cliente elige entre las alternativas que definas.",
  "Objetivos por día (entrenamiento, descanso…) con progreso automático.",
  "PDFs y dietas por objetivos siguen funcionando — cada cliente ve lo suyo.",
];

/**
 * The V1 → V2 rollout wizard: import recipes, review every client's
 * post-switch outcome (with real previews), learn the new section, and flip
 * the client-facing switch — reversibly. Entering the page auto-enables the
 * trainer tools (prepare mode); clients see nothing until step 4.
 */
export function NutritionUpdateContent() {
  const { data, isPending, isError } = useNutritionUpdateReadiness();
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
      <Card className="border border-gray-200 bg-white">
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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-gray-900">
            Actualización a Nutrición 2.0
          </h1>
          <p className="text-sm text-default-500">
            Prepara todo a tu ritmo — tus clientes no ven ningún cambio hasta el
            paso 4.
          </p>
        </div>
        <Chip
          color={live ? "success" : "primary"}
          startContent={
            <Icon
              icon={
                live ? "solar:check-circle-bold" : "solar:magic-stick-3-linear"
              }
              width={16}
            />
          }
          variant="flat"
        >
          {live ? "Activa para tus clientes" : "Modo preparación"}
        </Chip>
      </header>

      <StepCard
        index={1}
        subtitle="Convierte las comidas de tus planes antiguos en recetas de tu biblioteca. Los totales del plan original se conservan exactos; puedes repetir este paso cuando quieras — nunca se duplican."
        title="Importa tus recetas"
      >
        <RecipeImportContent />
      </StepCard>

      <StepCard
        index={2}
        subtitle="Qué verá cada cliente en su sección de Nutrición tras el cambio. Toca «Vista previa» para verlo con sus datos reales."
        title="Revisa a tus clientes"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {counts.atRisk > 0 ? (
              <Chip color="warning" size="sm" variant="flat">
                ⚠️ {counts.atRisk} sin dieta visible
              </Chip>
            ) : null}
            <Chip color="success" size="sm" variant="flat">
              {counts.pdf} con PDF
            </Chip>
            <Chip color="primary" size="sm" variant="flat">
              {counts.goals} con objetivos
            </Chip>
            <Chip color="default" size="sm" variant="flat">
              {counts.planV2} con plan nuevo
            </Chip>
            <Chip color="default" size="sm" variant="flat">
              {counts.none} sin dieta actual
            </Chip>
          </div>

          {clients.length === 0 ? (
            <p className="text-sm text-default-500">
              Aún no tienes clientes activos.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {[...clients]
                .sort(
                  (a, b) =>
                    Number(b.verdict === "at_risk") -
                    Number(a.verdict === "at_risk")
                )
                .map((client) => (
                  <ClientRow
                    key={client.clientId}
                    client={client}
                    onPreview={() => setPreview(client)}
                  />
                ))}
            </div>
          )}
        </div>
      </StepCard>

      <StepCard
        index={3}
        subtitle="Lo esencial de la nueva sección, en un minuto."
        title="Conoce la nueva nutrición"
      >
        <div className="flex flex-col gap-3">
          {VIDEO_URL !== null ? (
            <div className="overflow-hidden rounded-large border border-gray-200">
              <iframe
                allowFullScreen
                className="aspect-video w-full"
                src={VIDEO_URL}
                title="Nutrición 2.0"
              />
            </div>
          ) : null}
          <ul className="flex flex-col gap-2">
            {FEATURE_BULLETS.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-2 text-sm text-default-600"
              >
                <Icon
                  className="mt-0.5 shrink-0 text-success"
                  icon="solar:check-circle-linear"
                  width={16}
                />
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </StepCard>

      <StepCard
        index={4}
        subtitle={
          live
            ? "Tus clientes ya usan la nueva nutrición."
            : "Cuando actives, cada cliente verá lo del paso 2 — al instante."
        }
        title="Activa el cambio"
      >
        {live ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm text-success-700">
              <Icon icon="solar:check-circle-bold" width={18} />
              Nutrición 2.0 activa para tus clientes.
            </p>
            <Button
              className="self-start"
              isLoading={action.isPending}
              size="sm"
              variant="bordered"
              onPress={() => action.mutate("deactivate_clients")}
            >
              Volver a la versión anterior
            </Button>
            <p className="text-xs text-default-400">
              Volver no borra nada: tus recetas, planes y PDFs se conservan y
              puedes reactivar cuando quieras.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {counts.atRisk > 0 ? (
              <div className="flex flex-col gap-2 rounded-large border border-warning-200 bg-warning-50 p-3">
                <p className="text-sm text-warning-700">
                  <span className="font-semibold">
                    {counts.atRisk}{" "}
                    {counts.atRisk === 1 ? "cliente" : "clientes"} con plan
                    antiguo estructurado
                  </span>{" "}
                  — se quedarán sin dieta visible hasta que les crees un plan
                  nuevo o les subas un PDF.
                </p>
                <Checkbox
                  isSelected={acknowledged}
                  size="sm"
                  onValueChange={setAcknowledged}
                >
                  <span className="text-xs">
                    Lo entiendo, quiero activar de todas formas
                  </span>
                </Checkbox>
              </div>
            ) : null}

            <Button
              className="self-start"
              color="primary"
              isDisabled={counts.atRisk > 0 && acknowledged === false}
              isLoading={action.isPending}
              size="lg"
              startContent={
                action.isPending ? null : (
                  <Icon icon="solar:rocket-2-linear" width={18} />
                )
              }
              onPress={() => action.mutate("activate_clients")}
            >
              Activar Nutrición 2.0 para mis clientes
            </Button>
            <p className="text-xs text-default-400">
              Puedes volver a la versión anterior cuando quieras — no se pierde
              nada.
            </p>
          </div>
        )}
      </StepCard>

      <ClientPreviewModal client={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function StepCard({
  index,
  title,
  subtitle,
  children,
}: {
  index: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
            {index}
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-default-500">{subtitle}</p>
          </div>
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

const VERDICT_UI: Record<
  ClientReadiness["verdict"],
  { label: string; color: "success" | "primary" | "warning" | "default" }
> = {
  plan_v2: { label: "Plan nuevo activo", color: "default" },
  pdf: { label: "Verá su PDF", color: "success" },
  goals: { label: "Verá sus objetivos", color: "primary" },
  at_risk: { label: "Sin dieta visible", color: "warning" },
  none: { label: "Sin dieta actual", color: "default" },
};

function ClientRow({
  client,
  onPreview,
}: {
  client: ClientReadiness;
  onPreview: () => void;
}) {
  const ui = VERDICT_UI[client.verdict];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-large border border-gray-200 px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
        {client.name}
      </span>
      <Chip color={ui.color} size="sm" variant="flat">
        {client.verdict === "at_risk" ? "⚠️ " : ""}
        {ui.label}
      </Chip>
      {client.verdict === "at_risk" ? (
        <Button
          as={Link}
          color="warning"
          href={`/trainer/dashboard/clients/${client.clientId}?tab=nutrition`}
          size="sm"
          variant="flat"
        >
          Crear plan
        </Button>
      ) : (
        <Button size="sm" variant="bordered" onPress={onPreview}>
          Vista previa
        </Button>
      )}
    </div>
  );
}
