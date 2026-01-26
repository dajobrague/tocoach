"use client";

import { Button, Divider, Form, Input, Link } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import React from "react";
import { createClient } from "@supabase/supabase-js";

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<"email" | "password">("email");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isFirstLogin, setIsFirstLogin] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  const toggleVisibility = () => setIsVisible(!isVisible);

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/check-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al verificar email");
      }

      setIsFirstLogin(result.isFirstLogin);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al verificar email");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (isFirstLogin) {
        // First login - set new password
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        // CRITICAL: Create client with persistSession: false to prevent session leakage
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false, // Don't save session to localStorage
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });

        console.log("[AdminFirstLogin] First login detected for:", email);

        // Sign in with temporary password
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password: "TopCoachAdmin2026!",
          });

        if (signInError || !signInData.user) {
          console.error("[AdminFirstLogin] Sign in error:", signInError);
          throw new Error(
            "Error al autenticar con contraseña temporal. " +
              (signInError?.message || "Por favor, contacta al administrador.")
          );
        }

        console.log(
          "[AdminFirstLogin] Authenticated user:",
          signInData.user.email,
          "ID:",
          signInData.user.id
        );

        // SECURITY CHECK: Verify the authenticated user matches the email
        if (signInData.user.email?.toLowerCase() !== email.toLowerCase()) {
          console.error(
            "[AdminFirstLogin] SECURITY ERROR: Email mismatch!",
            "Expected:",
            email,
            "Got:",
            signInData.user.email
          );
          throw new Error(
            "Error de seguridad: usuario incorrecto. Contacta al administrador."
          );
        }

        // Update password
        const { error: updateError } = await supabase.auth.updateUser({
          password: password,
        });

        if (updateError) {
          throw new Error(
            "Error al configurar contraseña: " + updateError.message
          );
        }

        console.log("[AdminFirstLogin] Password updated successfully");

        // CRITICAL: Sign out from Supabase to clear any temporary session
        await supabase.auth.signOut();
        console.log("[AdminFirstLogin] Supabase session cleared");

        // Mark password as changed
        const setupResponse = await fetch("/api/admin/setup-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ email }),
        });

        if (!setupResponse.ok) {
          throw new Error("Error al completar la configuración");
        }

        // Now log in with new password to create JWT session
        const loginResponse = await fetch("/api/admin/login", {
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
          "[AdminFirstLogin] JWT session created, redirecting to dashboard"
        );
        window.location.href = "/admin/dashboard";
      } else {
        // Regular login
        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Error en el inicio de sesión");
        }

        window.location.href = "/admin/dashboard";
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error en el inicio de sesión"
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center pb-8">
          <div className="bg-black text-white p-4 rounded-2xl mb-6">
            <Icon className="text-5xl" icon="solar:shield-user-bold" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-slate-900 mb-2">
            Admin Dashboard
          </h1>
          <h2 className="text-xl font-medium font-heading mb-2 text-slate-700">
            Panel de Administración
          </h2>
          <p className="text-slate-500 font-body text-center text-sm">
            Acceso exclusivo para administradores del sistema
          </p>
        </div>

        <div className="rounded-large bg-white shadow-lg flex w-full flex-col gap-6 px-8 py-8 border border-slate-200">
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
                autoFocus
                isRequired
                autoComplete="email"
                className="font-body"
                label="Correo electrónico"
                placeholder="admin@topcoach.com"
                type="email"
                value={email}
                variant="bordered"
                onValueChange={setEmail}
              />
              <Button
                className="w-full font-body font-semibold mt-2 text-white shadow-lg bg-black"
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-600 font-body">
                  <strong>{email}</strong>
                </p>
                <Button
                  className="text-black"
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setStep("email");
                    setPassword("");
                    setError("");
                  }}
                >
                  Cambiar
                </Button>
              </div>

              {isFirstLogin && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                  <div className="flex items-start gap-2">
                    <Icon
                      className="text-blue-600 text-lg mt-0.5"
                      icon="solar:info-circle-bold"
                    />
                    <p className="text-sm text-blue-900 font-body">
                      Es tu primer inicio de sesión. Por favor, establece una
                      contraseña segura (mínimo 8 caracteres).
                    </p>
                  </div>
                </div>
              )}

              <Input
                autoFocus
                isRequired
                autoComplete={
                  isFirstLogin ? "new-password" : "current-password"
                }
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
                label={isFirstLogin ? "Nueva Contraseña" : "Contraseña"}
                placeholder={
                  isFirstLogin
                    ? "Crea una contraseña segura"
                    : "Introduce tu contraseña"
                }
                type={isVisible ? "text" : "password"}
                value={password}
                variant="bordered"
                onValueChange={setPassword}
              />
              <Button
                className="w-full font-body font-semibold mt-2 text-white shadow-lg bg-black"
                disabled={isLoading}
                isLoading={isLoading}
                size="lg"
                type="submit"
              >
                {isLoading
                  ? isFirstLogin
                    ? "Configurando..."
                    : "Iniciando sesión..."
                  : isFirstLogin
                    ? "Establecer Contraseña e Iniciar Sesión"
                    : "Iniciar Sesión"}
              </Button>
            </Form>
          )}

          <div className="flex items-center gap-4">
            <Divider className="flex-1" />
            <Icon
              className="text-slate-400 text-lg"
              icon="solar:lock-password-bold-duotone"
            />
            <Divider className="flex-1" />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon
                className="text-black text-lg"
                icon="solar:shield-warning-bold-duotone"
              />
              <h4 className="text-sm font-semibold font-heading text-slate-900">
                Acceso Restringido
              </h4>
            </div>
            <p className="text-xs text-slate-700 font-body">
              Este panel está reservado para administradores del sistema. Si
              eres un entrenador, inicia sesión en{" "}
              <Link className="font-semibold" href="/trainer/login" size="sm">
                /trainer/login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
