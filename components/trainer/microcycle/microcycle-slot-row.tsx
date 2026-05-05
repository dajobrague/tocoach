// Una fila del microciclo: "Día N" + Select para elegir sesión / descanso
// + Chip con tag visual del tipo (Fuerza / Cardio / Descanso / etc.).

import type { Session, SessionType } from "@/types/training";

import { Chip, Select, SelectItem } from "@heroui/react";

const REST_VALUE = "__rest__";

const TYPE_LABEL: Record<SessionType, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  flexibility: "Flexibilidad",
  sports: "Deportes",
  recovery: "Descanso activo",
  other: "Otro",
};

const TYPE_COLOR: Record<
  SessionType,
  "primary" | "danger" | "warning" | "secondary" | "success" | "default"
> = {
  strength: "primary",
  cardio: "danger",
  flexibility: "secondary",
  sports: "warning",
  recovery: "success",
  other: "default",
};

interface Props {
  dayIndex: number;
  selectedSessionId: string | null; // null = descanso explícito
  availableSessions: Session[];
  isDisabled?: boolean;
  onChange: (sessionId: string | null) => void;
}

export default function MicrocycleSlotRow({
  dayIndex,
  selectedSessionId,
  availableSessions,
  isDisabled = false,
  onChange,
}: Props) {
  const selectedKey = selectedSessionId ?? REST_VALUE;
  const selectedSession =
    selectedSessionId === null
      ? null
      : (availableSessions.find((s) => s.id === selectedSessionId) ?? null);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-16 shrink-0 text-sm font-medium text-default-700">
        Día {dayIndex}
      </div>
      <Select
        aria-label={`Sesión del día ${dayIndex}`}
        className="flex-1"
        isDisabled={isDisabled}
        selectedKeys={[selectedKey]}
        size="sm"
        onSelectionChange={(keys) => {
          const next = Array.from(keys)[0];

          if (next === REST_VALUE || next === undefined) {
            onChange(null);

            return;
          }
          onChange(String(next));
        }}
      >
        <>
          <SelectItem key={REST_VALUE} textValue="Descanso">
            — Descanso —
          </SelectItem>
          {availableSessions.map((s) => (
            <SelectItem key={s.id} textValue={s.name}>
              {s.name}
            </SelectItem>
          ))}
        </>
      </Select>
      <div className="w-28 shrink-0 flex justify-end">
        {selectedSession?.session_type ? (
          <Chip
            color={TYPE_COLOR[selectedSession.session_type]}
            size="sm"
            variant="flat"
          >
            {TYPE_LABEL[selectedSession.session_type]}
          </Chip>
        ) : selectedSessionId === null ? (
          <Chip color="default" size="sm" variant="flat">
            Descanso
          </Chip>
        ) : null}
      </div>
    </div>
  );
}
