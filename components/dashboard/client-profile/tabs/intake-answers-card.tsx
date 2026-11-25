"use client";

// Respuestas del formulario inicial en la pestaña Formularios del cliente.
// Nada si el entrenador lo tiene apagado; "pendiente" si el cliente aún no
// lo ha enviado.

import type { FormTemplate } from "@/lib/forms/types";

import { Button, Card, CardBody, Chip, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// El resumen legible del post-entreno sirve para cualquier formulario.
import { summarizeWorkoutAnswers } from "@/lib/forms/workout";

interface IntakeResponse {
  id: string;
  reviewed_at?: string | null;
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

  // Revisarlo lo quita de "por revisar" en Inicio y del aviso del cliente.
  const queryClient = useQueryClient();
  const markReviewed = useMutation({
    mutationFn: async (responseId: string) => {
      const res = await fetch(
        `/api/forms/responses/${clientId}/${responseId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewed: true }),
        }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok || body?.success !== true) {
        throw new Error(body?.error || "Error al actualizar");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["trainer", "intake-response", clientId],
      });
      void queryClient.invalidateQueries({ queryKey: ["trainer", "inicio"] });
    },
    onError: (error) => {
      addToast({
        title: "No se pudo marcar como revisado",
        description: error instanceof Error ? error.message : undefined,
        color: "danger",
      });
    },
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
          {response ? (
            response.reviewed_at ? (
              <Chip
                className="ml-auto"
                color="success"
                size="sm"
                variant="flat"
              >
                Revisado
              </Chip>
            ) : (
              <Button
                className="ml-auto"
                color="primary"
                isLoading={markReviewed.isPending}
                size="sm"
                variant="flat"
                onPress={() => markReviewed.mutate(response.id)}
              >
                Marcar revisado
              </Button>
            )
          ) : null}
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
