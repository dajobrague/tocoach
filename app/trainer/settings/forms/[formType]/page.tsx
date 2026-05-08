"use client";

import type {
  CheckInSchedule,
  FormConfigData,
  FormTemplate,
  FormType,
  QuestionConfig,
} from "@/lib/forms/types";

import { Card, CardBody, Divider, Skeleton, Switch } from "@heroui/react";
import { notFound, useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";

import FormConfigEditor from "@/components/dashboard/client-profile/tabs/form-config-editor";
import { InstantSaveBadge } from "@/components/shared/instant-save-badge";
import {
  CheckInScheduleEditor,
  buildCheckinSchedulePayload,
  validateCheckinScheduleDraft,
} from "@/components/trainer/checkin-schedule-editor";
import {
  DEFAULT_CHECKIN_CONFIG,
  DEFAULT_HABIT_CONFIG,
} from "@/lib/forms/defaults";
import { useInstantSave } from "@/lib/hooks/use-instant-save";

const FORM_TYPE_LABELS: Record<FormType, { title: string; subtitle: string }> =
  {
    checkins: {
      title: "Plantilla de Check-in",
      subtitle:
        "Preguntas y horario por defecto que se aplicarán a los clientes nuevos cuando actives el interruptor de abajo.",
    },
    habits: {
      title: "Plantilla de Hábitos Diarios",
      subtitle:
        "Preguntas por defecto para el formulario de hábitos diarios. Se aplicarán a clientes nuevos cuando el interruptor esté activo.",
    },
  };

/**
 * Config inicial al auto-crear la plantilla cuando el tenant aún no tiene
 * una. Reutiliza los defaults ricos de `lib/forms/defaults.ts` — las mismas
 * páginas y preguntas que venían sirviéndose por defecto en el editor de
 * cliente. Así el trainer arranca con contenido en lugar de una plantilla
 * vacía, y el set de preguntas queda sincronizado entre los dos caminos.
 */
function buildDefaultQuestionsConfig(formType: FormType): FormConfigData {
  return formType === "checkins"
    ? DEFAULT_CHECKIN_CONFIG
    : DEFAULT_HABIT_CONFIG;
}

const DEFAULT_TEMPLATE_NAMES: Record<FormType, string> = {
  checkins: "Plantilla de Check-in",
  habits: "Plantilla de Hábitos",
};

function isValidFormType(raw: string): raw is FormType {
  return raw === "checkins" || raw === "habits";
}

export default function TemplateFormEditorPage({
  params,
}: {
  params: Promise<{ formType: string }>;
}) {
  const { formType: rawType } = use(params);

  if (!isValidFormType(rawType)) {
    notFound();
  }

  const formType = rawType as FormType;

  return <TemplateEditor formType={formType} />;
}

function TemplateEditor({ formType }: { formType: FormType }) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.session) {
          router.replace("/trainer/login");
        } else {
          setAuthChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/trainer/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  // ── Template load ──────────────────────────────────────────────────────
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!authChecked) return;

    let cancelled = false;

    setLoading(true);
    setLoadError(null);

    const loadOrCreate = async () => {
      try {
        const res = await fetch(`/api/forms/templates?form_type=${formType}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!data?.success) {
          setLoadError(data?.error ?? "Error al cargar plantilla");
          setLoading(false);

          return;
        }

        const first = (data.templates ?? [])[0] as FormTemplate | undefined;

        if (first) {
          setTemplate(first);
          setLoading(false);

          return;
        }

        // Sin plantilla activa: creamos una on-demand con los defaults ricos
        // compartidos (lib/forms/defaults) para que el trainer arranque con
        // contenido. El editor queda utilizable inmediatamente y las
        // ediciones siguientes se persisten vía auto-save.
        const createRes = await fetch("/api/forms/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            form_type: formType,
            name: DEFAULT_TEMPLATE_NAMES[formType],
            questions_config: buildDefaultQuestionsConfig(formType),
            auto_apply_to_new_clients: false,
          }),
        });

        const createJson = await createRes.json().catch(() => ({}));

        if (cancelled) return;

        if (!createRes.ok || !createJson?.success || !createJson?.template) {
          setLoadError(
            createJson?.error ?? "No se pudo crear la plantilla inicial"
          );
          setLoading(false);

          return;
        }

        setTemplate(createJson.template as FormTemplate);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Error al cargar plantilla";

        setLoadError(message);
        setLoading(false);
      }
    };

    loadOrCreate();

    return () => {
      cancelled = true;
    };
  }, [authChecked, formType]);

  // ── Auto-apply toggle save ─────────────────────────────────────────────
  const toggleSave = useInstantSave(
    useCallback(
      async (value: unknown, signal: AbortSignal) => {
        if (!template) return;

        const res = await fetch("/api/forms/templates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal,
          body: JSON.stringify({
            template_id: template.id,
            auto_apply_to_new_clients: value,
          }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.success) {
          throw new Error(
            json?.error ?? "No se pudo actualizar el interruptor"
          );
        }
      },
      [template]
    )
  );

  const [autoApply, setAutoApply] = useState(false);

  useEffect(() => {
    if (template) {
      setAutoApply(Boolean(template.auto_apply_to_new_clients));
    }
  }, [template]);

  const onToggle = useCallback(
    (next: boolean) => {
      setAutoApply(next);
      toggleSave.save(next, { immediate: true });
    },
    [toggleSave]
  );

  // ── Questions auto-save ────────────────────────────────────────────────
  const questionsSave = useInstantSave(
    useCallback(
      async (value: unknown, signal: AbortSignal) => {
        if (!template) return;

        const res = await fetch("/api/forms/templates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal,
          body: JSON.stringify({
            template_id: template.id,
            questions_config: value,
          }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.success) {
          throw new Error(
            json?.error ?? "No se pudieron guardar las preguntas"
          );
        }
      },
      [template]
    )
  );

  const handleQuestionsChange = useCallback(
    (config: FormConfigData) => {
      questionsSave.save(config);
    },
    [questionsSave]
  );

  // ── Schedule auto-save (checkins only) ─────────────────────────────────
  const scheduleSave = useInstantSave(
    useCallback(async (value: unknown, signal: AbortSignal) => {
      const res = await fetch("/api/forms/templates/default-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal,
        body: JSON.stringify({ schedule: value }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? "No se pudo guardar el horario");
      }
    }, [])
  );

  const handleScheduleChange = useCallback(
    (draft: CheckInSchedule) => {
      // Cheap client-side validation: avoid spamming invalid PUTs.
      const errors = validateCheckinScheduleDraft(draft);

      if (Object.keys(errors).length > 0) return;

      const payload = buildCheckinSchedulePayload(draft);

      scheduleSave.save(payload);
    },
    [scheduleSave]
  );

  const labels = useMemo(() => FORM_TYPE_LABELS[formType], [formType]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (!authChecked || loading) {
    return (
      <PageShell>
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/2 rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </PageShell>
    );
  }

  if (loadError || !template) {
    return (
      <PageShell>
        <Card>
          <CardBody>
            <p className="text-danger-600">
              {loadError ?? "No se pudo cargar la plantilla."}
            </p>
          </CardBody>
        </Card>
      </PageShell>
    );
  }

  const initialQuestions: QuestionConfig[] | FormConfigData =
    template.questions_config;

  return (
    <PageShell>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {labels.title}
        </h1>
        <p className="mt-2 text-gray-600">{labels.subtitle}</p>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Aplicar automáticamente a clientes nuevos
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Cuando está activo, cada cliente nuevo recibe esta plantilla al
                momento de registrarse. No afecta a clientes existentes.
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-3">
              <InstantSaveBadge
                error={toggleSave.error}
                status={toggleSave.status}
              />
              <Switch
                isDisabled={toggleSave.status === "saving"}
                isSelected={autoApply}
                onValueChange={onToggle}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {formType === "checkins" ? (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">
                Horario por defecto
              </h2>
              <InstantSaveBadge
                error={scheduleSave.error}
                status={scheduleSave.status}
              />
            </div>
            <Divider />
            <CheckInScheduleEditor
              embedded
              hideSaveButton
              editorTitle=""
              variant="template"
              onScheduleChange={handleScheduleChange}
            />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Preguntas</h2>
            <InstantSaveBadge
              error={questionsSave.error}
              status={questionsSave.status}
            />
          </div>
          <Divider />
          <FormConfigEditor
            initialConfig={initialQuestions}
            onChange={handleQuestionsChange}
          />
        </CardBody>
      </Card>

      <p className="text-xs text-gray-500">
        Los cambios se guardan automáticamente. Esto nunca reemplaza la
        configuración de clientes existentes; para aplicar esta plantilla a un
        cliente específico usa el botón en su perfil.
      </p>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
      {children}
    </main>
  );
}
