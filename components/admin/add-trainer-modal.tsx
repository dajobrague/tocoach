"use client";

import { Icon } from "@iconify/react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import React from "react";

interface AddTrainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddTrainerModal({
  isOpen,
  onClose,
  onSuccess,
}: AddTrainerModalProps) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [tenantHost, setTenantHost] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const handleClose = () => {
    setFullName("");
    setEmail("");
    setTenantHost("");
    setError("");
    setSuccessMessage("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/admin/trainers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          fullName,
          email,
          tenantHost,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear entrenador");
      }

      setSuccessMessage(data.message);

      // Wait a bit to show success message, then close and refresh
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear entrenador"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate tenant host from full name
  React.useEffect(() => {
    if (fullName && !tenantHost) {
      const slug = fullName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 30);

      setTenantHost(slug);
    }
  }, [fullName, tenantHost]);

  return (
    <Modal
      isOpen={isOpen}
      scrollBehavior="inside"
      size="2xl"
      onClose={handleClose}
    >
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Icon
                className="text-2xl text-black"
                icon="solar:user-plus-bold-duotone"
              />
              <h2 className="text-xl font-heading font-bold">
                Agregar Nuevo Entrenador
              </h2>
            </div>
            <p className="text-sm text-slate-500 font-body font-normal">
              Crea una cuenta de entrenador. Se le enviará un email para
              configurar su contraseña.
            </p>
          </ModalHeader>

          <ModalBody>
            {error && (
              <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Icon
                    className="text-danger"
                    icon="solar:danger-circle-bold"
                  />
                  <p className="text-danger text-sm font-body">{error}</p>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icon
                    className="text-success text-xl mt-0.5"
                    icon="solar:check-circle-bold"
                  />
                  <div>
                    <p className="text-success font-semibold font-body mb-1">
                      ¡Entrenador creado exitosamente!
                    </p>
                    <p className="text-sm text-success-700 font-body">
                      {successMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <Input
                isRequired
                className="font-body"
                label="Nombre completo"
                placeholder="Ej: Juan Pérez"
                startContent={<Icon icon="solar:user-bold-duotone" />}
                value={fullName}
                variant="bordered"
                onValueChange={setFullName}
              />

              <Input
                isRequired
                className="font-body"
                description="El entrenador usará este correo para iniciar sesión"
                label="Correo electrónico"
                placeholder="Ej: juan@example.com"
                startContent={<Icon icon="solar:letter-bold-duotone" />}
                type="email"
                value={email}
                variant="bordered"
                onValueChange={setEmail}
              />

              <Input
                isRequired
                className="font-body"
                description="URL única para el entrenador (solo letras, números y guiones)"
                label="Subdominio / Tenant Host"
                placeholder="Ej: juan-perez"
                startContent={<Icon icon="solar:link-bold-duotone" />}
                value={tenantHost}
                variant="bordered"
                onValueChange={setTenantHost}
              />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icon
                    className="text-blue-600 text-xl mt-0.5"
                    icon="solar:info-circle-bold"
                  />
                  <div className="text-sm font-body text-blue-900">
                    <p className="font-semibold mb-2">
                      Instrucciones para el entrenador:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-800">
                      <li>
                        Ir a{" "}
                        <code className="bg-blue-100 px-1 rounded">
                          /trainer/login
                        </code>
                      </li>
                      <li>
                        Iniciar sesión con su correo y contraseña temporal:{" "}
                        <code className="bg-blue-100 px-2 py-0.5 rounded font-semibold">
                          TopCoach2026!
                        </code>
                      </li>
                      <li>
                        El sistema detectará que no tiene contraseña
                        personalizada
                      </li>
                      <li>Se le pedirá que configure su propia contraseña</li>
                      <li>Luego podrá acceder a su dashboard</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button
              color="default"
              disabled={isLoading}
              variant="light"
              onPress={handleClose}
            >
              Cancelar
            </Button>
            <Button
              className="bg-black text-white"
              color="primary"
              disabled={isLoading || !!successMessage}
              isLoading={isLoading}
              type="submit"
            >
              {isLoading ? "Creando..." : "Crear Entrenador"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
