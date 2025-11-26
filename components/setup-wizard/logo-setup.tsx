"use client";

import {
  Button,
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

import { useSetupWizard } from "@/lib/setup-wizard/context";

export default function LogoSetup() {
  const { state, actions } = useSetupWizard();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];

      if (file) {
        // Create preview URL
        const previewUrl = URL.createObjectURL(file);

        setLogoPreview(previewUrl);

        // Set file in state
        actions.setLogoFile(file);

        try {
          // Upload to Supabase Storage
          const formData = new FormData();

          formData.append("logo", file);

          const response = await fetch("/api/setup/upload-logo", {
            method: "POST",
            body: formData,
          });

          const result = await response.json();

          if (result.success) {
            // Set permanent URL from storage
            actions.setLogoUrl(result.logoUrl);
            console.log("Logo uploaded successfully:", result.logoUrl);
          } else {
            console.error("Logo upload failed:", result.error);
            // Keep preview URL as fallback
            actions.setLogoUrl(previewUrl);
          }
        } catch (error) {
          console.error("Logo upload error:", error);
          // Keep preview URL as fallback
          actions.setLogoUrl(previewUrl);
        }
      }
    },
    [actions]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".svg", ".webp"],
    },
    maxSize: 2 * 1024 * 1024, // 2MB
    multiple: false,
    noClick: false, // Ensure click is enabled
    noKeyboard: false,
  });

  const handleRemoveLogo = () => {
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoPreview(null);
    actions.setLogoFile(null);
    actions.setLogoUrl(null);
  };

  const logoSizeOptions = [
    { key: "small", label: "Pequeño", description: "Para headers compactos" },
    { key: "medium", label: "Mediano", description: "Tamaño estándar" },
    { key: "large", label: "Grande", description: "Para mayor impacto" },
  ];

  const logoPositionOptions = [
    { key: "left", label: "Izquierda", icon: "solar:align-left-linear" },
    { key: "center", label: "Centro", icon: "solar:align-center-linear" },
    { key: "right", label: "Derecha", icon: "solar:align-right-linear" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-blue-600" icon="solar:gallery-linear" />
          Logo y Marca
        </h4>
      </div>

      {/* Logo Upload */}
      <div className="space-y-4">
        <label className="text-sm font-medium text-black">Subir Logo</label>

        {state.logo?.url ? (
          // Show uploaded logo
          <Card className="border border-gray-200">
            <CardBody className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <img
                    alt="Logo preview"
                    className="w-16 h-16 object-contain rounded-lg border border-gray-200"
                    src={state.logo.url}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-black">Logo subido</p>
                  <p className="text-xs text-gray-500">
                    Haz clic en "Cambiar" para subir uno nuevo
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="border-gray-300"
                    size="sm"
                    variant="bordered"
                    {...(getRootProps() as any)}
                  >
                    Cambiar
                  </Button>
                  <Button
                    color="danger"
                    size="sm"
                    variant="light"
                    onPress={handleRemoveLogo}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ) : (
          // Show upload area
          <div>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg transition-colors cursor-pointer p-8 text-center ${
                isDragActive
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
              }`}
              onClick={(e) => {
                e.preventDefault();
                open();
              }}
            >
              <input {...getInputProps()} />
              <div className="flex justify-center mb-4">
                <Icon
                  className={`text-4xl ${isDragActive ? "text-blue-600" : "text-gray-400"}`}
                  icon="solar:upload-linear"
                />
              </div>
              <h4 className="text-lg font-semibold text-black mb-2">
                {isDragActive ? "Suelta tu logo aquí" : "Sube tu logo"}
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Arrastra y suelta, o haz clic aquí para seleccionar
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <p>• Formatos: PNG, JPG, SVG, WebP</p>
                <p>• Tamaño máximo: 2MB</p>
                <p>• Recomendado: Fondo transparente</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logo Text Fallback */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-black">
          Texto de marca (alternativo)
        </label>
        <Input
          className="font-body"
          description="Se mostrará si no hay logo subido"
          placeholder="Mi Marca"
          value={state.logo?.text || ""}
          variant="bordered"
          onValueChange={actions.setLogoText}
        />
      </div>

      {/* Logo Position */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-black">
          Posición del logo
        </label>
        <div className="grid grid-cols-3 gap-3">
          {logoPositionOptions.map((option) => (
            <Button
              key={option.key}
              className="h-auto p-4 flex-col gap-2"
              color={
                state.logo?.position === option.key ? "primary" : "default"
              }
              variant={
                state.logo?.position === option.key ? "solid" : "bordered"
              }
              onPress={() =>
                actions.setLogoPosition(
                  option.key as "left" | "center" | "right"
                )
              }
            >
              <Icon className="text-xl" icon={option.icon} />
              <span className="text-sm">{option.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Logo Size */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-black">
          Tamaño del logo
        </label>
        <Select
          className="w-full"
          selectedKeys={[state.logo?.size || "medium"]}
          variant="bordered"
          onSelectionChange={(keys) => {
            const size = Array.from(keys)[0] as "small" | "medium" | "large";

            actions.setLogoSize(size);
          }}
        >
          {logoSizeOptions.map((option) => (
            <SelectItem key={option.key} textValue={option.label}>
              <div>
                <p className="font-medium">{option.label}</p>
                <p className="text-xs text-gray-500">{option.description}</p>
              </div>
            </SelectItem>
          ))}
        </Select>
      </div>
    </div>
  );
}
