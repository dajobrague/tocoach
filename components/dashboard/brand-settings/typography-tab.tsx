"use client";

import { Alert, Button, Card, CardBody, Input, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useCallback, useEffect, useMemo, useRef } from "react";

// Popular Google Fonts for coaching platforms
const DEFAULT_FONT_OPTIONS = [
  {
    family: "Poppins",
    category: "Sans-serif",
    description: "Moderno y amigable",
  },
  {
    family: "Inter",
    category: "Sans-serif",
    description: "Legible y profesional",
  },
  {
    family: "Roboto",
    category: "Sans-serif",
    description: "Clásico y versátil",
  },
  {
    family: "Open Sans",
    category: "Sans-serif",
    description: "Neutral y legible",
  },
  {
    family: "Montserrat",
    category: "Sans-serif",
    description: "Elegante y moderno",
  },
  {
    family: "Lato",
    category: "Sans-serif",
    description: "Cálido y humano",
  },
  {
    family: "Playfair Display",
    category: "Serif",
    description: "Sofisticado y editorial",
  },
  {
    family: "Roboto Slab",
    category: "Serif",
    description: "Fuerte y moderno",
  },
  {
    family: "Nunito",
    category: "Sans-serif",
    description: "Redondeado y amigable",
  },
  {
    family: "Raleway",
    category: "Sans-serif",
    description: "Fino y elegante",
  },
];

