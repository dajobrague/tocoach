// features/trainer/nav/use-shell-mode.ts
"use client";

import { useEffect, useState } from "react";

export type ShellMode = "top" | "side";

const STORAGE_KEY = "trainer.shellMode";

function detect(): ShellMode {
  if (typeof window === "undefined") return "top";

  const param = new URLSearchParams(window.location.search).get("shell");
  if (param === "top" || param === "side") {
    try {
      window.localStorage.setItem(STORAGE_KEY, param);
    } catch {
      /* private mode or storage disabled; ignore */
    }
    return param;
  }

  try {
    const memo = window.localStorage.getItem(STORAGE_KEY);
    if (memo === "top" || memo === "side") return memo;
  } catch {
    /* ignore */
  }

  let inIframe = true;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }

  if (inIframe) {
    try {
      window.localStorage.setItem(STORAGE_KEY, "top");
    } catch {
      /* ignore */
    }
    return "top";
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, "side");
  } catch {
    /* ignore */
  }
  return "side";
}

/** Returns "top" (embedded in GHL iframe) or "side" (PWA / browser). */
export function useShellMode(): ShellMode {
  const [mode, setMode] = useState<ShellMode>(() => detect());

  useEffect(() => {
    // Re-detect once on mount in case the SSR-time default was wrong.
    const next = detect();
    if (next !== mode) setMode(next);

    // Watch for PWA install mid-session.
    const mql = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setMode(detect());
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Safari < 14 fallback
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return mode;
}
