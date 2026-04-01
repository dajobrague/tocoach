/**
 * Server-only OTP and password-reset token helpers (Supabase password_reset_otps).
 * Uses Node crypto; never persist plain OTPs or plain reset tokens.
 */

import { createHash, randomBytes, randomInt } from "node:crypto";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

export type PasswordResetUserType = "trainer" | "client";

export interface RequestOTPParams {
  email: string;
  userType: PasswordResetUserType;
  tenantSlug?: string | null;
  ipAddress?: string | null;
}

export interface VerifyOTPParams {
  email: string;
  otp: string;
  userType: PasswordResetUserType;
  tenantSlug?: string | null;
}

export type VerifyOTPResult =
  | { valid: true; resetToken: string }
  | { valid: false; error: string };

export interface VerifyResetTokenParams {
  email: string;
  resetToken: string;
  userType: PasswordResetUserType;
  tenantSlug?: string | null;
}

export type VerifyResetTokenResult =
  | { valid: true; otpRecordId: string }
  | { valid: false };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function resolveTenantSlug(
  userType: PasswordResetUserType,
  tenantSlug?: string | null
): string | null {
  if (userType === "trainer") {
    return null;
  }
  const s = tenantSlug?.trim().toLowerCase();

  if (!s) {
    throw new Error("tenantSlug is required for client password reset");
  }

  return s;
}

