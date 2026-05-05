// Selector de duración del microciclo (1–28 días). HeroUI Input type=number
// con clamp explícito en onChange para que el valor escrito a mano quede
// siempre dentro del rango.

import { Input } from "@heroui/react";

const MIN_DAYS = 1;
const MAX_DAYS = 28;

interface Props {
  value: number;
  isDisabled?: boolean;
  onChange: (next: number) => void;
}

export default function MicrocycleDurationSelector({
  value,
  isDisabled = false,
  onChange,
}: Props) {
  return (
    <Input
      classNames={{ inputWrapper: "max-w-[140px]" }}
      isDisabled={isDisabled}
      label="Duración del ciclo"
      labelPlacement="outside"
      max={MAX_DAYS}
      min={MIN_DAYS}
      placeholder="7"
      size="sm"
      type="number"
      value={String(value)}
      onValueChange={(raw) => {
        const parsed = parseInt(raw, 10);

        if (!Number.isFinite(parsed)) return;
        const clamped = Math.max(MIN_DAYS, Math.min(MAX_DAYS, parsed));

        onChange(clamped);
      }}
    />
  );
}
