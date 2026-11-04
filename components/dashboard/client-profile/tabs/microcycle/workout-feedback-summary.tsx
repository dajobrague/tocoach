"use client";

// Respuestas del formulario post-entreno dentro de la tarjeta de sesión del
// seguimiento. Compacto: una línea de datos + la nota como cita. Nada si el
// entrenador tiene el formulario apagado o el cliente no respondió.

import type { FormTemplate } from "@/lib/forms/types";

import { Icon } from "@iconify/react";
import { useQuery } from "@tanstack/react-query";

import {
  findWorkoutResponseForSession,
  summarizeWorkoutAnswers,
} from "@/lib/forms/workout";

interface Props {
  clientId: string;
  date: string;
  sessionId: string;
}

export function WorkoutFeedbackSummary({ clientId, date, sessionId }: Props) {
  const templateQuery = useQuery({
    queryKey: ["trainer", "form-template", "workout"],
    queryFn: async (): Promise<FormTemplate | null> => {
      const res = await fetch("/api/forms/templates?form_type=workout", {
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

  const responsesQuery = useQuery({
    queryKey: ["trainer", "workout-responses", clientId, date],
    queryFn: async (): Promise<
      Array<{ metadata?: unknown; answers?: Record<string, unknown> }>
    > => {
      const res = await fetch(
        `/api/forms/responses/${clientId}?form_type=workout&start_date=${date}&end_date=${date}`,
        { credentials: "include" }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok || body?.success !== true) return [];

      return Array.isArray(body.responses) ? body.responses : [];
    },
    enabled: active,
    staleTime: 60_000,
  });

  if (!active || !template) return null;
  const response = findWorkoutResponseForSession(
    responsesQuery.data ?? [],
    sessionId
  );

  if (!response) return null;
  const lines = summarizeWorkoutAnswers(
    template.questions_config,
    response.answers ?? {}
  );

  if (lines.length === 0) return null;
  const facts = lines.filter((l) => !l.isText);
  const texts = lines.filter((l) => l.isText);

  return (
    <div className="flex flex-col gap-1.5 border-b border-default-100 px-4 py-2.5">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-default-600">
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          <Icon aria-hidden icon="solar:chat-round-like-linear" width={14} />
          Post-entreno
        </span>
        {facts.map((l) => (
          <span key={l.id}>
            {l.label}:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {l.value}
            </span>
          </span>
        ))}
      </p>
      {texts.map((l) => (
        <p
          key={l.id}
          className="rounded-r-large border-l-[3px] border-default-200 bg-default-50 px-3 py-1.5 text-xs italic leading-snug text-default-600"
        >
          «{l.value}»
        </p>
      ))}
    </div>
  );
}
