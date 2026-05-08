// Selector horizontal de los 7 días de una semana, con navegación
// adelante/atrás.
//
// Por qué: el cliente elige qué día está entrenando. Por defecto la
// semana actual con hoy seleccionado, pero puede retroceder hasta 30
// días atrás para registrar entrenamientos pasados o editarlos. No
// puede ir más allá del domingo de la semana actual — los planes
// futuros viven en el microciclo del entrenador, no acá.
//
// Mantenemos `weekAnchor` como estado interno (lunes de la semana
// visible). Cuando el padre cambia `selectedDate` a un día fuera de
// la semana visible (p.ej. al hidratar desde localStorage), un useEffect
// resincroniza el anchor para que el día seleccionado quede visible.

"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { getLocalYmd } from "@/lib/forms/client-helpers";

interface Props {
  selectedDate: string;
  onSelect: (ymd: string) => void;
  // Fecha "hoy" en YMD local — se pasa desde arriba para que la decisión
  // de qué semana renderizar sea estable entre re-renders.
  todayYmd: string;
  // Cuántos días hacia atrás puede navegar el cliente. Default 30.
  maxBackDays?: number;
  // Set de fechas (YYYY-MM-DD) que tienen al menos un exercise_log.
  // Se pinta un puntito en esos días para indicar actividad.
  datesWithActivity?: Set<string>;
}

const WEEKDAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const DEFAULT_MAX_BACK_DAYS = 30;

interface DayCell {
  ymd: string;
  letter: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isOutOfRange: boolean;
}

function parseYmd(ymd: string): Date {
  const [yyyy, mm, dd] = ymd.split("-").map(Number);

  return new Date(yyyy ?? 1970, (mm ?? 1) - 1, dd ?? 1);
}

// Retorna el lunes (en local) de la semana que contiene `ymd`.
function getMondayOf(ymd: string): string {
  const d = parseYmd(ymd);
  const dow = d.getDay();
  const offsetToMonday = dow === 0 ? -6 : -(dow - 1);

  d.setDate(d.getDate() + offsetToMonday);

  return getLocalYmd(d);
}

function addDays(ymd: string, days: number): string {
  const d = parseYmd(ymd);

  d.setDate(d.getDate() + days);

  return getLocalYmd(d);
}

function buildWeek(
  weekAnchorYmd: string,
  todayYmd: string,
  earliestAllowedYmd: string,
  latestAllowedYmd: string
): DayCell[] {
  return Array.from({ length: 7 }, (_, i) => {
    const ymd = addDays(weekAnchorYmd, i);
    const d = parseYmd(ymd);

    return {
      ymd,
      letter: WEEKDAY_LETTERS[i] ?? "",
      dayNumber: d.getDate(),
      isToday: ymd === todayYmd,
      isPast: ymd < todayYmd,
      isFuture: ymd > todayYmd,
      isOutOfRange: ymd < earliestAllowedYmd || ymd > latestAllowedYmd,
    };
  });
}

// Etiqueta "Semana del 5 al 11 de mayo" — incluye mes solo en los
// extremos cuando difieren (p.ej. "29 de abr al 5 de mayo").
function formatWeekRangeLabel(mondayYmd: string): string {
  const monday = parseYmd(mondayYmd);
  const sunday = parseYmd(addDays(mondayYmd, 6));
  const sameMonth = monday.getMonth() === sunday.getMonth();

  try {
    if (sameMonth) {
      const month = new Intl.DateTimeFormat("es-ES", { month: "long" }).format(
        monday
      );

      return `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${month}`;
    }
    const fmt = new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
    });

    return `Semana del ${fmt.format(monday)} al ${fmt.format(sunday)}`.replace(
      /\./g,
      ""
    );
  } catch {
    return `Semana del ${mondayYmd}`;
  }
}

