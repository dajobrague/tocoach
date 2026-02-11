"use client";

import {
  Alert,
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

import { PRODUCTION_DOMAIN } from "@/config/app";

const BASE_DOMAIN = PRODUCTION_DOMAIN;

export default function BrandDomainTab() {
  const [currentSlug, setCurrentSlug] = React.useState("");
  const [desiredSlug, setDesiredSlug] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isAvailable, setIsAvailable] = React.useState<boolean | null>(null);
  const [checkError, setCheckError] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const confirmModal = useDisclosure();

  // Fetch current slug on mount
  React.useEffect(() => {
    const fetchCurrentSlug = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/brand/config");

        if (response.ok) {
          const data = await response.json();
          const slug = data.slug || "";

          setCurrentSlug(slug);
          setDesiredSlug(slug);
        }
      } catch (error) {
        console.error("Error fetching current slug:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentSlug();
  }, []);

  const checkAvailability = React.useCallback(
    async (slug: string) => {
      if (!slug || slug.length < 3) {
        setIsAvailable(null);
        setCheckError(null);
        setSuggestions([]);

        return;
      }

      if (slug === currentSlug) {
        setIsAvailable(true);
        setCheckError(null);
        setSuggestions([]);

        return;
      }

      setIsChecking(true);
      setCheckError(null);
      try {
        const response = await fetch(
          `/api/setup/check-domain?desired=${encodeURIComponent(slug)}`
        );
        const data = await response.json();

        // API returns isAvailable
        setIsAvailable(data.isAvailable ?? false);
        setSuggestions(data.suggestions || []);
        if (!data.isAvailable && data.error) {
          setCheckError(data.error);
        }
      } catch (error) {
        console.error("Error checking availability:", error);
        setIsAvailable(null);
        setCheckError("Error al verificar disponibilidad");
      } finally {
        setIsChecking(false);
      }
    },
    [currentSlug]
  );

  // Debounce the availability check
  React.useEffect(() => {
    if (desiredSlug === currentSlug) {
      setIsAvailable(desiredSlug ? true : null);
      setCheckError(null);
      setSuggestions([]);

      return;
    }

    const timeoutId = setTimeout(() => {
      checkAvailability(desiredSlug);
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [desiredSlug, currentSlug, checkAvailability]);

  const handleSlugChange = (value: string) => {
    // Only allow valid characters for slug
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");

    setDesiredSlug(sanitized);
  };

  // Ask for confirmation before saving
  const handleSaveClick = () => {
    if (!isAvailable || desiredSlug === currentSlug) return;
    confirmModal.onOpen();
  };

  // Actually perform the save
  const handleConfirmSave = async () => {
    confirmModal.onClose();
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/setup/save-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: desiredSlug }),
      });

      if (response.ok) {
        setCurrentSlug(desiredSlug);
        setMessage({
          type: "success",
          text: `Dominio actualizado a ${BASE_DOMAIN}/${desiredSlug}. Los clientes deberán usar la nueva URL para acceder.`,
        });
        setTimeout(() => setMessage(null), 8000);
      } else {
        const errData = await response.json().catch(() => ({}));

        throw new Error(errData.error || "Failed to save domain");
      }
    } catch (error: any) {
      console.error("Error saving domain:", error);
      setMessage({
        type: "error",
        text: error.message || "Error al guardar el dominio",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = desiredSlug !== currentSlug;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Message */}
      {message && (
        <Alert
          color={message.type === "success" ? "success" : "danger"}
          description={message.text}
          endContent={
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => setMessage(null)}
            >
              <Icon icon="solar:close-linear" width={18} />
            </Button>
          }
          startContent={
            <Icon
              icon={
                message.type === "success"
                  ? "solar:check-circle-bold"
                  : "solar:danger-circle-bold"
              }
              width={20}
            />
          }
          title={message.type === "success" ? "Éxito" : "Error"}
        />
      )}

      {/* Current Domain Info */}
      {currentSlug && (
        <Card className="bg-slate-100 border border-slate-200">
          <CardBody className="p-4">
            <div className="flex items-center gap-3">
              <Icon
                className="text-slate-700 text-xl"
                icon="solar:globe-linear"
              />
              <div>
                <p className="text-small font-medium text-slate-800">
                  Tu URL actual
                </p>
                <p className="text-small text-slate-700 font-mono font-bold">
                  {BASE_DOMAIN}/{currentSlug}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Slug Input */}
      <div className="space-y-3">
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:link-circle-linear" />
          Personaliza tu dominio
        </h4>
        <Input
          className="font-body w-full"
          color={
            isChecking
              ? "default"
              : isAvailable === true
                ? "success"
                : isAvailable === false
                  ? "danger"
                  : "default"
          }
          description={
            isChecking
              ? "Verificando disponibilidad..."
              : isAvailable === true
                ? desiredSlug === currentSlug
                  ? "Este es tu dominio actual"
                  : "Dominio disponible"
                : isAvailable === false
                  ? checkError || "Dominio no disponible"
                  : desiredSlug.length > 0 && desiredSlug.length < 3
                    ? "Mínimo 3 caracteres"
                    : "Introduce tu dominio deseado"
          }
          endContent={
            <div className="flex items-center gap-1">
              <div className="w-px h-4 bg-gray-300 mx-1" />
              {isChecking ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
              ) : isAvailable === true ? (
                <Icon
                  className="text-success text-xl"
                  icon="solar:check-circle-bold"
                />
              ) : isAvailable === false ? (
                <Icon
                  className="text-danger text-xl"
                  icon="solar:close-circle-bold"
                />
              ) : null}
            </div>
          }
          label="Tu dominio (nombre único)"
          placeholder="mi-coaching"
          startContent={
            <div className="text-default-400 text-sm whitespace-nowrap">
              {BASE_DOMAIN}/
            </div>
          }
          value={desiredSlug}
          variant="bordered"
          onValueChange={handleSlugChange}
        />

        {/* Preview URL */}
        {desiredSlug && isAvailable === true && hasChanges && (
          <Card className="bg-green-50 border border-green-200">
            <CardBody className="p-3">
              <p className="text-xs font-medium text-green-800 mb-1">
                Tu nueva URL será:
              </p>
              <p className="text-sm text-green-700 font-mono font-bold">
                https://{BASE_DOMAIN}/{desiredSlug}
              </p>
            </CardBody>
          </Card>
        )}

        {/* Warning when changing */}
        {hasChanges && isAvailable === true && (
          <Card className="bg-amber-50 border border-amber-200">
            <CardBody className="p-4">
              <div className="flex items-start gap-3">
                <Icon
                  className="text-amber-600 text-xl flex-shrink-0 mt-0.5"
                  icon="solar:danger-triangle-bold"
                />
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-1">
                    Cambiar el dominio afectará a tus clientes
                  </p>
                  <ul className="text-xs text-amber-700 space-y-1">
                    <li>
                      &bull; La URL anterior ({BASE_DOMAIN}/{currentSlug})
                      dejará de funcionar
                    </li>
                    <li>
                      &bull; Todos tus clientes deberán usar la nueva URL para
                      acceder
                    </li>
                    <li>
                      &bull; Deberás notificar a tus clientes sobre este cambio
                    </li>
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Slug Rules */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-black mb-2">
            Reglas para el dominio:
          </h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>&bull; Solo letras minúsculas, números y guiones</li>
            <li>&bull; Mínimo 3 caracteres, máximo 30</li>
            <li>&bull; No puede empezar o terminar con guión</li>
            <li>
              &bull; Será parte de tu URL:{" "}
              <strong>{BASE_DOMAIN}/[tu-dominio]</strong>
            </li>
          </ul>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-black mb-3">
            Sugerencias disponibles:
          </h4>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <Chip
                key={index}
                className="cursor-pointer bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                variant="flat"
                onClick={() => setDesiredSlug(suggestion)}
              >
                {BASE_DOMAIN}/{suggestion}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <Button
          className="bg-black text-white hover:bg-slate-800"
          isDisabled={!isAvailable || isChecking || !hasChanges}
          isLoading={isSaving}
          size="lg"
          startContent={<Icon icon="solar:floppy-disk-linear" />}
          onPress={handleSaveClick}
        >
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>

      {/* Confirmation Modal */}
      <Modal isOpen={confirmModal.isOpen} onClose={confirmModal.onClose}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Icon
              className="text-amber-500"
              icon="solar:danger-triangle-bold"
              width={24}
            />
            Confirmar cambio de dominio
          </ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Estás a punto de cambiar tu dominio de:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-mono text-red-700 line-through">
                  {BASE_DOMAIN}/{currentSlug}
                </p>
              </div>
              <p className="text-sm text-gray-700">a:</p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-mono text-green-700 font-bold">
                  {BASE_DOMAIN}/{desiredSlug}
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                <p className="text-sm font-semibold text-amber-800 mb-2">
                  Consecuencias de este cambio:
                </p>
                <ul className="text-xs text-amber-700 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <Icon
                      className="text-amber-600 flex-shrink-0 mt-0.5"
                      icon="solar:danger-circle-bold"
                      width={14}
                    />
                    <span>
                      <strong>Todos tus clientes perderán acceso</strong> a la
                      URL actual inmediatamente
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon
                      className="text-amber-600 flex-shrink-0 mt-0.5"
                      icon="solar:danger-circle-bold"
                      width={14}
                    />
                    <span>
                      Los enlaces y accesos directos guardados{" "}
                      <strong>dejarán de funcionar</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon
                      className="text-amber-600 flex-shrink-0 mt-0.5"
                      icon="solar:danger-circle-bold"
                      width={14}
                    />
                    <span>
                      Deberás <strong>notificar a todos tus clientes</strong> la
                      nueva URL
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              className="border-gray-300"
              variant="bordered"
              onPress={confirmModal.onClose}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              startContent={
                <Icon icon="solar:danger-triangle-bold" width={18} />
              }
              onPress={handleConfirmSave}
            >
              Sí, cambiar dominio
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
