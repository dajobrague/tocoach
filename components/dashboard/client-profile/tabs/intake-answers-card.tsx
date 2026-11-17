"use client";

// Respuestas del formulario inicial en la pestaña Formularios del cliente.
// Nada si el entrenador lo tiene apagado; "pendiente" si el cliente aún no
// lo ha enviado.

import type { FormTemplate } from "@/lib/forms/types";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "@tanstack/react-query";

// El resumen legible del post-entreno sirve para cualquier formulario.
import { summarizeWorkoutAnswers } from "@/lib/forms/workout";

interface IntakeResponse {
  response_date: string;
  answers?: Record<string, unknown>;
}

export function IntakeAnswersCard({ clientId }: { clientId: string }) {
  const templateQuery = useQuery({
    queryKey: ["trainer", "form-template", "intake"],
    queryFn: async (): Promise<FormTemplate | null> => {
      const res = await fetch("/api/forms/templates?form_type=intake", {
        credentials: "include",
      });
      const body = await res.json().catch(() => null);

      if (!res.ok || body?.success !== true) return null;

      return (body.templates?.[0] as FormTemplate | undefined) ?? null;
    },
    staleTime: 5 * 60_000,
  });
  const template = templateQuery.data;
  const active = template?.is_active === true;

  const responseQuery = useQuery({
    queryKey: ["trainer", "intake-response", clientId],
    queryFn: async (): Promise<IntakeResponse | null> => {
      const res = await fetch(
        `/api/forms/responses/${clientId}?form_type=intake`,
        { credentials: "include" }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok || body?.success !== true) return null;

      return (body.responses?.[0] as IntakeResponse | undefined) ?? null;
    },
    enabled: active,
  });

  if (!active || !template || responseQuery.isPending) return null;
  const response = responseQuery.data;
  const lines = response
    ? summarizeWorkoutAnswers(template.questions_config, response.answers ?? {})
    : [];

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Icon
            className="text-default-500"
            icon="solar:clipboard-list-linear"
            width={18}
          />
          <h3 className="text-sm font-semibold text-gray-900">
            Formulario inicial
          </h3>
          <span className="text-xs text-default-500">
            {response
              ? `Enviado el ${new Date(
                  `${response.response_date}T12:00:00`
                ).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`
              : "Pendiente: el cliente aún no lo ha rellenado"}
          </span>
        </div>

        {lines.length > 0 ? (
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {lines.map((line) => (
              <div
                key={line.id}
                className={line.isText ? "sm:col-span-2" : undefined}
              >
                <dt className="text-xs text-default-500">{line.label}</dt>
                <dd className="whitespace-pre-line text-sm text-gray-900">
                  {line.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </CardBody>
    </Card>
  );
}
