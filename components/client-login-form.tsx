"use client";

import { Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import NextLink from "next/link";
import React from "react";

import {
  clearClientToken,
  getClientToken,
  storeClientToken,
} from "@/lib/auth/client-token-storage";

interface ClientLoginFormProps {
  tenantSlug: string;
  /** Nombre del entrenador para el mensaje de "correo no encontrado". */
  trainerName?: string;
}

type LoginStep = "email" | "password" | "setup-password";

const PASSWORD_RULES: ReadonlyArray<{
  label: string;
  test: (v: string) => boolean;
}> = [
  { label: "8 caracteres o más", test: (v) => v.length >= 8 },
  { label: "Una letra mayúscula", test: (v) => /[A-ZÁÉÍÓÚÑ]/.test(v) },
  { label: "Un número", test: (v) => /\d/.test(v) },
];

/** Primer nombre para el saludo ("Hola de nuevo, Marta"). */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

// Guard against an infinite recovery loop: if the browser keeps stripping
// the cookie immediately after we re-set it (hard cookie blocking), we'd
// bounce dashboard → login → refresh-cookie → dashboard → ... forever.
// Track the last attempt timestamp in sessionStorage and skip recovery if
// we tried to recover less than RECOVERY_COOLDOWN_MS ago.
const LAST_RECOVERY_KEY = "topcoach.last_session_recovery_at";
const RECOVERY_COOLDOWN_MS = 10_000;

function readLastRecoveryTs(): number {
  if (typeof sessionStorage === "undefined") return 0;
  try {
    return parseInt(sessionStorage.getItem(LAST_RECOVERY_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function writeLastRecoveryTs(ts: number): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(LAST_RECOVERY_KEY, String(ts));
  } catch {
    // no-op
  }
}

// Extract the `tenant_slug` claim from a JWT without verifying it. Used only
// to decide whether to skip the cookie-recovery flow for a token that
// belongs to a different tenant — the JWT's signature is still verified
// server-side by /api/auth/refresh-cookie. Returns null on any parse error.
function decodeTokenTenantSlug(token: string): string | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) return null;
    const payloadSegment = parts[1];

    if (!payloadSegment) return null;
    const padded =
      payloadSegment.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (payloadSegment.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as { tenant_slug?: unknown };

    return typeof payload.tenant_slug === "string" ? payload.tenant_slug : null;
  } catch {
    return null;
  }
}

export function ClientLoginForm({ tenantSlug }: ClientLoginFormProps) {
  const [step, setStep] = React.useState<LoginStep>("email");
  const [email, setEmail] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isVisible, setIsVisible] = React.useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  // Starts `true` so SSR renders the loader shell; the effect below flips
  // it to `false` synchronously on the first client render when there's
  // nothing to recover.
  const [isRecoveringSession, setIsRecoveringSession] = React.useState(true);
  // Llegada desde "Recuperar contraseña": correo puesto + aviso.
  const [justReset, setJustReset] = React.useState(false);
  const autoCheckedRef = React.useRef(false);

  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const newPasswordRef = React.useRef<HTMLInputElement>(null);

  // On mount: if the user has a valid JWT in localStorage (from a prior
  // login) but no cookie (middleware bounced them here), POST the token to
  // /api/auth/refresh-cookie to re-issue the cookie, then navigate to the
  // dashboard. Same signed JWT, same tenant — just restoring the cookie
  // transport that the browser dropped.
  React.useEffect(() => {
    let cancelled = false;

    async function recoverSession() {
      const token = getClientToken();

      if (!token) {
        if (!cancelled) setIsRecoveringSession(false);

        return;
      }

      // Cross-tenant guard: a localStorage token from another trainer's
      // portal would otherwise be re-issued as a cookie here and bounce
      // the user into a redirect loop on this tenant's protected routes.
      // Don't clear it — the user may still want it for the original
      // tenant — just skip recovery and render the login form.
      const tokenTenantSlug = decodeTokenTenantSlug(token);

      if (tokenTenantSlug && tokenTenantSlug !== tenantSlug) {
        if (!cancelled) setIsRecoveringSession(false);

        return;
      }

      // Anti-loop: if we just attempted recovery and are back on /login,
      // the browser is hard-blocking the cookie. Show the form and let
      // the user proceed manually rather than bouncing forever.
      const lastTs = readLastRecoveryTs();

      if (Date.now() - lastTs < RECOVERY_COOLDOWN_MS) {
        if (!cancelled) setIsRecoveringSession(false);

        return;
      }

      writeLastRecoveryTs(Date.now());

      try {
        const response = await fetch("/api/auth/refresh-cookie", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // Token is invalid/expired. Clear it so subsequent visits show
          // the login form immediately instead of retrying.
          clearClientToken();
          if (!cancelled) setIsRecoveringSession(false);

          return;
        }

        const data = await response.json();

        if (typeof data.token === "string" && data.token) {
          storeClientToken(data.token);
        }

        // Cookie was re-set server-side. Full page navigation (not
        // router.push) so middleware re-runs with the fresh cookie.
        window.location.href = `/${tenantSlug}/dashboard`;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[Client Login] Session recovery failed:", err);
        if (!cancelled) setIsRecoveringSession(false);
      }
    }

    recoverSession();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  // When a step reveals its password field, move the caret there.
  React.useEffect(() => {
    if (step === "email") return undefined;
    const id = window.setTimeout(() => {
      (step === "password" ? passwordRef : newPasswordRef).current?.focus({
        preventScroll: true,
      });
    }, 200);

    return () => clearTimeout(id);
  }, [step]);

  React.useEffect(() => {
    if (isRecoveringSession || autoCheckedRef.current) return;
    autoCheckedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("email");

    if (!fromQuery) return;
    setEmail(fromQuery);
    if (params.get("reset") === "1") {
      setJustReset(true);
      // Pasa directo al campo de contraseña con el correo ya comprobado.
      window.setTimeout(() => {
        document
          .getElementById("client-login-form")
          ?.dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
          );
      }, 0);
    }
  }, [isRecoveringSession]);

  const finishLogin = (token: unknown) => {
    // Persist the JWT as a cookie fallback (used as `Authorization:
    // Bearer` on writes when the httpOnly cookie is blocked by
    // Safari ITP / third-party cookie restrictions / in-app browsers).
    if (typeof token === "string" && token) {
      storeClientToken(token);
    }

    // Full page navigation so the TanStack Query cache is reset and the
    // bootstrap query fetches fresh auth data.
    window.location.href = `/${tenantSlug}/dashboard`;
  };

  const submitPassword = async (value: string) => {
    const response = await fetch("/api/auth/client-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, password: value, tenantSlug }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Contraseña incorrecta");
    }
    finishLogin(result.token);
  };

  const handleEmailStep = async () => {
    const emailValue = email.trim();

    if (!/^\S+@\S+\.\S+$/.test(emailValue)) {
      setError("Escribe un correo completo, como nombre@correo.com.");

      return;
    }

    const response = await fetch("/api/auth/check-client-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailValue, tenantHost: tenantSlug }),
    });
    const result = await response.json();

    if (!response.ok || !result.exists) {
      throw new Error(
        result.message ||
          "No se encontró una cuenta con ese correo. Contacta a tu entrenador."
      );
    }

    setEmail(emailValue);
    setClientId(result.clientId);
    setFullName(result.fullName);

    // Password managers often fill the (collapsed) password field together
    // with the email: log straight in instead of asking for another tap.
    const autofilled = passwordRef.current?.value ?? "";

    if (result.hasPassword && autofilled) {
      const response2 = await fetch("/api/auth/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: result.clientId,
          password: autofilled,
          tenantSlug,
        }),
      });
      const result2 = await response2.json();

      if (response2.ok) {
        finishLogin(result2.token);

        return;
      }
      setPassword("");
    }

    setStep(result.hasPassword ? "password" : "setup-password");
  };

  const handleSetupPassword = async () => {
    const response = await fetch("/api/auth/setup-client-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        password: newPassword,
        confirmPassword,
        tenantSlug,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "No se pudo crear la contraseña");
    }
    finishLogin(result.token);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;
    setError("");
    setIsLoading(true);

    try {
      if (step === "email") await handleEmailStep();
      else if (step === "password") {
        if (!password) throw new Error("Escribe tu contraseña.");
        await submitPassword(password);
      } else await handleSetupPassword();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Algo salió mal. Inténtalo de nuevo."
      );
      if (step === "password") passwordRef.current?.select();
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setJustReset(false);
    setStep("email");
    setError("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    window.setTimeout(() => emailRef.current?.select(), 0);
  };

  const rulesPassed = PASSWORD_RULES.map((r) => r.test(newPassword));
  const confirmMismatch =
    confirmPassword.length > 0 && !newPassword.startsWith(confirmPassword);
  const setupReady =
    rulesPassed.every(Boolean) && confirmPassword === newPassword;

  const name = firstNameOf(fullName);
  const title =
    step === "password"
      ? `Hola de nuevo${name ? `, ${name}` : ""}`
      : step === "setup-password"
        ? `Bienvenido${name ? `, ${name}` : ""}`
        : "Entra en tu cuenta";
  const lede =
    step === "password"
      ? "Escribe tu contraseña para entrar."
      : step === "setup-password"
        ? "Es tu primera vez. Crea una contraseña para entrar desde ahora."
        : "Usa el correo que le diste a tu entrenador.";
  const ctaLabel =
    step === "password"
      ? "Entrar"
      : step === "setup-password"
        ? "Crear y entrar"
        : "Continuar";

  const fieldClass =
    "h-[54px] w-full rounded-xl border border-default-200 bg-content1 px-4 text-[17px] text-foreground caret-primary outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-default-400 focus:border-primary focus:shadow-[0_0_0_4px_hsl(var(--heroui-primary)/0.2)]";
  const errorFieldClass =
    "border-danger shadow-[0_0_0_4px_hsl(var(--heroui-danger)/0.15)]";

  if (isRecoveringSession) {
    return (
      <div className="flex w-full flex-col items-center gap-3 py-12">
        <Spinner color="primary" size="lg" />
        <p className="text-[15px] text-default-500">Abriendo tu cuenta…</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex w-full flex-col gap-5"
      id="client-login-form"
      onSubmit={handleSubmit}
    >
      {justReset ? (
        <p
          className="flex items-start gap-2.5 rounded-xl bg-content1 px-3.5 py-3 text-[15px] leading-snug text-foreground shadow-small"
          role="status"
        >
          <Icon
            className="mt-0.5 shrink-0 text-xl text-success"
            icon="solar:check-circle-linear"
          />
          Contraseña cambiada. Entra con la nueva.
        </p>
      ) : null}
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-heading text-[30px] leading-[1.08] tracking-[-0.025em] text-foreground [text-wrap:balance]">
          {title}
        </h2>
        <p className="text-base leading-snug text-default-500">{lede}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label
          className="text-[13px] font-semibold text-default-500"
          htmlFor="client-login-email"
        >
          Correo
        </label>
        <div className="relative">
          <input
            ref={emailRef}
            required
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
            className={`${fieldClass} ${step !== "email" ? "bg-transparent pr-28" : ""} ${error && step === "email" ? errorFieldClass : ""}`}
            enterKeyHint="next"
            id="client-login-email"
            inputMode="email"
            name="email"
            placeholder="nombre@correo.com"
            readOnly={step !== "email"}
            spellCheck={false}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
          />
          {step !== "email" ? (
            <button
              className="absolute right-1.5 top-1.5 h-[42px] select-none rounded-[10px] px-3 text-[15px] font-semibold text-foreground active:bg-default-100"
              type="button"
              onClick={handleChangeEmail}
            >
              Cambiar
            </button>
          ) : null}
        </div>
        {error && step === "email" ? (
          <p className="text-sm leading-snug text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {/* Contraseña: siempre en el DOM (plegada) para que los gestores de
          contraseñas rellenen correo y contraseña a la vez. */}
      <Reveal open={step === "password"}>
        <div className="flex flex-col gap-2">
          <label
            className="text-[13px] font-semibold text-default-500"
            htmlFor="client-login-password"
          >
            Contraseña
          </label>
          <div className="relative">
            <input
              ref={passwordRef}
              autoComplete="current-password"
              className={`${fieldClass} pr-14 ${error && step === "password" ? errorFieldClass : ""}`}
              enterKeyHint="go"
              id="client-login-password"
              name="password"
              type={isVisible ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
            />
            <EyeButton
              visible={isVisible}
              onToggle={() => setIsVisible((v) => !v)}
            />
          </div>
          {error && step === "password" ? (
            <p className="text-sm leading-snug text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <NextLink
          className="-mt-2 self-start py-1.5 text-[15px] font-medium text-foreground underline decoration-default-300 underline-offset-[3px]"
          href={`/${tenantSlug}/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
        >
          ¿Olvidaste tu contraseña?
        </NextLink>
      </Reveal>

      <Reveal open={step === "setup-password"}>
        <div className="flex flex-col gap-2">
          <label
            className="text-[13px] font-semibold text-default-500"
            htmlFor="client-login-new-password"
          >
            Crea una contraseña
          </label>
          <div className="relative">
            <input
              ref={newPasswordRef}
              autoComplete="new-password"
              className={`${fieldClass} pr-14`}
              enterKeyHint="next"
              id="client-login-new-password"
              minLength={8}
              name="newPassword"
              type={isVisible ? "text" : "password"}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  document.getElementById("client-login-confirm")?.focus();
                }
              }}
            />
            <EyeButton
              visible={isVisible}
              onToggle={() => setIsVisible((v) => !v)}
            />
          </div>
        </div>
        <ul className="-mt-1 grid gap-1.5 text-sm text-default-500">
          {PASSWORD_RULES.map((rule, i) => (
            <li
              key={rule.label}
              className={`flex items-center gap-2 transition-colors ${rulesPassed[i] ? "text-foreground" : ""}`}
            >
              <Icon
                className={`text-base ${rulesPassed[i] ? "text-success" : "text-default-300"}`}
                icon={
                  rulesPassed[i]
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
            htmlFor="client-login-confirm"
          >
            Repítela
          </label>
          <div className="relative">
            <input
              autoComplete="new-password"
              className={`${fieldClass} pr-14 ${confirmMismatch ? errorFieldClass : ""}`}
              enterKeyHint="go"
              id="client-login-confirm"
              name="confirmPassword"
              type={isConfirmVisible ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <EyeButton
              visible={isConfirmVisible}
              onToggle={() => setIsConfirmVisible((v) => !v)}
            />
          </div>
          {confirmMismatch ? (
            <p className="text-sm text-danger">No coincide con la de arriba.</p>
          ) : null}
          {error && step === "setup-password" ? (
            <p className="text-sm leading-snug text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Reveal>

      <Button
        className="mt-1 h-[54px] w-full text-[17px] font-semibold"
        color="primary"
        isDisabled={step === "setup-password" && !setupReady}
        isLoading={isLoading}
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

  // React 18 doesn't forward a boolean `inert`; set the attribute directly so
  // the folded fields can't be tabbed into.
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
