import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { getRealtimeAccessToken } from "@/lib/realtime/realtime-token";

let client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client for browser-side usage.
 * The single instance ensures one shared WebSocket connection
 * across all Realtime subscriptions (notifications, messages, etc.).
 *
 * Realtime only: the anon key opens the socket, but every channel is joined
 * with the app-signed token from /api/realtime/token (see `accessToken`).
 * The anon role has no table grants, so a channel without that token gets
 * no events. `supabase.auth.*` is unavailable on this client by design.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error(
      "getSupabaseBrowserClient must only be called in the browser"
    );
  }

  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }

    client = createClient(url, anonKey, {
      accessToken: getRealtimeAccessToken,
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }

  return client;
}
