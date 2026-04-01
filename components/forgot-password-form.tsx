"use client";

import { Button, Form, Input, Link, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import React from "react";

interface ForgotPasswordFormProps {
  tenantSlug: string;
}

type FlowStep = 1 | 2 | 3 | "success";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE_LIMIT_MESSAGE =
  "Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.";

function getSlideIndex(step: FlowStep): number {
  if (step === "success") return 3;

  return step - 1;
}

function validatePasswordRules(password: string) {
  return {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

function OtpDigitInput({
  disabled,
  index,
  inputRef,
  value,
  onChange,
  onKeyDown,
  onPaste,
}: {
  disabled: boolean;
  index: number;
  inputRef: (el: HTMLInputElement | null) => void;
  value: string;
  onChange: (index: number, digit: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  const pasteHandler =
    index === 0 && onPaste ? { onPaste } : ({} as Record<string, never>);

  return (
    <Input
      ref={(node) => {
        const input = node?.querySelector?.("input") ?? null;

        inputRef(input);
      }}
      aria-label={`Dígito ${index + 1} del código`}
      classNames={{
        base: "w-full min-w-0 flex-1 max-w-[3.25rem] sm:max-w-[3.5rem]",
        input: "text-center text-xl font-semibold tabular-nums px-0 font-body",
        inputWrapper:
          "h-12 sm:h-14 min-h-12 sm:min-h-14 justify-center rounded-xl border-2 shadow-none bg-content1 data-[hover=true]:bg-content1",
      }}
      inputMode="numeric"
      isDisabled={disabled}
      maxLength={1}
      size="lg"
      value={value}
      variant="bordered"
      {...pasteHandler}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, "").slice(-1);

        onChange(index, d);
      }}
      onKeyDown={(e) => onKeyDown(index, e)}
    />
  );
}

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

  const otpInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    if (step !== 2) return undefined;
    const t = requestAnimationFrame(() => {
      otpInputRefs.current[0]?.focus();
    });

    return () => cancelAnimationFrame(t);
  }, [step]);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [resendCooldown]);

  React.useEffect(() => {
    if (step !== "success") return;
    const id = window.setTimeout(() => {
      router.push(`/${tenantSlug}/login`);
    }, 3000);

    return () => clearTimeout(id);
  }, [step, router, tenantSlug]);

  const setOtpDigit = React.useCallback((index: number, digit: string) => {
    setOtp((prev) => {
      const next = [...prev];

      next[index] = digit;

      return next;
    });
    if (digit && index < 5) {
      requestAnimationFrame(() => {
        otpInputRefs.current[index + 1]?.focus();
      });
    }
  }, []);

  const handleOtpKeyDown = React.useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !otp[index] && index > 0) {
        e.preventDefault();
        otpInputRefs.current[index - 1]?.focus();
      }
    },
    [otp]
  );

  const handleOtpPaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const text = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);

      if (!text) return;
      const chars = text.split("");

      setOtp((prev) => {
        const next = [...prev];

        for (let i = 0; i < 6; i++) {
          next[i] = chars[i] ?? "";
        }

        return next;
      });
      const focusIndex = Math.min(chars.length, 5);

      requestAnimationFrame(() => {
        otpInputRefs.current[focusIndex]?.focus();
      });
    },
    []
  );

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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const code = otp.join("");

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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
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

      setStep("success");
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
  };

  const strength = validatePasswordRules(newPassword);
  const slideIndex = getSlideIndex(step);
  const busy =
    isLoadingStep1 || isLoadingStep2 || isLoadingStep3 || isResending;

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-content1 shadow-medium ring-1 ring-default-100">
      <div
        className="flex w-[400%] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(-${slideIndex * 25}%)` }}
      >
        {/* Step 1 — Email */}
        <div className="w-1/4 shrink-0 px-5 py-7 sm:px-8 sm:py-9">
          {error && step === 1 && (
            <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 p-3">
              <p className="font-body text-sm text-danger">{error}</p>
            </div>
          )}

          <Form
            className="flex flex-col gap-5"
            validationBehavior="native"
            onSubmit={handleStep1Submit}
          >
            <Input
              isRequired
              autoComplete="email"
              className="font-body"
              label="Correo electrónico"
              name="email"
              placeholder="tu@correo.com"
              type="email"
              value={emailInput}
              variant="bordered"
              onValueChange={setEmailInput}
            />

            <Button
              className="h-12 w-full font-body text-base font-semibold sm:h-14"
              color="primary"
              disabled={busy}
              isLoading={isLoadingStep1}
              radius="lg"
              size="lg"
              type="submit"
            >
              Enviar código de verificación
            </Button>
          </Form>

          <div className="mt-6 text-center">
            <Link
              className="font-body text-sm text-default-500"
              href={`/${tenantSlug}/login`}
              size="sm"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        </div>

        {/* Step 2 — OTP */}
        <div className="w-1/4 shrink-0 px-5 py-7 sm:px-8 sm:py-9">
          {error && step === 2 && (
            <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 p-3">
              <p className="font-body text-sm text-danger">{error}</p>
            </div>
          )}

          <p className="mb-6 text-center font-body text-sm leading-relaxed text-default-600 sm:text-base">
            Ingresa el código de 6 dígitos que enviamos a{" "}
            <span className="font-semibold text-foreground">{email}</span>
          </p>

          <form className="flex flex-col gap-6" onSubmit={handleVerifyOtp}>
            <div className="flex justify-center gap-1.5 sm:gap-2.5">
              {otp.map((digit, i) => (
                <OtpDigitInput
                  key={i}
                  disabled={busy}
                  index={i}
                  inputRef={(el) => {
                    otpInputRefs.current[i] = el;
                  }}
                  value={digit}
                  onChange={setOtpDigit}
                  onKeyDown={handleOtpKeyDown}
                  onPaste={handleOtpPaste}
                />
              ))}
            </div>

            <Button
              className="h-12 w-full font-body text-base font-semibold sm:h-14"
              color="primary"
              disabled={busy}
              isLoading={isLoadingStep2}
              radius="lg"
              size="lg"
              type="submit"
            >
              Verificar código
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3 border-t border-default-100 pt-6">
            {resendCooldown > 0 ? (
              <p className="font-body text-sm text-default-400">
                Reenviar código en{" "}
                <span className="tabular-nums font-semibold text-default-600">
                  {resendCooldown}s
                </span>
              </p>
            ) : (
              <button
                className="font-body text-sm font-semibold text-primary underline-offset-4 transition-opacity hover:opacity-80 disabled:opacity-40"
                disabled={busy}
                type="button"
                onClick={handleResend}
              >
                {isResending ? "Enviando…" : "Reenviar código"}
              </button>
            )}
            <button
              className="font-body text-sm text-default-500 underline-offset-4 transition-colors hover:text-default-700"
              type="button"
              onClick={goBackToEmail}
            >
              Cambiar correo
            </button>
          </div>
        </div>

        {/* Step 3 — New password */}
        <div className="w-1/4 shrink-0 px-5 py-7 sm:px-8 sm:py-9">
          {error && step === 3 && (
            <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 p-3">
              <p className="font-body text-sm text-danger">{error}</p>
              {resetTokenExpired && (
                <button
                  className="mt-3 font-body text-sm font-semibold text-primary underline-offset-2 hover:underline"
                  type="button"
                  onClick={goBackToEmail}
                >
                  Volver al inicio y solicitar nuevo código
                </button>
              )}
            </div>
          )}

          <h2 className="mb-1 text-center font-heading text-lg font-bold text-foreground sm:text-xl">
            Nueva contraseña
          </h2>
          <p className="mb-6 text-center font-body text-sm text-default-500">
            Elige una contraseña segura para tu cuenta
          </p>

          <form className="flex flex-col gap-5" onSubmit={handleResetPassword}>
            <Input
              isRequired
              autoComplete="new-password"
              className="font-body"
              endContent={
                <button
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  className="focus:outline-none"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <Icon
                    className="pointer-events-none text-2xl text-default-400"
                    icon={
                      showPassword
                        ? "solar:eye-closed-linear"
                        : "solar:eye-bold"
                    }
                  />
                </button>
              }
              label="Contraseña"
              placeholder="••••••••"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              variant="bordered"
              onValueChange={setNewPassword}
            />

            <Input
              isRequired
              autoComplete="new-password"
              className="font-body"
              endContent={
                <button
                  aria-label={
                    showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  className="focus:outline-none"
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  <Icon
                    className="pointer-events-none text-2xl text-default-400"
                    icon={
                      showConfirm ? "solar:eye-closed-linear" : "solar:eye-bold"
                    }
                  />
                </button>
              }
              label="Confirmar contraseña"
              placeholder="••••••••"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              variant="bordered"
              onValueChange={setConfirmPassword}
            />

            <div className="rounded-xl border border-default-200 bg-default-50/80 p-4">
              <p className="mb-3 font-body text-xs font-semibold uppercase tracking-wide text-default-500">
                Requisitos
              </p>
              <ul className="flex flex-col gap-2 font-body text-sm">
                <li className="flex items-center gap-2">
                  <Icon
                    className={
                      strength.minLength
                        ? "text-success shrink-0 text-xl"
                        : "text-default-300 shrink-0 text-xl"
                    }
                    icon={
                      strength.minLength
                        ? "solar:check-circle-bold"
                        : "solar:close-circle-linear"
                    }
                  />
                  <span
                    className={
                      strength.minLength
                        ? "text-default-700"
                        : "text-default-500"
                    }
                  >
                    Mínimo 8 caracteres
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Icon
                    className={
                      strength.hasUpper
                        ? "text-success shrink-0 text-xl"
                        : "text-default-300 shrink-0 text-xl"
                    }
                    icon={
                      strength.hasUpper
                        ? "solar:check-circle-bold"
                        : "solar:close-circle-linear"
                    }
                  />
                  <span
                    className={
                      strength.hasUpper
                        ? "text-default-700"
                        : "text-default-500"
                    }
                  >
                    Al menos 1 letra mayúscula
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Icon
                    className={
                      strength.hasNumber
                        ? "text-success shrink-0 text-xl"
                        : "text-default-300 shrink-0 text-xl"
                    }
                    icon={
                      strength.hasNumber
                        ? "solar:check-circle-bold"
                        : "solar:close-circle-linear"
                    }
                  />
                  <span
                    className={
                      strength.hasNumber
                        ? "text-default-700"
                        : "text-default-500"
                    }
                  >
                    Al menos 1 número
                  </span>
                </li>
              </ul>
            </div>

            <Button
              className="h-12 w-full font-body text-base font-semibold sm:h-14"
              color="primary"
              disabled={busy}
              isLoading={isLoadingStep3}
              radius="lg"
              size="lg"
              type="submit"
            >
              Cambiar contraseña
            </Button>
          </form>
        </div>

        {/* Success */}
        <div className="flex w-1/4 shrink-0 flex-col items-center justify-center px-5 py-12 sm:px-8 sm:py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success-100 text-success sm:h-24 sm:w-24">
            <Icon
              className="text-5xl sm:text-6xl"
              icon="solar:check-circle-bold"
            />
          </div>
          <h2 className="mt-6 text-center font-heading text-xl font-bold sm:text-2xl">
            ¡Contraseña actualizada!
          </h2>
          <p className="mt-2 max-w-xs text-center font-body text-sm text-default-500">
            Redirigiendo al inicio de sesión en unos segundos…
          </p>
          <Link
            className="mt-8 font-body text-sm font-semibold text-primary"
            href={`/${tenantSlug}/login`}
            size="sm"
          >
            Ir al inicio de sesión ahora
          </Link>
        </div>
      </div>
    </div>
  );
}
