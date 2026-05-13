"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { ChartsSection } from "@/components/client-dashboard/charts-section";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { DynamicFormModal } from "@/components/client-dashboard/dynamic-form-modal";
import { clientFetch } from "@/lib/auth/client-token-storage";
import {
  chartPeriodCountForRange,
  daysToFetchForChartRange,
  getChartDateRange,
} from "@/lib/forms/chart-helpers";
import {
  formResponsesToSubmittedAtPayload,
  getLocalTodayYmd,
  getLocalYmd,
} from "@/lib/forms/client-helpers";
import {
  formatScheduleDescription,
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
 * Opciones del selector de período de Progreso. Las keys deben matchear
 * lo que `chartPeriodCountForRange` (lib/forms/chart-helpers) y el
 * snapshot endpoint de charts entienden — no cambiar sin alinear ambos.
 */
const PERIOD_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "7d", label: "7 Días" },
  { key: "30d", label: "30 Días" },
  { key: "3m", label: "3 Meses" },
  { key: "6m", label: "6 Meses" },
  { key: "12m", label: "12 Meses" },
];

export function DashboardContent() {
  const {
    clientId,
    firstName,
    logoUrl,
    trainerName,
    clientProfilePicture,
    tenantSlug,
  } = useClientData();

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

  const chartPeriodCount = useMemo(() => {
    try {
      return chartPeriodCountForRange(selectedPeriod, checkinSchedule);
    } catch {
      return chartPeriodCountForRange(
        selectedPeriod,
        FALLBACK_CHECKIN_SCHEDULE
      );
    }
  }, [selectedPeriod, checkinSchedule]);

  const fetchDays = useMemo(() => {
    try {
      const { from } = getChartDateRange(checkinSchedule, chartPeriodCount);

      return Math.max(14, daysToFetchForChartRange(from), 7);
    } catch {
      const { from } = getChartDateRange(
        FALLBACK_CHECKIN_SCHEDULE,
        chartPeriodCount
      );

      return Math.max(14, daysToFetchForChartRange(from), 7);
    }
  }, [checkinSchedule, chartPeriodCount]);

  // ─── TanStack Query: cached data fetching (range from schedule periods) ─
  const {
    data: weeklyResponses = [] as FormResponse[],
    isLoading: isLoadingWeekly,
    isError: isErrorWeekly,
  } = useFormResponses(clientId, "checkins", fetchDays);

  const {
    data: dailyResponses = [] as FormResponse[],
    isLoading: isLoadingDaily,
    isError: isErrorDaily,
  } = useFormResponses(clientId, "habits", fetchDays);

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

  // Indexa las respuestas diarias por `response_date` una sola vez.
  // Antes hacíamos `dailyResponses.find()` en `dailyFormDays` — con
  // `fetchDays` hasta ~365 días eso era O(n·m) por render.
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

  return (
    <>
      {/* pb-28 da clearance para iPhone con safe-area-inset (~34px) +
          bottom-nav (~60px) + un buffer. Antes pb-20 dejaba la última
          card del scroll tapada por unos 30px. */}
      <div className="min-h-screen bg-background pb-28">
        <div className="max-w-lg mx-auto">
          {/* Top Header */}
          <ClientHeader
            clientId={clientId}
            clientProfilePicture={clientProfilePicture}
            firstName={firstName}
            logoUrl={logoUrl}
            tenantSlug={tenantSlug}
            trainerName={trainerName}
            onOpenDailyForm={() => setSelectedDayForForm(getLocalTodayYmd())}
            onOpenWeeklyForm={() => setShowWeeklyFormModal(true)}
          />

          {/* Banner de error cuando falla la carga de respuestas. No
              tumba la página — sigue mostrando el resto de secciones,
              pero avisa al cliente que algo se cargó incompleto. */}
          {isErrorForms && (
            <div className="mb-4 px-4" role="alert">
              <div className="rounded-large border border-danger/20 bg-danger/5 p-3 flex items-start gap-3">
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
                  <p className="text-[11px] text-foreground/60 mt-0.5">
                    Recarga la página o vuelve a intentarlo en un momento.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Check-in banner cuando el schedule está activo y la
              ventana actual está vencida. Mismo recipe que el error
              banner de arriba (border-warning/20 + bg-warning/5 +
              icon chip) para visual parity con el resto del
              dashboard, en lugar del bloque amarillo full-bleed
              legacy. El título original (custom_name del trainer)
              vive ahora dentro de la card. */}
          {showWeeklyBanner && (
            <div className="mb-4 px-4">
              <div className="rounded-large border border-warning/20 bg-warning/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 bg-warning/10 p-2 rounded-full">
                    <Icon
                      aria-hidden
                      className="text-warning-600"
                      icon="solar:clipboard-list-bold"
                      width={24}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-foreground">
                      {`Tu ${checkinSchedule.custom_name} te espera`}
                    </p>
                    <p className="text-sm text-foreground/70 mt-0.5">
                      Completa tu seguimiento para que tu entrenador vea cómo va
                      la semana.
                    </p>
                    <p className="text-xs text-foreground/50 mt-1">
                      {formatScheduleDescription(checkinSchedule)}
                    </p>
                  </div>
                </div>
                <Button
                  aria-label={`Completar ${checkinSchedule.custom_name}`}
                  className="mt-3 w-full font-semibold"
                  color="warning"
                  endContent={
                    <Icon icon="solar:alt-arrow-right-bold" width={18} />
                  }
                  variant="solid"
                  onPress={() => setShowWeeklyFormModal(true)}
                >
                  Empezar Check-in
                </Button>
              </div>
            </div>
          )}

          {/* Registro Diario — 3 cards (hoy + 2 anteriores). Reservamos
              el alto durante el loading con skeleton para evitar CLS;
              antes la sección entera aparecía de golpe.

              Estrategia de color theme-safe (multi-tenant: cada
              entrenador tiene un primary distinto, desde teal saturado
              a azul pastel — no podemos asumir luminancia). Las 3
              cards comparten `bg-content1` neutro y la diferenciación
              de "hoy" es solo borde + chip:

                · `border-2 border-primary` — borde grueso para que se
                  perciba como acento, no línea fina.
                · Chip "HOY" sólido con `bg-primary text-primary-foreground`,
                  el ÚNICO par theme-token con contraste garantizado por
                  el tailwind.config.js (cada tenant define el foreground
                  explícito al hacer override del primary). En cualquier
                  tenant el chip se lee.

              Antes intentamos `bg-primary/10` y `bg-primary-50` como
              fondo del card — en tenants con primary saturado el texto
              negro encima quedaba ilegible y la pildora warning encima
              se enturbiaba. Ahora todo el contenido interno vive sobre
              fondo neutro y conserva su contraste natural. */}
          {isLoadingForms ? (
            <div className="mb-4 px-4">
              <h2 className="text-lg font-semibold font-heading mb-3 text-foreground">
                Registro Diario
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="rounded-xl bg-default-50 border-[1.5px] border-default-200 h-[100px] animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-4 px-4">
              <h2 className="text-lg font-semibold font-heading mb-3 text-foreground">
                Registro Diario
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {dailyFormDays.map((day) => (
                  <button
                    key={day.date}
                    aria-label={`Abrir registro de ${day.dayName} ${day.label}${
                      day.isToday ? ", hoy" : ""
                    }, ${day.isSubmitted ? "enviado" : "pendiente"}`}
                    className={`flex flex-col items-center rounded-xl p-3 transition-all active:scale-[0.97] cursor-pointer shadow-sm border-2 bg-content1 ${
                      day.isToday ? "border-primary" : "border-default-200"
                    }`}
                    type="button"
                    onClick={() => setSelectedDayForForm(day.date)}
                  >
                    <span className="text-sm font-bold capitalize mt-1 text-foreground">
                      {day.label}
                    </span>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs capitalize text-foreground/60">
                        {day.dayName}
                      </span>
                      {day.isToday ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded leading-none">
                          Hoy
                        </span>
                      ) : null}
                    </div>
                    {day.isSubmitted ? (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10">
                        <Icon
                          aria-hidden
                          className="text-success"
                          icon="solar:check-circle-bold"
                          width={14}
                        />
                        <span className="text-[11px] font-semibold text-success">
                          Enviado
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10">
                        <Icon
                          aria-hidden
                          className="text-warning-600"
                          icon="solar:clock-circle-bold"
                          width={14}
                        />
                        <span className="text-[11px] font-semibold text-warning-600">
                          Pendiente
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
          <DynamicFormModal
            clientId={clientId}
            formType="checkins"
            isOpen={showWeeklyFormModal}
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

          {/* Daily Habits Modal — mismo patrón que el check-in. */}
          <DynamicFormModal
            clientId={clientId}
            formType="habits"
            isOpen={selectedDayForForm !== null}
            targetDate={selectedDayForForm ?? undefined}
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

          {/* Progress Section */}
          <div className="px-4 space-y-4">
            <h2 className="text-lg font-semibold font-heading text-foreground">
              Progreso
            </h2>

            {/* Selector de período. Usamos el mismo patrón de segmented
                control manual que `training-tabs.tsx` (track soft +
                pill activa con shadow) en lugar de <Tabs> de HeroUI —
                el variant="bordered" + color="primary" se sentía como
                control de formulario y desfasaba visualmente con los
                cards soft de abajo. */}
            <div
              aria-label="Seleccionar período de progreso"
              className="flex rounded-lg bg-default-100 p-1 w-full"
              role="tablist"
            >
              {PERIOD_OPTIONS.map(({ key, label }) => {
                const isActive = selectedPeriod === key;

                return (
                  <button
                    key={key}
                    aria-selected={isActive}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs transition ${
                      isActive
                        ? "bg-content1 text-foreground shadow-sm font-medium"
                        : "text-default-500 hover:text-default-700 font-normal"
                    }`}
                    role="tab"
                    type="button"
                    onClick={() => setSelectedPeriod(key)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <ChartsSection
              clientId={clientId}
              selectedPeriod={selectedPeriod}
            />
          </div>
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}
