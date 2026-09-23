"use client";

// Ajustes → Marca → "Tarjeta de sesión" (Fase 2, JC 23 sep): el entrenador
// decide si sus clientes pueden compartir la tarjeta al terminar una sesión,
// con qué estilo y qué datos aparecen. La vista previa es la imagen real
// (misma ruta de dibujo que la del cliente) con una sesión de ejemplo.

import type {
  ShareCardSettings,
  ShareCardStat,
  ShareCardStyle,
} from "@/lib/share-card/settings";

import {
  Alert,
  Button,
  Checkbox,
  CheckboxGroup,
  Skeleton,
  Spinner,
  Switch,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useEffect, useState } from "react";

import {
  DEFAULT_SHARE_CARD_SETTINGS,
  SHARE_CARD_STATS,
  SHARE_CARD_STAT_LABELS,
} from "@/lib/share-card/settings";

const STYLE_OPTIONS: Array<{
  key: ShareCardStyle;
  title: string;
  description: string;
  swatch: string;
}> = [
  {
    key: "dark",
    title: "Oscuro",
    description: "Historia completa con fondo oscuro.",
    swatch: "bg-gradient-to-b from-slate-700 to-slate-950",
  },
  {
    key: "light",
    title: "Claro",
    description: "Historia completa con fondo claro y tu color.",
    swatch: "bg-gradient-to-b from-white to-slate-200 border border-gray-200",
  },
  {
    key: "sticker",
    title: "Sticker",
    description: "Sin fondo: texto blanco para ponerlo sobre tu foto.",
    swatch:
      "bg-[conic-gradient(#e5e7eb_25%,#fff_0_50%,#e5e7eb_0_75%,#fff_0)] bg-[length:12px_12px] border border-gray-200",
  },
];

/** Máximo de cifras grandes en la tarjeta (el resto se omite). */
const TILE_STATS: ShareCardStat[] = [
  "volume",
  "sets",
  "cardio",
  "exercises",
  "reps",
];

function previewUrl(settings: ShareCardSettings): string {
  const params = new URLSearchParams({
    style: settings.style,
    stats: settings.stats.join(","),
  });

  return `/api/trainer/share-card/preview?${params.toString()}`;
}

export default function ShareCardTab() {
  const [saved, setSaved] = useState<ShareCardSettings | null>(null);
  const [draft, setDraft] = useState<ShareCardSettings>(
    DEFAULT_SHARE_CARD_SETTINGS
  );
  const [loadError, setLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  // La imagen tarda ~1-2 s en generarse: spinner encima de la anterior.
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trainer/share-card", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { settings: ShareCardSettings };

        setSaved(body.settings);
        setDraft(body.settings);
      })
      .catch(() => setLoadError(true));
  }, []);

  // Debounce corto: marcar varias casillas seguidas no dispara N imágenes.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      setPreviewSrc(previewUrl(draft));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [draft]);

  const isDirty =
    saved !== null && JSON.stringify(saved) !== JSON.stringify(draft);
  const tileCount = draft.stats.filter((stat) =>
    TILE_STATS.includes(stat)
  ).length;

  const save = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/trainer/share-card", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { settings: ShareCardSettings };

      setSaved(body.settings);
      setDraft(body.settings);
      setMessage({ type: "success", text: "Ajustes de la tarjeta guardados." });
    } catch {
      setMessage({
        type: "error",
        text: "No se pudieron guardar los ajustes. Inténtalo de nuevo.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError) {
    return (
      <Alert
        color="danger"
        description="No pudimos cargar los ajustes de la tarjeta. Recarga la página."
        title="Error"
      />
    );
  }

  if (saved === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {message && (
        <Alert
          color={message.type === "success" ? "success" : "danger"}
          description={message.text}
          title={message.type === "success" ? "Guardado" : "Error"}
        />
      )}

      <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900">
            Tarjeta para compartir la sesión
          </h3>
          <p className="max-w-xl text-sm text-gray-600">
            Al terminar un entrenamiento, tus clientes pueden compartir una
            imagen con tu logo y los datos de la sesión en Instagram o WhatsApp.
          </p>
        </div>
        <Switch
          aria-label="Permitir que los clientes compartan la tarjeta"
          isSelected={draft.enabled}
          onValueChange={(enabled) => setDraft((d) => ({ ...d, enabled }))}
        />
      </div>

      <div
        className={`grid gap-8 lg:grid-cols-[1fr_300px] ${draft.enabled ? "" : "pointer-events-none opacity-50"}`}
      >
        <div className="space-y-8">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Estilo
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {STYLE_OPTIONS.map((option) => {
                const selected = draft.style === option.key;

                return (
                  <button
                    key={option.key}
                    aria-pressed={selected}
                    className={`flex flex-col gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                      selected
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, style: option.key }))
                    }
                  >
                    <span
                      className={`h-16 w-full rounded-lg ${option.swatch}`}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">
                        {option.title}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Datos que se muestran
            </h4>
            <CheckboxGroup
              aria-label="Datos que se muestran en la tarjeta"
              classNames={{ wrapper: "grid gap-2 sm:grid-cols-2" }}
              value={draft.stats}
              onValueChange={(values) =>
                setDraft((d) => ({
                  ...d,
                  // Orden canónico: el de la tarjeta, no el de los clics.
                  stats: SHARE_CARD_STATS.filter((stat) =>
                    values.includes(stat)
                  ),
                }))
              }
            >
              {SHARE_CARD_STATS.map((stat) => (
                <Checkbox key={stat} value={stat}>
                  {SHARE_CARD_STAT_LABELS[stat]}
                </Checkbox>
              ))}
            </CheckboxGroup>
            <p className="text-xs text-gray-500">
              Caben hasta 4 cifras grandes (volumen, series, cardio, ejercicios,
              repeticiones), en ese orden, y solo se muestran si el cliente
              tiene ese dato.
              {tileCount > 4
                ? ` Has marcado ${tileCount}: las últimas no entrarán.`
                : ""}
            </p>
          </section>
        </div>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Vista previa
          </h4>
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-[conic-gradient(#f3f4f6_25%,#fff_0_50%,#f3f4f6_0_75%,#fff_0)] bg-[length:16px_16px]">
            {previewSrc !== null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="Vista previa de la tarjeta con una sesión de ejemplo"
                className="block w-full"
                src={previewSrc}
                onError={() => setPreviewLoading(false)}
                onLoad={() => setPreviewLoading(false)}
              />
            ) : (
              <div className="aspect-[9/16] w-full" />
            )}
            {previewLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                <Spinner />
              </div>
            ) : null}
          </div>
          <p className="text-xs text-gray-500">
            Sesión de ejemplo con tu logo, tu nombre y tu color.
          </p>
        </section>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
        {isDirty ? (
          <span className="text-sm text-gray-500">Cambios sin guardar</span>
        ) : null}
        <Button
          className="bg-black text-white hover:bg-slate-800"
          isDisabled={!isDirty}
          isLoading={isSaving}
          size="lg"
          startContent={<Icon icon="solar:diskette-linear" />}
          onPress={save}
        >
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
}
