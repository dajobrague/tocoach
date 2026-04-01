"use client";

import type { CheckInFrequency, CheckInSchedule } from "@/lib/forms/types";

import {
  Autocomplete,
  AutocompleteItem,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Skeleton,
  Switch,
  addToast,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { formatScheduleDescription } from "@/lib/forms/schedule";

// ─── Types ───────────────────────────────────────────────────────────────

export interface CheckInScheduleEditorProps {
  /** Per-client schedule API (`/api/forms/configs/[id]/schedule`). */
  clientId?: string;
  /** `template` uses `/api/forms/templates/default-schedule`. */
  variant?: "client" | "template";
  onSaved?: () => void;
  embedded?: boolean;
  /** Hide primary save (e.g. parent saves schedule + questions in one action). */
  hideSaveButton?: boolean;
  /** Current draft for parent banners / unified save. */
  onScheduleChange?: (schedule: CheckInSchedule) => void;
  /** Bump to re-sync draft from server after discard or external save. */
  scheduleSyncRevision?: number;
  /** Section title (default: Configuración de Check-in). */
  editorTitle?: string;
  /** Template mode only: batch-apply + confirmation modal. */
  showApplyAllClients?: boolean;
}

interface ScheduleApiResponse {
  success: boolean;
  schedule?: CheckInSchedule;
  default_schedule?: CheckInSchedule;
  schedule_source?: string;
  error?: string;
  errors?: string[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

const COMMON_TIMEZONES: { id: string; label: string }[] = [
  { id: "Europe/Madrid", label: "España peninsular" },
  { id: "Atlantic/Canary", label: "Islas Canarias" },
  { id: "America/Mexico_City", label: "México (centro)" },
  { id: "America/Bogota", label: "Colombia" },
  { id: "America/Lima", label: "Perú" },
  { id: "America/Santiago", label: "Chile" },
  { id: "America/Argentina/Buenos_Aires", label: "Argentina" },
  { id: "America/New_York", label: "EE. UU. (Este)" },
  { id: "America/Los_Angeles", label: "EE. UU. (Pacífico)" },
];

const GRACE_OPTIONS: { value: number; label: string }[] = [
  { value: 24, label: "24 horas" },
  { value: 48, label: "48 horas" },
  { value: 72, label: "72 horas" },
  { value: 168, label: "1 semana" },
];

/** Monday → Sunday (L … D). */
const DAY_CHIPS: { dow: number; short: string }[] = [
  { dow: 1, short: "L" },
  { dow: 2, short: "M" },
  { dow: 3, short: "X" },
  { dow: 4, short: "J" },
  { dow: 5, short: "V" },
  { dow: 6, short: "S" },
  { dow: 0, short: "D" },
];

function getAllIanaTimeZones(): string[] {
  try {
    const list = Intl.supportedValuesOf("timeZone");

    return [...list].sort((a, b) => a.localeCompare(b));
  } catch {
    return COMMON_TIMEZONES.map((z) => z.id);
  }
}

function toTimeInputValue(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());

  if (!m) return "12:00";

  const hh = m[1];
  const mm = m[2];

  if (hh === undefined || mm === undefined) return "12:00";

  return `${hh.padStart(2, "0")}:${mm}`;
}

function fromTimeInputValue(v: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(v);

  if (!m) return "12:00";

  const hh = m[1];
  const mm = m[2];

  if (hh === undefined || mm === undefined) return "12:00";

  return `${parseInt(hh, 10)}:${mm}`;
}

async function fetchClientSchedule(
  clientId: string
): Promise<{ schedule: CheckInSchedule; schedule_source: string | null }> {
  const res = await fetch(`/api/forms/configs/${clientId}/schedule`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await res.json()) as ScheduleApiResponse;

  if (!data.success || !data.schedule) {
    throw new Error(data.error || "No se pudo cargar el horario");
  }

  return {
    schedule: data.schedule,
    schedule_source: data.schedule_source ?? null,
  };
}

async function saveClientSchedule(
  clientId: string,
  schedule: CheckInSchedule
): Promise<CheckInSchedule> {
  const res = await fetch(`/api/forms/configs/${clientId}/schedule`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(schedule),
  });
  const data = (await res.json()) as ScheduleApiResponse;

  if (!data.success || !data.schedule) {
    const msg =
      data.errors?.join(" ") ||
      data.error ||
      "No se pudo guardar la configuración";

    throw new Error(msg);
  }

  return data.schedule;
}

async function fetchTemplateDefaultSchedule(): Promise<{
  schedule: CheckInSchedule;
  schedule_source: string | null;
}> {
  const res = await fetch("/api/forms/templates/default-schedule", {
    credentials: "include",
  });
  const data = (await res.json()) as ScheduleApiResponse;

  if (!data.success || !data.default_schedule) {
    throw new Error(data.error || "No se pudo cargar el horario por defecto");
  }

  return {
    schedule: data.default_schedule,
    schedule_source: data.schedule_source ?? null,
  };
}

async function saveTemplateDefaultSchedule(
  schedule: CheckInSchedule
): Promise<{ schedule: CheckInSchedule; schedule_source: string | null }> {
  const res = await fetch("/api/forms/templates/default-schedule", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(schedule),
  });
  const data = (await res.json()) as ScheduleApiResponse;

  if (!data.success || !data.default_schedule) {
    const msg =
      data.errors?.join(" ") ||
      data.error ||
      "No se pudo guardar la configuración";

    throw new Error(msg);
  }

  return {
    schedule: data.default_schedule,
    schedule_source: data.schedule_source ?? null,
  };
}

