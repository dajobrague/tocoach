"use client";

import {
  Button,
  Input,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  addToast,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientPage } from "@/components/client-dashboard/client-page";
import {
  ClientSheet,
  ClientSheetGrabber,
} from "@/components/client-dashboard/client-sheet";
import { IconTile } from "@/components/shared/icon-tile";
import { clearClientToken, clientFetch } from "@/lib/auth/client-token-storage";
import { buildInitials, thumbnailUrl } from "@/lib/utils/avatar";

interface ClientProfile {
  name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  occupation?: string;
  city?: string;
  state?: string;
  country?: string;
  sign_up_date?: string;
}

const AVATAR_DISPLAY_PX = 96;
const AVATAR_THUMB_PX = 192;

function formatDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatLocation(profile: ClientProfile | null): string | null {
  if (!profile) return null;
  const parts = [profile.city, profile.state, profile.country].filter(
    (part): part is string => Boolean(part && part.trim())
  );

  return parts.length ? parts.join(", ") : null;
}

export function ProfileContent() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { clientId, clientProfilePicture, firstName, lastName } =
    useClientData();

  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  // Avatar state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    clientProfilePicture
  );
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const {
    isOpen: isDeleteOpen,
    onClose: closeDeleteModal,
    onOpen: openDeleteModal,
  } = useDisclosure();
  const {
    isOpen: isLogoutOpen,
    onClose: closeLogoutModal,
    onOpen: openLogoutModal,
  } = useDisclosure();

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  useEffect(() => {
    setAvatarUrl(clientProfilePicture);
    setAvatarFailed(false);
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

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast({
        color: "danger",
        description: "La imagen no puede superar 2MB",
        title: "Archivo demasiado grande",
      });

      return;
    }

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();

      formData.append("file", file);

      const res = await clientFetch("/api/client/profile-picture", {
        body: formData,
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        setAvatarUrl(data.profilePictureUrl);
        setAvatarFailed(false);
        await queryClient.invalidateQueries({
          queryKey: ["client", "bootstrap"],
        });
        addToast({
          color: "success",
          description: "Tu foto de perfil se ha actualizado correctamente",
          title: "Foto actualizada",
        });
      } else {
        addToast({
          color: "danger",
          description: data.error || "No se pudo subir la imagen",
          title: "Error",
        });
      }
    } catch (error) {
      console.error("Error uploading avatar:", error);
      addToast({
        color: "danger",
        description: "Error al subir la imagen",
        title: "Error",
      });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAvatarDelete = async () => {
    setIsDeletingAvatar(true);

    try {
      const res = await clientFetch("/api/client/profile-picture", {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        setAvatarUrl(undefined);
        setAvatarFailed(false);
        await queryClient.invalidateQueries({
          queryKey: ["client", "bootstrap"],
        });
        closeDeleteModal();
        addToast({
          color: "success",
          description: "Tu foto de perfil se ha eliminado",
          title: "Foto eliminada",
        });
      } else {
        addToast({
          color: "danger",
          description: data.error || "No se pudo eliminar la imagen",
          title: "Error",
        });
      }
    } catch (error) {
      console.error("Error deleting avatar:", error);
      addToast({
        color: "danger",
        description: "Error al eliminar la imagen",
        title: "Error",
      });
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const slug = pathname.split("/")[1] || "";

    try {
      const response = await fetch("/api/auth/client-logout", {
        method: "POST",
      });

      // Always clear the localStorage fallback token, even on server error,
      // so a stale JWT can't keep authenticating writes for 30 days.
      clearClientToken();

      if (response.ok) {
        closeLogoutModal();
        router.push(`/${slug}/login`);
        router.refresh();
      }
    } catch (error) {
      console.error("Logout error:", error);
      clearClientToken();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      addToast({
        color: "warning",
        description: "Todos los campos son requeridos",
        title: "Campos incompletos",
      });

      return;
    }

    if (newPassword !== confirmNewPassword) {
      addToast({
        color: "danger",
        description: "Las contraseñas nuevas no coinciden",
        title: "Error",
      });

      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await clientFetch("/api/client/change-password", {
        body: JSON.stringify({
          confirmNewPassword,
          currentPassword,
          newPassword,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        addToast({
          color: "success",
          description: "Tu contraseña se ha cambiado correctamente",
          title: "Contraseña actualizada",
        });
        setShowPasswordForm(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        addToast({
          color: "danger",
          description: data.error || "No se pudo cambiar la contraseña",
          title: "Error",
        });
      }
    } catch (error) {
      console.error("Error changing password:", error);
      addToast({
        color: "danger",
        description: "Error al cambiar la contraseña",
        title: "Error",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <ClientPage showBack title="Mi perfil">
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        </ClientPage>
        <ClientBottomNav />
      </>
    );
  }

  const displayFirstName = clientProfile?.name || firstName || "";
  const displayLastName = clientProfile?.last_name || lastName || "";
  const fullName = `${displayFirstName} ${displayLastName}`.trim() || "Cliente";
  const initials = buildInitials(displayFirstName, displayLastName);
  const showAvatarImage = Boolean(avatarUrl) && !avatarFailed;
  const location = formatLocation(clientProfile);
  const dobFormatted = formatDate(clientProfile?.dob);
  const memberSince = formatDate(clientProfile?.sign_up_date);

  return (
    <>
      <ClientPage showBack title="Mi perfil">
        <div className="space-y-5 px-4 pb-8 pt-2">
          <div className="flex flex-col items-center text-center">
            <button
              aria-label={
                showAvatarImage ? "Cambiar foto de perfil" : "Subir foto"
              }
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-primary/10 transition-transform active:scale-[0.97] motion-reduce:active:scale-100"
              disabled={isUploadingAvatar}
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              {showAvatarImage && avatarUrl ? (
                <img
                  alt={fullName}
                  className="h-full w-full object-cover"
                  decoding="async"
                  loading="lazy"
                  sizes={`${AVATAR_DISPLAY_PX}px`}
                  src={thumbnailUrl(avatarUrl, AVATAR_THUMB_PX)}
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-heading text-[32px] font-extrabold text-primary">
                  {initials}
                </span>
              )}
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Spinner color="white" size="sm" />
                </div>
              )}
            </button>

            <input
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              type="file"
              onChange={handleAvatarChange}
            />

            <h2 className="mt-2.5 max-w-full truncate font-heading text-[22px] text-foreground">
              {fullName}
            </h2>
          </div>

          <dl className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small">
            {clientProfile?.email && (
              <MetadataRow label="Email" value={clientProfile.email} />
            )}
            {clientProfile?.phone && (
              <MetadataRow label="Teléfono" value={clientProfile.phone} />
            )}
            {dobFormatted && (
              <MetadataRow label="Fecha de nacimiento" value={dobFormatted} />
            )}
            {clientProfile?.occupation &&
              clientProfile.occupation !== "No especificado" && (
                <MetadataRow
                  label="Ocupación"
                  value={clientProfile.occupation}
                />
              )}
            {location && <MetadataRow label="Ubicación" value={location} />}
            {memberSince && (
              <MetadataRow label="Miembro desde" value={memberSince} />
            )}
          </dl>

          <div className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small">
            <ActionRow
              disabled={isUploadingAvatar}
              icon="solar:camera-linear"
              label="Cambiar foto"
              onPress={() => fileInputRef.current?.click()}
            />
            {showAvatarImage && (
              <ActionRow
                danger
                disabled={isDeletingAvatar}
                icon="solar:trash-bin-trash-linear"
                label="Eliminar foto"
                onPress={openDeleteModal}
              />
            )}
            {!showPasswordForm ? (
              <ActionRow
                icon="solar:lock-password-linear"
                label="Cambiar contraseña"
                onPress={() => setShowPasswordForm(true)}
              />
            ) : (
              <div className="space-y-4 px-4 py-4">
                <Input
                  autoComplete="current-password"
                  classNames={{ input: "text-base" }}
                  endContent={
                    <button
                      aria-label={
                        showCurrentPw
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                    >
                      <Icon
                        className="text-xl text-default-400"
                        icon={
                          showCurrentPw
                            ? "solar:eye-bold"
                            : "solar:eye-closed-bold"
                        }
                      />
                    </button>
                  }
                  label="Contraseña actual"
                  placeholder="Ingresa tu contraseña actual"
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPassword}
                  variant="bordered"
                  onValueChange={setCurrentPassword}
                />
                <Input
                  autoComplete="new-password"
                  classNames={{ input: "text-base" }}
                  endContent={
                    <button
                      aria-label={
                        showNewPw ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                    >
                      <Icon
                        className="text-xl text-default-400"
                        icon={
                          showNewPw ? "solar:eye-bold" : "solar:eye-closed-bold"
                        }
                      />
                    </button>
                  }
                  label="Nueva contraseña"
                  placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número"
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  variant="bordered"
                  onValueChange={setNewPassword}
                />
                <Input
                  autoComplete="new-password"
                  classNames={{ input: "text-base" }}
                  endContent={
                    <button
                      aria-label={
                        showConfirmPw
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      type="button"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                    >
                      <Icon
                        className="text-xl text-default-400"
                        icon={
                          showConfirmPw
                            ? "solar:eye-bold"
                            : "solar:eye-closed-bold"
                        }
                      />
                    </button>
                  }
                  label="Confirmar nueva contraseña"
                  placeholder="Repite la nueva contraseña"
                  type={showConfirmPw ? "text" : "password"}
                  value={confirmNewPassword}
                  variant="bordered"
                  onValueChange={setConfirmNewPassword}
                />

                <div className="flex gap-2 pt-1">
                  <Button
                    className="flex-1"
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
                    className="flex-1 font-semibold"
                    color="primary"
                    isLoading={isChangingPassword}
                    onPress={handleChangePassword}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-large bg-content1 shadow-small">
            <button
              className="flex min-h-14 w-full items-center justify-center gap-2 px-4 text-base font-semibold text-danger transition-colors active:bg-danger/10 [@media(hover:hover)]:hover:bg-danger/5"
              type="button"
              onClick={openLogoutModal}
            >
              <Icon icon="solar:logout-2-linear" width={20} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </ClientPage>
      <ClientBottomNav />

      <ClientSheet isOpen={isDeleteOpen} size="sm" onClose={closeDeleteModal}>
        <ModalContent>
          {(onCloseSheet) => (
            <>
              <ClientSheetGrabber onClose={onCloseSheet} />
              <ModalHeader className="flex flex-col items-center gap-2 pb-2 pt-2 sm:pt-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
                  <Icon
                    className="text-3xl text-danger"
                    icon="solar:trash-bin-trash-bold"
                  />
                </div>
                <span className="font-heading text-lg">¿Eliminar foto?</span>
              </ModalHeader>
              <ModalBody className="px-6 pb-2 text-center">
                <p className="text-sm text-default-500">
                  Tu foto de perfil será eliminada. Esta acción no se puede
                  deshacer.
                </p>
              </ModalBody>
              <ModalFooter className="flex gap-2 px-6 pb-6 pt-2">
                <Button
                  className="flex-1"
                  variant="flat"
                  onPress={closeDeleteModal}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 font-semibold"
                  color="danger"
                  isLoading={isDeletingAvatar}
                  onPress={handleAvatarDelete}
                >
                  Eliminar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </ClientSheet>

      <ClientSheet isOpen={isLogoutOpen} size="sm" onClose={closeLogoutModal}>
        <ModalContent>
          {(onCloseSheet) => (
            <>
              <ClientSheetGrabber onClose={onCloseSheet} />
              <ModalHeader className="flex flex-col items-center gap-2 pb-2 pt-2 sm:pt-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
                  <Icon
                    className="text-3xl text-danger"
                    icon="solar:logout-2-linear"
                  />
                </div>
                <span className="font-heading text-lg">¿Cerrar sesión?</span>
              </ModalHeader>
              <ModalBody className="px-6 pb-2 text-center">
                <p className="text-sm text-default-500">
                  Tendrás que volver a ingresar tu contraseña para acceder a tu
                  cuenta.
                </p>
              </ModalBody>
              <ModalFooter className="flex gap-2 px-6 pb-6 pt-2">
                <Button
                  className="flex-1"
                  variant="flat"
                  onPress={closeLogoutModal}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 font-semibold"
                  color="danger"
                  isLoading={isLoggingOut}
                  onPress={handleLogout}
                >
                  Cerrar sesión
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </ClientSheet>
    </>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <dt className="shrink-0 whitespace-nowrap text-[15px] text-foreground">
        {label}
      </dt>
      <dd className="ml-auto min-w-0 text-right text-[15px] tabular-nums text-default-500 [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-default-100 disabled:opacity-50 [@media(hover:hover)]:hover:bg-default-50"
      disabled={disabled}
      type="button"
      onClick={onPress}
    >
      <IconTile icon={icon} size="sm" tone={danger ? "danger" : "primary"} />
      <span
        className={`flex-1 text-[15px] font-semibold ${danger ? "text-danger" : "text-foreground"}`}
      >
        {label}
      </span>
      <Icon
        className="shrink-0 text-lg text-default-400"
        icon="solar:alt-arrow-right-linear"
      />
    </button>
  );
}