/** Cryptographically random 6-digit string (may include leading zeros). */
export function generateOTP(): string {
  const n = randomInt(0, 1_000_000);

  return String(n).padStart(6, "0");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashOTP(otp: string): string {
  return sha256Hex(otp);
}

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

const RATE_LIMIT_EMAIL_MESSAGE =
  "Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.";

const OTP_INSERT_FRIENDLY_ERROR =
  "No se pudo generar el código de verificación. Intenta de nuevo en unos minutos.";

export async function requestOTP(params: RequestOTPParams): Promise<string> {
  try {
    const email = normalizeEmail(params.email);
    const tenantSlug = resolveTenantSlug(params.userType, params.tenantSlug);
    const supabase = createSupabaseClient();

    const { data: allowed, error: rateError } = await supabase.rpc(
      "check_otp_rate_limit",
      {
        p_email: email,
        p_user_type: params.userType,
      }
    );

    if (rateError) {
      throw new Error(rateError.message);
    }
    if (allowed !== true) {
      throw new Error(RATE_LIMIT_EMAIL_MESSAGE);
    }

    let invalidate = supabase
      .from("password_reset_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("email", email)
      .eq("user_type", params.userType)
      .is("used_at", null);

    invalidate =
      tenantSlug === null
        ? invalidate.is("tenant_slug", null)
        : invalidate.eq("tenant_slug", tenantSlug);

    const { error: invError } = await invalidate;

    if (invError) {
      throw new Error(invError.message);
    }

    const plainOtp = generateOTP();
    const otpHash = hashOTP(plainOtp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from("password_reset_otps")
      .insert({
        email,
        otp_hash: otpHash,
        user_type: params.userType,
        tenant_slug: tenantSlug,
        expires_at: expiresAt,
        max_attempts: 5,
        attempts: 0,
        ip_address: params.ipAddress?.trim() || null,
      });

    if (insertError) {
      console.error("[requestOTP] insert failed:", insertError.message);
      throw new Error(OTP_INSERT_FRIENDLY_ERROR);
    }

    return plainOtp;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";

    if (msg === RATE_LIMIT_EMAIL_MESSAGE) {
      throw e;
    }
    if (msg === OTP_INSERT_FRIENDLY_ERROR) {
      throw e;
    }
    console.error("[requestOTP] unexpected error:", e);
    throw new Error(OTP_INSERT_FRIENDLY_ERROR);
  }
}

export async function verifyOTP(
  params: VerifyOTPParams
): Promise<VerifyOTPResult> {
  const email = normalizeEmail(params.email);
  const tenantSlug = resolveTenantSlug(params.userType, params.tenantSlug);
  const supabase = createSupabaseClient();
  const otpDigits = params.otp.replace(/\D/g, "");

  if (otpDigits.length !== 6) {
    return { valid: false, error: "Código inválido o expirado" };
  }
  const otpHash = hashOTP(otpDigits);

  let query = supabase
    .from("password_reset_otps")
    .select(
      "id, otp_hash, attempts, max_attempts, expires_at, used_at, created_at"
    )
    .eq("email", email)
    .eq("user_type", params.userType)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString());

  query =
    tenantSlug === null
      ? query.is("tenant_slug", null)
      : query.eq("tenant_slug", tenantSlug);

  const { data: record, error: fetchError } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (!record) {
    return { valid: false, error: "Código inválido o expirado" };
  }

  const otpMaxAgeMs = 10 * 60 * 1000;
  const createdAtMs = new Date(record.created_at).getTime();

  if (Number.isNaN(createdAtMs) || Date.now() - createdAtMs > otpMaxAgeMs) {
    return { valid: false, error: "Código inválido o expirado" };
  }

  if (record.attempts >= record.max_attempts) {
    await supabase
      .from("password_reset_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("id", record.id);

    return {
      valid: false,
      error: "Demasiados intentos fallidos. Solicita un nuevo código.",
    };
  }

  if (record.otp_hash !== otpHash) {
    const nextAttempts = record.attempts + 1;

    await supabase
      .from("password_reset_otps")
      .update({ attempts: nextAttempts })
      .eq("id", record.id);

    const remaining = record.max_attempts - nextAttempts;

    return {
      valid: false,
      error: `Código incorrecto. Te quedan ${remaining} intentos.`,
    };
  }

  const plainToken = generateResetToken();
  const tokenHash = sha256Hex(plainToken);
  const tokenExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("password_reset_otps")
    .update({
      reset_token: tokenHash,
      reset_token_expires_at: tokenExpires,
    })
    .eq("id", record.id);

  if (updateError) {
    return { valid: false, error: "Código inválido o expirado" };
  }

  return { valid: true, resetToken: plainToken };
}

export async function verifyResetToken(
  params: VerifyResetTokenParams
): Promise<VerifyResetTokenResult> {
  const email = normalizeEmail(params.email);
  const tenantSlug = resolveTenantSlug(params.userType, params.tenantSlug);
  const tokenHash = sha256Hex(params.resetToken.trim());
  const supabase = createSupabaseClient();

  let query = supabase
    .from("password_reset_otps")
    .select("id, reset_token_expires_at, created_at")
    .eq("email", email)
    .eq("user_type", params.userType)
    .eq("reset_token", tokenHash)
    .is("used_at", null)
    .gt("reset_token_expires_at", new Date().toISOString());

  query =
    tenantSlug === null
      ? query.is("tenant_slug", null)
      : query.eq("tenant_slug", tenantSlug);

  const { data: record, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!record) {
    return { valid: false };
  }

  const now = Date.now();
  const tokenExp = new Date(record.reset_token_expires_at).getTime();

  if (Number.isNaN(tokenExp) || tokenExp <= now) {
    return { valid: false };
  }

  const resetWindowMaxAgeMs = 30 * 60 * 1000;
  const createdAtMs = new Date(record.created_at).getTime();

  if (Number.isNaN(createdAtMs) || now - createdAtMs > resetWindowMaxAgeMs) {
    return { valid: false };
  }

  return { valid: true, otpRecordId: record.id as string };
}

export async function markOTPUsed(otpRecordId: string): Promise<void> {
  const supabase = createSupabaseClient();
  const { error } = await supabase
    .from("password_reset_otps")
    .update({ used_at: new Date().toISOString() })
    .eq("id", otpRecordId);

  if (error) {
    throw new Error(error.message);
  }
}
