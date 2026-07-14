// Persiste la sesión activa elegida por el cliente ({date, sessionId})
// para que sobreviva navegación dentro del PWA. Sin esto, el cliente
// pierde su pick al volver desde otra pestaña del bottom-nav (la
// pantalla se desmonta y vuelve a montar con estado inicial).
//
// Storage local, scoped por clientId. No cross-device — eso requeriría
// llevarlo a BD, fuera de scope para este bloque.

"use client";

import { useCallback, useEffect, useState } from "react";

import { getLocalTodayYmd } from "@/lib/forms/client-helpers";

interface ActiveTraining {
  date: string;
  sessionId: string;
}

const STORAGE_KEY = (clientId: string) =>
  `topcoach:client:${clientId}:active-training`;

// Parsea y valida el valor persistido. Solo se restaura cuando la fecha
// guardada es HOY (local): cada día tiene su propio contexto — la
// persistencia existe para sobrevivir navegación/reloads DENTRO del
// mismo entrenamiento, no para arrastrar el último día entrenado.
// Sin este corte, un cliente que entrenó el lunes y nunca salió de la
// sesión abría la pestaña Entrenamiento el miércoles y la app le
// mostraba el lunes en vez de hoy. Pure y exportada para testearla.
export function parseActiveTraining(
  raw: string | null,
  todayYmd: string
): ActiveTraining | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActiveTraining> | null;

    if (
      parsed &&
      typeof parsed.date === "string" &&
      typeof parsed.sessionId === "string" &&
      parsed.date === todayYmd
    ) {
      return { date: parsed.date, sessionId: parsed.sessionId };
    }
  } catch {
    /* JSON inválido — tratar como ausente */
  }

  return null;
}

function read(clientId: string): ActiveTraining | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY(clientId));
    const result = parseActiveTraining(raw, getLocalTodayYmd());

    // Self-clean: un valor presente pero stale/ilegible no va a volver a
    // ser válido — lo borramos para no re-parsearlo en cada mount.
    if (raw && !result) {
      window.localStorage.removeItem(STORAGE_KEY(clientId));
    }

    return result;
  } catch {
    /* localStorage puede tirar QuotaExceededError — ignorar */
  }

  return null;
}

function write(clientId: string, value: ActiveTraining | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY(clientId), JSON.stringify(value));
    } else {
      window.localStorage.removeItem(STORAGE_KEY(clientId));
    }
  } catch {
    /* ignorar — no es crítico */
  }
}

interface Result {
  persisted: ActiveTraining | null;
  setActive: (value: ActiveTraining) => void;
  clearActive: () => void;
}

export function usePersistedActiveTraining(clientId: string): Result {
  // Lazy initializer: lee de localStorage solo en mount. Nota: en SSR
  // devuelve null y se rehidrata en el primer render del cliente —
  // aceptable porque esta vista es client-only ("use client" en padre).
  const [persisted, setPersisted] = useState<ActiveTraining | null>(() =>
    read(clientId)
  );

  // Si clientId cambia (caso raro, p.ej. login/logout en la misma SPA),
  // releer.
  useEffect(() => {
    setPersisted(read(clientId));
  }, [clientId]);

  const setActive = useCallback(
    (value: ActiveTraining) => {
      write(clientId, value);
      setPersisted(value);
    },
    [clientId]
  );

  const clearActive = useCallback(() => {
    write(clientId, null);
    setPersisted(null);
  }, [clientId]);

  return { persisted, setActive, clearActive };
}
