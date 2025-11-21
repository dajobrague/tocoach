"use client";

import { Button, Form, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import React from "react";

interface ClientLoginFormProps {
  tenantSlug: string;
}

type LoginStep = "email" | "password" | "setup-password";

export function ClientLoginForm({ tenantSlug }: ClientLoginFormProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<LoginStep>("email");
  const [email, setEmail] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [isVisible, setIsVisible] = React.useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  const toggleVisibility = () => setIsVisible(!isVisible);
  const toggleConfirmVisibility = () => setIsConfirmVisible(!isConfirmVisible);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const emailValue = formData.get("email") as string;

    try {
      const response = await fetch("/api/auth/check-client-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue, tenantHost: tenantSlug }),
      });

      const result = await response.json();

      if (!response.ok || !result.exists) {
        throw new Error(result.message || "No user found with that email");
      }

      setEmail(emailValue);
      setClientId(result.clientId);
      setFullName(result.fullName);

      // Determine next step based on whether password is set
      setStep(result.hasPassword ? "password" : "setup-password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error checking email");
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
    const password = formData.get("password") as string;

    try {
      const response = await fetch("/api/auth/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, password, tenantSlug }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Invalid password");
      }

      // Login successful - redirect to slug-based dashboard
      router.push(`/${tenantSlug}/dashboard`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupPasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    try {
      const response = await fetch("/api/auth/setup-client-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          password,
          confirmPassword,
          tenantSlug,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to set password");
      }

      // Password set, redirect to slug-based dashboard
      router.push(`/${tenantSlug}/dashboard`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setError("");
  };

  return (
    <div className="rounded-large bg-content1 shadow-small flex w-full flex-col gap-6 px-8 py-8">
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
          <p className="text-danger text-sm font-body">{error}</p>
        </div>
      )}

      {/* Step 1: Email */}
      {step === "email" && (
        <Form
          className="flex flex-col gap-4"
          validationBehavior="native"
          onSubmit={handleEmailSubmit}
        >
          <Input
            isRequired
            autoComplete="email"
            className="font-body"
            label="Correo Electrónico"
            name="email"
            placeholder="Ingresa tu correo"
            type="email"
            variant="bordered"
          />

          <Button
            className="w-full font-body mt-2"
            color="primary"
            disabled={isLoading}
            isLoading={isLoading}
            size="lg"
            type="submit"
          >
            {isLoading ? "Verificando..." : "Continuar"}
          </Button>
        </Form>
      )}

      {/* Step 2: Enter Password */}
      {step === "password" && (
        <>
          <div className="text-center">
            <p className="text-sm text-default-600 font-body">
              Bienvenido de vuelta, {fullName}
            </p>
            <p className="text-xs text-default-400 font-body mt-1">{email}</p>
          </div>

          <Form
            className="flex flex-col gap-4"
            validationBehavior="native"
            onSubmit={handlePasswordSubmit}
          >
            <Input
              isRequired
              autoComplete="current-password"
              className="font-body"
              endContent={
                <button type="button" onClick={toggleVisibility}>
                  <Icon
                    className="text-default-400 pointer-events-none text-2xl"
                    icon={
                      isVisible ? "solar:eye-closed-linear" : "solar:eye-bold"
                    }
                  />
                </button>
              }
              label="Contraseña"
              name="password"
              placeholder="Ingresa tu contraseña"
              type={isVisible ? "text" : "password"}
              variant="bordered"
            />

            <div className="flex gap-2 w-full">
              <Button
                className="flex-1 font-body"
                size="lg"
                variant="bordered"
                onPress={handleBack}
              >
                Atrás
              </Button>
              <Button
                className="flex-[2] font-body"
                color="primary"
                disabled={isLoading}
                isLoading={isLoading}
                size="lg"
                type="submit"
              >
                {isLoading ? "Iniciando..." : "Iniciar Sesión"}
              </Button>
            </div>
          </Form>
        </>
      )}

      {/* Step 3: Setup Password */}
      {step === "setup-password" && (
        <>
          <div className="text-center">
            <h3 className="text-lg font-heading font-semibold mb-2">
              Configura Tu Contraseña
            </h3>
            <p className="text-sm text-default-600 font-body">
              Hola, {fullName}
            </p>
            <p className="text-xs text-primary font-body mt-1 font-semibold">
              {email}
            </p>
          </div>

          <div className="bg-primary border border-primary rounded-lg p-3">
            <p className="text-xs text-white font-body">
              <strong>Requisitos de Contraseña:</strong>
            </p>
            <ul className="text-xs text-white font-body mt-2 space-y-1 ml-4 list-disc">
              <li>Mínimo 8 caracteres</li>
              <li>Al menos una letra mayúscula</li>
              <li>Al menos un número</li>
            </ul>
          </div>

          <Form
            className="flex flex-col gap-4"
            validationBehavior="native"
            onSubmit={handleSetupPasswordSubmit}
          >
            <Input
              isRequired
              autoComplete="new-password"
              className="font-body"
              endContent={
                <button type="button" onClick={toggleVisibility}>
                  <Icon
                    className="text-default-400 pointer-events-none text-2xl"
                    icon={
                      isVisible ? "solar:eye-closed-linear" : "solar:eye-bold"
                    }
                  />
                </button>
              }
              label="Nueva Contraseña"
              minLength={8}
              name="password"
              placeholder="Crea una contraseña"
              type={isVisible ? "text" : "password"}
              variant="bordered"
            />

            <Input
              isRequired
              autoComplete="new-password"
              className="font-body"
              endContent={
                <button type="button" onClick={toggleConfirmVisibility}>
                  <Icon
                    className="text-default-400 pointer-events-none text-2xl"
                    icon={
                      isConfirmVisible
                        ? "solar:eye-closed-linear"
                        : "solar:eye-bold"
                    }
                  />
                </button>
              }
              label="Confirmar Contraseña"
              minLength={8}
              name="confirmPassword"
              placeholder="Confirma tu contraseña"
              type={isConfirmVisible ? "text" : "password"}
              variant="bordered"
            />

            <div className="flex gap-2 w-full">
              <Button
                className="flex-1 font-body"
                size="lg"
                variant="bordered"
                onPress={handleBack}
              >
                Atrás
              </Button>
              <Button
                className="flex-[2] font-body"
                color="primary"
                disabled={isLoading}
                isLoading={isLoading}
                size="lg"
                type="submit"
              >
                {isLoading ? "Configurando..." : "Configurar y Entrar"}
              </Button>
            </div>
          </Form>
        </>
      )}

      <div className="mt-4 w-full">
        <div className="bg-default-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="text-primary text-lg" icon="ph:info-duotone" />
            <h4 className="text-sm font-semibold font-heading">
              Acceso de Clientes
            </h4>
          </div>
          <p className="text-xs text-default-600 font-body">
            ¿No tienes cuenta? Tu entrenador creará una para ti.
          </p>
        </div>
      </div>
    </div>
  );
}
