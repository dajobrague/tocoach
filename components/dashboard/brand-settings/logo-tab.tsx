"use client";

import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";

export default function BrandLogoTab() {
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [logoText, setLogoText] = React.useState("");
  const [logoSize, setLogoSize] = React.useState<"small" | "medium" | "large">(
    "medium"
  );
  const [logoPosition, setLogoPosition] = React.useState<
    "left" | "center" | "right"
  >("left");
  const [isUploading, setIsUploading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    // Fetch current brand configuration
    const fetchBrandConfig = async () => {
      try {
        const response = await fetch("/api/brand/config");

        if (response.ok) {
          const data = await response.json();

          setLogoUrl(data.logo_url || data.theme_json?.assets?.logo || null);
          // You might want to fetch these from somewhere
          setLogoText(data.brand_name || "");
        }
      } catch (error) {
        console.error("Error fetching brand config:", error);
      }
    };

    fetchBrandConfig();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];

    if (file) {
      setIsUploading(true);
      try {
        // Create preview URL
        const previewUrl = URL.createObjectURL(file);

        setLogoUrl(previewUrl);

        // Upload to Supabase Storage
        const formData = new FormData();

        formData.append("logo", file);

        const response = await fetch("/api/setup/upload-logo", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          setLogoUrl(result.logoUrl);
          setMessage({ type: "success", text: "Logo subido exitosamente" });
          setTimeout(() => setMessage(null), 5000);
        } else {
          console.error("Logo upload failed:", result.error);
          setMessage({ type: "error", text: "Error al subir el logo" });
          setLogoUrl(null);
        }
      } catch (error) {
        console.error("Logo upload error:", error);
        setMessage({ type: "error", text: "Error al subir el logo" });
        setLogoUrl(null);
      } finally {
        setIsUploading(false);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".svg", ".webp"],
    },
    maxSize: 2 * 1024 * 1024, // 2MB
    multiple: false,
  });

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setMessage({ type: "success", text: "Logo eliminado" });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/brand/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo_url: logoUrl,
          brand_name: logoText,
          // Save these to theme config if needed
          assets: {
            logo: logoUrl,
          },
        }),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Configuración guardada exitosamente",
        });
        setTimeout(() => setMessage(null), 5000);
      } else {
        throw new Error("Failed to save logo config");
      }
    } catch (error) {
      console.error("Error saving logo config:", error);
      setMessage({ type: "error", text: "Error al guardar la configuración" });
    } finally {
      setIsSaving(false);
    }
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
      {/* Logo Upload */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-blue-600" icon="solar:gallery-linear" />
          Logo de tu Marca
        </h4>

        {logoUrl ? (
          // Show uploaded logo
          <Card className="border border-gray-200">
            <CardBody className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <img
                    alt="Logo preview"
                    className="w-16 h-16 object-contain rounded-lg border border-gray-200"
                    src={logoUrl}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-black">Logo actual</p>
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
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg transition-colors cursor-pointer p-8 text-center ${
              isDragActive
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex justify-center mb-4">
              <Icon
                className={`text-4xl ${isDragActive ? "text-blue-600" : "text-gray-400"}`}
                icon={
                  isUploading ? "solar:refresh-linear" : "solar:upload-linear"
                }
              />
            </div>
            <h4 className="text-lg font-semibold text-black mb-2">
              {isUploading
                ? "Subiendo logo..."
                : isDragActive
                  ? "Suelta tu logo aquí"
                  : "Sube tu logo"}
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
          value={logoText}
          variant="bordered"
          onValueChange={setLogoText}
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
              color={logoPosition === option.key ? "primary" : "default"}
              variant={logoPosition === option.key ? "solid" : "bordered"}
              onPress={() =>
                setLogoPosition(option.key as "left" | "center" | "right")
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
          selectedKeys={[logoSize]}
          variant="bordered"
          onSelectionChange={(keys) => {
            const size = Array.from(keys)[0] as "small" | "medium" | "large";

            setLogoSize(size);
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

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <Button
          color="primary"
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
