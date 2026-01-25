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
import { createClient } from "@supabase/supabase-js";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentName: string;
  currentEmail: string;
  userId: string;
}

export default function EditProfileModal({
  isOpen,
  onClose,
  onSuccess,
  currentName,
  currentEmail,
  userId,
}: EditProfileModalProps) {
  const [fullName, setFullName] = React.useState(currentName);
  const [email, setEmail] = React.useState(currentEmail);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  React.useEffect(() => {
    if (isOpen) {
      setFullName(currentName);
      setEmail(currentEmail);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setSuccessMessage("");
    }
  }, [isOpen, currentName, currentEmail]);

  const handleClose = () => {
    setFullName(currentName);
    setEmail(currentEmail);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMessage("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    // Validate password change if attempting to change password
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setError("Debes ingresar tu contraseña actual para cambiarla");
        setIsLoading(false);

        return;
      }
      if (!newPassword) {
        setError("Debes ingresar una nueva contraseña");
        setIsLoading(false);

        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Las contraseñas nuevas no coinciden");
        setIsLoading(false);

        return;
      }
      if (newPassword.length < 8) {
        setError("La nueva contraseña debe tener al menos 8 caracteres");
        setIsLoading(false);

        return;
      }
    }

    try {
      // Create client-side Supabase client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      let passwordChanged = false;
      let emailChanged =
        email.toLowerCase().trim() !== currentEmail.toLowerCase().trim();

      // Handle password change (client-side using Supabase)
      if (currentPassword && newPassword) {
        // Verify current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: currentEmail,
          password: currentPassword,
        });

        if (signInError) {
          throw new Error("La contraseña actual es incorrecta");
        }

        // Update password
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (passwordError) {
          throw new Error(
            "Error al actualizar contraseña: " + passwordError.message
          );
        }

        passwordChanged = true;
      }

      // Handle email change (client-side using Supabase)
      if (emailChanged) {
        if (!currentPassword) {
          throw new Error(
            "Debes ingresar tu contraseña actual para cambiar tu email"
          );
        }

        // Verify current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: currentEmail,
          password: currentPassword,
        });

        if (signInError) {
          throw new Error("La contraseña actual es incorrecta");
        }

        // Update email
        const { error: emailError } = await supabase.auth.updateUser({
          email: email.toLowerCase().trim(),
        });

        if (emailError) {
          throw new Error("Error al actualizar email: " + emailError.message);
        }
      }

      // Update name via API
      const response = await fetch(`/api/admin/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          fullName,
          email: email.toLowerCase().trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar perfil");
      }

      if (passwordChanged || emailChanged) {
        setSuccessMessage(
          "Perfil actualizado exitosamente. Por seguridad, deberás iniciar sesión nuevamente."
        );
        setTimeout(() => {
          window.location.href = "/admin/login";
        }, 3000);
      } else {
        setSuccessMessage("Perfil actualizado exitosamente");
        setTimeout(() => {
          handleClose();
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al actualizar perfil"
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
                icon="solar:user-circle-bold-duotone"
              />
              <h2 className="text-xl font-heading font-bold">
                Editar Mi Perfil
              </h2>
            </div>
            <p className="text-sm text-slate-500 font-body font-normal">
              Actualiza tu información personal
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
                  <p className="text-success font-semibold font-body">
                    {successMessage}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 font-body">
                  Información Personal
                </h3>
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
                  label="Correo electrónico"
                  placeholder="Ej: admin@example.com"
                  startContent={<Icon icon="solar:letter-bold-duotone" />}
                  type="email"
                  value={email}
                  variant="bordered"
                  onValueChange={setEmail}
                />
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 font-body">
                  Cambiar Contraseña (Opcional)
                </h3>
                <p className="text-xs text-slate-500 font-body">
                  Deja estos campos vacíos si no deseas cambiar tu contraseña.
                  Si cambias tu email, también necesitarás ingresar tu
                  contraseña actual.
                </p>

                <Input
                  className="font-body"
                  label="Contraseña actual"
                  placeholder="Ingresa tu contraseña actual"
                  startContent={
                    <Icon icon="solar:lock-password-bold-duotone" />
                  }
                  type="password"
                  value={currentPassword}
                  variant="bordered"
                  onValueChange={setCurrentPassword}
                />

                <Input
                  className="font-body"
                  label="Nueva contraseña"
                  placeholder="Mínimo 8 caracteres"
                  startContent={<Icon icon="solar:lock-keyhole-bold-duotone" />}
                  type="password"
                  value={newPassword}
                  variant="bordered"
                  onValueChange={setNewPassword}
                />

                <Input
                  className="font-body"
                  label="Confirmar nueva contraseña"
                  placeholder="Repite la nueva contraseña"
                  startContent={<Icon icon="solar:lock-keyhole-bold-duotone" />}
                  type="password"
                  value={confirmPassword}
                  variant="bordered"
                  onValueChange={setConfirmPassword}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icon
                    className="text-blue-600 text-xl mt-0.5"
                    icon="solar:info-circle-bold"
                  />
                  <div className="text-sm font-body text-blue-900">
                    <p className="font-semibold mb-1">Nota importante:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>
                        Si cambias tu email o contraseña, deberás iniciar sesión
                        nuevamente
                      </li>
                      <li>
                        Para cambiar el email, es obligatorio ingresar tu
                        contraseña actual
                      </li>
                      <li>Asegúrate de recordar tus nuevas credenciales</li>
                    </ul>
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
              {isLoading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
