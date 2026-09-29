// Toolbar del calendario: selector de vista (Mes / Quincena / Semana) y
// fila de título con navegación previa/siguiente + "Hoy" al final. El
// título cambia según la vista activa.

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { SegmentedControl } from "@/components/shared/segmented-control";

export type CalendarView = "month" | "fortnight" | "week";

interface Props {
  view: CalendarView;
  title: string;
  onChangeView: (next: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const VIEW_OPTIONS: readonly { key: CalendarView; label: string }[] = [
  { key: "month", label: "Mes" },
  { key: "fortnight", label: "Quincena" },
  { key: "week", label: "Semana" },
];

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
      <SegmentedControl
        ariaLabel="Vista del calendario"
        options={VIEW_OPTIONS}
        size="md"
        value={view}
        onChange={onChangeView}
      />

      <div className="flex items-center gap-1">
        <Button
          isIconOnly
          aria-label="Anterior"
          size="sm"
          variant="light"
          onPress={onPrev}
        >
          <Icon icon="solar:alt-arrow-left-linear" width={18} />
        </Button>

        <h2 className="flex-1 text-center font-heading text-base font-bold text-foreground first-letter:uppercase">
          {title}
        </h2>

        <Button
          isIconOnly
          aria-label="Siguiente"
          size="sm"
          variant="light"
          onPress={onNext}
        >
          <Icon icon="solar:alt-arrow-right-linear" width={18} />
        </Button>

        <Button size="sm" variant="light" onPress={onToday}>
          Hoy
        </Button>
      </div>
    </div>
  );
}
