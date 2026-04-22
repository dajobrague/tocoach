"use client";

import {
  Button,
  Card,
  CardBody,
  Divider,
  Input,
  Spinner,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import { TenantLogo } from "@/components/tenant-logo";
import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { LogoutButton } from "@/components/client-dashboard/logout-button";
import { clientFetch } from "@/lib/auth/client-token-storage";

export function ProfileContent() {
  const {
    clientId,
    firstName,
    logoUrl,
    trainerName,
    clientProfilePicture,
    tenantSlug,
  } = useClientData();

  const [clientProfile, setClientProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Avatar state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    clientProfilePicture
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Sync avatar from context when it changes
  useEffect(() => {
    setAvatarUrl(clientProfilePicture);
  }, [clientProfilePicture]);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await clientFetch(`/api/client/profile`);
        const data = await res.json();

        if (data.success) {
          setClientProfile(data.profile);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [clientId]);

  // ─── Avatar upload handler ──────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    // Client-side validation
    if (file.size > 2 * 1024 * 1024) {
      addToast({
        title: "Archivo demasiado grande",
        description: "La imagen no puede superar 2MB",
        color: "danger",
      });

      return;
    }

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();

      formData.append("file", file);

      const res = await clientFetch("/api/client/profile-picture", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setAvatarUrl(data.profilePictureUrl);
        addToast({
          title: "Foto actualizada",
          description: "Tu foto de perfil se ha actualizado correctamente",
          color: "success",
        });
      } else {
        addToast({
          title: "Error",
          description: data.error || "No se pudo subir la imagen",
          color: "danger",
        });
      }
    } catch (error) {
      console.error("Error uploading avatar:", error);
      addToast({
        title: "Error",
        description: "Error al subir la imagen",
        color: "danger",
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Change password handler ────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      addToast({
        title: "Campos incompletos",
        description: "Todos los campos son requeridos",
        color: "warning",
      });

      return;
    }

    if (newPassword !== confirmNewPassword) {
      addToast({
        title: "Error",
        description: "Las contraseñas nuevas no coinciden",
        color: "danger",
      });

      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await clientFetch("/api/client/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        addToast({
          title: "Contraseña actualizada",
          description: "Tu contraseña se ha cambiado correctamente",
          color: "success",
        });
        setShowPasswordForm(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        addToast({
          title: "Error",
          description: data.error || "No se pudo cambiar la contraseña",
          color: "danger",
        });
      }
    } catch (error) {
      console.error("Error changing password:", error);
      addToast({
        title: "Error",
        description: "Error al cambiar la contraseña",
        color: "danger",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-background p-4 pb-20">
          <div className="max-w-lg mx-auto flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        </div>
        <ClientBottomNav />
      </>
    );
  }

  const fullName = clientProfile
    ? `${clientProfile.name} ${clientProfile.last_name || ""}`.trim()
    : firstName;

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto px-4 space-y-6">
          {/* Logo Header */}
          {logoUrl && (
            <div className="pt-6 flex justify-center">
              <TenantLogo
                alt={trainerName}
                className="h-12 w-auto object-contain"
                height={48}
                src={logoUrl}
                width={96}
              />
            </div>
          )}

          {/* Page title */}
          <div className={`${logoUrl ? "pt-2" : "pt-8"} pb-2`}>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-1">
              Perfil
            </h1>
            <p className="text-default-500 font-body">Administra tu cuenta</p>
          </div>

          {/* ─── Avatar + Name Card ─────────────────────────────────── */}
          <Card className="border border-default-200">
            <CardBody className="p-5">
              <div className="flex items-center gap-5">
                {/* Avatar with upload overlay */}
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                    {avatarUrl ? (
                      <img
                        alt={fullName}
                        className="w-full h-full object-cover"
                        src={avatarUrl}
                      />
                    ) : (
                      <Icon
                        className="text-primary text-4xl"
                        icon="solar:user-bold"
                      />
                    )}
                  </div>

                  {/* Upload overlay button */}
                  <button
                    className="absolute inset-0 w-20 h-20 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    disabled={isUploadingAvatar}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploadingAvatar ? (
                      <Spinner color="white" size="sm" />
                    ) : (
                      <Icon
                        className="text-white text-2xl"
                        icon="solar:camera-bold"
                      />
                    )}
                  </button>

                  {/* Small edit badge always visible */}
                  <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1.5 shadow-md">
                    <Icon
                      className="text-white text-xs"
                      icon="solar:pen-bold"
                    />
                  </div>

                  <input
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    type="file"
                    onChange={handleAvatarChange}
                  />
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-heading font-bold text-foreground truncate">
                    {fullName}
                  </h2>
                  <p className="text-sm text-default-500 font-body truncate">
                    {clientProfile?.email}
                  </p>
                  <button
                    className="text-xs text-primary font-body mt-1 cursor-pointer bg-transparent border-none p-0"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Cambiar foto
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* ─── Personal Info Card ─────────────────────────────────── */}
          <Card className="border border-default-200">
            <CardBody className="p-0">
              <div className="px-5 py-4">
                <h3 className="text-sm font-heading font-bold text-default-500 uppercase tracking-wider">
                  Información Personal
                </h3>
              </div>
              <Divider />

              {/* Phone */}
              {clientProfile?.phone && (
                <>
                  <div className="flex items-center gap-4 px-5 py-3.5">
                    <Icon
                      className="text-default-400 text-xl flex-shrink-0"
                      icon="solar:phone-bold"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-default-400 font-body">
                        Teléfono
                      </p>
                      <p className="text-sm font-body text-foreground">
                        {clientProfile.phone}
                      </p>
                    </div>
                  </div>
                  <Divider />
                </>
              )}

              {/* Email */}
              <div className="flex items-center gap-4 px-5 py-3.5">
                <Icon
                  className="text-default-400 text-xl flex-shrink-0"
                  icon="solar:letter-bold"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-default-400 font-body">Email</p>
                  <p className="text-sm font-body text-foreground truncate">
                    {clientProfile?.email || "-"}
                  </p>
                </div>
              </div>
              <Divider />

              {/* Member since */}
              <div className="flex items-center gap-4 px-5 py-3.5">
                <Icon
                  className="text-default-400 text-xl flex-shrink-0"
                  icon="solar:calendar-bold"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-default-400 font-body">
                    Miembro Desde
                  </p>
                  <p className="text-sm font-body text-foreground">
                    {clientProfile?.sign_up_date
                      ? new Date(clientProfile.sign_up_date).toLocaleDateString(
                          "es-ES",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )
                      : "-"}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* ─── Security Card (Change Password) ────────────────────── */}
          <Card className="border border-default-200">
            <CardBody className="p-0">
              <div className="px-5 py-4">
                <h3 className="text-sm font-heading font-bold text-default-500 uppercase tracking-wider">
                  Seguridad
                </h3>
              </div>
              <Divider />

              {!showPasswordForm ? (
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-default-100 transition-colors active:bg-default-200 text-left"
                  type="button"
                  onClick={() => setShowPasswordForm(true)}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Icon
                      className="text-warning text-xl"
                      icon="solar:lock-password-bold"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-foreground text-sm">
                      Cambiar Contraseña
                    </p>
                    <p className="text-xs text-default-500 font-body">
                      Actualiza tu contraseña de acceso
                    </p>
                  </div>
                  <Icon
                    className="text-default-400 text-xl flex-shrink-0"
                    icon="solar:alt-arrow-right-linear"
                  />
                </button>
              ) : (
                <div className="px-5 py-4 space-y-4">
                  <Input
                    endContent={
                      <button
                        className="focus:outline-none"
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                      >
                        <Icon
                          className="text-default-400 text-xl"
                          icon={
                            showCurrentPw
                              ? "solar:eye-bold"
                              : "solar:eye-closed-bold"
                          }
                        />
                      </button>
                    }
                    label="Contraseña Actual"
                    placeholder="Ingresa tu contraseña actual"
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    variant="bordered"
                    onValueChange={setCurrentPassword}
                  />
                  <Input
                    endContent={
                      <button
                        className="focus:outline-none"
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                      >
                        <Icon
                          className="text-default-400 text-xl"
                          icon={
                            showNewPw
                              ? "solar:eye-bold"
                              : "solar:eye-closed-bold"
                          }
                        />
                      </button>
                    }
                    label="Nueva Contraseña"
                    placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número"
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    variant="bordered"
                    onValueChange={setNewPassword}
                  />
                  <Input
                    endContent={
                      <button
                        className="focus:outline-none"
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                      >
                        <Icon
                          className="text-default-400 text-xl"
                          icon={
                            showConfirmPw
                              ? "solar:eye-bold"
                              : "solar:eye-closed-bold"
                          }
                        />
                      </button>
                    }
                    label="Confirmar Nueva Contraseña"
                    placeholder="Repite la nueva contraseña"
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmNewPassword}
                    variant="bordered"
                    onValueChange={setConfirmNewPassword}
                  />

                  <div className="flex gap-2 pt-1">
                    <Button
                      className="flex-1 font-body"
                      variant="flat"
                      onPress={() => {
                        setShowPasswordForm(false);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmNewPassword("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 font-body font-semibold"
                      color="primary"
                      isLoading={isChangingPassword}
                      onPress={handleChangePassword}
                    >
                      Guardar
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* ─── Account Section ─────────────────────────────────────── */}
          <Card className="border border-default-200">
            <CardBody className="p-0">
              <div className="px-5 py-4">
                <h3 className="text-sm font-heading font-bold text-default-500 uppercase tracking-wider">
                  Cuenta
                </h3>
              </div>
              <Divider />
              <div className="p-4">
                <LogoutButton />
              </div>
            </CardBody>
          </Card>

          {/* App Info */}
          <div className="pt-2 pb-6">
            <div className="text-center space-y-1">
              <p className="text-xs text-default-400 font-body font-medium">
                Top Coach
              </p>
              <p className="text-xs text-default-300 font-body">
                Versión 1.0.0
              </p>
            </div>
          </div>
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}
