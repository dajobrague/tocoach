// Trainer verify OTP — returns short-lived reset token
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

  try {
    const body = await request.json();
    const { email, otp } = body as { email?: string; otp?: string };

    if (!email?.trim() || !otp?.trim()) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    emailMasked = maskEmail(normalizedEmail);

    const result = await verifyOTP({
      email: normalizedEmail,
      otp,
      userType: "trainer",
      tenantSlug: null,
    });

    if (!result.valid) {
      logPasswordRecovery("VerifyOTP", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
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
      userType: "trainer",
      tenantSlug: null,
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
      userType: "trainer",
      tenantSlug: null,
      outcome: "failure",
      ip,
      reason: "server_error",
    });
    console.error("[Trainer Verify OTP] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
