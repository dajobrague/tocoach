"use client";

import { Button, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

interface ForgotPasswordFormProps {
  tenantSlug: string;
}

type FlowStep = 1 | 2 | 3;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE_LIMIT_MESSAGE =
  "Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.";

/** El código caduca a los 10 min (lib/security/otp.ts). */
const OTP_TTL_SECONDS = 600;

const PASSWORD_RULES: ReadonlyArray<{
  key: "minLength" | "hasUpper" | "hasNumber";
  label: string;
}> = [
  { key: "minLength", label: "8 caracteres o más" },
  { key: "hasUpper", label: "Una letra mayúscula" },
  { key: "hasNumber", label: "Un número" },
];

function validatePasswordRules(password: string) {
  return {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

const fieldClass =
  "h-[54px] w-full rounded-xl border border-default-200 bg-content1 px-4 text-[17px] text-foreground caret-primary outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-default-400 focus:border-primary focus:shadow-[0_0_0_4px_hsl(var(--heroui-primary)/0.2)]";

/**
 * Recuperar contraseña en una sola pantalla, con el mismo patrón que el
 * login: cada paso se despliega debajo del anterior (correo → código de 6
 * cifras → contraseña nueva). Al terminar vuelve al login con el correo
 * puesto y el aviso "Contraseña cambiada". Mismas APIs que antes.
 */
export function ForgotPasswordForm({ tenantSlug }: ForgotPasswordFormProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<FlowStep>(1);
  const [email, setEmail] = React.useState("");
  const [emailInput, setEmailInput] = React.useState("");
  const [otp, setOtp] = React.useState(["", "", "", "", "", ""]);
  const [resetToken, setResetToken] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [isLoadingStep1, setIsLoadingStep1] = React.useState(false);
  const [isLoadingStep2, setIsLoadingStep2] = React.useState(false);
  const [isLoadingStep3, setIsLoadingStep3] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);

  const [error, setError] = React.useState("");
  const [resetTokenExpired, setResetTokenExpired] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [expiresIn, setExpiresIn] = React.useState(0);
  const [codeFocused, setCodeFocused] = React.useState(false);

  const codeInputRef = React.useRef<HTMLInputElement>(null);
  const newPasswordRef = React.useRef<HTMLInputElement>(null);
  // Kept for the shared handlers below (resend focuses the first cell).
  const otpInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    otpInputRefs.current = [codeInputRef.current];
  });

  // Prefill from the login screen ("¿Olvidaste tu contraseña?" passes ?email=).
  React.useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("email");

    if (fromQuery) setEmailInput(fromQuery);
  }, []);

  React.useEffect(() => {
    const target =
      step === 2 ? codeInputRef : step === 3 ? newPasswordRef : null;

    if (!target) return undefined;
    const id = window.setTimeout(
      () => target.current?.focus({ preventScroll: true }),
      200
    );

    return () => clearTimeout(id);
  }, [step]);

  React.useEffect(() => {
    if (resendCooldown <= 0 && expiresIn <= 0) return undefined;
    const id = window.setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1));
      setExpiresIn((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [resendCooldown, expiresIn]);

  const postForgotPassword = async (emailToSend: string) => {
    const res = await fetch("/api/auth/client-forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailToSend, tenantSlug }),
    });
    const data = await res.json().catch(() => ({}));

    return { res, data };
  };

  const handleStep1Submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const trimmed = emailInput.trim().toLowerCase();

    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setError("Ingresa un correo electrónico válido");

      return;
    }

    setIsLoadingStep1(true);
    try {
      const { res, data } = await postForgotPassword(trimmed);

      if (res.status === 429 && data.rateLimited) {
        setError(
          typeof data.error === "string" ? data.error : RATE_LIMIT_MESSAGE
        );

        return;
      }

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "No se pudo enviar el código. Intenta de nuevo."
        );

        return;
      }

      setEmail(trimmed);
      setStep(2);
      setOtp(["", "", "", "", "", ""]);
      setResendCooldown(60);
      setExpiresIn(OTP_TTL_SECONDS);
      addToast({
        title: "Código enviado",
        description: "Te enviamos un código a tu correo",
        color: "success",
      });
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsLoadingStep1(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    setIsResending(true);
    setError("");
    try {
      const { res, data } = await postForgotPassword(email);

      if (res.status === 429 && data.rateLimited) {
        setError(
          typeof data.error === "string" ? data.error : RATE_LIMIT_MESSAGE
        );

        return;
      }

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "No se pudo reenviar el código."
        );

        return;
      }

      setOtp(["", "", "", "", "", ""]);
      setResendCooldown(60);
      setExpiresIn(OTP_TTL_SECONDS);
      addToast({
        title: "Código reenviado",
        description: "Revisa tu bandeja de entrada",
        color: "success",
      });
      requestAnimationFrame(() => {
        otpInputRefs.current[0]?.focus();
      });
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyOtp = async (
    e?: React.FormEvent,
    codeOverride?: string
  ) => {
    e?.preventDefault();
    setError("");
    const code = codeOverride ?? otp.join("");

    if (code.length !== 6) {
      setError("Ingresa el código de 6 dígitos");

      return;
    }

    setIsLoadingStep2(true);
    try {
      const res = await fetch("/api/auth/client-verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          otp: code,
          tenantSlug,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Código inválido o expirado"
        );

        return;
      }

      setResetToken(data.resetToken as string);
      setStep(3);
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsLoadingStep2(false);
    }
  };

  const handleResetPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");

      return;
    }

    const rules = validatePasswordRules(newPassword);

    if (!rules.minLength || !rules.hasUpper || !rules.hasNumber) {
      setError("La contraseña no cumple los requisitos");

      return;
    }

    setIsLoadingStep3(true);
    setResetTokenExpired(false);
    try {
      const res = await fetch("/api/auth/client-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          resetToken,
          newPassword,
          confirmPassword,
          tenantSlug,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          setResetTokenExpired(true);
          setError(
            "El enlace de restablecimiento ha expirado. Solicita un nuevo código."
          );
        } else {
          setError(
            typeof data.error === "string"
              ? data.error
              : "No se pudo actualizar la contraseña."
          );
        }

        return;
      }

      // Igual que antes, se vuelve al login; ahora con el correo puesto y el
      // aviso de contraseña cambiada.
      router.push(
        `/${tenantSlug}/login?reset=1&email=${encodeURIComponent(email)}`
      );
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsLoadingStep3(false);
    }
  };

  const goBackToEmail = () => {
    setStep(1);
    setError("");
    setResetTokenExpired(false);
    setOtp(["", "", "", "", "", ""]);
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setResendCooldown(0);
    setExpiresIn(0);
  };

  const strength = validatePasswordRules(newPassword);
  const busy =
    isLoadingStep1 || isLoadingStep2 || isLoadingStep3 || isResending;
  const code = otp.join("");
  const confirmMismatch =
    confirmPassword.length > 0 && !newPassword.startsWith(confirmPassword);
  const passwordReady =
    strength.minLength &&
    strength.hasUpper &&
    strength.hasNumber &&
    confirmPassword === newPassword;

  const title =
    step === 1
      ? "Recupera tu contraseña"
      : step === 2
        ? "Revisa tu correo"
        : "Crea una contraseña nueva";
  const lede =
    step === 1
      ? "Te enviamos un código de 6 cifras a tu correo."
      : step === 2
        ? `Escribe el código que enviamos a ${email}. Mira también en spam.`
        : "La usarás desde ahora para entrar.";
  const ctaLabel =
    step === 1
      ? "Enviar código"
      : step === 2
        ? "Verificar"
        : "Guardar contraseña";

  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);

    setOtp(Array.from({ length: 6 }, (_, i) => digits[i] ?? ""));
    if (error) setError("");
    // Al completar el código se verifica solo.
    if (digits.length === 6 && !isLoadingStep2)
      void handleVerifyOtp(undefined, digits);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (step === 1) return void handleStep1Submit(e);
    if (step === 2) return void handleVerifyOtp(e);
    e.preventDefault();
    if (passwordReady) void handleResetPassword();
  };

  const minutes = Math.floor(expiresIn / 60);
  const seconds = String(expiresIn % 60).padStart(2, "0");

  return (
    <form noValidate className="flex w-full flex-col gap-5" onSubmit={onSubmit}>
      <NextLink
        className="-ml-2 -mt-2 flex h-10 items-center gap-0.5 self-start rounded-[10px] pl-1 pr-3 text-[15px] font-medium text-foreground active:bg-default-100"
        href={`/${tenantSlug}/login`}
      >
        <Icon className="text-xl" icon="solar:alt-arrow-left-linear" />
        Volver
      </NextLink>

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-[30px] leading-[1.08] tracking-[-0.025em] text-foreground [text-wrap:balance]">
          {title}
        </h2>
        <p className="text-base leading-snug text-default-500">{lede}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label
          className="text-[13px] font-semibold text-default-500"
          htmlFor="forgot-email"
        >
          Correo
        </label>
        <div className="relative">
          <input
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
            className={`${fieldClass} ${step !== 1 ? "bg-transparent pr-28" : ""} ${error && step === 1 ? "border-danger" : ""}`}
            enterKeyHint="send"
            id="forgot-email"
            inputMode="email"
            placeholder="nombre@correo.com"
            readOnly={step !== 1}
            spellCheck={false}
            type="email"
            value={step === 1 ? emailInput : email}
            onChange={(e) => {
              setEmailInput(e.target.value);
              if (error) setError("");
            }}
          />
          {step !== 1 ? (
            <button
              className="absolute right-1.5 top-1.5 h-[42px] select-none rounded-[10px] px-3 text-[15px] font-semibold text-foreground active:bg-default-100"
              type="button"
              onClick={goBackToEmail}
            >
              Cambiar
            </button>
          ) : null}
        </div>
        {error && step === 1 ? (
          <p className="text-sm leading-snug text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <Reveal open={step === 2}>
        <div className="flex flex-col gap-2">
          <label
            className="text-[13px] font-semibold text-default-500"
            htmlFor="forgot-code"
          >
            Código
          </label>
          {/* Un solo input (pegar y autorrelleno del código funcionan) pintado
              como 6 casillas. */}
          <div className="relative grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, i) => {
              const current = codeFocused && i === Math.min(code.length, 5);

              return (
                <div
                  key={i}
                  aria-hidden
                  className={`grid h-[58px] place-items-center rounded-xl border bg-content1 font-heading text-2xl tabular-nums text-foreground transition-[border-color,box-shadow] duration-150 ${
                    error && step === 2
                      ? "border-danger"
                      : current
                        ? "border-primary shadow-[0_0_0_4px_hsl(var(--heroui-primary)/0.2)]"
                        : "border-default-200"
                  }`}
                >
                  {otp[i] ||
                    (current ? (
                      <span className="h-6 w-0.5 animate-pulse bg-primary" />
                    ) : null)}
                </div>
              );
            })}
            <input
              ref={codeInputRef}
              aria-label="Código de 6 cifras"
              autoComplete="one-time-code"
              className="absolute inset-0 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent opacity-0"
              disabled={isLoadingStep2}
              enterKeyHint="done"
              id="forgot-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]*"
              value={code}
              onBlur={() => setCodeFocused(false)}
              onChange={(e) => onCodeChange(e.target.value)}
              onFocus={() => setCodeFocused(true)}
            />
          </div>
          {error && step === 2 ? (
            <p className="text-sm leading-snug text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="-mt-2 flex items-center justify-between gap-3 text-sm text-default-500">
          <span className="tabular-nums">
            {expiresIn > 0
              ? `Caduca en ${minutes}:${seconds}`
              : "El código caducó. Pide otro."}
          </span>
          <button
            className="py-1.5 text-sm font-semibold text-foreground disabled:font-medium disabled:text-default-500"
            disabled={resendCooldown > 0 || busy}
            type="button"
            onClick={() => void handleResend()}
          >
            {isResending
              ? "Enviando…"
              : resendCooldown > 0
                ? `Reenviar en ${resendCooldown} s`
                : "Reenviar código"}
          </button>
        </div>
      </Reveal>

      <Reveal open={step === 3}>
        <div className="flex flex-col gap-2">
          <label
            className="text-[13px] font-semibold text-default-500"
            htmlFor="forgot-new"
          >
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              ref={newPasswordRef}
              autoComplete="new-password"
              className={`${fieldClass} pr-14`}
              enterKeyHint="next"
              id="forgot-new"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  document.getElementById("forgot-confirm")?.focus();
                }
              }}
            />
            <EyeButton
              visible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          </div>
        </div>
        <ul className="-mt-1 grid gap-1.5 text-sm text-default-500">
          {PASSWORD_RULES.map((rule) => (
            <li
              key={rule.key}
              className={`flex items-center gap-2 ${strength[rule.key] ? "text-foreground" : ""}`}
            >
              <Icon
                className={`text-base ${strength[rule.key] ? "text-success" : "text-default-300"}`}
                icon={
                  strength[rule.key]
                    ? "solar:check-circle-bold"
                    : "solar:record-circle-linear"
                }
              />
              {rule.label}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <label
            className="text-[13px] font-semibold text-default-500"
            htmlFor="forgot-confirm"
          >
            Repítela
          </label>
          <div className="relative">
            <input
              autoComplete="new-password"
              className={`${fieldClass} pr-14 ${confirmMismatch ? "border-danger" : ""}`}
              enterKeyHint="go"
              id="forgot-confirm"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <EyeButton
              visible={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
            />
          </div>
          {confirmMismatch ? (
            <p className="text-sm text-danger">No coincide con la de arriba.</p>
          ) : null}
          {error && step === 3 ? (
            <div className="flex flex-col items-start gap-1" role="alert">
              <p className="text-sm leading-snug text-danger">{error}</p>
              {resetTokenExpired ? (
                <button
                  className="py-1 text-sm font-semibold text-primary"
                  type="button"
                  onClick={goBackToEmail}
                >
                  Pedir un código nuevo
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </Reveal>

      <Button
        className="mt-1 h-[54px] w-full text-[17px] font-semibold"
        color="primary"
        isDisabled={
          (step === 2 && code.length !== 6) || (step === 3 && !passwordReady)
        }
        isLoading={isLoadingStep1 || isLoadingStep2 || isLoadingStep3}
        radius="lg"
        type="submit"
      >
        {ctaLabel}
      </Button>
    </form>
  );
}

/** Despliega su contenido en su sitio (alto desde 0) sin sacarlo del DOM. */
function Reveal({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  // React 18 doesn't forward a boolean `inert`.
  React.useEffect(() => {
    ref.current?.toggleAttribute("inert", !open);
  }, [open]);

  return (
    <div
      ref={ref}
      aria-hidden={!open}
      className={`grid transition-[grid-template-rows,opacity,margin] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-opacity ${
        open
          ? "mt-0 grid-rows-[1fr] opacity-100"
          : "-mt-5 grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="-m-1 flex min-h-0 flex-col gap-5 overflow-hidden p-1">
        {children}
      </div>
    </div>
  );
}

function EyeButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      className="absolute right-1 top-1 grid h-[46px] w-[46px] place-items-center rounded-[10px] text-default-500 active:bg-default-100"
      type="button"
      onClick={onToggle}
    >
      <Icon
        className="text-[22px]"
        icon={visible ? "solar:eye-closed-linear" : "solar:eye-linear"}
      />
    </button>
  );
}
