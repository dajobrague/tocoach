/**
 * Transactional email service (Resend). Server-side only.
 */

import { Resend } from "resend";

export interface SendOTPEmailParams {
  to: string;
  otp: string;
  brandName: string;
  logoUrl?: string;
}

export interface SendPasswordChangedEmailParams {
  to: string;
  brandName: string;
}

export type SendEmailResult =
  | { success: true }
  | { success: false; error: string };

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();

  if (!key) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(key);
  }

  return resendClient;
}

function getFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() || "TopCoach <noreply@topcoach.app>"
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeOtp(otp: string): string | null {
  const digits = otp.replace(/\D/g, "");

  return digits.length === 6 ? digits : null;
}

function buildOtpEmailHtml(params: {
  brandNameSafe: string;
  digits: string[];
  logoUrl?: string;
}): string {
  const { brandNameSafe, digits, logoUrl } = params;
  const logoBlock =
    logoUrl && isSafeImageUrl(logoUrl)
      ? `<tr><td align="center" style="padding:0 24px 24px 24px;"><img src="${escapeHtml(logoUrl)}" alt="${brandNameSafe}" width="120" style="max-height:48px;width:auto;height:auto;display:block;margin:0 auto;border:0;" /></td></tr>`
      : "";

  const otpCells = digits
    .map(
      (d) =>
        `<td style="width:48px;height:56px;background-color:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;text-align:center;vertical-align:middle;font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:700;color:#18181b;letter-spacing:0;line-height:56px;">${d}</td>`
    )
    .join('<td style="width:8px;font-size:1px;line-height:1px;">&nbsp;</td>');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Código de verificación</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;-webkit-text-size-adjust:100%;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
        ${logoBlock}
        <tr>
          <td style="padding:32px 32px 8px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:600;color:#18181b;text-align:center;">
            ${brandNameSafe}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 24px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:22px;color:#52525b;text-align:center;">
            Tu código de verificación es:
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 28px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
              <tr>${otpCells}</tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 16px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:21px;color:#71717a;text-align:center;">
            Este código expira en 10 minutos
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:20px;color:#a1a1aa;text-align:center;">
            Si no solicitaste este código, ignora este correo
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function buildPasswordChangedHtml(brandNameSafe: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Contraseña actualizada</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;-webkit-text-size-adjust:100%;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
        <tr>
          <td style="padding:32px 32px 16px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:600;color:#18181b;text-align:center;">
            ${brandNameSafe}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 16px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:24px;color:#52525b;text-align:center;">
            Tu contraseña se ha actualizado correctamente.
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:22px;color:#71717a;text-align:center;">
            Si no realizaste este cambio, contacta con el soporte de inmediato para proteger tu cuenta.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

async function sendWithResend(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const resend = getResend();

  if (!resend) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unknown error sending email";

    return { success: false, error: message };
  }
}

export async function sendOTPEmail(
  params: SendOTPEmailParams
): Promise<SendEmailResult> {
  const to = params.to?.trim() ?? "";
  const brandName = params.brandName?.trim() ?? "";
  const normalized = normalizeOtp(params.otp ?? "");

  if (!to || !EMAIL_REGEX.test(to)) {
    return { success: false, error: "Invalid email address" };
  }
  if (!brandName) {
    return { success: false, error: "Brand name is required" };
  }
  if (!normalized) {
    return { success: false, error: "OTP must be exactly 6 digits" };
  }

  const digits = normalized.split("");
  const brandNameSafe = escapeHtml(brandName);
  const subject = `${brandName} - Código de verificación`;
  const html = buildOtpEmailHtml(
    params.logoUrl !== undefined
      ? { brandNameSafe, digits, logoUrl: params.logoUrl }
      : { brandNameSafe, digits }
  );
  const text = [
    `${brandName} - Código de verificación`,
    "",
    `Tu código: ${normalized.split("").join(" ")}`,
    "",
    "Este código expira en 10 minutos",
    "",
    "Si no solicitaste este código, ignora este correo",
  ].join("\n");

  return sendWithResend({ to, subject, html, text });
}

export async function sendPasswordChangedEmail(
  params: SendPasswordChangedEmailParams
): Promise<SendEmailResult> {
  const to = params.to?.trim() ?? "";
  const brandName = params.brandName?.trim() ?? "";

  if (!to || !EMAIL_REGEX.test(to)) {
    return { success: false, error: "Invalid email address" };
  }
  if (!brandName) {
    return { success: false, error: "Brand name is required" };
  }

  const brandNameSafe = escapeHtml(brandName);
  const subject = `${brandName} - Contraseña actualizada`;
  const html = buildPasswordChangedHtml(brandNameSafe);
  const text = [
    `${brandName} - Contraseña actualizada`,
    "",
    "Tu contraseña se ha actualizado correctamente.",
    "",
    "Si no realizaste este cambio, contacta con el soporte de inmediato para proteger tu cuenta.",
  ].join("\n");

  return sendWithResend({ to, subject, html, text });
}
