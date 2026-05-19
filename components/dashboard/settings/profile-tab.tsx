"use client";

import {
  Avatar,
  Button,
  Card,
  CardBody,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { PRODUCTION_DOMAIN } from "@/config/app";

interface TrainerProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  profile_picture_url: string | null;
  tenant_host: string;
  created_at: string;
  status: string;
  community_url: string | null;
}

interface ProfileTabProps {
  onProfilePictureChange?: (url: string) => void;
}

export default function ProfileTab({
  onProfilePictureChange,
}: ProfileTabProps) {
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [brandSlug, setBrandSlug] = useState("");

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [communityUrl, setCommunityUrl] = useState("");

  // Password modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/trainer/profile");
      const data = await res.json();

      if (data.success && data.trainer) {
        setProfile(data.trainer);
        setFullName(data.trainer.full_name || "");
        setEmail(data.trainer.email || "");
        setPhone(data.trainer.phone || "");
        setCommunityUrl(data.trainer.community_url || "");
      }
    } catch (error) {
      console.error("[ProfileTab] Failed to fetch profile:", error);
      setErrorMessage("Error al cargar el perfil");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    // Fetch brand slug for domain display
    fetch("/api/brand/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.slug) {
          setBrandSlug(data.slug);
        }
      })
      .catch(() => {});
  }, [fetchProfile]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage("");
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setSuccessMessage("");
    setTimeout(() => setErrorMessage(""), 5000);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/trainer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          community_url: communityUrl.trim() || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        showSuccess("Perfil actualizado correctamente");
        // Refresh profile
        fetchProfile();
      } else {
        showError(data.error || "Error al actualizar");
      }
    } catch (error) {
      console.error("[ProfileTab] Save error:", error);
      showError("Error al guardar los cambios");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();

      formData.append("photo", file);

      const res = await fetch("/api/trainer/profile-picture", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setProfile((prev) =>
          prev ? { ...prev, profile_picture_url: data.url } : prev
        );
        // Notify parent to update header avatar immediately
        onProfilePictureChange?.(data.url);
        showSuccess("Foto de perfil actualizada");
      } else {
        showError(data.error || "Error al subir la foto");
      }
    } catch (error) {
      console.error("[ProfileTab] Photo upload error:", error);
      showError("Error al subir la foto");
    } finally {
      setIsUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Todos los campos son obligatorios");

      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("La nueva contraseña debe tener al menos 6 caracteres");

      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden");

      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/trainer/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (data.success) {
        setPasswordSuccess("Contraseña actualizada correctamente");
        setTimeout(() => {
          setIsPasswordModalOpen(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setPasswordSuccess("");
          setPasswordError("");
        }, 1500);
      } else {
        setPasswordError(data.error || "Error al cambiar la contraseña");
      }
    } catch (error) {
      console.error("[ProfileTab] Change password error:", error);
      setPasswordError("Error al cambiar la contraseña");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const hasChanges =
    profile &&
    (fullName !== (profile.full_name || "") ||
      email !== (profile.email || "") ||
      phone !== (profile.phone || "") ||
      communityUrl !== (profile.community_url || ""));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Status Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-xl text-sm">
          <Icon icon="solar:check-circle-bold" width={18} />
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
          <Icon icon="solar:danger-triangle-bold" width={18} />
          {errorMessage}
        </div>
      )}

      {/* Profile Photo Section */}
      <Card className="border border-gray-200 shadow-sm">
        <CardBody className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Foto de perfil
          </h3>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar
                isBordered
                className="w-24 h-24 text-2xl"
                color="default"
                name={profile?.full_name || ""}
                {...(profile?.profile_picture_url
                  ? { src: profile.profile_picture_url }
                  : {})}
              />
              {isUploadingPhoto ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                  <Spinner color="white" size="sm" />
                </div>
              ) : (
                <button
                  className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded-full transition-all cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    icon="solar:camera-bold"
                    width={28}
                  />
                </button>
              )}
              <input
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                type="file"
                onChange={handlePhotoUpload}
              />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-900">
                {profile?.full_name || "Sin nombre"}
              </p>
              <p className="text-xs text-gray-500">{profile?.email}</p>
              <Button
                className="mt-2"
                size="sm"
                startContent={<Icon icon="solar:camera-linear" width={16} />}
                variant="flat"
                onPress={() => fileInputRef.current?.click()}
              >
                Cambiar foto
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Formato: PNG, JPG o WebP. Máximo 2MB.
          </p>
        </CardBody>
      </Card>

      {/* Personal Info Section */}
      <Card className="border border-gray-200 shadow-sm">
        <CardBody className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Información personal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre completo"
              labelPlacement="outside"
              placeholder="Tu nombre"
              startContent={
                <Icon
                  className="text-gray-400"
                  icon="solar:user-linear"
                  width={18}
                />
              }
              value={fullName}
              variant="bordered"
              onValueChange={setFullName}
            />
            <Input
              label="Correo electrónico"
              labelPlacement="outside"
              placeholder="tu@email.com"
              startContent={
                <Icon
                  className="text-gray-400"
                  icon="solar:letter-linear"
                  width={18}
                />
              }
              type="email"
              value={email}
              variant="bordered"
              onValueChange={setEmail}
            />
            <Input
              label="Teléfono"
              labelPlacement="outside"
              placeholder="+34 600 000 000"
              startContent={
                <Icon
                  className="text-gray-400"
                  icon="solar:phone-linear"
                  width={18}
                />
              }
              value={phone}
              variant="bordered"
              onValueChange={setPhone}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Dominio
              </label>
              <div className="flex items-center h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
                <Icon
                  className="text-gray-400 mr-2"
                  icon="solar:link-circle-linear"
                  width={18}
                />
                {brandSlug ? `${PRODUCTION_DOMAIN}/${brandSlug}` : "—"}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Miembro desde{" "}
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "—"}
          </p>
        </CardBody>
      </Card>

      {/* Community URL Section */}
      <Card className="border border-gray-200 shadow-sm">
        <CardBody className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Comunidad
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Configura la URL de tu comunidad para mostrarla a tus clientes
          </p>
          <Input
            description="Los clientes verán esta página en una pestaña 'Comunidad' en su dashboard"
            label="URL de la Comunidad"
            labelPlacement="outside"
            placeholder="https://community.example.com/your-community"
            startContent={
              <Icon
                className="text-gray-400"
                icon="solar:users-group-rounded-linear"
                width={18}
              />
            }
            type="url"
            value={communityUrl}
            variant="bordered"
            onValueChange={setCommunityUrl}
          />
        </CardBody>
      </Card>

      {/* Security Section */}
      <Card className="border border-gray-200 shadow-sm">
        <CardBody className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Seguridad
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Gestiona tu contraseña y seguridad de la cuenta
          </p>
          <Divider className="mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-2.5 rounded-xl">
                <Icon
                  className="text-gray-600"
                  icon="solar:lock-password-linear"
                  width={22}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Contraseña</p>
                <p className="text-xs text-gray-500">
                  Cambia tu contraseña de acceso
                </p>
              </div>
            </div>
            <Button
              size="sm"
              startContent={<Icon icon="solar:pen-linear" width={16} />}
              variant="flat"
              onPress={() => {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setPasswordError("");
                setPasswordSuccess("");
                setShowCurrentPassword(false);
                setShowNewPassword(false);
                setIsPasswordModalOpen(true);
              }}
            >
              Cambiar
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Change Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">Cambiar contraseña</h3>
            <p className="text-sm text-gray-500 font-normal">
              Ingresa tu contraseña actual y la nueva
            </p>
          </ModalHeader>
          <ModalBody>
            {passwordError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                <Icon icon="solar:danger-triangle-bold" width={18} />
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-xl text-sm">
                <Icon icon="solar:check-circle-bold" width={18} />
                {passwordSuccess}
              </div>
            )}
            <Input
              endContent={
                <button
                  className="text-gray-400 hover:text-gray-600"
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  <Icon
                    icon={
                      showCurrentPassword
                        ? "solar:eye-bold"
                        : "solar:eye-closed-bold"
                    }
                    width={20}
                  />
                </button>
              }
              label="Contraseña actual"
              placeholder="Ingresa tu contraseña actual"
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              variant="bordered"
              onValueChange={setCurrentPassword}
            />
            <Input
              endContent={
                <button
                  className="text-gray-400 hover:text-gray-600"
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  <Icon
                    icon={
                      showNewPassword
                        ? "solar:eye-bold"
                        : "solar:eye-closed-bold"
                    }
                    width={20}
                  />
                </button>
              }
              label="Nueva contraseña"
              placeholder="Mínimo 6 caracteres"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              variant="bordered"
              onValueChange={setNewPassword}
            />
            <Input
              label="Confirmar nueva contraseña"
              placeholder="Repite la nueva contraseña"
              type={showNewPassword ? "text" : "password"}
              value={confirmPassword}
              variant="bordered"
              onValueChange={setConfirmPassword}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => setIsPasswordModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-gray-900 text-white font-semibold"
              isLoading={isChangingPassword}
              onPress={handleChangePassword}
            >
              Cambiar contraseña
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Sticky Save Bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg transition-transform duration-300 z-50 ${
          hasChanges ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Icon
              className="text-amber-500"
              icon="solar:info-circle-bold"
              width={18}
            />
            <span>Tienes cambios sin guardar</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="flat"
              onPress={() => {
                // Reset to original values
                if (profile) {
                  setFullName(profile.full_name || "");
                  setEmail(profile.email || "");
                  setPhone(profile.phone || "");
                  setCommunityUrl(profile.community_url || "");
                }
              }}
            >
              Descartar
            </Button>
            <Button
              className="bg-gray-900 text-white font-semibold"
              isLoading={isSaving}
              size="sm"
              onPress={handleSaveProfile}
            >
              Guardar cambios
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
