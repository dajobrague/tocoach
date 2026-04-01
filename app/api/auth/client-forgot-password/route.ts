// Client forgot password — request OTP (anti-enumeration on email)
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
import { sendOTPEmail, type SendOTPEmailParams } from "@/lib/services/email";

const RATE_LIMIT_MESSAGE =
  "Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.";

function themeBrandName(themeJson: unknown): string | null {
  if (!themeJson || typeof themeJson !== "object") return null;
  const meta = (themeJson as { meta?: unknown }).meta;

  if (!meta || typeof meta !== "object") return null;
  const name = (meta as { name?: unknown }).name;

  if (typeof name !== "string") return null;
  const t = name.trim();

  return t.length > 0 ? t : null;
}

function absoluteLogoUrl(logoUrl: string | null): string | undefined {
  if (!logoUrl?.trim()) return undefined;
  const u = logoUrl.trim();

  if (u.startsWith("http://") || u.startsWith("https://")) {
    return u;
  }
  if (u.startsWith("/")) {
    const domain = process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

    return `${protocol}://${domain}${u}`;
  }

  return u;
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();
  const ip = getRequestClientIp(request);

  try {
    const body = await request.json();
    const { email, tenantSlug } = body as {
      email?: string;
      tenantSlug?: string;
    };

    if (!email?.trim() || !tenantSlug?.trim()) {
      return NextResponse.json(
        { error: "El correo y el identificador del sitio son requeridos" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const slug = tenantSlug.trim();
    const tenantSlugLog = slug.toLowerCase();
    const emailMasked = maskEmail(normalizedEmail);

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("trainer_id, logo_url, theme_json, slug")
      .ilike("slug", slug)
      .eq("status", "active")
      .single();

    if (tenantError || !tenant?.trainer_id) {
      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "failure",
        ip,
        reason: "tenant_not_found",
      });

      return NextResponse.json(
        { error: "Sitio del entrenador no encontrado." },
        { status: 404 }
      );
    }

    const { data: clients, error: clientError } = await supabase
      .from("clients")
      .select("id, email, status, tenant")
      .ilike("email", normalizedEmail)
      .eq("tenant", tenant.trainer_id)
      .limit(1);

    if (clientError) {
      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "failure",
        ip,
        reason: "database_error",
      });
      console.error("[Client Forgot Password] DB error:", clientError.message);

      return NextResponse.json(
        { error: "Error al procesar la solicitud. Intenta de nuevo." },
        { status: 500 }
      );
    }

    const client = clients?.[0];

    if (!client) {
      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "success",
        ip,
        reason: "ack_no_matching_client",
      });

      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (
      client.status !== "Activo" &&
      client.status !== "Onboarding Completado"
    ) {
      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "success",
        ip,
        reason: "ack_client_inactive",
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
          userType: "client",
          tenantSlug: tenantSlugLog,
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
        userType: "client",
        tenantSlug: tenantSlugLog,
        ipAddress: ip,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";

      if (msg === RATE_LIMIT_MESSAGE) {
        logPasswordRecovery("RequestOTP", {
          emailMasked,
          userType: "client",
          tenantSlug: tenantSlugLog,
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
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "failure",
        ip,
        reason: "otp_generation_failed",
      });
      throw e;
    }

    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("full_name")
      .eq("id", tenant.trainer_id)
      .single();

    if (trainerError) {
      console.warn("[Client Forgot Password] Trainer lookup:", trainerError);
    }

    const fromTheme = themeBrandName(tenant.theme_json);
    const fromTrainer = trainer?.full_name?.trim();
    const brandName =
      fromTheme ??
      (fromTrainer && fromTrainer.length > 0 ? fromTrainer : null) ??
      tenant.slug?.trim() ??
      "TopCoach";

    const logoUrl = absoluteLogoUrl(tenant.logo_url ?? null);

    const emailPayload: SendOTPEmailParams = {
      to: normalizedEmail,
      otp: plainOtp,
      brandName,
    };

    if (logoUrl !== undefined) {
      emailPayload.logoUrl = logoUrl;
    }

    const emailResult = await sendOTPEmail(emailPayload);

    if (!emailResult.success) {
      console.error(
        "[Client Forgot Password] sendOTPEmail failed:",
        emailResult.error
      );
      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "failure",
        ip,
        reason: "email_send_failed",
      });
    } else {
      logPasswordRecovery("RequestOTP", {
        emailMasked,
        userType: "client",
        tenantSlug: tenantSlugLog,
        outcome: "success",
        ip,
        reason: "otp_email_sent",
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Client Forgot Password] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
