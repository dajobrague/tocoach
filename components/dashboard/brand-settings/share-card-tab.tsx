"use client";

// Ajustes → Marca → "Compartir entrenos" (JC, 14 oct): el cliente compone su
// imagen (plantilla, fondo, datos, color); el entrenador solo firma. Aquí
// decide si se puede compartir, su nombre, su Instagram y el pie
// "topcoach.io". La vista previa usa las mismas plantillas que el cliente
// con una sesión de ejemplo, dibujadas en el navegador.

import type { ShareCardSettings } from "@/lib/share-card/settings";

import { Alert, Button, Input, Skeleton, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { ensureShareFonts } from "@/components/share-card/fonts";
import { Sticker, type TemplateId } from "@/components/share-card/sticker";
import {
  SAMPLE_SESSION,
  SESSION_STATS,
  type ShareBranding,
  pickStats,
} from "@/lib/share-card/session-data";
import { sessionMuscles, useShareBody } from "@/lib/hooks/use-share-body";
import { DEFAULT_SHARE_CARD_SETTINGS } from "@/lib/share-card/settings";

interface Branding {
  trainerName: string;
  brandColor: string | null;
  logoSrc: string | null;
}

// Damero oscuro: el sticker es transparente y va sobre la foto del cliente.
const CHECKER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect width='24' height='24' fill='%233a3a3a'/%3E%3Crect width='12' height='12' fill='%234a4a4a'/%3E%3Crect x='12' y='12' width='12' height='12' fill='%234a4a4a'/%3E%3C/svg%3E")`;

const PREVIEWS: { id: TemplateId; name: string }[] = [
  { id: "datos", name: "Datos" },
  { id: "musculos", name: "Músculos" },
  { id: "record", name: "Récord" },
];

const SAMPLE_MUSCLES = sessionMuscles(SAMPLE_SESSION.exercises);

const SAMPLE_STATS = pickStats(
  SESSION_STATS,
  ["duration", "volume", "sets"],
  SAMPLE_SESSION
);

export default function ShareCardTab() {
  const [saved, setSaved] = useState<ShareCardSettings | null>(null);
  const [draft, setDraft] = useState<ShareCardSettings>(
    DEFAULT_SHARE_CARD_SETTINGS
  );
  const [branding, setBranding] = useState<Branding | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const body = useShareBody(SAMPLE_MUSCLES);
  const [loadError, setLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    void ensureShareFonts().then(() => setFontsReady(true));
    fetch("/api/trainer/share-card", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as {
          settings: ShareCardSettings;
          branding: Branding;
        };

        setSaved(body.settings);
        setDraft(body.settings);
        setBranding(body.branding);
      })
      .catch(() => setLoadError(true));
  }, []);

  const isDirty =
    saved !== null && JSON.stringify(saved) !== JSON.stringify(draft);
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
      setMessage({ type: "success", text: "Ajustes guardados." });
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
        description="No pudimos cargar los ajustes. Recarga la página."
        title="Error"
      />
    );
  }

  if (saved === null || branding === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  const previewBranding: ShareBranding = {
    name: draft.displayName || branding.trainerName,
    instagram: draft.instagram,
    brandColor: branding.brandColor,
    logoSrc: branding.logoSrc,
    showTopcoach: draft.showTopcoach,
    footer: draft.footer,
  };

  return (
    <div className="space-y-8">
      {message && (
        <Alert
          color={message.type === "success" ? "success" : "danger"}
          description={message.text}
          title={message.type === "success" ? "Guardado" : "Error"}
        />
      )}

      <div className="flex items-start justify-between gap-4 rounded-xl border border-default-200 bg-content1 p-5">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            Tus clientes comparten sus entrenos
          </h3>
          <p className="max-w-xl text-sm text-default-600">
            Al terminar una sesión o un ejercicio, el cliente crea su imagen
            para Instagram: elige la plantilla, el fondo (su foto, su vídeo o un
            color) y los datos. Tú solo pones tu firma, que sale siempre.
          </p>
        </div>
        <Switch
          aria-label="Permitir que los clientes compartan sus entrenos"
          isSelected={draft.enabled}
          onValueChange={(enabled) => setDraft((d) => ({ ...d, enabled }))}
        />
      </div>

      <div
        className={`grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] ${draft.enabled ? "" : "pointer-events-none opacity-50"}`}
      >
        <section className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Tu firma</h4>
          <Input
            description="Vacío = el nombre de tu marca."
            id="share-card-display-name"
            label="Nombre"
            labelPlacement="outside"
            maxLength={40}
            placeholder={branding.trainerName}
            value={draft.displayName}
            onValueChange={(displayName) =>
              setDraft((d) => ({ ...d, displayName }))
            }
          />
          <Input
            description="Se muestra debajo de tu nombre."
            id="share-card-instagram"
            label="Instagram"
            labelPlacement="outside"
            placeholder="tu.usuario"
            startContent={<span className="text-sm text-default-400">@</span>}
            value={draft.instagram}
            onValueChange={(value) =>
              setDraft((d) => ({
                ...d,
                // Solo lo que admite un usuario de Instagram.
                instagram: value
                  .trim()
                  .replace(/^@/, "")
                  .replace(/[^A-Za-z0-9._]/g, "")
                  .slice(0, 30),
              }))
            }
          />
          <Switch
            isSelected={draft.showTopcoach}
            size="sm"
            onValueChange={(showTopcoach) =>
              setDraft((d) => ({ ...d, showTopcoach }))
            }
          >
            <span className="text-sm text-default-700">Mostrar pie</span>
          </Switch>
          {draft.showTopcoach && (
            <Input
              description="Por ejemplo, el nombre de tu programa. Vacío = topcoach.io."
              id="share-card-footer"
              label="Pie de imagen"
              labelPlacement="outside"
              maxLength={40}
              placeholder="topcoach.io"
              value={draft.footer}
              onValueChange={(footer) => setDraft((d) => ({ ...d, footer }))}
            />
          )}
          <p className="flex items-start gap-2 rounded-lg bg-default-100 p-3 text-xs text-default-600">
            <Icon
              className="mt-0.5 shrink-0"
              icon="solar:palette-linear"
              width={16}
            />
            El logo y el color salen de tu marca (Ajustes → Marca).
          </p>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            Vista previa
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {PREVIEWS.map((preview) => (
              <figure key={preview.id} className="m-0 space-y-1.5">
                <div
                  className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-xl"
                  style={{
                    backgroundImage: CHECKER,
                    backgroundSize: "16px 16px",
                  }}
                >
                  {fontsReady ? (
                    <Sticker
                      body={body}
                      branding={previewBranding}
                      className="h-auto w-[86%]"
                      exercise={null}
                      id={`trainer-${preview.id}`}
                      ink="white"
                      mapMode="auto"
                      session={SAMPLE_SESSION}
                      shadow={false}
                      stats={SAMPLE_STATS}
                      template={preview.id}
                      onBrandBg={false}
                    />
                  ) : null}
                </div>
                <figcaption className="text-center text-xs text-default-500">
                  {preview.name}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="text-xs text-default-500">
            Sesión de ejemplo. El cliente elige entre estas y otras plantillas,
            y puede compartir también un solo ejercicio.
          </p>
        </section>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-default-200 pt-6">
        {isDirty ? (
          <span className="text-sm text-default-500">Cambios sin guardar</span>
        ) : null}
        <Button
          color="primary"
          isDisabled={!isDirty}
          isLoading={isSaving}
          startContent={<Icon icon="solar:diskette-linear" />}
          onPress={save}
        >
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
