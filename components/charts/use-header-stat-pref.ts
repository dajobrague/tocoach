"use client";

/**
 * Preferencia del espectador para el número grande de las chart cards:
 * "average" (media del rango visible) o "latest" (último registro).
 *
 * Es una preferencia POR GRÁFICA (clave = ChartConfig.id, estable entre
 * reorders) y por navegador. Antes era una única clave global y cambiar
 * una card cambiaba todas — JC lo reportó en vivo (sep-2026). Vive en
 * localStorage: es una conveniencia de visualización per-viewer, no
 * config del trainer. Se sincroniza cross-tab vía evento `storage` y
 * mismo-tab vía evento custom. Cualquier fallo de storage (Safari
 * private mode, storage bloqueado) degrada al fallback en memoria.
 */

import { useCallback, useSyncExternalStore } from "react";

import {
  DEFAULT_HEADER_STAT,
  parseHeaderStatMode,
  type HeaderStatMode,
} from "./header-stat";

const STORAGE_PREFIX = "tc-chart-header-stat:";
const CHANGE_EVENT = "tc-chart-header-stat-change";

// Fallback en memoria para navegadores con storage bloqueado — sin él,
// el toggle sería un botón muerto (el snapshot nunca cambiaría).
const memoryPrefs = new Map<string, HeaderStatMode>();

function readPref(chartId: string): HeaderStatMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + chartId);

    if (raw !== null) return parseHeaderStatMode(raw);
  } catch {
    // caemos al valor en memoria
  }

  return memoryPrefs.get(chartId) ?? DEFAULT_HEADER_STAT;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useHeaderStatPref(
  chartId: string
): [HeaderStatMode, (mode: HeaderStatMode) => void] {
  const getSnapshot = useCallback(() => readPref(chartId), [chartId]);
  const mode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    (): HeaderStatMode => DEFAULT_HEADER_STAT
  );

  const setMode = useCallback(
    (next: HeaderStatMode) => {
      memoryPrefs.set(chartId, next);
      try {
        window.localStorage.setItem(STORAGE_PREFIX + chartId, next);
      } catch {
        // Storage bloqueado: el toggle sigue funcionando vía memoryPrefs,
        // solo se pierde la persistencia entre visitas.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [chartId]
  );

  return [mode, setMode];
}
