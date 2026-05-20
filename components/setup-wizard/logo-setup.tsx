"use client";

import { Button, Card, CardBody, Input } from "@heroui/react";
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
        // Local preview only — NEVER persisted. It dies with this browser tab.
        const previewUrl = URL.createObjectURL(file);

        setLogoPreview(previewUrl);
        actions.setLogoFile(file);

        try {
          const formData = new FormData();

          formData.append("logo", file);

          const response = await fetch("/api/setup/upload-logo", {
            method: "POST",
            body: formData,
          });

          const result = await response.json();

          if (result.success) {
            // Persist only the real Supabase Storage URL.
            actions.setLogoUrl(result.logoUrl);
            console.log("Logo uploaded successfully:", result.logoUrl);
          } else {
            console.error("Logo upload failed:", result.error);
            // Do NOT persist the blob preview — it's tab-local and would
            // break for every other viewer the moment this tab closes.
            actions.setLogoUrl(null);
            actions.setLogoFile(null);
            URL.revokeObjectURL(previewUrl);
            setLogoPreview(null);
          }
        } catch (error) {
          console.error("Logo upload error:", error);
          actions.setLogoUrl(null);
          actions.setLogoFile(null);
          URL.revokeObjectURL(previewUrl);
          setLogoPreview(null);
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

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:gallery-linear" />
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
                  ? "border-slate-400 bg-slate-100"
                  : "border-gray-300 hover:border-slate-300 hover:bg-gray-50"
              }`}
              onClick={(e) => {
                e.preventDefault();
                open();
              }}
            >
              <input {...getInputProps()} />
              <div className="flex justify-center mb-4">
                <Icon
                  className={`text-4xl ${isDragActive ? "text-slate-700" : "text-gray-400"}`}
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

      {/* Action Buttons */}
      <div className="flex justify-between pt-6 border-t border-gray-200">
        <Button
          className="border-gray-300"
          startContent={<Icon icon="solar:arrow-left-linear" />}
          variant="bordered"
          onPress={actions.prevStep}
        >
          Anterior
        </Button>

        <Button
          className="bg-black text-white hover:bg-slate-800"
          endContent={<Icon icon="solar:arrow-right-linear" />}
          size="lg"
          onPress={actions.nextStep}
        >
          Siguiente: Tipografía
        </Button>
      </div>
    </div>
  );
}
