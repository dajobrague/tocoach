// Toolbar del calendario: navegación previa/hoy/siguiente + selector de
// vista en pestañas (Mes / Quincena / Semana). El título cambia según
// la vista activa.

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

export type CalendarView = "month" | "fortnight" | "week";

interface Props {
  view: CalendarView;
  title: string;
  onChangeView: (next: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const VIEW_LABEL: Record<CalendarView, string> = {
  month: "Mes",
  fortnight: "Quincena",
  week: "Semana",
};

export function CalendarHeader({
  view,
  title,
  onChangeView,
  onPrev,
  onNext,
  onToday,
}: Props) {
  return (
    <div className="space-y-3">
      <div
        aria-label="Vista del calendario"
        className="flex rounded-lg bg-default-100 p-1"
        role="tablist"
      >
        {(Object.keys(VIEW_LABEL) as CalendarView[]).map((v) => {
          const isActive = v === view;

          return (
            <button
              key={v}
              aria-selected={isActive}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "bg-white text-foreground shadow-sm"
                  : "text-default-500 hover:text-default-700"
              }`}
              role="tab"
              type="button"
              onClick={() => onChangeView(v)}
            >
              {VIEW_LABEL[v]}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          isIconOnly
          aria-label="Anterior"
          size="sm"
          variant="flat"
          onPress={onPrev}
        >
          <Icon className="text-lg" icon="solar:alt-arrow-left-bold" />
        </Button>

        <h2 className="font-heading font-bold text-base text-foreground text-center flex-1">
          {title}
        </h2>

        <Button
          isIconOnly
          aria-label="Siguiente"
          size="sm"
          variant="flat"
          onPress={onNext}
        >
          <Icon className="text-lg" icon="solar:alt-arrow-right-bold" />
        </Button>
      </div>

      <div className="flex justify-center">
        <Button color="primary" size="sm" variant="flat" onPress={onToday}>
          Hoy
        </Button>
      </div>
    </div>
  );
}
