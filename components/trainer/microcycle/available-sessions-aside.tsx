// Panel lateral (desktop) o sección debajo (mobile) con la biblioteca de
// sesiones del programa: nombres y count de ejercicios. Es read-only —
// la creación de sesiones vive en la pestaña "Entrenamientos" del cliente.
// Si la sesión no tiene ejercicios todavía, mostramos "0 ejercicios" para
// que el trainer note que necesita armar el contenido antes.

import type { Session } from "@/types/training";

import { Card, CardBody, CardHeader } from "@heroui/react";
import { Icon } from "@iconify/react";

interface Props {
  sessions: Session[];
  exerciseCounts?: Record<string, number>;
}

export default function AvailableSessionsAside({
  sessions,
  exerciseCounts,
}: Props) {
  return (
    <Card className="bg-white" shadow="sm">
      <CardHeader className="flex items-center gap-2 pb-2">
        <Icon
          className="text-default-500"
          icon="solar:dumbbell-bold"
          width={20}
        />
        <span className="text-sm font-semibold text-default-700">
          Sesiones del programa
        </span>
      </CardHeader>
      <CardBody className="pt-0">
        {sessions.length === 0 ? (
          <p className="text-xs text-default-400">
            Este programa todavía no tiene sesiones. Agrégalas desde la pestaña{" "}
            <span className="font-medium">Entrenamientos</span>.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => {
              const count = exerciseCounts?.[s.id] ?? 0;

              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2"
                >
                  <span className="text-sm text-default-700 truncate pr-2">
                    {s.name}
                  </span>
                  <span className="text-xs text-default-500 shrink-0">
                    {count} {count === 1 ? "ejercicio" : "ejercicios"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
