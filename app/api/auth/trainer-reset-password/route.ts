// Trainer reset password using OTP-issued reset token (Supabase Auth password via admin API)
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/clients/supabase-admin";
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

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();
  const ip = getRequestClientIp(request);
  let emailMasked = "***";

  try {
    const body = await request.json();
    const { email, resetToken, newPassword, confirmPassword } = body as {
      email?: string;
      resetToken?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (
      !email?.trim() ||
      !resetToken?.trim() ||
      newPassword === undefined ||
      confirmPassword === undefined
    ) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    emailMasked = maskEmail(normalizedEmail);

    if (newPassword !== confirmPassword) {
      logPasswordRecovery("ResetPassword", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
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
        userType: "trainer",
        tenantSlug: null,
        outcome: "failure",
        ip,
        reason: validation.error ?? "password_validation_failed",
      });

      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const tokenResult = await verifyResetToken({
      email: normalizedEmail,
      resetToken,
      userType: "trainer",
      tenantSlug: null,
    });

    if (!tokenResult.valid) {
      logPasswordRecovery("ResetPassword", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
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

    const { data: trainers, error: trainerError } = await supabase
      .from("trainers")
      .select("id, password_set_at")
      .ilike("email", normalizedEmail)
      .limit(1);

    if (trainerError) {
      logPasswordRecovery("ResetPassword", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
        outcome: "failure",
        ip,
        reason: "database_lookup_failed",
      });
      console.error("[Trainer Reset Password] Lookup error:", trainerError);

      return NextResponse.json(
        { error: "Error al actualizar la contraseña. Intenta de nuevo." },
        { status: 500 }
      );
    }

    const trainer = trainers?.[0];

    if (!trainer) {
      logPasswordRecovery("ResetPassword", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
        outcome: "failure",
        ip,
        reason: "trainer_not_found",
      });

      return NextResponse.json(
        { error: "No se encontró la cuenta." },
        { status: 404 }
      );
    }

    let supabaseAdmin;

    try {
      supabaseAdmin = createSupabaseAdminClient();
    } catch (e) {
      logPasswordRecovery("ResetPassword", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
        outcome: "failure",
        ip,
        reason: "admin_client_misconfigured",
      });
      console.error("[Trainer Reset Password] Admin client:", e);

      return NextResponse.json(
        { error: "Error de configuración del servidor. Contacta soporte." },
        { status: 500 }
      );
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      trainer.id,
      { password: newPassword }
    );

    if (authError) {
      logPasswordRecovery("ResetPassword", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
        outcome: "failure",
        ip,
        reason: "auth_update_failed",
      });
      console.error("[Trainer Reset Password] Auth update:", authError.message);

      return NextResponse.json(
        { error: "Error al actualizar la contraseña. Intenta de nuevo." },
        { status: 500 }
      );
    }

    const { error: profileError } = await supabase
      .from("trainers")
      .update({ password_set_at: new Date().toISOString() })
      .eq("id", trainer.id)
      .is("password_set_at", null);

    if (profileError) {
      console.error(
        "[Trainer Reset Password] password_set_at update:",
        profileError
      );
    }

    try {
      await markOTPUsed(tokenResult.otpRecordId);
    } catch (markErr) {
      console.error("[Trainer Reset Password] markOTPUsed failed:", markErr);
    }

    const emailSend = await sendPasswordChangedEmail({
      to: normalizedEmail,
      brandName: "TopCoach",
    });

    if (!emailSend.success) {
      console.error(
        "[Trainer Reset Password] sendPasswordChangedEmail failed:",
        emailSend.error
      );
    }

    logPasswordRecovery("ResetPassword", {
      emailMasked,
      userType: "trainer",
      tenantSlug: null,
      outcome: "success",
      ip,
      reason: "password_updated",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logPasswordRecovery("ResetPassword", {
      emailMasked,
      userType: "trainer",
      tenantSlug: null,
      outcome: "failure",
      ip,
      reason: "server_error",
    });
    console.error("[Trainer Reset Password] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
