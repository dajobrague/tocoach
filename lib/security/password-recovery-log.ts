import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PasswordRecoveryStep = "RequestOTP" | "VerifyOTP" | "ResetPassword";

export const IP_OTP_HOUR_MAX = 10;
export const IP_OTP_RATE_LIMIT_MESSAGE =
  "Demasiados intentos desde esta red. Espera una hora antes de intentar de nuevo.";

/** Masks email for logs, e.g. `d***@gmail.com`. */
export function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");

  if (at <= 0 || at === normalized.length - 1) {
    return "***";
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);

  if (local.length === 0) {
    return `***@${domain}`;
  }

  return `${local[0]}***@${domain}`;
}

export function getRequestClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();

    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();

  return realIp || null;
}

export function logPasswordRecovery(
  step: PasswordRecoveryStep,
  info: {
    emailMasked: string;
    userType: "client" | "trainer";
    tenantSlug: string | null;
    outcome: "success" | "failure";
    ip: string | null;
    reason?: string;
  }
): void {
  const payload: Record<string, unknown> = {
    emailMasked: info.emailMasked,
    userType: info.userType,
    tenantSlug: info.tenantSlug,
    outcome: info.outcome,
    ip: info.ip,
  };

  if (info.reason) {
    payload.reason = info.reason;
  }

  const line = `[PasswordRecovery:${step}] ${JSON.stringify(payload)}`;

  if (info.outcome === "success") {
    console.log(line);
  } else {
    console.warn(line);
  }
}

/** Counts OTP rows created for this IP in the last hour (all emails / user types). */
export async function countOtpRequestsByIpLastHour(
  supabase: SupabaseClient,
  ipAddress: string
): Promise<{ count: number; error: Error | null }> {
  const trimmed = ipAddress.trim();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("password_reset_otps")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", trimmed)
    .gt("created_at", oneHourAgo);

  if (error) {
    return { count: 0, error: new Error(error.message) };
  }

  return { count: count ?? 0, error: null };
}
