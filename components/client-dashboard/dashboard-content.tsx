"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import {
  ClientPage,
  SectionHeader,
} from "@/components/client-dashboard/client-page";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { daysToFetchForChartRange } from "@/lib/forms/chart-helpers";
import {
  formResponsesToSubmittedAtPayload,
  getLocalTodayYmd,
  getLocalYmd,
} from "@/lib/forms/client-helpers";
import {
  formatScheduleDescription,
  getCheckInPeriodStart,
  getScheduleOrDefault,
  isCheckInDue,
} from "@/lib/forms/schedule";
import {
  DEFAULT_CHECKIN_SCHEDULE,
  FormResponse,
  type CheckInSchedule,
} from "@/lib/forms/types";
import { useFormResponses } from "@/lib/hooks/use-client-queries";

/** Weekly default schedule if parsing or chart math fails (Monday 12:00 Europe/Madrid). */
const FALLBACK_CHECKIN_SCHEDULE: CheckInSchedule = {
  ...DEFAULT_CHECKIN_SCHEDULE,
};

/**
 * Días de historial de hábitos que necesita la home: los 3 day-cards
 * de "Registro Diario" solo miran hoy y los 2 días anteriores; 7 días
 * cubre cualquier skew entre el YMD local del cliente y el start_date
 * UTC del fetch.
 */
const HABITS_FETCH_DAYS = 7;

/**
 * Piso de la ventana de fetch de check-ins (cubre cadencia semanal +
 * grace period típico + skew de huso horario).
 */
const MIN_CHECKIN_FETCH_DAYS = 14;

// Code-split: recharts (ChartsSection) y el modal de formularios (1.800+
// líneas) quedan fuera del chunk crítico del portal — el dashboard pinta
// y los chunks llegan después (charts con skeleton; el modal se descarga
// al abrirse).
const ChartsSection = dynamic(
  () =>
    import("@/components/client-dashboard/charts-section").then(
      (m) => m.ChartsSection
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="h-48 rounded-xl bg-default-100 animate-pulse" />
        <div className="h-48 rounded-xl bg-default-100 animate-pulse" />
      </div>
    ),
  }
);

const DynamicFormModal = dynamic(
  () =>
    import("@/components/client-dashboard/dynamic-form-modal").then(
      (m) => m.DynamicFormModal
    ),
  { ssr: false }
);

/**
 * Opciones del selector de período de Progreso. Las keys deben matchear
 * lo que `chartPeriodCountForRange` (lib/forms/chart-helpers) y el
 * snapshot endpoint de charts entienden — no cambiar sin alinear ambos.
 */
const PERIOD_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "7d", label: "7 Días" },
  { key: "14d", label: "14 Días" },
  { key: "30d", label: "30 Días" },
  { key: "3m", label: "3 Meses" },
  { key: "6m", label: "6 Meses" },
  { key: "12m", label: "12 Meses" },
];

