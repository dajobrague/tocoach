"use client";

import { Button, Divider, Form, Input, Link } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import React from "react";

export default function TrainerLoginPage() {
    const router = useRouter();
    const [isVisible, setIsVisible] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string>("");

    const toggleVisibility = () => setIsVisible(!isVisible);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        setError("");

        const formData = new FormData(event.currentTarget);
        const data = {
            email: formData.get("email") as string,
            password: formData.get("password") as string,
        };

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Error en el inicio de sesión");
            }

            console.log('[TrainerLogin] Login successful, redirecting to dashboard...');
            console.log('[TrainerLogin] Current URL:', window.location.href);
            console.log('[TrainerLogin] About to redirect to /trainer/dashboard');

            // Login successful - use window.location for full page reload to ensure cookies are set
            setTimeout(() => {
                console.log('[TrainerLogin] Executing redirect NOW');
                window.location.href = "/trainer/dashboard";
            }, 100);

        } catch (err) {
            setError(err instanceof Error ? err.message : "Error en el inicio de sesión");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-full w-full items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md">
                <div className="flex flex-col items-center pb-8">
                    <h1 className="text-3xl font-heading font-bold text-black mb-4">TOP COACH</h1>
                    <h2 className="text-xl font-medium font-heading mb-2">Bienvenido de nuevo</h2>
                    <p className="text-default-500 font-body text-center">Inicia sesión en tu plataforma de coaching</p>
                </div>

                <div className="rounded-large bg-content1 shadow-small flex w-full flex-col gap-6 px-8 py-8">
                    {error && (
                        <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
                            <p className="text-danger text-sm font-body">{error}</p>
                        </div>
                    )}

                    <Form className="flex flex-col gap-4" validationBehavior="native" onSubmit={handleSubmit}>
                        <Input
                            isRequired
                            label="Dirección de correo electrónico"
                            name="email"
                            placeholder="Introduce tu correo electrónico"
                            type="email"
                            variant="bordered"
                            className="font-body"
                            autoComplete="email"
                        />

                        <Input
                            isRequired
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
                            className="font-body"
                            autoComplete="current-password"
                        />

                        <div className="flex justify-end">
                            <Link href="/forgot-password" size="sm" className="font-body">
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>

                        <Button
                            className="w-full font-body mt-2"
                            color="primary"
                            type="submit"
                            isLoading={isLoading}
                            disabled={isLoading}
                            size="lg"
                        >
                            {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
                        </Button>
                    </Form>

                    <div className="flex items-center gap-4">
                        <Divider className="flex-1" />
                        <p className="text-tiny text-default-500 shrink-0">O</p>
                        <Divider className="flex-1" />
                    </div>

                    <p className="text-small text-center font-body">
                        ¿No tienes una cuenta?&nbsp;
                        <Link href="/trainer/register" size="sm" className="font-body">
                            Crear cuenta
                        </Link>
                    </p>
                </div>

                <div className="mt-6 w-full">
                    <div className="bg-default-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Icon icon="ph:info-duotone" className="text-primary text-lg" />
                            <h4 className="text-sm font-semibold font-heading">Para Entrenadores y Coaches</h4>
                        </div>
                        <p className="text-xs text-default-600 font-body">
                            Este es el acceso para entrenadores. Tus clientes accederán a su portal a través de tu dominio personalizado.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

