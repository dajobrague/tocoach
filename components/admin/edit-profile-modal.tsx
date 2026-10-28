"use client";

import { Modal, ModalContent } from "@heroui/react";
import React from "react";
import { createClient } from "@supabase/supabase-js";

import {
  DialogHeader,
  Field,
  buttonClasses,
  dialogClassNames,
  fieldTone,
  inputClass,
} from "@/components/admin/admin-ui";

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
  const [passwordOpen, setPasswordOpen] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setFullName(currentName);
      setEmail(currentEmail);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setSuccessMessage("");
      setPasswordOpen(false);
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

  const emailChanged =
    email.toLowerCase().trim() !== currentEmail.toLowerCase().trim();
  const showPasswords = passwordOpen || emailChanged;

  return (
    <Modal
      hideCloseButton
      classNames={dialogClassNames}
      isDismissable={!isLoading}
      isOpen={isOpen}
      size="lg"
      onClose={handleClose}
    >
      <ModalContent>
        <form noValidate onSubmit={handleSubmit}>
          <div className="px-6 pt-6">
            <DialogHeader
              subtitle="Tu nombre, correo y contraseña."
              title="Editar perfil"
            />
          </div>

          <div className="space-y-1 px-6 pt-5">
            <Field htmlFor="profile-name" label="Nombre completo">
              <input
                className={`${inputClass} ${fieldTone(false)}`}
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>
            <Field
              hint={
                emailChanged
                  ? "Para cambiar el correo confirma tu contraseña actual."
                  : undefined
              }
              htmlFor="profile-email"
              label="Correo electrónico"
            >
              <input
                className={`${inputClass} ${fieldTone(false)}`}
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            {showPasswords ? (
              <div className="space-y-1 border-t border-slate-100 pt-4">
                <Field htmlFor="profile-current" label="Contraseña actual">
                  <input
                    autoComplete="current-password"
                    className={`${inputClass} ${fieldTone(false)}`}
                    id="profile-current"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </Field>
                {passwordOpen ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      hint="Mínimo 8 caracteres."
                      htmlFor="profile-new"
                      label="Nueva contraseña"
                    >
                      <input
                        autoComplete="new-password"
                        className={`${inputClass} ${fieldTone(false)}`}
                        id="profile-new"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </Field>
                    <Field
                      error={
                        confirmPassword && confirmPassword !== newPassword
                          ? "No coincide."
                          : null
                      }
                      htmlFor="profile-confirm"
                      label="Repetir contraseña"
                    >
                      <input
                        autoComplete="new-password"
                        className={`${inputClass} ${fieldTone(
                          !!confirmPassword && confirmPassword !== newPassword
                        )}`}
                        id="profile-confirm"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!passwordOpen ? (
              <button
                className="mb-4 text-[13px] font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                type="button"
                onClick={() => setPasswordOpen(true)}
              >
                Cambiar contraseña
              </button>
            ) : null}
          </div>

          {error ? (
            <p className="mx-6 mb-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </p>
          ) : null}
          {successMessage ? (
            <p className="mx-6 mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
            <p className="text-[12px] text-slate-400">
              {emailChanged || newPassword
                ? "Tendrás que volver a iniciar sesión."
                : ""}
            </p>
            <div className="flex gap-2">
              <button
                className={buttonClasses.ghost}
                disabled={isLoading}
                type="button"
                onClick={handleClose}
              >
                Cancelar
              </button>
              <button
                className={`${buttonClasses.primary} min-w-[130px]`}
                disabled={
                  isLoading || !!successMessage || fullName.trim().length < 2
                }
                type="submit"
              >
                {isLoading ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
