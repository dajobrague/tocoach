/* eslint-disable no-console */
// Client reset password using OTP-issued reset token
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  getRequestClientIp,
  logPasswordRecovery,
  maskEmail,
} from "@/lib/security/password-recovery-log";
import { markOTPUsed, verifyResetToken } from "@/lib/security/otp";
import { sendPasswordChangedEmail } from "@/lib/services/email";

function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (password.length < 8) {
    return {
      valid: false,
      error: "La contraseña debe tener al menos 8 caracteres",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "La contraseña debe contener al menos una letra mayúscula",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "La contraseña debe contener al menos un número",
    };
  }

  return { valid: true };
}

function themeBrandName(themeJson: unknown): string | null {
  if (!themeJson || typeof themeJson !== "object") return null;
  const meta = (themeJson as { meta?: unknown }).meta;

  if (!meta || typeof meta !== "object") return null;
  const name = (meta as { name?: unknown }).name;

  if (typeof name !== "string") return null;
  const t = name.trim();

  return t.length > 0 ? t : null;
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();
  const ip = getRequestClientIp(request);
  let emailMasked = "***";
  let tenantSlugLog: string | null = null;

  try {
    const body = await request.json();
    const { email, resetToken, newPassword, confirmPassword, tenantSlug } =
      body as {
        email?: string;
        resetToken?: string;
        newPassword?: string;
        confirmPassword?: string;
        tenantSlug?: string;
      };

    if (
      !email?.trim() ||
      !resetToken?.trim() ||
      newPassword === undefined ||
      confirmPassword === undefined ||
      !tenantSlug?.trim()
    ) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const slug = tenantSlug.trim().toLowerCase();

    emailMasked = maskEmail(normalizedEmail);
    tenantSlugLog = slug;

    if (newPassword !== confirmPassword) {
      logPasswordRecovery("ResetPassword", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "failure",
        ip,
        reason: "password_mismatch",
      });

      return NextResponse.json(
        { error: "Las contraseñas no coinciden" },
        { status: 400 }
      );
    }

    const validation = validatePassword(newPassword);

    if (!validation.valid) {
      logPasswordRecovery("ResetPassword", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "failure",
        ip,
        reason: validation.error ?? "password_validation_failed",
      });

      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const tokenResult = await verifyResetToken({
      email: normalizedEmail,
      resetToken,
      userType: "client",
      tenantSlug: slug,
    });

    if (!tokenResult.valid) {
      logPasswordRecovery("ResetPassword", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "failure",
        ip,
        reason: "expired_or_invalid_reset_token",
      });

      return NextResponse.json(
        {
          error:
            "El enlace de restablecimiento ha expirado. Solicita uno nuevo.",
        },
        { status: 401 }
      );
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("trainer_id, theme_json, slug")
      .ilike("slug", slug)
      .eq("status", "active")
      .single();

    if (tenantError || !tenant?.trainer_id) {
      logPasswordRecovery("ResetPassword", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "failure",
        ip,
        reason: "tenant_not_found",
      });
      console.error("[Client Reset Password] Tenant not found:", tenantError);

      return NextResponse.json(
        { error: "Sitio del entrenador no encontrado." },
        { status: 404 }
      );
    }

    // Email is already lowercased and trimmed by `normalizeEmail`; using
    // `.eq` (not `.ilike`) ensures we only update the single matching row.
    // Two tenants-internal clients with emails that differ only by case
    // would otherwise both have their password overwritten.
    const { error: updateError } = await supabase
      .from("clients")
      .update({ password: newPassword })
      .eq("email", normalizedEmail)
      .eq("tenant", tenant.trainer_id);

    if (updateError) {
      logPasswordRecovery("ResetPassword", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "failure",
        ip,
        reason: "database_update_failed",
      });
      console.error("[Client Reset Password] Update error:", updateError);

      return NextResponse.json(
        { error: "Error al actualizar la contraseña. Intenta de nuevo." },
        { status: 500 }
      );
    }

    try {
      await markOTPUsed(tokenResult.otpRecordId);
    } catch (markErr) {
      console.error("[Client Reset Password] markOTPUsed failed:", markErr);
    }

    const { data: trainer } = await supabase
      .from("trainers")
      .select("full_name")
      .eq("id", tenant.trainer_id)
      .single();

    const fromTheme = themeBrandName(tenant.theme_json);
    const fromTrainer = trainer?.full_name?.trim();
    const brandName =
      fromTheme ??
      (fromTrainer && fromTrainer.length > 0 ? fromTrainer : null) ??
      tenant.slug?.trim() ??
      "TopCoach";

    const emailSend = await sendPasswordChangedEmail({
      to: normalizedEmail,
      brandName,
    });

    if (!emailSend.success) {
      console.error(
        "[Client Reset Password] sendPasswordChangedEmail failed:",
        emailSend.error
      );
    }

    logPasswordRecovery("ResetPassword", {
      emailMasked,
      userType: "client",
      tenantSlug: tenantSlugLog,
      outcome: "success",
      ip,
      reason: "password_updated",
    });

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    logPasswordRecovery("ResetPassword", {
      emailMasked,
      userType: "client",
      tenantSlug: tenantSlugLog,
      outcome: "failure",
      ip,
      reason: "server_error",
    });
    console.error("[Client Reset Password] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
