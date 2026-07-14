"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";

import { useNutritionV2FlagStatus } from "@/features/trainer/nav/use-nutrition-v2-flag";

const WIZARD_PATH = "/trainer/dashboard/nutrition-update";

/**
 * Métricas-page announcement for the V1→V2 nutrition rollout — big on
 * purpose: Métricas is the trainers' landing page and the wizard is the
 * launch vehicle. Shows until the tenant flips the client-facing switch
 * (after that there is nothing left to set up); once prepare mode has
 * started the copy shifts to "continue where you left off".
 */
export function NutritionUpdateBanner() {
  const { enabled, prepareMode, isLoading } = useNutritionV2FlagStatus();

  if (isLoading || enabled) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black text-white">
        <Icon icon="solar:rocket-2-linear" width={24} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-black">
            {prepareMode
              ? "Continúa tu actualización a Nutrición 2.0"
              : "Nutrición 2.0 ya está aquí"}
          </h3>
          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-700">
            Nuevo
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {prepareMode
            ? "Ya empezaste a prepararla. Revisa a tus clientes y activa el cambio cuando quieras — ellos no ven nada hasta entonces."
            : "Recetas con fotos y macros, menús con alternativas y objetivos por día. Prepárala a tu ritmo: tus clientes no ven ningún cambio hasta que tú lo actives."}
        </p>
      </div>
      <Button
        as={Link}
        className="shrink-0 bg-slate-900 text-white"
        endContent={<Icon icon="solar:arrow-right-linear" width={16} />}
        href={WIZARD_PATH}
      >
        {prepareMode ? "Continuar configuración" : "Empezar la actualización"}
      </Button>
    </div>
  );
}
