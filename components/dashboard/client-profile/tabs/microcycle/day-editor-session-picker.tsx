"use client";

import { Select, SelectItem, Spinner } from "@heroui/react";

import { useTrainerSessions } from "./use-trainer-sessions";

interface Props {
  clientId: string;
  value: string | null;
  onSelect: (sessionId: string) => void;
  disabled?: boolean;
}

export function DayEditorSessionPicker({
  clientId,
  value,
  onSelect,
  disabled = false,
}: Props) {
  const { sessions, loading } = useTrainerSessions(clientId);

  if (loading && sessions.length === 0) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-gray-500">
        <Spinner size="sm" />
        Cargando sesiones…
      </div>
    );
  }

  return (
    <Select
      aria-label="Sesión asignada al día"
      className="w-56"
      isDisabled={disabled}
      placeholder="Selecciona sesión"
      selectedKeys={value ? [value] : []}
      size="sm"
      onSelectionChange={(keys) => {
        const next = Array.from(keys)[0];

        if (typeof next === "string") onSelect(next);
      }}
    >
      {sessions.map((s) => (
        <SelectItem key={s.id}>{s.name}</SelectItem>
      ))}
    </Select>
  );
}
