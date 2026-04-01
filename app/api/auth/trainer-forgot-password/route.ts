// Trainer forgot password — request OTP (anti-enumeration on email)
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  countOtpRequestsByIpLastHour,
  getRequestClientIp,
  IP_OTP_HOUR_MAX,
  IP_OTP_RATE_LIMIT_MESSAGE,
  logPasswordRecovery,
  maskEmail,
} from "@/lib/security/password-recovery-log";
import { requestOTP } from "@/lib/security/otp";
import { sendOTPEmail } from "@/lib/services/email";

const RATE_LIMIT_MESSAGE =
  "Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();
  const ip = getRequestClientIp(request);

  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email?.trim()) {
      return NextResponse.json(
        { error: "El correo es requerido" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailMasked = maskEmail(normalizedEmail);

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
        outcome: "failure",
        ip,
        reason: "invalid_email_format",
      });

      return NextResponse.json(
        { error: "Correo electrónico no válido" },
        { status: 400 }
      );
    }

    const { data: trainers, error: trainerError } = await supabase
      .from("trainers")
      .select("id, status")
      .ilike("email", normalizedEmail)
      .limit(1);

    if (trainerError) {
      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
        outcome: "failure",
        ip,
        reason: "database_error",
      });
      console.error(
        "[Trainer Forgot Password] DB error:",
        trainerError.message
      );

      return NextResponse.json(
        { error: "Error al procesar la solicitud. Intenta de nuevo." },
        { status: 500 }
      );
    }

    const trainer = trainers?.[0];

    if (!trainer || trainer.status !== "active") {
      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
        outcome: "success",
        ip,
        reason: "ack_no_matching_trainer_or_inactive",
      });

      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (ip) {
      const { count, error: ipCountErr } = await countOtpRequestsByIpLastHour(
        supabase,
        ip
      );

      if (ipCountErr) {
        console.warn(
          "[PasswordRecovery:RequestOTP] IP count query failed:",
          ipCountErr.message
        );
      } else if (count > IP_OTP_HOUR_MAX) {
        logPasswordRecovery("RequestOTP", {
          emailMasked,
          userType: "trainer",
          tenantSlug: null,
          outcome: "failure",
          ip,
          reason: "ip_rate_limited",
        });

        return NextResponse.json(
          {
            success: false,
            error: IP_OTP_RATE_LIMIT_MESSAGE,
            rateLimited: true,
          },
          { status: 429 }
        );
      }
    }

    let plainOtp: string;

    try {
      plainOtp = await requestOTP({
        email: normalizedEmail,
        userType: "trainer",
        tenantSlug: null,
        ipAddress: ip,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";

      if (msg === RATE_LIMIT_MESSAGE) {
        logPasswordRecovery("RequestOTP", {
          emailMasked,
          userType: "trainer",
          tenantSlug: null,
          outcome: "failure",
          ip,
          reason: "email_rate_limited",
        });

        return NextResponse.json(
          {
            success: false,
            error: RATE_LIMIT_MESSAGE,
            rateLimited: true,
          },
          { status: 429 }
        );
      }

      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
        outcome: "failure",
        ip,
        reason: "otp_generation_failed",
      });
      throw e;
    }

    const emailResult = await sendOTPEmail({
      to: normalizedEmail,
      otp: plainOtp,
      brandName: "TopCoach",
    });

    if (!emailResult.success) {
      console.error(
        "[Trainer Forgot Password] sendOTPEmail failed:",
        emailResult.error
      );
      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
        outcome: "failure",
        ip,
        reason: "email_send_failed",
      });
    } else {
      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "trainer",
        tenantSlug: null,
        outcome: "success",
        ip,
        reason: "otp_email_sent",
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Trainer Forgot Password] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