async function batchApplyScheduleToClients(
  schedule: CheckInSchedule
): Promise<number> {
  const res = await fetch("/api/forms/configs/batch-update-schedule", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schedule }),
  });
  const data = (await res.json()) as {
    success: boolean;
    updated?: number;
    error?: string;
    errors?: string[];
  };

  if (!data.success) {
    throw new Error(
      data.errors?.join(" ") || data.error || "Error al aplicar a los clientes"
    );
  }

  return data.updated ?? 0;
}

export function buildCheckinSchedulePayload(
  draft: CheckInSchedule
): CheckInSchedule {
  const sortedDays = [...new Set(draft.days_of_week)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);

  let times_per_week = draft.times_per_week;

  if (draft.frequency === "weekly" || draft.frequency === "biweekly") {
    times_per_week = 1;
  } else {
    times_per_week = Math.min(7, Math.max(1, Math.round(draft.times_per_week)));
  }

  return {
    ...draft,
    days_of_week: sortedDays,
    times_per_week,
    custom_name: draft.custom_name.trim(),
    time: toTimeInputValue(draft.time),
    timezone: draft.timezone.trim(),
  };
}

export function validateCheckinScheduleDraft(
  d: CheckInSchedule
): Record<string, string> {
  const err: Record<string, string> = {};
  const name = d.custom_name.trim();

  if (!name) {
    err.custom_name = "El nombre del check-in es obligatorio.";
  }

  const days = [...new Set(d.days_of_week)].sort((a, b) => a - b);

  if (d.frequency === "weekly" || d.frequency === "biweekly") {
    if (days.length !== 1) {
      err.days_of_week = "Selecciona exactamente un día.";
    }
  } else if (d.frequency === "custom") {
    const n = Math.min(7, Math.max(1, Math.round(d.times_per_week)));

    if (days.length !== n) {
      err.days_of_week = `Debes seleccionar exactamente ${n} día(s) (coincide con «veces por semana»).`;
    }
  }

  if (!/^\d{2}:\d{2}$/.test(toTimeInputValue(d.time))) {
    err.time = "Indica una hora válida (HH:MM).";
  }

  if (!d.timezone.trim()) {
    err.timezone = "Selecciona o escribe una zona horaria.";
  }

  return err;
}

