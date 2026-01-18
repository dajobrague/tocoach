"use client";

import { Button, Card, CardBody, Chip, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { PRODUCTION_DOMAIN } from "@/config/app";
import { useSetupWizard } from "@/lib/setup-wizard/context";

// Always show the production domain in the UI (app.topcoach.io)
// This gives users a clear view of their final production URL
const BASE_DOMAIN = PRODUCTION_DOMAIN;

export default function DomainSetup() {
  const { state, actions } = useSetupWizard();
  // Extract just the slug part from the stored value
  const currentSlug = state.domain.desired || "";
  const [inputValue, setInputValue] = useState(currentSlug);
  const [lastCheckedValue, setLastCheckedValue] = useState("");

  // Debug logging
  console.log("[DomainSetup] Current state:", {
    current: state.domain.current,
    desired: state.domain.desired,
    BASE_DOMAIN,
  });

  // Debounced slug checking - only check when input changes and stops
  useEffect(() => {
    if (!inputValue || inputValue.length < 3) return;

    // Don't check if it's the same as what we last checked
    if (inputValue === lastCheckedValue || inputValue === state.domain.current)
      return;

    const timeoutId = setTimeout(() => {
      setLastCheckedValue(inputValue);
      actions.checkDomainAvailability(inputValue);
    }, 800); // Increased delay to reduce API calls

    return () => clearTimeout(timeoutId);
  }, [inputValue, actions, state.domain.current, lastCheckedValue]);

  const handleSlugChange = (value: string) => {
    // Only allow valid characters for slug
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");

    setInputValue(sanitized);
    actions.setDomain(sanitized);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    actions.setDomain(suggestion);
    setLastCheckedValue(suggestion);
    actions.checkDomainAvailability(suggestion);
  };

  const getInputStatus = () => {
    if (state.domain.isChecking) return "default";
    if (state.domain.isAvailable === true) return "success";
    if (state.domain.isAvailable === false) return "danger";

    return "default";
  };

  const getStatusMessage = () => {
    if (state.domain.isChecking) return "Verificando disponibilidad...";
    if (state.domain.isAvailable === true) {
      return state.domain.desired === state.domain.current
        ? "✅ Este es tu slug actual"
        : "✅ Slug disponible";
    }
    if (state.domain.isAvailable === false) return "❌ Slug no disponible";

    return "Introduce tu slug deseado";
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading font-bold text-black mb-2">
          Personaliza tu dominio
        </h2>
        <p className="text-gray-600 font-body">
          Elige el nombre único donde tus clientes accederán a tu plataforma
        </p>
      </div>

      {/* Current Domain Info */}
      {state.domain.current && (
        <Card className="bg-blue-50 border border-blue-200">
          <CardBody className="p-4">
            <div className="flex items-center gap-3">
              <Icon
                className="text-blue-600 text-xl"
                icon="solar:info-circle-linear"
              />
              <div>
                <p className="text-small font-medium text-blue-800">
                  Tu URL actual
                </p>
                <p className="text-small text-blue-600 font-mono">
                  {BASE_DOMAIN}/
                  {state.domain.current.replace(/\.localhost$/, "")}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Slug Input */}
      <div className="space-y-3">
        <Input
          className="font-body w-full"
          color={getInputStatus()}
          description={getStatusMessage()}
          endContent={
            <div className="flex items-center gap-1">
              <div className="w-px h-4 bg-gray-300 mx-1" />
              {state.domain.isChecking ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              ) : state.domain.isAvailable === true ? (
                <Icon
                  className="text-success text-xl"
                  icon="solar:check-circle-bold"
                />
              ) : state.domain.isAvailable === false ? (
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
          value={inputValue}
          variant="bordered"
          onValueChange={handleSlugChange}
        />

        {/* Preview URL */}
        {inputValue && (
          <Card className="bg-green-50 border border-green-200">
            <CardBody className="p-3">
              <p className="text-xs font-medium text-green-800 mb-1">
                Tu URL será:
              </p>
              <p className="text-sm text-green-700 font-mono font-bold">
                https://{BASE_DOMAIN}/{inputValue}
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
      {state.domain.suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-black mb-3">
            Sugerencias disponibles:
          </h4>
          <div className="flex flex-wrap gap-2">
            {state.domain.suggestions.map((suggestion, index) => (
              <Chip
                key={index}
                className="cursor-pointer hover:bg-blue-100"
                color="primary"
                variant="bordered"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {BASE_DOMAIN}/{suggestion}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {state.errors.domain && (
        <Card className="bg-red-50 border border-red-200">
          <CardBody className="p-4">
            <div className="flex items-center gap-3">
              <Icon
                className="text-red-600 text-xl"
                icon="solar:danger-circle-linear"
              />
              <p className="text-small text-red-800">{state.errors.domain}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button
          className="border-gray-300"
          startContent={<Icon icon="solar:arrow-left-linear" />}
          variant="bordered"
          onPress={() => window.history.back()}
        >
          Volver al Dashboard
        </Button>

        <Button
          color="primary"
          endContent={<Icon icon="solar:arrow-right-linear" />}
          isDisabled={!state.domain.isAvailable || state.domain.isChecking}
          isLoading={state.isLoading}
          onPress={async () => {
            try {
              // Only save if slug has changed
              if (state.domain.desired !== state.domain.current) {
                await actions.saveDomain(state.domain.desired);
              }
              actions.nextStep();
            } catch (error) {
              // Error is handled in the context, just show it to user
              console.error("Failed to save slug:", error);
            }
          }}
        >
          {state.isLoading ? "Guardando..." : "Siguiente: Colores"}
        </Button>
      </div>
    </div>
  );
}
