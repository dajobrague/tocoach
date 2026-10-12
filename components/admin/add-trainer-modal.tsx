"use client";

import { Icon } from "@iconify/react";
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
import { slugFormatError, slugify } from "@/lib/tenant/slug";

interface AddTrainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called right after the trainer is created, so the list can refresh. */
  onCreated: () => void;
  /** Slugs/hosts and emails already in use — checked instantly while typing. */
  takenSlugs: Set<string>;
  takenEmails: Set<string>;
}

interface Created {
  fullName: string;
  email: string;
  slug: string;
  tempPassword: string;
}

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "app.topcoach.io";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function credentialsText(c: Created) {
  return [
    `Hola ${c.fullName.split(" ")[0]}, ya tienes tu cuenta en TopCoach:`,
    "",
    `Acceso: https://${APP_DOMAIN}/trainer/login`,
    `Email: ${c.email}`,
    `Contraseña temporal: ${c.tempPassword}`,
    "",
    "Al entrar por primera vez te pedirá crear tu propia contraseña.",
    `Tus clientes entrarán en https://${APP_DOMAIN}/${c.slug}`,
  ].join("\n");
}

export default function AddTrainerModal({
  isOpen,
  onClose,
  onCreated,
  takenSlugs,
  takenEmails,
}: AddTrainerModalProps) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [emailTouched, setEmailTouched] = React.useState(false);
  const [slug, setSlug] = React.useState("");
  // The slug follows the name until the admin edits it by hand.
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<{
    field?: "email" | "slug";
    message: string;
  } | null>(null);
  const [created, setCreated] = React.useState<Created | null>(null);

  const reset = () => {
    setFullName("");
    setEmail("");
    setEmailTouched(false);
    setSlug("");
    setSlugEdited(false);
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
        ? "Ya hay un entrenador con este correo."
        : serverError?.field === "email"
          ? serverError.message
          : null;

  const slugError = !slug
    ? null
    : (slugFormatError(slug) ??
      (takenSlugs.has(slug)
        ? "Esta dirección ya está en uso."
        : serverError?.field === "slug"
          ? serverError.message
          : null));

  const canSubmit =
    fullName.trim().length > 1 &&
    EMAIL_RE.test(normalizedEmail) &&
    !emailError &&
    slug.length > 0 &&
    !slugError &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setServerError(null);

    try {
      const response = await fetch("/api/admin/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: normalizedEmail,
          tenantHost: slug,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setServerError({
          field: data.field,
          message: data.error || "No se pudo crear el entrenador.",
        });

        return;
      }

      setCreated({
        fullName: fullName.trim(),
        email: normalizedEmail,
        slug,
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
              title={`${created.fullName} ya tiene cuenta`}
            />
            <div className="mt-5">
              <KeyValueList
                rows={[
                  ["Acceso", `${APP_DOMAIN}/trainer/login`],
                  ["Email", created.email],
                  ["Contraseña temporal", created.tempPassword],
                  ["Portal de clientes", `${APP_DOMAIN}/${created.slug}`],
                ]}
              />
            </div>
            <p className="mt-2 text-[12px] text-slate-400">
              Al entrar por primera vez elegirá su propia contraseña.
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
                  text={credentialsText(created)}
                />
              </div>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={handleSubmit}>
            <div className="px-6 pt-6">
              <DialogHeader
                subtitle="Crea su cuenta y su portal de clientes."
                title="Nuevo entrenador"
              />
            </div>

            <div className="space-y-1 px-6 pt-5">
              <Field htmlFor="trainer-name" label="Nombre completo">
                <input
                  className={`${inputClass} ${fieldTone(false)}`}
                  id="trainer-name"
                  placeholder="Juan Pérez"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (!slugEdited) setSlug(slugify(e.target.value));
                  }}
                />
              </Field>

              <Field
                error={emailError}
                hint="Con este correo iniciará sesión."
                htmlFor="trainer-email"
                label="Correo electrónico"
              >
                <input
                  autoComplete="off"
                  className={`${inputClass} ${fieldTone(!!emailError)}`}
                  id="trainer-email"
                  placeholder="juan@ejemplo.com"
                  type="email"
                  value={email}
                  onBlur={() => setEmailTouched(true)}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (serverError?.field === "email") setServerError(null);
                  }}
                />
              </Field>

              <Field
                hint={
                  slugError ? (
                    <span className="text-red-600">{slugError}</span>
                  ) : slug ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <Icon icon="solar:check-circle-linear" width={13} />
                      Disponible
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Se genera a partir del nombre.
                    </span>
                  )
                }
                htmlFor="trainer-slug"
                label="Dirección del portal"
              >
                <div
                  className={`flex h-9 items-center rounded-lg border bg-white text-[14px] transition-[border-color,box-shadow] focus-within:ring-2 ${
                    slugError
                      ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-500/10"
                      : "border-slate-200 focus-within:border-slate-400 focus-within:ring-slate-900/5"
                  }`}
                >
                  <span className="select-none pl-3 text-slate-400">
                    {APP_DOMAIN}/
                  </span>
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-[13px] text-slate-900 outline-none"
                    id="trainer-slug"
                    spellCheck={false}
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                      );
                      if (serverError?.field === "slug") setServerError(null);
                    }}
                  />
                </div>
              </Field>
            </div>

            {serverError && !serverError.field ? (
              <p className="mx-6 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {serverError.message}
              </p>
            ) : null}

            <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                className={buttonClasses.ghost}
                disabled={isSubmitting}
                type="button"
                onClick={handleClose}
              >
                Cancelar
              </button>
              <button
                className={`${buttonClasses.primary} min-w-[140px]`}
                disabled={!canSubmit}
                type="submit"
              >
                {isSubmitting ? "Creando…" : "Crear entrenador"}
              </button>
            </div>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