function timezoneItemLabel(id: string): string {
  const common = COMMON_TIMEZONES.find((z) => z.id === id);

  return common ? `${id} — ${common.label}` : id;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function CheckInScheduleEditor({
  clientId,
  variant = "client",
  onSaved,
  embedded = false,
  hideSaveButton = false,
  onScheduleChange,
  scheduleSyncRevision = 0,
  editorTitle = "Configuración de Check-in",
  showApplyAllClients = false,
}: CheckInScheduleEditorProps) {
  const queryClient = useQueryClient();
  const [initialized, setInitialized] = useState(false);
  const [draft, setDraft] = useState<CheckInSchedule | null>(null);
  const [scheduleSource, setScheduleSource] = useState<string | null>(null);
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});
  const [batchLoading, setBatchLoading] = useState(false);
  const applyAllModal = useDisclosure();

  const isTemplate = variant === "template";

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: isTemplate
      ? ["trainer", "checkin-default-schedule"]
      : ["trainer", "checkin-schedule", clientId ?? ""],
    queryFn: () =>
      isTemplate
        ? fetchTemplateDefaultSchedule()
        : fetchClientSchedule(clientId as string),
    enabled: isTemplate ? true : Boolean(clientId),
  });

  useEffect(() => {
    setInitialized(false);
  }, [clientId, variant, scheduleSyncRevision]);

  useEffect(() => {
    if (draft) {
      onScheduleChange?.(draft);
    }
  }, [draft, onScheduleChange]);

  useEffect(() => {
    if (data && !initialized) {
      setDraft({ ...data.schedule });
      setScheduleSource(data.schedule_source);
      setInitialized(true);
    }
  }, [data, initialized]);

  const allZones = useMemo(() => getAllIanaTimeZones(), []);

  const timezoneItems = useMemo(() => {
    const set = new Set(allZones);
    const tz = draft?.timezone;

    if (tz && !set.has(tz)) {
      return [tz, ...allZones];
    }

    return allZones;
  }, [allZones, draft?.timezone]);

  type SaveMutationResult =
    | { mode: "client"; schedule: CheckInSchedule }
    | {
        mode: "template";
        schedule: CheckInSchedule;
        schedule_source: string | null;
      };

  const mutation = useMutation({
    mutationFn: async (s: CheckInSchedule): Promise<SaveMutationResult> => {
      if (isTemplate) {
        const r = await saveTemplateDefaultSchedule(s);

        return { mode: "template", ...r };
      }

      const schedule = await saveClientSchedule(clientId as string, s);

      return { mode: "client", schedule };
    },
    onSuccess: (result) => {
      if (result.mode === "template") {
        setDraft({ ...result.schedule });
        queryClient.setQueryData(["trainer", "checkin-default-schedule"], {
          schedule: result.schedule,
          schedule_source: result.schedule_source,
        });
        setScheduleSource(result.schedule_source);
      } else {
        setDraft({ ...result.schedule });
        queryClient.setQueryData(
          ["trainer", "checkin-schedule", clientId ?? ""],
          {
            schedule: result.schedule,
            schedule_source: "client",
          }
        );
        queryClient.invalidateQueries({
          queryKey: ["trainer", "checkin-schedule", clientId ?? ""],
        });
        setScheduleSource("client");
      }
      addToast({
        title: "Configuración guardada",
        description: "El horario de check-in se ha actualizado correctamente.",
        color: "success",
      });
      onSaved?.();
    },
    onError: (e: Error) => {
      addToast({
        title: "Error al guardar",
        description: e.message,
        color: "danger",
      });
    },
  });

  const updateDraft = useCallback((patch: Partial<CheckInSchedule>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const handleFrequencyChange = useCallback((freq: CheckInFrequency) => {
    setDraft((prev) => {
      if (!prev) return prev;
      let days = [...prev.days_of_week];

      if (freq === "weekly" || freq === "biweekly") {
        days = days.length > 0 ? [days[0] ?? 1] : [1];
      } else {
        const n = Math.min(
          7,
          Math.max(1, prev.times_per_week || days.length || 1)
        );

        days = days.slice(0, n);
        if (days.length === 0) days = [1];
      }

      return {
        ...prev,
        frequency: freq,
        days_of_week: days,
        times_per_week:
          freq === "custom"
            ? Math.min(7, Math.max(1, prev.times_per_week || days.length))
            : 1,
      };
    });
  }, []);

  const toggleDay = useCallback((dow: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const { frequency } = prev;
      let days = [...prev.days_of_week];

      if (frequency === "weekly" || frequency === "biweekly") {
        days = [dow];

        return { ...prev, days_of_week: days };
      }

      const n = Math.min(7, Math.max(1, Math.round(prev.times_per_week)));
      const has = days.includes(dow);

      if (has) {
        days = days.filter((d) => d !== dow);
      } else if (days.length < n) {
        days = [...days, dow].sort((a, b) => a - b);
      }

      return { ...prev, days_of_week: days };
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!draft) return;

    const payload = buildCheckinSchedulePayload(draft);
    const errs = validateCheckinScheduleDraft(payload);

    setInlineErrors(errs);

    if (Object.keys(errs).length > 0) {
      return;
    }

    mutation.mutate(payload);
  }, [draft, mutation]);

  const handleRestoreDefaults = useCallback(async () => {
    if (isTemplate) return;

    try {
      const res = await fetch("/api/forms/templates/default-schedule", {
        credentials: "include",
      });
      const json = (await res.json()) as ScheduleApiResponse & {
        default_schedule?: CheckInSchedule;
      };

      if (!json.success || !json.default_schedule) {
        addToast({
          title: "Error",
          description:
            json.error ||
            "No se pudo cargar el horario por defecto del entrenador.",
          color: "danger",
        });

        return;
      }

      setDraft({ ...json.default_schedule });
      setInlineErrors({});
      addToast({
        title: "Valores restaurados",
        description: hideSaveButton
          ? "Se han cargado los valores por defecto. Pulsa «Guardar Configuración» para aplicarlos."
          : "Se han cargado los valores por defecto. Pulsa «Guardar cambios» para aplicarlos.",
        color: "default",
      });
    } catch {
      addToast({
        title: "Error de conexión",
        description: "No se pudo obtener la plantilla por defecto.",
        color: "danger",
      });
    }
  }, [hideSaveButton, isTemplate]);

  const handleConfirmApplyAll = useCallback(async () => {
    if (!draft || !isTemplate) return;

    const payload = buildCheckinSchedulePayload(draft);
    const errs = validateCheckinScheduleDraft(payload);

    setInlineErrors(errs);

    if (Object.keys(errs).length > 0) {
      applyAllModal.onClose();

      return;
    }

    setBatchLoading(true);

    try {
      const n = await batchApplyScheduleToClients(payload);

      applyAllModal.onClose();
      queryClient.invalidateQueries({
        queryKey: ["trainer", "checkin-schedule"],
      });
      addToast({
        title: "Horario aplicado",
        description: `Se actualizó la configuración de check-in en ${n} cliente(s) activo(s).`,
        color: "success",
      });
    } catch (e) {
      addToast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo completar",
        color: "danger",
      });
    } finally {
      setBatchLoading(false);
    }
  }, [applyAllModal, draft, isTemplate, queryClient]);

  const showDefaultBadge =
    scheduleSource === "default" || scheduleSource === "template";

  const bodyContent = (() => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-4 py-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      );
    }

    if (isError) {
      return (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
          <p className="font-medium">No se pudo cargar el horario</p>
          <p className="mt-1">{error?.message}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="bordered"
            onPress={() => refetch()}
          >
            Reintentar
          </Button>
        </div>
      );
    }

    if (!draft) {
      return (
        <div className="flex flex-col gap-4 py-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      );
    }

    const formDisabled = !draft.enabled;

    return (
      <>
        <div
          className={`flex flex-col gap-6 ${formDisabled ? "pointer-events-none opacity-45" : ""}`}
        >
          {/* Nombre */}
          <Input
            isRequired
            description="Este nombre aparecerá en la app del cliente"
            endContent={
              <span className="text-xs text-default-400">
                {draft.custom_name.length}/50
              </span>
            }
            errorMessage={inlineErrors.custom_name}
            isInvalid={Boolean(inlineErrors.custom_name)}
            label="Nombre del check-in"
            maxLength={50}
            placeholder="Check-in"
            value={draft.custom_name}
            onValueChange={(v) => {
              updateDraft({ custom_name: v });
              if (inlineErrors.custom_name) {
                setInlineErrors((e) => {
                  const n = { ...e };

                  delete n.custom_name;

                  return n;
                });
              }
            }}
          />

          {/* Frecuencia */}
          <div>
            <p className="mb-2 text-sm font-medium text-default-700">
              Frecuencia
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "weekly" as const, label: "Semanal" },
                  { key: "biweekly" as const, label: "Quincenal" },
                  { key: "custom" as const, label: "Personalizado" },
                ] as const
              ).map(({ key, label }) => (
                <Button
                  key={key}
                  className="min-w-[7rem]"
                  color={draft.frequency === key ? "primary" : "default"}
                  variant={draft.frequency === key ? "solid" : "bordered"}
                  onPress={() => handleFrequencyChange(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {draft.frequency === "custom" && (
              <Input
                className="mt-3 max-w-[220px]"
                description="Número de días distintos a la semana (1–7)"
                label="Veces por semana"
                max={7}
                min={1}
                type="number"
                value={String(draft.times_per_week)}
                onValueChange={(v) => {
                  const n = parseInt(v, 10);

                  updateDraft({
                    times_per_week: Number.isFinite(n)
                      ? Math.min(7, Math.max(1, n))
                      : 1,
                  });
                }}
              />
            )}
          </div>

          {/* Días */}
          <div>
            <p className="mb-2 text-sm font-medium text-default-700">Días</p>
            <div className="flex flex-wrap gap-2">
              {DAY_CHIPS.map(({ dow, short }) => {
                const selected = draft.days_of_week.includes(dow);

                return (
                  <Button
                    key={dow}
                    className="min-h-10 min-w-10 font-semibold"
                    color={selected ? "primary" : "default"}
                    radius="full"
                    size="sm"
                    variant={selected ? "solid" : "bordered"}
                    onPress={() => toggleDay(dow)}
                  >
                    {short}
                  </Button>
                );
              })}
            </div>
            {inlineErrors.days_of_week ? (
              <p className="mt-2 text-xs text-danger">
                {inlineErrors.days_of_week}
              </p>
            ) : null}
          </div>

          {/* Hora */}
          <Input
            errorMessage={inlineErrors.time}
            isInvalid={Boolean(inlineErrors.time)}
            label="Hora de envío"
            type="time"
            value={toTimeInputValue(draft.time)}
            onValueChange={(v) => updateDraft({ time: fromTimeInputValue(v) })}
          />

          {/* Zona horaria */}
          <div>
            <Autocomplete
              classNames={{ base: "w-full" }}
              defaultItems={timezoneItems.map((id) => ({ id }))}
              errorMessage={inlineErrors.timezone}
              isInvalid={Boolean(inlineErrors.timezone)}
              label="Zona horaria"
              placeholder="Busca zona horaria (IANA)…"
              selectedKey={draft.timezone}
              onSelectionChange={(key) => {
                if (key) {
                  updateDraft({ timezone: String(key) });
                  if (inlineErrors.timezone) {
                    setInlineErrors((e) => {
                      const n = { ...e };

                      delete n.timezone;

                      return n;
                    });
                  }
                }
              }}
            >
              {(item: { id: string }) => (
                <AutocompleteItem
                  key={item.id}
                  textValue={timezoneItemLabel(item.id)}
                >
                  {timezoneItemLabel(item.id)}
                </AutocompleteItem>
              )}
            </Autocomplete>
            <p className="mt-1 text-xs text-default-500">
              Escribe para filtrar entre todas las zonas IANA disponibles en tu
              navegador.
            </p>
          </div>

          {/* Periodo de gracia */}
          <Select
            label="Tiempo límite para completar"
            selectedKeys={new Set([String(draft.grace_period_hours)])}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0];

              if (v) {
                updateDraft({ grace_period_hours: parseInt(String(v), 10) });
              }
            }}
          >
            <>
              {GRACE_OPTIONS.map((o) => (
                <SelectItem key={String(o.value)}>{o.label}</SelectItem>
              ))}
              {!GRACE_OPTIONS.some(
                (o) => o.value === draft.grace_period_hours
              ) ? (
                <SelectItem key={String(draft.grace_period_hours)}>
                  {draft.grace_period_hours} horas (actual)
                </SelectItem>
              ) : null}
            </>
          </Select>

          {/* Vista previa */}
          <Card className="border border-default-200 bg-default-50/80 shadow-none">
            <CardHeader className="flex gap-2 pb-0">
              <Icon
                className="text-primary"
                icon="solar:eye-linear"
                width={22}
              />
              <span className="text-sm font-semibold">Vista previa</span>
            </CardHeader>
            <CardBody className="gap-2 pt-2 text-sm text-default-700">
              {!draft.enabled ? (
                <p>
                  {isTemplate
                    ? "El check-in está desactivado en la plantilla por defecto."
                    : "El check-in está desactivado para este cliente."}
                </p>
              ) : (
                <>
                  <p>
                    Los clientes recibirán su{" "}
                    <strong className="text-foreground">
                      {draft.custom_name.trim() || "check-in"}
                    </strong>
                    : {formatScheduleDescription(draft)} (
                    <span className="font-mono text-xs">{draft.timezone}</span>
                    ).
                  </p>
                  <p>
                    Tendrán <strong>{draft.grace_period_hours}</strong> horas
                    para completarlo.
                  </p>
                </>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col gap-3 border-t border-default-200 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {!hideSaveButton ? (
              <Button
                color="primary"
                isLoading={mutation.isPending}
                startContent={
                  !mutation.isPending ? (
                    <Icon icon="solar:diskette-bold" width={20} />
                  ) : null
                }
                onPress={handleSave}
              >
                Guardar cambios
              </Button>
            ) : null}
            {!isTemplate ? (
              <Button variant="light" onPress={handleRestoreDefaults}>
                Restaurar valores por defecto
              </Button>
            ) : null}
            {isTemplate && showApplyAllClients ? (
              <Button
                color="danger"
                startContent={
                  <Icon icon="solar:users-group-rounded-bold" width={20} />
                }
                variant="flat"
                onPress={applyAllModal.onOpen}
              >
                Aplicar a todos los clientes
              </Button>
            ) : null}
          </div>
          {showDefaultBadge ? (
            <Badge
              classNames={{ base: "max-w-full whitespace-normal h-auto py-1" }}
              color="primary"
              variant="flat"
            >
              Usando configuración por defecto
            </Badge>
          ) : null}
        </div>
      </>
    );
  })();

  const headerBlock = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{editorTitle}</h3>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {isLoading ? (
          <Skeleton className="h-8 w-44 rounded-full" />
        ) : draft ? (
          <Switch
            isSelected={draft.enabled}
            size="sm"
            onValueChange={(v) => {
              updateDraft({ enabled: v });
            }}
          >
            <span className="text-sm font-medium">Check-in activo</span>
          </Switch>
        ) : null}
      </div>
    </div>
  );

  const applyAllModalEl = (
    <Modal
      backdrop="blur"
      isOpen={applyAllModal.isOpen}
      placement="center"
      onOpenChange={applyAllModal.onOpenChange}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Aplicar a todos los clientes
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-600">
            ¿Estás seguro? Esto actualizará la configuración de check-in de
            todos tus clientes activos a estos valores. Los clientes con
            configuraciones personalizadas serán sobrescritos.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={applyAllModal.onClose}>
            Cancelar
          </Button>
          <Button
            color="danger"
            isLoading={batchLoading}
            onPress={handleConfirmApplyAll}
          >
            Sí, aplicar a todos
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  if (embedded) {
    return (
      <>
        <div className="flex flex-col gap-4">
          {headerBlock}
          {bodyContent}
        </div>
        {applyAllModalEl}
      </>
    );
  }

  return (
    <>
      <Card className="w-full shadow-sm">
        <CardHeader className="flex flex-col gap-1 border-b border-default-200 pb-4">
          {headerBlock}
        </CardHeader>
        <CardBody>{bodyContent}</CardBody>
      </Card>
      {applyAllModalEl}
    </>
  );
}

export default CheckInScheduleEditor;
