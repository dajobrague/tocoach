"use client";

import { Button, Form, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import React from "react";

export default function TrainerResetPasswordPage() {
  const router = useRouter();
  const [isVisible, setIsVisible] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [success, setSuccess] = React.useState(false);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const newPassword = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setIsLoading(false);

      return;
    }

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      setIsLoading(false);

      return;
    }

    try {
      // Create Supabase client - the session should be restored from the reset link
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Configuración de Supabase no disponible");
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Also update password_set_at in trainers table
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Call API to update password_set_at
        await fetch("/api/trainer/setup-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            newPassword: newPassword,
          }),
        });
      }

      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/trainer/login");
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al restablecer la contraseña"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          <div className="rounded-large bg-content1 shadow-small p-8 text-center">
            <Icon
              className="text-success text-6xl mx-auto mb-4"
              icon="solar:check-circle-bold"
            />
            <h2 className="text-2xl font-heading font-bold mb-2">
              ¡Contraseña restablecida!
            </h2>
            <p className="text-default-600 font-body">
              Tu contraseña ha sido actualizada correctamente. Redirigiendo al
              inicio de sesión...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center pb-8">
          <h1 className="text-3xl font-heading font-bold text-black mb-4">
            TOP COACH
          </h1>
          <h2 className="text-xl font-medium font-heading mb-2">
            Nueva contraseña
          </h2>
          <p className="text-default-500 font-body text-center">
            Elige una contraseña segura para tu cuenta
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
              autoComplete="new-password"
              className="font-body"
              description="Mínimo 8 caracteres"
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
              minLength={8}
              name="password"
              placeholder="Ingresa tu nueva contraseña"
              type={isVisible ? "text" : "password"}
              variant="bordered"
            />

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
              label="Confirmar contraseña"
              minLength={8}
              name="confirmPassword"
              placeholder="Confirma tu nueva contraseña"
              type={isVisible ? "text" : "password"}
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
              {isLoading ? "Restableciendo..." : "Restablecer contraseña"}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
