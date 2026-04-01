// Client verify OTP — returns short-lived reset token
import { NextRequest, NextResponse } from "next/server";

import {
  getRequestClientIp,
  logPasswordRecovery,
  maskEmail,
} from "@/lib/security/password-recovery-log";
import { verifyOTP } from "@/lib/security/otp";

export async function POST(request: NextRequest) {
  const ip = getRequestClientIp(request);
  let emailMasked = "***";
  let tenantSlugLog: string | null = null;

  try {
    const body = await request.json();
    const { email, otp, tenantSlug } = body as {
      email?: string;
      otp?: string;
      tenantSlug?: string;
    };

    if (!email?.trim() || !otp?.trim() || !tenantSlug?.trim()) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    const slug = tenantSlug.trim().toLowerCase();
    const normalizedEmail = email.toLowerCase().trim();

    emailMasked = maskEmail(normalizedEmail);
    tenantSlugLog = slug;

    const result = await verifyOTP({
      email: normalizedEmail,
      otp,
      userType: "client",
      tenantSlug: slug,
    });

    if (!result.valid) {
      logPasswordRecovery("VerifyOTP", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "failure",
        ip,
        reason: result.error,
      });

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    logPasswordRecovery("VerifyOTP", {
      emailMasked,
      userType: "client",
      tenantSlug: tenantSlugLog,
      outcome: "success",
      ip,
      reason: "token_issued",
    });

    return NextResponse.json({
      success: true,
      resetToken: result.resetToken,
    });
  } catch (error) {
    logPasswordRecovery("VerifyOTP", {
      emailMasked,
      userType: "client",
      tenantSlug: tenantSlugLog,
      outcome: "failure",
      ip,
      reason: "server_error",
    });
    console.error("[Client Verify OTP] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
