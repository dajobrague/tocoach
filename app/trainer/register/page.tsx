"use client";

import { Button, Divider, Form, Input, Link } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import React from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  const togglePasswordVisibility = () =>
    setIsPasswordVisible(!isPasswordVisible);
  const toggleConfirmPasswordVisibility = () =>
    setIsConfirmPasswordVisible(!isConfirmPasswordVisible);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // Check if passwords match
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setIsLoading(false);

      return;
    }

    const data = {
      email: formData.get("email") as string,
      password: password,
      fullName: formData.get("fullName") as string,
    };

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error en el registro");
      }

      // Registration successful, redirect to trainer dashboard
      router.push("/trainer/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en el registro");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center pb-8">
          <h1 className="text-3xl font-heading font-bold text-black mb-4">
            TOP COACH
          </h1>
          <h2 className="text-2xl font-heading font-semibold mb-2">
            Crea tu cuenta
          </h2>
          <p className="text-default-500 font-body text-center">
            Únete a TopCoach y empieza a construir tu negocio de coaching
          </p>
        </div>

        <div className="rounded-large bg-content1 shadow-small flex w-full flex-col gap-6 px-8 py-8">
          {error && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
              <p className="text-danger text-sm font-body">{error}</p>
            </div>
          )}

          <Form
            className="flex flex-col gap-4"
            validationBehavior="native"
            onSubmit={handleSubmit}
          >
            <Input
              isRequired
              className="font-body"
              label="Nombre completo"
              name="fullName"
              placeholder="Introduce tu nombre completo"
              type="text"
              variant="bordered"
            />

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

            <Input
              isRequired
              autoComplete="new-password"
              className="font-body"
              description="Mínimo 8 caracteres"
              endContent={
                <button type="button" onClick={togglePasswordVisibility}>
                  {isPasswordVisible ? (
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
              type={isPasswordVisible ? "text" : "password"}
              variant="bordered"
            />

            <Input
              isRequired
              autoComplete="new-password"
              className="font-body"
              endContent={
                <button type="button" onClick={toggleConfirmPasswordVisibility}>
                  {isConfirmPasswordVisible ? (
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
              label="Confirmar contraseña"
              name="confirmPassword"
              placeholder="Confirma tu contraseña"
              type={isConfirmPasswordVisible ? "text" : "password"}
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
              {isLoading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </Form>

          <div className="flex items-center gap-4">
            <Divider className="flex-1" />
            <p className="text-tiny text-default-500 shrink-0">O</p>
            <Divider className="flex-1" />
          </div>

          <p className="text-small text-center font-body">
            ¿Ya tienes una cuenta?&nbsp;
            <Link className="font-body" href="/trainer/login" size="sm">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
