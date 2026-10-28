"use client";

import { Modal, ModalContent } from "@heroui/react";
import React from "react";

import {
  CopyButton,
  DialogHeader,
  Field,
  KeyValueList,
  SuccessHeader,
  buttonClasses,
  dialogClassNames,
  fieldTone,
  inputClass,
} from "@/components/admin/admin-ui";

type Role = "admin" | "super_admin";

interface AddAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called right after the admin is created, so the list can refresh. */
  onCreated: () => void;
  takenEmails: Set<string>;
}

interface Created {
  fullName: string;
  email: string;
  role: Role;
  tempPassword: string;
}

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "app.topcoach.io";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES: { key: Role; title: string; description: string }[] = [
  {
    key: "admin",
    title: "Admin",
    description: "Crea y gestiona entrenadores.",
  },
  {
    key: "super_admin",
    title: "Super admin",
    description: "Todo lo anterior y gestiona administradores.",
  },
];

export default function AddAdminModal({
  isOpen,
  onClose,
  onCreated,
  takenEmails,
}: AddAdminModalProps) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [emailTouched, setEmailTouched] = React.useState(false);
  const [role, setRole] = React.useState<Role>("admin");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<{
    field?: "email";
    message: string;
  } | null>(null);
  const [created, setCreated] = React.useState<Created | null>(null);

  const reset = () => {
    setFullName("");
    setEmail("");
    setEmailTouched(false);
    setRole("admin");
    setServerError(null);
    setCreated(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const normalizedEmail = email.trim().toLowerCase();
  const emailError =
    normalizedEmail && !EMAIL_RE.test(normalizedEmail)
      ? emailTouched
        ? "Revisa el formato del correo."
        : null
      : takenEmails.has(normalizedEmail)
        ? "Ya es administrador."
        : serverError?.field === "email"
          ? serverError.message
          : null;

  const canSubmit =
    fullName.trim().length > 1 &&
    EMAIL_RE.test(normalizedEmail) &&
    !emailError &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setServerError(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: normalizedEmail,
          role,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setServerError({
          field: data.field,
          message: data.error || "No se pudo crear el administrador.",
        });

        return;
      }

      setCreated({
        fullName: fullName.trim(),
        email: normalizedEmail,
        role,
        tempPassword: data.tempPassword,
      });
      onCreated();
    } catch {
      setServerError({ message: "Error de conexión. Inténtalo de nuevo." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      hideCloseButton
      classNames={dialogClassNames}
      isDismissable={!isSubmitting}
      isOpen={isOpen}
      size="lg"
      onClose={handleClose}
    >
      <ModalContent>
        {created ? (
          <div className="admin-swap-in p-6">
            <SuccessHeader
              subtitle="Envíale estas credenciales. No se manda ningún correo automático."
              title={`${created.fullName} ya es ${created.role === "super_admin" ? "super admin" : "admin"}`}
            />
            <div className="mt-5">
              <KeyValueList
                rows={[
                  ["Acceso", `${APP_DOMAIN}/admin/login`],
                  ["Email", created.email],
                  ["Contraseña temporal", created.tempPassword],
                ]}
              />
            </div>
            <p className="mt-2 text-[12px] text-slate-400">
              Deberá cambiarla en su primer acceso.
            </p>
            <div className="mt-6 flex items-center justify-between">
              <button
                className={buttonClasses.ghost}
                type="button"
                onClick={reset}
              >
                Crear otro
              </button>
              <div className="flex gap-2">
                <button
                  className={buttonClasses.secondary}
                  type="button"
                  onClick={handleClose}
                >
                  Cerrar
                </button>
                <CopyButton
                  label="Copiar credenciales"
                  text={[
                    `Hola ${created.fullName.split(" ")[0]}, ya tienes acceso al panel de TopCoach:`,
                    "",
                    `Acceso: https://${APP_DOMAIN}/admin/login`,
                    `Email: ${created.email}`,
                    `Contraseña temporal: ${created.tempPassword}`,
                    "",
                    "Te pedirá cambiarla al entrar por primera vez.",
                  ].join("\n")}
                />
              </div>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={handleSubmit}>
            <div className="px-6 pt-6">
              <DialogHeader
                subtitle="Tendrá acceso a este panel."
                title="Nuevo administrador"
              />
            </div>

            <div className="space-y-1 px-6 pt-5">
              <Field htmlFor="admin-name" label="Nombre completo">
                <input
                  className={`${inputClass} ${fieldTone(false)}`}
                  id="admin-name"
                  placeholder="Ana García"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>

              <Field
                error={emailError}
                hint="Con este correo iniciará sesión."
                htmlFor="admin-email"
                label="Correo electrónico"
              >
                <input
                  autoComplete="off"
                  className={`${inputClass} ${fieldTone(!!emailError)}`}
                  id="admin-email"
                  placeholder="ana@topcoach.io"
                  type="email"
                  value={email}
                  onBlur={() => setEmailTouched(true)}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (serverError?.field === "email") setServerError(null);
                  }}
                />
              </Field>

              <fieldset className="space-y-1.5 pb-4">
                <legend className="mb-1.5 text-[13px] font-medium text-slate-700">
                  Rol
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const selected = role === r.key;

                    return (
                      <label
                        key={r.key}
                        className={`cursor-pointer rounded-lg border px-3 py-2.5 transition-[border-color,box-shadow] ${
                          selected
                            ? "border-slate-900 ring-1 ring-slate-900"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <input
                          checked={selected}
                          className="sr-only"
                          name="admin-role"
                          type="radio"
                          value={r.key}
                          onChange={() => setRole(r.key)}
                        />
                        <span className="block text-[13px] font-medium text-slate-900">
                          {r.title}
                        </span>
                        <span className="block text-[12px] text-slate-500">
                          {r.description}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            {serverError && !serverError.field ? (
              <p className="mx-6 mb-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {serverError.message}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                className={buttonClasses.ghost}
                disabled={isSubmitting}
                type="button"
                onClick={handleClose}
              >
                Cancelar
              </button>
              <button
                className={`${buttonClasses.primary} min-w-[150px]`}
                disabled={!canSubmit}
                type="submit"
              >
                {isSubmitting ? "Creando…" : "Crear administrador"}
              </button>
            </div>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
