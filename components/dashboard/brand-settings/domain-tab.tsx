"use client";

import { Alert, Button, Card, CardBody, Chip, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

import { PRODUCTION_DOMAIN } from "@/config/app";

const BASE_DOMAIN = PRODUCTION_DOMAIN;

export default function BrandDomainTab() {
  const [currentSlug, setCurrentSlug] = React.useState("");
  const [desiredSlug, setDesiredSlug] = React.useState("");
  const [isChecking, setIsChecking] = React.useState(false);
  const [isAvailable, setIsAvailable] = React.useState<boolean | null>(null);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    // Fetch current domain/slug
    const fetchCurrentSlug = async () => {
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
      }
    };

    fetchCurrentSlug();
  }, []);

  const checkAvailability = React.useCallback(
    async (slug: string) => {
      if (!slug || slug.length < 3) {
        setIsAvailable(null);
        setSuggestions([]);

        return;
      }

      if (slug === currentSlug) {
        setIsAvailable(true);
        setSuggestions([]);

        return;
      }

      setIsChecking(true);
      try {
        const response = await fetch(
          `/api/setup/check-domain?desired=${encodeURIComponent(slug)}`
        );
        const data = await response.json();

        setIsAvailable(data.available);
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error("Error checking availability:", error);
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    },
    [currentSlug]
  );

  // Debounce the availability check
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (desiredSlug !== currentSlug) {
        checkAvailability(desiredSlug);
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [desiredSlug, currentSlug, checkAvailability]);

  const handleSlugChange = (value: string) => {
    // Only allow valid characters for slug
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");

    setDesiredSlug(sanitized);
  };

  const handleSave = async () => {
    if (!isAvailable || desiredSlug === currentSlug) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/setup/save-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desired_slug: desiredSlug }),
      });

      if (response.ok) {
        setCurrentSlug(desiredSlug);
        setMessage({
          type: "success",
          text: "Dominio actualizado exitosamente",
        });
        setTimeout(() => setMessage(null), 5000);
      } else {
        throw new Error("Failed to save domain");
      }
    } catch (error) {
      console.error("Error saving domain:", error);
      setMessage({ type: "error", text: "Error al guardar el dominio" });
    } finally {
      setIsSaving(false);
    }
  };

  const getInputStatus = () => {
    if (isChecking) return "default";
    if (isAvailable === true) return "success";
    if (isAvailable === false) return "danger";

    return "default";
  };

  const getStatusMessage = () => {
    if (isChecking) return "Verificando disponibilidad...";
    if (isAvailable === true) {
      return desiredSlug === currentSlug
        ? "✅ Este es tu slug actual"
        : "✅ Slug disponible";
    }
    if (isAvailable === false) return "❌ Slug no disponible";

    return "Introduce tu slug deseado";
  };

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
                icon="solar:info-circle-linear"
              />
              <div>
                <p className="text-small font-medium text-slate-800">
                  Tu URL actual
                </p>
                <p className="text-small text-slate-700 font-mono">
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
          Personaliza tu Slug
        </h4>
        <Input
          className="font-body w-full"
          color={getInputStatus()}
          description={getStatusMessage()}
          endContent={
            <div className="flex items-center gap-1">
              <div className="w-px h-4 bg-gray-300 mx-1" />
              {isChecking ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
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
          label="Tu slug (nombre único)"
          placeholder="mi-coaching"
          startContent={
            <div className="text-default-400 text-sm">{BASE_DOMAIN}/</div>
          }
          value={desiredSlug}
          variant="bordered"
          onValueChange={handleSlugChange}
        />

        {/* Preview URL */}
        {desiredSlug && (
          <Card className="bg-green-50 border border-green-200">
            <CardBody className="p-3">
              <p className="text-xs font-medium text-green-800 mb-1">
                Tu URL será:
              </p>
              <p className="text-sm text-green-700 font-mono font-bold">
                https://{BASE_DOMAIN}/{desiredSlug}
              </p>
            </CardBody>
          </Card>
        )}

        {/* Slug Rules */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-black mb-2">
            Reglas para el slug:
          </h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Solo letras minúsculas, números y guiones</li>
            <li>• Mínimo 3 caracteres, máximo 30</li>
            <li>• No puede empezar o terminar con guión</li>
            <li>
              • Será parte de tu URL: <strong>{BASE_DOMAIN}/[tu-slug]</strong>
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
                className="cursor-pointer bg-black text-white hover:bg-slate-800"
                variant="bordered"
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
          color="primary"
          isDisabled={!isAvailable || isChecking || desiredSlug === currentSlug}
          isLoading={isSaving}
          size="lg"
          startContent={<Icon icon="solar:floppy-disk-linear" />}
          onPress={handleSave}
        >
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
}
