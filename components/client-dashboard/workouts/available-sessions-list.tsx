// Lista "Escoge tu siguiente entrenamiento". Itera sobre useAvailableSessions
// y muestra una card por sesión. Tap en card o "Comenzar" → emite
// onActivate(sessionId): el orquestador entra en MODO ACTIVA (ver
// active-session-view.tsx) y la lista deja de renderizarse.

import type { AvailableSession } from "./hooks/use-available-sessions";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { SessionCard } from "./session-card";

// Re-exportado aquí porque el orquestador y la vista activa lo consumen.
export interface OpenLogPayload {
  exercise: { order: number; name: string; imageUrl?: string } & Record<
    string,
    unknown
  >;
  sessionId: string;
  scheduledDate: string;
  existingLog: unknown | null;
}

interface Props {
  availableSessions: AvailableSession[];
  onActivate: (sessionId: string) => void;
}

export function AvailableSessionsList({
  availableSessions,
  onActivate,
}: Props) {
  if (availableSessions.length === 0) return null;

  return (
    <section className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="text-primary" icon="solar:dumbbell-bold" width={20} />
        <h2 className="text-xl font-heading font-semibold text-foreground">
          Escoge tu siguiente entrenamiento
        </h2>
      </div>
      <div className="space-y-3 w-full">
        {availableSessions.map((session) => (
          <div
            key={session.id}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => onActivate(session.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate(session.id);
              }
            }}
          >
            <SessionCard
              exerciseCount={session.exercise_count}
              name={session.name}
              rightContent={
                <Button
                  color="primary"
                  size="sm"
                  startContent={<Icon icon="solar:play-bold" width={16} />}
                  onPress={() => onActivate(session.id)}
                >
                  Comenzar
                </Button>
              }
              sessionType={session.session_type}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
