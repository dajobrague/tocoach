"use client";

import { Alert, Button, Card, CardBody, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";

export default function BrandLogoTab() {
  // logoUrl is what gets persisted: only ever a real https URL (or null).
  // previewUrl is the in-browser blob: shown while an upload is in flight;
  // it must NEVER be persisted because it dies with the browser tab.
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [logoText, setLogoText] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    // Fetch current brand configuration
    const fetchBrandConfig = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/brand/config");

        if (response.ok) {
          const data = await response.json();

          console.log("[Logo Tab] Brand config data:", data);

          // Try multiple possible locations for the logo
          const logo =
            data.logo_url ||
            data.theme_json?.assets?.logo ||
            data.theme_json?.logo_url ||
            null;

          console.log("[Logo Tab] Logo URL found:", logo);
          setLogoUrl(logo);
          setLogoText(data.brand_name || "");
        }
      } catch (error) {
        console.error("Error fetching brand config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBrandConfig();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];

    if (file) {
      setIsUploading(true);

      // Local preview only — never persisted. Cleared once the real
      // Supabase URL comes back, or on failure.
      const localPreview = URL.createObjectURL(file);

      setPreviewUrl(localPreview);

      try {
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
        }
      } catch (error) {
        console.error("Logo upload error:", error);
        setMessage({ type: "error", text: "Error al subir el logo" });
      } finally {
        URL.revokeObjectURL(localPreview);
        setPreviewUrl(null);
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
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
          <Icon className="text-slate-700" icon="solar:gallery-linear" />
          Logo de tu Marca
        </h4>

        {isLoading ? (
          // Show loading state
          <Card className="border border-gray-200">
            <CardBody className="p-6">
              <div className="flex items-center justify-center gap-3">
                <Icon
                  className="text-slate-700 animate-spin"
                  icon="solar:refresh-linear"
                  width={24}
                />
                <p className="text-sm text-gray-600">Cargando logo...</p>
              </div>
            </CardBody>
          </Card>
        ) : previewUrl || logoUrl ? (
          // Show uploaded logo (or in-flight preview during upload)
          <Card className="border border-gray-200">
            <CardBody className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <img
                    alt="Logo preview"
                    className="w-16 h-16 object-contain rounded-lg border border-gray-200"
                    src={previewUrl ?? logoUrl ?? ""}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-black">
                    {isUploading ? "Subiendo logo..." : "Logo actual"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isUploading
                      ? "Espera a que termine antes de guardar"
                      : 'Haz clic en "Cambiar" para subir uno nuevo'}
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
                ? "border-slate-400 bg-slate-100"
                : "border-gray-300 hover:border-slate-300 hover:bg-gray-50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex justify-center mb-4">
              <Icon
                className={`text-4xl ${isDragActive ? "text-slate-700" : "text-gray-400"}`}
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

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <Button
          className="bg-black text-white hover:bg-slate-800"
          isDisabled={isUploading}
          isLoading={isSaving}
          size="lg"
          startContent={<Icon icon="solar:floppy-disk-linear" />}
          onPress={handleSave}
        >
          {isSaving
            ? "Guardando..."
            : isUploading
              ? "Esperando subida..."
              : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
}