// Build Google Fonts URL for one or more families
function buildGoogleFontsUrl(families: string[]): string {
  const unique = [...new Set(families)];
  const params = unique
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@300;400;500;600;700`)
    .join("&");

  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

// Extract font family name from a Google Fonts URL
function extractFamilyFromUrl(url: string): string | null {
  try {
    const match = url.match(/family=([^:&]+)/);

    if (match?.[1]) {
      return decodeURIComponent(match[1].replace(/\+/g, " "));
    }
  } catch {
    // ignore
  }

  return null;
}

export default function BrandTypographyTab() {
  const [headingFont, setHeadingFont] = React.useState("Inter");
  const [bodyFont, setBodyFont] = React.useState("Inter");
  const [customFonts, setCustomFonts] = React.useState<
    { family: string; category: string; description: string }[]
  >([]);
  const [customFontUrl, setCustomFontUrl] = React.useState("");
  const [customFontError, setCustomFontError] = React.useState<string | null>(
    null
  );
  const [isLoadingCustom, setIsLoadingCustom] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const fontsLoadedRef = useRef(false);

  // Combined list of all font options
  const allFontOptions = useMemo(
    () => [...DEFAULT_FONT_OPTIONS, ...customFonts],
    [customFonts]
  );

  // Load Google Fonts for preview
  useEffect(() => {
    if (fontsLoadedRef.current) return;
    fontsLoadedRef.current = true;

    const families = DEFAULT_FONT_OPTIONS.map((f) => f.family);
    const linkId = "brand-typography-preview-fonts";

    // Don't add twice
    if (document.getElementById(linkId)) return;

    const link = document.createElement("link");

    link.id = linkId;
    link.rel = "stylesheet";
    link.href = buildGoogleFontsUrl(families);
    document.head.appendChild(link);
  }, []);

  // Load additional font when custom fonts are added
  const loadCustomFontPreview = useCallback((family: string) => {
    const linkId = `custom-font-${family.replace(/\s+/g, "-")}`;

    if (document.getElementById(linkId)) return;

    const link = document.createElement("link");

    link.id = linkId;
    link.rel = "stylesheet";
    link.href = buildGoogleFontsUrl([family]);
    document.head.appendChild(link);
  }, []);

  // Fetch current brand configuration
  useEffect(() => {
    const fetchBrandConfig = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/brand/config");

        if (response.ok) {
          const data = await response.json();

          if (data.theme_json?.fonts) {
            const hFamily = data.theme_json.fonts.heading?.family || "Inter";
            const bFamily = data.theme_json.fonts.body?.family || "Inter";

            // Strip fallbacks (e.g. "Inter, system-ui, sans-serif" → "Inter")
            const stripFallback = (f: string) => (f.split(",")[0] ?? f).trim();

            setHeadingFont(stripFallback(hFamily));
            setBodyFont(stripFallback(bFamily));

            // If either font is not in the defaults, add it as custom
            const defaultNames = DEFAULT_FONT_OPTIONS.map((f) => f.family);
            const extras: {
              family: string;
              category: string;
              description: string;
            }[] = [];

            for (const fam of [
              stripFallback(hFamily),
              stripFallback(bFamily),
            ]) {
              if (
                !defaultNames.includes(fam) &&
                !extras.find((e) => e.family === fam)
              ) {
                extras.push({
                  family: fam,
                  category: "Custom",
                  description: "Fuente personalizada",
                });
                loadCustomFontPreview(fam);
              }
            }

            // Also load any custom fonts stored in theme_json
            if (data.theme_json.fonts.customFonts) {
              for (const cf of data.theme_json.fonts.customFonts) {
                if (
                  !defaultNames.includes(cf.family) &&
                  !extras.find((e) => e.family === cf.family)
                ) {
                  extras.push({
                    family: cf.family,
                    category: "Custom",
                    description: "Fuente personalizada",
                  });
                  loadCustomFontPreview(cf.family);
                }
              }
            }

            if (extras.length > 0) {
              setCustomFonts(extras);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching brand config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBrandConfig();
  }, [loadCustomFontPreview]);

  // Handle loading a custom font from URL
  const handleLoadCustomFont = useCallback(async () => {
    setCustomFontError(null);
    const url = customFontUrl.trim();

    if (!url) return;

    // Validate it looks like a Google Fonts URL
    if (!url.includes("fonts.googleapis.com")) {
      setCustomFontError(
        "La URL debe ser de Google Fonts (fonts.googleapis.com)"
      );

      return;
    }

    const family = extractFamilyFromUrl(url);

    if (!family) {
      setCustomFontError("No se pudo extraer el nombre de la fuente de la URL");

      return;
    }

    // Check if already in the list
    if (allFontOptions.find((f) => f.family === family)) {
      setCustomFontError(`La fuente "${family}" ya está disponible`);

      return;
    }

    setIsLoadingCustom(true);

    try {
      // Load the font
      loadCustomFontPreview(family);

      // Wait a moment for the font to start loading
      await new Promise((r) => setTimeout(r, 1000));

      setCustomFonts((prev) => [
        ...prev,
        {
          family,
          category: "Custom",
          description: "Fuente personalizada",
        },
      ]);

      setCustomFontUrl("");
      setMessage({
        type: "success",
        text: `Fuente "${family}" cargada correctamente`,
      });
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setCustomFontError("Error al cargar la fuente");
    } finally {
      setIsLoadingCustom(false);
    }
  }, [customFontUrl, allFontOptions, loadCustomFontPreview]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/brand/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fonts: {
            heading: {
              family: headingFont,
              weight: 600,
            },
            body: {
              family: bodyFont,
              weight: 400,
            },
            // Persist custom fonts so we can show them when the page reloads
            ...(customFonts.length > 0 && {
              customFonts: customFonts.map((f) => ({ family: f.family })),
            }),
          },
        }),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Tipografía guardada exitosamente. Los cambios se reflejarán en la app del cliente.",
        });
        setTimeout(() => setMessage(null), 5000);
      } else {
        throw new Error("Failed to save fonts");
      }
    } catch (error) {
      console.error("Error saving fonts:", error);
      setMessage({ type: "error", text: "Error al guardar la tipografía" });
    } finally {
      setIsSaving(false);
    }
  };

  const FontPreviewCard = ({
    font,
    isSelected,
    onClick,
    type,
  }: {
    font: { family: string; category: string; description: string };
    isSelected: boolean;
    onClick: () => void;
    type: "heading" | "body";
  }) => (
    <Card
      isPressable
      className={`border transition-all ${
        isSelected
          ? "border-slate-500 bg-slate-100"
          : "border-gray-200 hover:border-slate-300"
      }`}
      onPress={onClick}
    >
      <CardBody className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="font-semibold text-black">{font.family}</h5>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {font.category}
            </span>
          </div>

          <p
            className={`${type === "heading" ? "text-xl font-semibold" : "text-sm"}`}
            style={{ fontFamily: `'${font.family}', sans-serif` }}
          >
            Transforma tu cuerpo
          </p>

          <p className="text-xs text-gray-600">{font.description}</p>

          {isSelected && (
            <div className="flex items-center gap-2 text-slate-700">
              <Icon className="text-sm" icon="solar:check-circle-bold" />
              <span className="text-xs font-medium">Seleccionado</span>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

      {/* Live Preview */}
      <Card className="border border-gray-200 bg-white">
        <CardBody className="p-6">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Vista previa
          </h4>
          <div className="space-y-2">
            <p
              className="text-2xl font-semibold text-black"
              style={{ fontFamily: `'${headingFont}', sans-serif` }}
            >
              Bienvenido a tu entrenamiento
            </p>
            <p
              className="text-base text-gray-700"
              style={{ fontFamily: `'${bodyFont}', sans-serif` }}
            >
              Tu plan personalizado incluye ejercicios diseñados para alcanzar
              tus objetivos. Sigue cada rutina con constancia y verás resultados
              increíbles.
            </p>
            <p
              className="text-sm text-gray-500"
              style={{ fontFamily: `'${bodyFont}', sans-serif` }}
            >
              Títulos: {headingFont} · Texto: {bodyFont}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Custom Google Font */}
      <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
        <CardBody className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <Icon
                  className="text-2xl text-slate-700"
                  icon="solar:link-circle-linear"
                />
              </div>
              <div className="flex-1">
                <h5 className="text-sm font-semibold text-black mb-1">
                  Agregar fuente personalizada
                </h5>
                <p className="text-xs text-gray-600 mb-3">
                  Pega la URL de Google Fonts para usar cualquier fuente de su
                  catálogo
                </p>

                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="https://fonts.googleapis.com/css2?family=..."
                    size="sm"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:link-linear"
                      />
                    }
                    value={customFontUrl}
                    variant="bordered"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLoadCustomFont();
                    }}
                    onValueChange={(v) => {
                      setCustomFontUrl(v);
                      setCustomFontError(null);
                    }}
                  />
                  <Button
                    className="bg-black text-white hover:bg-slate-800"
                    isDisabled={!customFontUrl.trim()}
                    isLoading={isLoadingCustom}
                    size="md"
                    startContent={
                      !isLoadingCustom ? (
                        <Icon icon="solar:download-linear" />
                      ) : undefined
                    }
                    onPress={handleLoadCustomFont}
                  >
                    Cargar
                  </Button>
                </div>

                {customFontError && (
                  <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                    <Icon icon="solar:danger-circle-linear" width={14} />
                    {customFontError}
                  </p>
                )}

                <div className="mt-3 space-y-1">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Icon
                      className="text-slate-600"
                      icon="solar:info-circle-linear"
                    />
                    Visita{" "}
                    <a
                      className="text-slate-700 underline"
                      href="https://fonts.google.com"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Google Fonts
                    </a>{" "}
                    → elige una fuente → copia el link de la sección &quot;Get
                    embed code&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Heading Font Selection */}
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:text-bold-linear" />
          Fuente para títulos
        </h4>
        <div className="grid md:grid-cols-2 gap-4">
          {allFontOptions.map((font) => (
            <FontPreviewCard
              key={`heading-${font.family}`}
              font={font}
              isSelected={headingFont === font.family}
              type="heading"
              onClick={() => setHeadingFont(font.family)}
            />
          ))}
        </div>
      </div>

      {/* Body Font Selection */}
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:text-linear" />
          Fuente para texto
        </h4>
        <div className="grid md:grid-cols-2 gap-4">
          {allFontOptions.map((font) => (
            <FontPreviewCard
              key={`body-${font.family}`}
              font={font}
              isSelected={bodyFont === font.family}
              type="body"
              onClick={() => setBodyFont(font.family)}
            />
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <Button
          className="bg-black text-white hover:bg-slate-800"
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
