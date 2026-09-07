"use client";

import { clientFetch } from "@/lib/auth/client-token-storage";

export type RealtimeKind = "client" | "trainer";

/** Refresh this long before `exp`; must exceed realtime-js's 25s heartbeat. */
const REFRESH_MARGIN_MS = 60_000;

let cached: { token: string; expiresAtMs: number; kind: RealtimeKind } | null =
  null;
let inflight: Promise<string | null> | null = null;
let lastKind: RealtimeKind | null = null;

async function fetchToken(kind: RealtimeKind): Promise<string | null> {
  try {
    // clientFetch adds the Bearer fallback for client sessions whose cookie
    // got dropped (Safari ITP); for trainers it is a plain fetch.
    const res = await clientFetch(`/api/realtime/token?kind=${kind}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;

    const body = (await res.json()) as { token?: unknown; expiresAt?: unknown };

    if (typeof body.token !== "string" || typeof body.expiresAt !== "number") {
      return null;
    }

    cached = { token: body.token, expiresAtMs: body.expiresAt * 1000, kind };

    return body.token;
  } catch {
    return null;
  }
}

/**
 * Token for `kind`, reused until it is close to expiry. `null` means there is
 * no usable session (or the server is not configured): callers must NOT open a
 * channel in that case — the socket would fall back to the anon apikey.
 */
export function getRealtimeToken(kind: RealtimeKind): Promise<string | null> {
  lastKind = kind;

  if (
    cached &&
    cached.kind === kind &&
    cached.expiresAtMs - REFRESH_MARGIN_MS > Date.now()
  ) {
    return Promise.resolve(cached.token);
  }

  if (!inflight) {
    inflight = fetchToken(kind).finally(() => {
      inflight = null;
    });
  }

  return inflight;
}

/**
 * `accessToken` callback for the browser Supabase client. realtime-js calls it
 * on connect and on every heartbeat, so a token near expiry is renewed and
 * pushed to the joined channels without any timer of our own. When a refresh
 * fails it returns the last token rather than null: Realtime then rejects the
 * channel (visible as CHANNEL_ERROR) instead of silently downgrading to anon.
 */
export function getRealtimeAccessToken(): Promise<string | null> {
  if (!lastKind) return Promise.resolve(cached?.token ?? null);

  return getRealtimeToken(lastKind).then(
    (token) => token ?? cached?.token ?? null
  );
}

/** Test seam. */
export function resetRealtimeTokenCache(): void {
  cached = null;
  inflight = null;
  lastKind = null;
}
