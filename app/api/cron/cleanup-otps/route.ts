import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/clients/supabase-admin";

function extractCronSecret(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");

  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();

    if (token) return token;
  }
  const headerSecret = request.headers.get("x-cron-secret")?.trim();

  if (headerSecret) return headerSecret;
  const url = new URL(request.url);
  const q = url.searchParams.get("secret")?.trim();

  if (q) return q;

  return null;
}

/**
 * Deletes OTP rows whose OTP expiry is older than 24 hours (cleanup after grace period).
 * Secured with CRON_SECRET (header Authorization Bearer, x-cron-secret, or ?secret=).
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();

  if (!expected) {
    console.error("[cron/cleanup-otps] CRON_SECRET is not configured");

    return NextResponse.json(
      { error: "Cron is not configured on this server" },
      { status: 503 }
    );
  }

  const provided = extractCronSecret(request);

  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("password_reset_otps")
      .delete()
      .lt("expires_at", cutoff)
      .select("id");

    if (error) {
      console.error("[cron/cleanup-otps] delete failed:", error.message);

      return NextResponse.json(
        { error: "Failed to run cleanup" },
        { status: 500 }
      );
    }

    const deleted = data?.length ?? 0;

    return NextResponse.json({ success: true, deleted });
  } catch (e) {
    console.error("[cron/cleanup-otps] unexpected:", e);

    return NextResponse.json(
      { error: "Failed to run cleanup" },
      { status: 500 }
    );
  }
}
