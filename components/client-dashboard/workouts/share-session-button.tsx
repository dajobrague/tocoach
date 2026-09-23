"use client";

// "Compartir sesión" (llamada JC, 15 sep): abre una vista previa de la
// tarjeta (sticker transparente 4:5) que genera el servidor y la comparte con el menú nativo del
// móvil (Instagram, WhatsApp…). La imagen se descarga al abrir el modal, así
// el tap de "Compartir" llama a navigator.share con el File ya listo — el
// navegador exige que share() ocurra dentro del gesto, sin awaits previos.
// Donde no se puede compartir archivos (Firefox, escritorio, algunas PWA de
// iOS) queda "Guardar imagen" y mantener pulsada la vista previa.

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { useTenant } from "@/components/tenant-provider";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { shareCardSettingsFromFeatures } from "@/lib/share-card/settings";

interface ShareSessionButtonProps {
  scheduledDate: string;
  sessionId: string;
  sessionName: string;
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
}: ShareSessionButtonProps) {
  // El entrenador puede desactivarla (Ajustes → Marca → Tarjeta de sesión).
  const enabled = shareCardSettingsFromFeatures(useTenant()?.features).enabled;
  const [isOpen, setIsOpen] = useState(false);
  const [card, setCard] = useState<CardState>({ status: "loading" });
  const [shareFailed, setShareFailed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    setCard({ status: "loading" });
    setShareFailed(false);
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

      <Modal
        isOpen={isOpen}
        placement="center"
        scrollBehavior="inside"
        size="sm"
        onClose={() => setIsOpen(false)}
      >
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
                <p className="text-center text-xs text-default-500">
                  {shareFailed || !canShareFile
                    ? "También puedes mantener pulsada la imagen para guardarla."
                    : "Súbela a tus historias y etiqueta a tu entrenador."}
                </p>
              </>
            )}
          </ModalBody>
          <ModalFooter className="flex-col gap-2 sm:flex-row">
            {canShareFile && !shareFailed ? (
              <Button
                fullWidth
                color="primary"
                startContent={<Icon icon="solar:share-bold" width={18} />}
                onPress={share}
              >
                Compartir
              </Button>
            ) : null}
            <Button
              fullWidth
              isDisabled={card.status !== "ready"}
              startContent={<Icon icon="solar:download-linear" width={18} />}
              variant={canShareFile && !shareFailed ? "flat" : "solid"}
              onPress={download}
            >
              Guardar imagen
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
