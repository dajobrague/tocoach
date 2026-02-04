"use client";

import { Button, Form, Input, Link } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

export default function TrainerForgotPasswordPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;

    try {
      const response = await fetch("/api/trainer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al enviar el correo");
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al enviar el correo"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          <div className="rounded-large bg-content1 shadow-small p-8">
            <div className="flex items-center gap-3 mb-4">
              <Icon
                className="text-success text-3xl"
                icon="solar:check-circle-bold"
              />
              <h3 className="text-lg font-semibold font-heading">
                Revisa tu correo
              </h3>
            </div>
            <p className="text-default-600 mb-4 font-body">
              Si existe una cuenta con ese correo electrónico, recibirás
              instrucciones para restablecer tu contraseña.
            </p>
            <Link className="text-primary font-body" href="/trainer/login">
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center pb-8">
          <h1 className="text-3xl font-heading font-bold text-black mb-4">
            TOP COACH
          </h1>
          <h2 className="text-xl font-medium font-heading mb-2">
            Restablecer contraseña
          </h2>
          <p className="text-default-500 font-body text-center">
            Ingresa tu correo electrónico y te enviaremos un enlace para
            restablecer tu contraseña
          </p>
        </div>

        <div className="rounded-large bg-content1 shadow-small p-8">
          {error && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 mb-4">
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
              autoComplete="email"
              className="font-body"
              label="Correo electrónico"
              name="email"
              placeholder="Ingresa tu correo electrónico"
              type="email"
              variant="bordered"
            />

            <Button
              className="w-full mt-2"
              color="primary"
              disabled={isLoading}
              isLoading={isLoading}
              size="lg"
              type="submit"
            >
              {isLoading ? "Enviando..." : "Enviar enlace"}
            </Button>
          </Form>

          <div className="mt-4 text-center">
            <Link className="font-body" href="/trainer/login" size="sm">
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