export function DashboardContent() {
  const { clientId } = useClientData();

  const queryClient = useQueryClient();

  const { data: checkinsConfigJson, isPending: isCheckinConfigLoading } =
    useQuery({
      queryKey: ["client", "formConfig", clientId, "checkins"],
      queryFn: async () => {
        try {
          const res = await clientFetch(
            `/api/forms/configs/${clientId}?form_type=checkins`,
            { cache: "no-store" }
          );

          return (await res.json()) as {
            success?: boolean;
            schedule?: unknown;
          };
        } catch {
          return { success: false as const };
        }
      },
      enabled: Boolean(clientId),
    });

  const checkinSchedule = useMemo((): CheckInSchedule => {
    try {
      return getScheduleOrDefault(
        (checkinsConfigJson?.schedule ?? null) as CheckInSchedule | null
      );
    } catch {
      return { ...FALLBACK_CHECKIN_SCHEDULE };
    }
  }, [checkinsConfigJson?.schedule]);

  // State
  const [selectedDayForForm, setSelectedDayForForm] = useState<string | null>(
    null
  );
  const [showWeeklyFormModal, setShowWeeklyFormModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("7d");

  // Ventana de fetch de check-ins, DESACOPLADA del selector de período
  // de Progreso: las gráficas leen de su propio endpoint (query
  // `chartsSnapshot` en charts-section), así que aquí solo hace falta
  // lo que `isCheckInDue` consulta — respuestas dentro de la ventana
  // abierta, que arranca en el trigger del período actual
  // (getCheckInPeriodStart). Fetch desde ese trigger (+3 días de buffer
  // vía daysToFetchForChartRange). Antes esta ventana seguía al
  // selector y podía pedir ~365 días de respuestas completas solo para
  // pintar el banner y 3 day-cards.
  const checkinFetchDays = useMemo(() => {
    try {
      const periodStart = getCheckInPeriodStart(checkinSchedule);

      return Math.max(
        MIN_CHECKIN_FETCH_DAYS,
        daysToFetchForChartRange(periodStart)
      );
    } catch {
      return MIN_CHECKIN_FETCH_DAYS;
    }
  }, [checkinSchedule]);

  // ─── TanStack Query: cached data fetching (ventana mínima por consumer) ─
  const {
    data: weeklyResponses = [] as FormResponse[],
    isLoading: isLoadingWeekly,
    isError: isErrorWeekly,
  } = useFormResponses(clientId, "checkins", checkinFetchDays);

  const {
    data: dailyResponses = [] as FormResponse[],
    isLoading: isLoadingDaily,
    isError: isErrorDaily,
  } = useFormResponses(clientId, "habits", HABITS_FETCH_DAYS);

  const isLoadingForms = isLoadingWeekly || isLoadingDaily;
  const isErrorForms = isErrorWeekly || isErrorDaily;

  // "Hoy" en Y-M-D del huso local. Mantener este state alineado con
  // `Intl.DateTimeFormat()` que usa el snapshot fetch evita que el
  // dashboard se "atrase" después de medianoche.
  //
  // Tres mecanismos combinados para resistir todos los escenarios de
  // tab abierta cruzando medianoche:
  //
  //  1. setTimeout one-shot apuntando a la PRÓXIMA medianoche local
  //     exacta (+ reschedule al disparar). Da precisión de ms en
  //     lugar de los hasta 60s del setInterval anterior.
  //  2. document `visibilitychange` listener — dispara cuando la tab
  //     pasa de hidden→visible (típico cuando el cliente vuelve a la
  //     app desde otra pantalla, sin necesariamente cliquear). El
  //     `window.focus` solo no cubría este caso.
  //  3. setInterval de 60s como red de seguridad por si ambos
  //     mecanismos anteriores no se disparan en algún navegador
  //     poco amigable (PWA en standalone con throttling agresivo).
  //
  // Sin esto, Chrome/Safari throttean los timers en background y la
  // gráfica (que usa Intl en cada fetch fresh) podía mostrar el día
  // nuevo mientras "Registro Diario" seguía atascado en el día
  // anterior.
  const [todayYmd, setTodayYmd] = useState(() => getLocalTodayYmd());

  useEffect(() => {
    const refresh = () => {
      const next = getLocalTodayYmd();

      setTodayYmd((prev) => (prev === next ? prev : next));
    };

    let midnightTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextMidnight = () => {
      const now = new Date();
      const tomorrow = new Date(now);

      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      // 100ms de buffer para asegurar que `getLocalTodayYmd()` ya
      // devuelva el día nuevo cuando dispara.
      const msUntilMidnight = tomorrow.getTime() - now.getTime() + 100;

      midnightTimeout = setTimeout(() => {
        refresh();
        scheduleNextMidnight();
      }, msUntilMidnight);
    };

    scheduleNextMidnight();

    const fallbackInterval = setInterval(refresh, 60_000);

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      if (midnightTimeout) clearTimeout(midnightTimeout);
      clearInterval(fallbackInterval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // Indexa las respuestas diarias por `response_date` una sola vez
  // (evita un `find()` por card en cada render de `dailyFormDays`).
  const responsesByDate = useMemo(() => {
    const map = new Map<string, FormResponse>();

    for (const r of dailyResponses) {
      map.set(r.response_date, r);
    }

    return map;
  }, [dailyResponses]);

  const showWeeklyBanner = useMemo(() => {
    if (isLoadingForms || isCheckinConfigLoading || !checkinSchedule.enabled) {
      return false;
    }

    try {
      return isCheckInDue(
        checkinSchedule,
        formResponsesToSubmittedAtPayload(weeklyResponses)
      );
    } catch {
      return false;
    }
  }, [
    isLoadingForms,
    isCheckinConfigLoading,
    checkinSchedule,
    weeklyResponses,
  ]);
  // Anclamos los memos del "calendario local" a `todayYmd` (estado
  // refrescado por el effect de medianoche). Construir el Date desde
  // `${ymd}T00:00:00` lo deja en huso local, igual que getLocalYmd.
  const dailyFormDays = useMemo(() => {
    const anchor = new Date(`${todayYmd}T00:00:00`);
    const days: {
      date: string;
      label: string;
      dayName: string;
      isToday: boolean;
      isSubmitted: boolean;
    }[] = [];

    for (let i = 0; i < 3; i++) {
      const d = new Date(anchor);

      d.setDate(anchor.getDate() - i);
      const dateStr = getLocalYmd(d);

      days.push({
        date: dateStr,
        label: d.toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
        }),
        dayName: d.toLocaleDateString("es-ES", { weekday: "long" }),
        isToday: i === 0,
        isSubmitted: responsesByDate.has(dateStr),
      });
    }

    return days;
  }, [responsesByDate, todayYmd]);

  // Check-in pendiente: la acción más importante de la semana, así que se
  // funde con la barra de marca de Inicio (misma superficie bg-primary +
  // primary-foreground calculado por contraste). El CTA invierte la pareja
  // y usa la marca cruda (no .text-primary, que con marcas pálidas aplica
  // una tinta oscurecida pensada para el lienzo claro).
  const checkinExtension = showWeeklyBanner ? (
    <div className="border-t border-primary-foreground/15 pt-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-primary-foreground/15">
          <Icon
            aria-hidden
            className="text-primary-foreground"
            icon="solar:clipboard-list-bold"
            width={22}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-base leading-snug text-primary-foreground">
            {`Tu ${checkinSchedule.custom_name} te espera`}
          </p>
          <p className="mt-0.5 text-sm text-primary-foreground/85">
            Completa tu seguimiento para que tu entrenador vea cómo va la semana
            · {formatScheduleDescription(checkinSchedule)}
          </p>
        </div>
      </div>
      <Button
        aria-label={`Completar ${checkinSchedule.custom_name}`}
        className="mt-4 w-full bg-primary-foreground font-semibold text-[hsl(var(--heroui-primary))]"
        endContent={<Icon icon="solar:alt-arrow-right-linear" width={18} />}
        onPress={() => setShowWeeklyFormModal(true)}
      >
        Empezar check-in
      </Button>
    </div>
  ) : null;

  return (
    <>
      <ClientPage
        heroExtension={checkinExtension}
        onOpenDailyForm={() => setSelectedDayForForm(getLocalTodayYmd())}
        onOpenWeeklyForm={() => setShowWeeklyFormModal(true)}
      >
        {/* Banner de error cuando falla la carga de respuestas. No
              tumba la página — sigue mostrando el resto de secciones,
              pero avisa al cliente que algo se cargó incompleto. */}
        {isErrorForms && (
          <div className="mb-4 px-4" role="alert">
            <div className="rounded-large bg-danger/10 p-3 flex items-start gap-3">
              <Icon
                aria-hidden
                className="text-danger flex-shrink-0 mt-0.5"
                icon="solar:danger-triangle-bold"
                width={20}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-danger">
                  No pudimos cargar tus registros
                </p>
                <p className="text-xs text-default-600 mt-0.5">
                  Recarga la página o vuelve a intentarlo en un momento.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Registro diario — 3 cards (hoy + 2 anteriores). Skeleton con
              el mismo alto durante la carga para evitar CLS.

              Theme-safe multi-tenant: las 3 cards son superficie neutra
              (`bg-content1 shadow-small`); "hoy" se marca con anillo
              `ring-primary` + chip sólido `bg-primary text-primary-foreground`
              (par con contraste garantizado por el pipeline de tema).
              Estado: enviado → chip success; hoy sin enviar → chip de marca
              (accionable); días pasados sin enviar → chip neutro. */}
        {isLoadingForms ? (
          <div className="mb-4 px-4">
            <SectionHeader title="Registro diario" />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  aria-hidden
                  className="rounded-large bg-default-100 h-[100px] animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-4 px-4">
            <SectionHeader title="Registro diario" />
            <div className="grid grid-cols-3 gap-2">
              {dailyFormDays.map((day) => (
                <button
                  key={day.date}
                  aria-label={`Abrir registro de ${day.dayName} ${day.label}${
                    day.isToday ? ", hoy" : ""
                  }, ${
                    day.isSubmitted
                      ? "enviado"
                      : day.isToday
                        ? "pendiente"
                        : "sin registro"
                  }`}
                  className={`flex flex-col items-center rounded-large bg-content1 p-3 shadow-small transition-transform active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    day.isToday ? "ring-2 ring-primary" : ""
                  }`}
                  type="button"
                  onClick={() => setSelectedDayForForm(day.date)}
                >
                  <span className="text-sm font-bold capitalize mt-1 text-foreground">
                    {day.label}
                  </span>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs capitalize text-default-600">
                      {day.dayName}
                    </span>
                    {day.isToday ? (
                      <span className="text-[11px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-small leading-none">
                        Hoy
                      </span>
                    ) : null}
                  </div>
                  {day.isSubmitted ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10">
                      <Icon
                        aria-hidden
                        className="text-success-700"
                        icon="solar:check-circle-bold"
                        width={14}
                      />
                      <span className="text-[11px] font-semibold text-success-700">
                        Enviado
                      </span>
                    </div>
                  ) : day.isToday ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10">
                      <Icon
                        aria-hidden
                        className="text-primary"
                        icon="solar:pen-linear"
                        width={14}
                      />
                      <span className="whitespace-nowrap text-[11px] font-semibold text-primary">
                        Pendiente
                      </span>
                    </div>
                  ) : (
                    <div className="px-2 py-0.5 rounded-full bg-default-100">
                      <span className="whitespace-nowrap text-[11px] font-medium text-default-600">
                        Sin registro
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Check-in modal. `onSuccess` invalida formResponses,
              formConfig (puede haber cambiado el shape del check-in si
              el trainer lo editó) Y `chartsSnapshot` con prefix-match
              que cubre TODOS los selectedPeriod cacheados (7d/30d/etc).
              Sin la invalidación de chartsSnapshot, las gráficas
              quedaban hasta 60s con datos viejos tras un submit
              exitoso — era la queja #1 de los clientes. El modal
              espera el await antes de cerrar, así garantizamos que
              el refetch llegó antes de que el usuario navegue. */}
        {showWeeklyFormModal && (
          <DynamicFormModal
            isOpen
            clientId={clientId}
            formType="checkins"
            schedule={checkinSchedule}
            onClose={() => setShowWeeklyFormModal(false)}
            onSuccess={async () => {
              await Promise.all([
                queryClient.invalidateQueries({
                  queryKey: ["client", "formResponses", clientId, "checkins"],
                }),
                queryClient.invalidateQueries({
                  queryKey: ["client", "formConfig", clientId, "checkins"],
                }),
                queryClient.invalidateQueries({
                  queryKey: ["client", "chartsSnapshot", String(clientId)],
                }),
              ]);
            }}
          />
        )}

        {/* Daily Habits Modal — mismo patrón que el check-in. Montado solo
              al abrir: así el chunk del modal no se descarga hasta que hace
              falta. */}
        {selectedDayForForm !== null && (
          <DynamicFormModal
            isOpen
            clientId={clientId}
            formType="habits"
            targetDate={selectedDayForForm}
            onClose={() => setSelectedDayForForm(null)}
            onSuccess={async () => {
              await Promise.all([
                queryClient.invalidateQueries({
                  queryKey: ["client", "formResponses", clientId, "habits"],
                }),
                queryClient.invalidateQueries({
                  queryKey: ["client", "chartsSnapshot", String(clientId)],
                }),
              ]);
            }}
          />
        )}

        {/* Progress Section */}
        <div className="px-4 space-y-4">
          <SectionHeader className="mb-0" title="Progreso" />

          <SegmentedControl
            ariaLabel="Seleccionar período de progreso"
            options={PERIOD_OPTIONS}
            value={selectedPeriod}
            onChange={setSelectedPeriod}
          />

          <ChartsSection clientId={clientId} selectedPeriod={selectedPeriod} />
        </div>
      </ClientPage>
      <ClientBottomNav />
    </>
  );
}
