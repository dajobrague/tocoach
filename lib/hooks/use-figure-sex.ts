"use client";

import { useSyncExternalStore } from "react";

export type FigureSex = "male" | "female";

const KEY = "topcoach:trainer:figure-sex";
const listeners = new Set<() => void>();

function read(): FigureSex {
  try {
    return localStorage.getItem(KEY) === "female" ? "female" : "male";
  } catch {
    return "male"; // private window / blocked storage
  }
}

export function setFigureSex(sex: FigureSex) {
  try {
    localStorage.setItem(KEY, sex);
  } catch {
    // not persisted; still applies to this page load below
  }
  memory = sex;
  listeners.forEach((notify) => notify());
}

// Fallback when localStorage is unavailable: keep the choice for the session.
let memory: FigureSex | null = null;

const snapshot = (): FigureSex => memory ?? read();

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify); // other tabs

  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

/**
 * Which figure the trainer wants to see (exercise clips and muscle body).
 * Trainer-side only: clients always get the figure of their own profile.
 */
export function useFigureSex(): FigureSex {
  return useSyncExternalStore(subscribe, snapshot, () => "male");
}
