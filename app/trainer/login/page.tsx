"use client";

import { Button, Form, Input, Link } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import React from "react";

export default function TrainerLoginPage() {
  const router = useRouter();
  const [isVisible, setIsVisible] = React.useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [step, setStep] = React.useState<"email" | "password">("email");
  const [email, setEmail] = React.useState("");
  const [isFirstLogin, setIsFirstLogin] = React.useState(false);
  const [trainerName, setTrainerName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const toggleVisibility = () => setIsVisible(!isVisible);
  const toggleConfirmVisibility = () => setIsConfirmVisible(!isConfirmVisible);

  // Password validation for first login
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const passwordsMatch =
    password === confirmPassword && confirmPassword.length > 0;
  const isPasswordValid =
    hasMinLength && hasLetter && hasNumber && passwordsMatch;

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const emailValue = formData.get("email") as string;

    try {
      const response = await fetch("/api/trainer/check-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: emailValue }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al verificar email");
      }

      setEmail(emailValue);
      setIsFirstLogin(result.isFirstLogin);
      setTrainerName(result.fullName || "");
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al verificar email");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const passwordValue = isFirstLogin
      ? password
      : (formData.get("password") as string);

    try {
      if (isFirstLogin) {
        // Validate password requirements
        if (!hasMinLength || !hasLetter || !hasNumber) {
          throw new Error("La contraseña no cumple con los requisitos mínimos");
        }
        if (!passwordsMatch) {
          throw new Error("Las contraseñas no coinciden");
        }
        const password = passwordValue;
        // First login: Update password in Supabase Auth and set password_set_at
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const { createClient } = await import("@supabase/supabase-js");
        const { TEMP_PASSWORD_TRAINER } = await import("@/lib/constants/auth");

        // CRITICAL: Create client with persistSession: false to prevent session leakage
        // This ensures we don't restore any old sessions from localStorage
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false, // Don't save session to localStorage
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });

        console.log(
          "[TrainerLogin] First login detected for:",
          email,
          "- attempting auth with temp password"
        );

        // First, sign in with temporary password
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password: TEMP_PASSWORD_TRAINER,
          });

        if (signInError || !signInData.user) {
          console.error("[TrainerLogin] Sign in error:", signInError?.message);
          throw new Error(
            `Error al autenticar: ${signInError?.message}. Contacta al administrador.`
          );
        }

        console.log(
          "[TrainerLogin] Successfully authenticated user:",
          signInData.user.email,
          "ID:",
          signInData.user.id
        );

        // SECURITY CHECK: Verify the authenticated user matches the email
        if (signInData.user.email?.toLowerCase() !== email.toLowerCase()) {
          console.error(
            "[TrainerLogin] SECURITY ERROR: Email mismatch!",
            "Expected:",
            email,
            "Got:",
            signInData.user.email
          );
          throw new Error(
            "Error de seguridad: usuario incorrecto. Contacta al administrador."
          );
        }

        // Update to new password
        const { error: updateError } = await supabase.auth.updateUser({
          password: password,
        });

        if (updateError) {
          console.error("[TrainerLogin] Password update error:", updateError);
          throw new Error("Error al configurar contraseña");
        }

        console.log("[TrainerLogin] Password updated successfully");

        // CRITICAL: Sign out from Supabase to clear any temporary session
        await supabase.auth.signOut();
        console.log("[TrainerLogin] Supabase session cleared");

        // Mark password as set in our database
        const setupResponse = await fetch("/api/trainer/setup-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, newPassword: password }),
        });

        if (!setupResponse.ok) {
          throw new Error("Error al actualizar contraseña");
        }

        // Now login with new password to create our JWT session
        const loginResponse = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const loginResult = await loginResponse.json();

        if (!loginResponse.ok) {
          throw new Error(loginResult.error || "Error en el inicio de sesión");
        }

        console.log(
          "[TrainerLogin] JWT session created, redirecting to dashboard"
        );
        window.location.href = "/trainer/dashboard";
      } else {
        // Regular login
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password: passwordValue }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Error en el inicio de sesión");
        }

        window.location.href = "/trainer/dashboard";
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error en el inicio de sesión"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="flex h-full w-full items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center pb-8">
          <h1 className="text-3xl font-heading font-bold text-black mb-4">
            TOP COACH
          </h1>
          <h2 className="text-xl font-medium font-heading mb-2">
            {step === "email"
              ? "Bienvenido de nuevo"
              : isFirstLogin
                ? `¡Hola ${trainerName}!`
                : `Hola de nuevo, ${trainerName}`}
          </h2>
          <p className="text-default-500 font-body text-center">
            {step === "email"
              ? "Inicia sesión en tu plataforma de coaching"
              : isFirstLogin
                ? "Configura tu contraseña para comenzar"
                : "Ingresa tu contraseña para continuar"}
          </p>
        </div>

        <div className="rounded-large bg-content1 shadow-small flex w-full flex-col gap-6 px-8 py-8">
          {error && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
              <p className="text-danger text-sm font-body">{error}</p>
            </div>
          )}

          {step === "email" ? (
            <Form
              className="flex flex-col gap-4"
              validationBehavior="native"
              onSubmit={handleEmailSubmit}
            >
              <Input
                isRequired
                autoComplete="email"
                className="font-body"
                label="Dirección de correo electrónico"
                name="email"
                placeholder="Introduce tu correo electrónico"
                type="email"
                variant="bordered"
              />

              <Button
                className="w-full font-body mt-2 bg-black text-white hover:bg-slate-800"
                disabled={isLoading}
                isLoading={isLoading}
                size="lg"
                type="submit"
              >
                {isLoading ? "Verificando..." : "Continuar"}
              </Button>
            </Form>
          ) : (
            <Form
              className="flex flex-col gap-4"
              validationBehavior="native"
              onSubmit={handlePasswordSubmit}
            >
              <div className="flex items-center gap-2 mb-2">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={handleBack}
                >
                  <Icon className="text-xl" icon="solar:arrow-left-linear" />
                </Button>
                <p className="text-sm text-default-500 font-body">{email}</p>
              </div>

              {/* First login instructions */}
              {isFirstLogin && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon
                      className="text-slate-700"
                      icon="solar:shield-keyhole-bold"
                      width={20}
                    />
                    <h4 className="text-sm font-semibold text-slate-800 font-heading">
                      Configura tu contraseña
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 font-body leading-relaxed">
                    Es tu primer acceso. Por seguridad, necesitas crear una
                    contraseña personal. Esta será tu contraseña para acceder a
                    tu plataforma de coaching.
                  </p>
                </div>
              )}

              {isFirstLogin ? (
                <>
                  {/* New password field */}
                  <Input
                    isRequired
                    autoComplete="new-password"
                    className="font-body"
                    endContent={
                      <button type="button" onClick={toggleVisibility}>
                        {isVisible ? (
                          <Icon
                            className="text-default-400 pointer-events-none text-2xl"
                            icon="solar:eye-closed-linear"
                          />
                        ) : (
                          <Icon
                            className="text-default-400 pointer-events-none text-2xl"
                            icon="solar:eye-bold"
                          />
                        )}
                      </button>
                    }
                    label="Nueva contraseña"
                    name="password"
                    placeholder="Crea una contraseña segura"
                    type={isVisible ? "text" : "password"}
                    value={password}
                    variant="bordered"
                    onValueChange={setPassword}
                  />

                  {/* Password strength indicators */}
                  {password.length > 0 && (
                    <div className="space-y-1.5 -mt-1">
                      <div className="flex items-center gap-2">
                        <Icon
                          className={
                            hasMinLength ? "text-green-500" : "text-gray-300"
                          }
                          icon={
                            hasMinLength
                              ? "solar:check-circle-bold"
                              : "solar:close-circle-linear"
                          }
                          width={16}
                        />
                        <span
                          className={`text-xs font-body ${hasMinLength ? "text-green-700" : "text-gray-500"}`}
                        >
                          Mínimo 8 caracteres
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon
                          className={
                            hasLetter ? "text-green-500" : "text-gray-300"
                          }
                          icon={
                            hasLetter
                              ? "solar:check-circle-bold"
                              : "solar:close-circle-linear"
                          }
                          width={16}
                        />
                        <span
                          className={`text-xs font-body ${hasLetter ? "text-green-700" : "text-gray-500"}`}
                        >
                          Incluye al menos una letra
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon
                          className={
                            hasNumber ? "text-green-500" : "text-gray-300"
                          }
                          icon={
                            hasNumber
                              ? "solar:check-circle-bold"
                              : "solar:close-circle-linear"
                          }
                          width={16}
                        />
                        <span
                          className={`text-xs font-body ${hasNumber ? "text-green-700" : "text-gray-500"}`}
                        >
                          Incluye al menos un número
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon
                          className={
                            hasSpecial ? "text-green-500" : "text-gray-300"
                          }
                          icon={
                            hasSpecial
                              ? "solar:check-circle-bold"
                              : "solar:close-circle-linear"
                          }
                          width={16}
                        />
                        <span
                          className={`text-xs font-body ${hasSpecial ? "text-green-700" : "text-gray-500"}`}
                        >
                          Incluye un carácter especial (recomendado)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Confirm password field */}
                  <Input
                    isRequired
                    autoComplete="new-password"
                    className="font-body"
                    endContent={
                      <button type="button" onClick={toggleConfirmVisibility}>
                        {isConfirmVisible ? (
                          <Icon
                            className="text-default-400 pointer-events-none text-2xl"
                            icon="solar:eye-closed-linear"
                          />
                        ) : (
                          <Icon
                            className="text-default-400 pointer-events-none text-2xl"
                            icon="solar:eye-bold"
                          />
                        )}
                      </button>
                    }
                    errorMessage={
                      confirmPassword.length > 0 && !passwordsMatch
                        ? "Las contraseñas no coinciden"
                        : undefined
                    }
                    isInvalid={confirmPassword.length > 0 && !passwordsMatch}
                    label="Confirmar contraseña"
                    name="confirmPassword"
                    placeholder="Repite tu contraseña"
                    type={isConfirmVisible ? "text" : "password"}
                    value={confirmPassword}
                    variant="bordered"
                    onValueChange={setConfirmPassword}
                  />

                  {/* Match indicator */}
                  {confirmPassword.length > 0 && passwordsMatch && (
                    <div className="flex items-center gap-2 -mt-1">
                      <Icon
                        className="text-green-500"
                        icon="solar:check-circle-bold"
                        width={16}
                      />
                      <span className="text-xs font-body text-green-700">
                        Las contraseñas coinciden
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Regular login password field */}
                  <Input
                    isRequired
                    autoComplete="current-password"
                    className="font-body"
                    endContent={
                      <button type="button" onClick={toggleVisibility}>
                        {isVisible ? (
                          <Icon
                            className="text-default-400 pointer-events-none text-2xl"
                            icon="solar:eye-closed-linear"
                          />
                        ) : (
                          <Icon
                            className="text-default-400 pointer-events-none text-2xl"
                            icon="solar:eye-bold"
                          />
                        )}
                      </button>
                    }
                    label="Contraseña"
                    name="password"
                    placeholder="Introduce tu contraseña"
                    type={isVisible ? "text" : "password"}
                    variant="bordered"
                  />

                  <div className="flex justify-end">
                    <Link
                      className="font-body text-slate-700 hover:text-black"
                      href="/trainer/forgot-password"
                      size="sm"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                </>
              )}

              <Button
                className="w-full font-body mt-2 bg-black text-white hover:bg-slate-800"
                disabled={isLoading || (isFirstLogin && !isPasswordValid)}
                isLoading={isLoading}
                size="lg"
                type="submit"
              >
                {isLoading
                  ? isFirstLogin
                    ? "Configurando..."
                    : "Iniciando sesión..."
                  : isFirstLogin
                    ? "Configurar contraseña y comenzar"
                    : "Iniciar sesión"}
              </Button>
            </Form>
          )}

          {/* Registration link removed - trainers are now created by admin only */}
        </div>

        <div className="mt-6 w-full">
          <div className="bg-default-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="text-slate-700 text-lg" icon="ph:info-duotone" />
              <h4 className="text-sm font-semibold font-heading">
                Para Entrenadores y Coaches
              </h4>
            </div>
            <p className="text-xs text-default-600 font-body">
              Este es el acceso para entrenadores. Tus clientes accederán a su
              portal a través de tu dominio personalizado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
