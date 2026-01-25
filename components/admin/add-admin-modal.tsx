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
  Select,
  SelectItem,
} from "@heroui/react";
import React from "react";

interface AddAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddAdminModal({
  isOpen,
  onClose,
  onSuccess,
}: AddAdminModalProps) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"super_admin" | "admin">("admin");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const handleClose = () => {
    setFullName("");
    setEmail("");
    setRole("admin");
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
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          fullName,
          email,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear usuario admin");
      }

      setSuccessMessage(data.message);

      // Wait a bit to show success message, then close and refresh
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear usuario admin"
      );
    } finally {
      setIsLoading(false);
    }
  };

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
                icon="solar:shield-user-bold-duotone"
              />
              <h2 className="text-xl font-heading font-bold">
                Agregar Usuario Administrador
              </h2>
            </div>
            <p className="text-sm text-slate-500 font-body font-normal">
              Crea un nuevo usuario con acceso al panel administrativo
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
                      ¡Usuario admin creado exitosamente!
                    </p>
                    <p className="text-sm text-success-700 font-body whitespace-pre-line">
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
                description="Este será el correo de acceso al panel admin"
                label="Correo electrónico"
                placeholder="Ej: admin@example.com"
                startContent={<Icon icon="solar:letter-bold-duotone" />}
                type="email"
                value={email}
                variant="bordered"
                onValueChange={setEmail}
              />

              <Select
                isRequired
                className="font-body"
                label="Rol"
                placeholder="Selecciona un rol"
                selectedKeys={[role]}
                startContent={<Icon icon="solar:star-bold-duotone" />}
                variant="bordered"
                onChange={(e) =>
                  setRole(e.target.value as "super_admin" | "admin")
                }
              >
                <SelectItem key="admin">
                  Admin - Solo gestión de entrenadores
                </SelectItem>
                <SelectItem key="super_admin">
                  Super Admin - Gestión completa (entrenadores + admins)
                </SelectItem>
              </Select>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icon
                    className="text-blue-600 text-xl mt-0.5"
                    icon="solar:info-circle-bold"
                  />
                  <div className="text-sm font-body text-blue-900">
                    <p className="font-semibold mb-2">Diferencias de roles:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>
                        <strong>Admin</strong>: Puede crear y gestionar
                        entrenadores
                      </li>
                      <li>
                        <strong>Super Admin</strong>: Puede hacer todo lo que
                        hace un admin, además de crear y gestionar otros
                        usuarios administradores
                      </li>
                    </ul>
                    <p className="mt-3 font-semibold">Credenciales:</p>
                    <p className="text-blue-700">
                      El usuario recibirá un email con su contraseña temporal:{" "}
                      <code className="bg-blue-100 px-2 py-0.5 rounded font-semibold">
                        TopCoachAdmin2026!
                      </code>
                    </p>
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
              {isLoading ? "Creando..." : "Crear Usuario Admin"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
