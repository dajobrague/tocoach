"use client";

// "Compartir sesión" (llamada JC, 15 sep): abre una vista previa de la
// tarjeta (sticker transparente 4:5) que genera el servidor y la comparte con el menú nativo del
// móvil (Instagram, WhatsApp…). La imagen se descarga al abrir el modal, así
// el tap de "Compartir" llama a navigator.share con el File ya listo — el
// navegador exige que share() ocurra dentro del gesto, sin awaits previos.
// Donde no se puede compartir archivos (Firefox, escritorio, algunas PWA de
// iOS) queda "Guardar imagen" y mantener pulsada la vista previa.
//
// Instagram (David, 29 sep): un archivo compartido lo usa como FONDO de la
// historia y rellena lo transparente. Para que el sticker quede encima de la
// foto que el cliente elige en Instagram hay que hacer como Strava: copiar el
// PNG al portapapeles y pegarlo en la historia. Desde web no se puede
// preseleccionar la app del menú de compartir (eso es la API nativa de
// Stories, solo para apps nativas).

import {
  Button,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { type ReactNode, useEffect, useState } from "react";

import { ClientSheet } from "@/components/client-dashboard/client-sheet";
import { useTenant } from "@/components/tenant-provider";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { shareCardSettingsFromFeatures } from "@/lib/share-card/settings";

interface ShareSessionButtonProps {
  scheduledDate: string;
  sessionId: string;
  sessionName: string;
  /** Disparador propio (p.ej. el CTA del resumen de sesión). */
  trigger?: (open: () => void) => ReactNode;
}

type CardState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; file: File; url: string };

function fileName(sessionName: string, date: string): string {
  const slug = sessionName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "sesion"}-${date}.png`;
}

export function ShareSessionButton({
  scheduledDate,
  sessionId,
  sessionName,
  trigger,
}: ShareSessionButtonProps) {
  // El entrenador puede desactivarla (Ajustes → Marca → Tarjeta de sesión).
  const enabled = shareCardSettingsFromFeatures(useTenant()?.features).enabled;
  const [isOpen, setIsOpen] = useState(false);
  const [card, setCard] = useState<CardState>({ status: "loading" });
  const [shareFailed, setShareFailed] = useState(false);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (!isOpen) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    setCard({ status: "loading" });
    setShareFailed(false);
    setCopy("idle");
    clientFetch(
      `/api/client/scheduled-sessions/${scheduledDate}/share-card?sessionId=${encodeURIComponent(sessionId)}`,
      { cache: "no-store" }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();

        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setCard({
          status: "ready",
          file: new File([blob], fileName(sessionName, scheduledDate), {
            type: "image/png",
          }),
          url: objectUrl,
        });
      })
      .catch((error) => {
        console.warn("[ShareSession] card fetch failed:", error);
        if (!cancelled) setCard({ status: "error" });
      });

    return () => {
      cancelled = true;
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, scheduledDate, sessionId, sessionName]);

  const canShareFile =
    card.status === "ready" &&
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [card.file] });

  const share = () => {
    if (card.status !== "ready") return;
    // Solo el archivo: con text/url algunos destinos comparten el texto en
    // vez de la imagen.
    navigator.share({ files: [card.file] }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.warn("[ShareSession] share failed:", error);
      setShareFailed(true);
    });
  };

  const canCopyImage =
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined";

  // Dentro del gesto y sin awaits antes de write() (Safari lo exige).
  const copyForInstagram = () => {
    if (card.status !== "ready") return;
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": card.file })])
      .then(() => {
        setCopy("copied");
        // Abre la cámara de historias; si no hay Instagram no pasa nada.
        window.location.href = "instagram://story-camera";
      })
      .catch((error: unknown) => {
        console.warn("[ShareSession] clipboard failed:", error);
        setCopy("failed");
      });
  };

  const download = () => {
    if (card.status !== "ready") return;
    const link = document.createElement("a");

    link.href = card.url;
    link.download = card.file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (!enabled) return null;

  return (
    <>
      {trigger ? (
        trigger(() => setIsOpen(true))
      ) : (
        <Button
          className="shrink-0"
          color="success"
          size="sm"
          startContent={<Icon icon="solar:share-linear" width={16} />}
          variant="flat"
          onPress={() => setIsOpen(true)}
        >
          Compartir
        </Button>
      )}

      <ClientSheet isOpen={isOpen} size="sm" onClose={() => setIsOpen(false)}>
        <ModalContent>
          <ModalHeader className="font-heading">Comparte tu sesión</ModalHeader>
          <ModalBody className="items-center">
            {card.status === "loading" ? (
              <div className="flex aspect-[4/5] w-full max-w-[260px] items-center justify-center rounded-xl bg-default-100">
                <Spinner />
              </div>
            ) : card.status === "error" ? (
              <p className="py-8 text-center text-sm text-default-600">
                No pudimos generar la imagen. Cierra y vuelve a intentarlo.
              </p>
            ) : (
              <>
                {/* Fondo tipo foto solo en la vista previa: la imagen es
                    transparente (sticker) y sobre el modal no se leería. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`Resumen de ${sessionName}`}
                  className="h-auto w-full max-w-[260px] rounded-xl bg-gradient-to-br from-[#d9c7a8] via-[#8a8f8c] to-[#3b4a5a] shadow-md"
                  src={card.url}
                />
                {copy === "copied" ? (
                  <ol className="list-decimal space-y-1 pl-5 text-xs text-default-600">
                    <li>En Instagram, crea una historia con tu foto.</li>
                    <li>
                      Toca «Añadir sticker» o pulsa en la pantalla y elige
                      «Pegar».
                    </li>
                    <li>Colócalo donde quieras y etiqueta a tu entrenador.</li>
                  </ol>
                ) : (
                  <p className="text-center text-xs text-default-500">
                    {copy === "failed"
                      ? "No se pudo copiar. Guarda la imagen y añádela como sticker desde tu galería."
                      : "Copia el sticker y pégalo en tu historia de Instagram, encima de tu foto."}
                  </p>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter className="flex-col gap-2 sm:flex-row">
            {canCopyImage ? (
              <Button
                fullWidth
                color="primary"
                isDisabled={card.status !== "ready"}
                startContent={<Icon icon="mdi:instagram" width={18} />}
                onPress={copyForInstagram}
              >
                {copy === "copied"
                  ? "Copiado · Abrir Instagram"
                  : "Copiar sticker para Instagram"}
              </Button>
            ) : null}
            {canShareFile && !shareFailed ? (
              <Button
                fullWidth
                startContent={<Icon icon="solar:share-linear" width={18} />}
                variant="flat"
                onPress={share}
              >
                Otras apps
              </Button>
            ) : null}
            <Button
              fullWidth
              isDisabled={card.status !== "ready"}
              startContent={<Icon icon="solar:download-linear" width={18} />}
              variant="flat"
              onPress={download}
            >
              Guardar imagen
            </Button>
          </ModalFooter>
        </ModalContent>
      </ClientSheet>
    </>
  );
}
