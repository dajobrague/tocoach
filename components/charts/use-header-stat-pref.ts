"use client";

/**
 * Preferencia del espectador para el número grande de las chart cards:
 * "latest" (último registro) o "average" (media del rango visible).
 *
 * Es UNA preferencia global por navegador — cambiarla desde cualquier
 * card actualiza todas (evento custom mismo-tab + evento `storage`
 * cross-tab). Vive en localStorage: es una conveniencia de visualización
 * per-viewer, no config del trainer. Cualquier fallo de storage (Safari
 * private mode, storage bloqueado) degrada a "latest", el
 * comportamiento histórico.
 */

import { useCallback, useSyncExternalStore } from "react";

import { parseHeaderStatMode, type HeaderStatMode } from "./header-stat";

const STORAGE_KEY = "tc-chart-header-stat";
const CHANGE_EVENT = "tc-chart-header-stat-change";

// Fallback en memoria para navegadores con storage bloqueado — sin él,
// el toggle sería un botón muerto (el snapshot nunca cambiaría).
let memoryPref: HeaderStatMode | null = null;

function readPref(): HeaderStatMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw !== null) return parseHeaderStatMode(raw);
  } catch {
    // caemos al valor en memoria
  }

  return memoryPref ?? "latest";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useHeaderStatPref(): [
  HeaderStatMode,
  (mode: HeaderStatMode) => void,
] {
  const mode = useSyncExternalStore(
    subscribe,
    readPref,
    (): HeaderStatMode => "latest"
  );

  const setMode = useCallback((next: HeaderStatMode) => {
    memoryPref = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage bloqueado: el toggle sigue funcionando vía memoryPref,
      // solo se pierde la persistencia entre visitas.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [mode, setMode];
}