export function WeekDateSelector({
  selectedDate,
  onSelect,
  todayYmd,
  maxBackDays = DEFAULT_MAX_BACK_DAYS,
  datesWithActivity,
}: Props) {
  // El anchor empieza alineado al lunes del día seleccionado: si el
  // cliente abre la pantalla con un selectedDate hidratado de
  // localStorage que cae en una semana anterior, ya arrancamos
  // mostrando esa semana.
  const [weekAnchor, setWeekAnchor] = useState<string>(() =>
    getMondayOf(selectedDate)
  );

  // Si selectedDate cambia y queda fuera de la semana visible (p.ej.
  // restauración asíncrona, o al saltar a hoy desde un botón externo
  // futuro), resincronizamos el anchor. weekAnchor no se incluye a
  // propósito — solo reaccionamos a cambios externos de selectedDate,
  // no a cambios internos del anchor.
  useEffect(() => {
    setWeekAnchor((prev) => {
      const expected = getMondayOf(selectedDate);

      return prev === expected ? prev : expected;
    });
  }, [selectedDate]);

  // Rango permitido: 30 días atrás como mínimo, domingo de la semana
  // actual como máximo.
  const earliestAllowed = useMemo(
    () => addDays(todayYmd, -maxBackDays),
    [todayYmd, maxBackDays]
  );
  const latestAllowed = useMemo(() => {
    const todayMonday = getMondayOf(todayYmd);

    return addDays(todayMonday, 6);
  }, [todayYmd]);

  const week = useMemo(
    () => buildWeek(weekAnchor, todayYmd, earliestAllowed, latestAllowed),
    [weekAnchor, todayYmd, earliestAllowed, latestAllowed]
  );

  const prevAnchor = useMemo(() => addDays(weekAnchor, -7), [weekAnchor]);
  const nextAnchor = useMemo(() => addDays(weekAnchor, 7), [weekAnchor]);

  // Permitimos retroceder mientras quede al menos un día de la semana
  // anterior dentro del rango permitido (i.e. el domingo de esa semana
  // ≥ earliestAllowed).
  const canGoPrev = addDays(prevAnchor, 6) >= earliestAllowed;
  // Avance: el lunes de la próxima semana debe ser ≤ latestAllowed
  // (que ya está topado al domingo de hoy → bloquea cualquier semana
  // posterior).
  const canGoNext = nextAnchor <= latestAllowed;

  const headerLabel = formatWeekRangeLabel(weekAnchor);
  // Solo mostramos el subtítulo ("Hoy" / "Ayer" / "Lunes 5 de mayo") si
  // el día seleccionado vive dentro de la semana visible. Si el cliente
  // navegó a una semana anterior sin tocar un día, no tiene sentido
  // seguir mostrando "Hoy" — la fecha seleccionada ni siquiera está en
  // pantalla.
  const sundayOfVisible = addDays(weekAnchor, 6);
  const isSelectedInVisibleWeek =
    selectedDate >= weekAnchor && selectedDate <= sundayOfVisible;
  const subtitleLabel = isSelectedInVisibleWeek
    ? formatSelectedLabel(selectedDate, todayYmd)
    : null;

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <Button
          isIconOnly
          aria-label="Semana anterior"
          isDisabled={!canGoPrev}
          size="sm"
          variant="light"
          onPress={() => setWeekAnchor(prevAnchor)}
        >
          <Icon icon="solar:alt-arrow-left-linear" width={18} />
        </Button>
        <div className="flex flex-col items-center text-center">
          <p className="text-[11px] font-body uppercase tracking-wide text-foreground/50">
            {headerLabel}
          </p>
          {subtitleLabel ? (
            <p className="text-xs font-body text-foreground/70">
              {subtitleLabel}
            </p>
          ) : null}
        </div>
        <Button
          isIconOnly
          aria-label="Semana siguiente"
          isDisabled={!canGoNext}
          size="sm"
          variant="light"
          onPress={() => setWeekAnchor(nextAnchor)}
        >
          <Icon icon="solar:alt-arrow-right-linear" width={18} />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((d) => {
          const isSelected = d.ymd === selectedDate;
          const hasActivity = datesWithActivity?.has(d.ymd) ?? false;
          const baseClass =
            "flex flex-col items-center justify-center rounded-xl py-2 transition-colors relative aspect-square disabled:opacity-30 disabled:cursor-not-allowed";
          const stateClass = d.isOutOfRange
            ? "bg-default-50 text-foreground/40"
            : isSelected
              ? "bg-primary text-primary-foreground"
              : d.isToday
                ? "bg-content1 text-foreground border-2 border-primary"
                : d.isPast
                  ? "bg-default-50 text-foreground/60"
                  : "bg-content1 text-foreground border border-default-200";

          // El puntito de actividad: success cuando hay logs ese día.
          // Si está seleccionado el bg ya es primary, así que usamos
          // primary-foreground para que el dot se lea contra el fondo.
          // Si no hay actividad pero es hoy, mantenemos el dot primary
          // viejo como hint visual de "estás acá".
          let dotClass: string | null = null;

          if (hasActivity) {
            dotClass = isSelected ? "bg-primary-foreground" : "bg-success";
          } else if (d.isToday && !isSelected) {
            dotClass = "bg-primary";
          }

          return (
            <button
              key={d.ymd}
              aria-label={`Seleccionar día ${d.dayNumber}`}
              aria-pressed={isSelected}
              className={`${baseClass} ${stateClass}`}
              disabled={d.isOutOfRange}
              type="button"
              onClick={() => onSelect(d.ymd)}
            >
              <span
                className={`text-[10px] font-body uppercase ${
                  isSelected ? "opacity-90" : "opacity-70"
                }`}
              >
                {d.letter}
              </span>
              <span className="text-base font-heading font-bold leading-none mt-0.5">
                {d.dayNumber}
              </span>
              {dotClass ? (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${dotClass}`}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// "Hoy" / "Ayer" / "Mañana" / "Lunes 12 de mayo".
function formatSelectedLabel(selectedYmd: string, todayYmd: string): string {
  if (selectedYmd === todayYmd) return "Hoy";
  const d = parseYmd(selectedYmd);
  const today = parseYmd(todayYmd);
  const diffDays = Math.round(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === -1) return "Ayer";
  if (diffDays === 1) return "Mañana";

  try {
    const formatted = new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(d);

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return selectedYmd;
  }
}
