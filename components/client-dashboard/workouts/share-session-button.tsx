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
import { useEffect, useState } from "react";

import { ClientSheet } from "@/components/client-dashboard/client-sheet";
import { useTenant } from "@/components/tenant-provider";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { shareCardSettingsFromFeatures } from "@/lib/share-card/settings";

interface ShareSessionButtonProps {
  scheduledDate: string;
  sessionId: string;
  sessionName: string;
  /** Sobre la superficie de marca (card de sesión): botón ancho invertido. */
  inverted?: boolean;
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
  inverted = false,
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
      <Button
        // Invertido: texto con la marca cruda (no .text-primary, que con
        // marcas pálidas es una tinta oscurecida para el lienzo claro).
        className={
          inverted
            ? "w-full bg-primary-foreground font-semibold text-[hsl(var(--heroui-primary))]"
            : "shrink-0"
        }
        color={inverted ? "default" : "primary"}
        size={inverted ? "md" : "sm"}
        startContent={
          <Icon icon="solar:share-linear" width={inverted ? 18 : 16} />
        }
        variant={inverted ? "solid" : "flat"}
        onPress={() => setIsOpen(true)}
      >
        Compartir
      </Button>

      <ClientSheet isOpen={isOpen} size="sm" onClose={() => setIsOpen(false)}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            <span className="font-heading text-lg">Comparte tu sesión</span>
            <span className="text-sm font-normal text-default-500">
              Pon tu entreno en tus historias de Instagram
            </span>
          </ModalHeader>
          <ModalBody className="gap-5">
            {/* Vista previa con forma de historia (9:16): el sticker es
                transparente, así que va sobre un fondo tipo foto para que se
                entienda cómo quedará encima de la foto del cliente. */}
            <div className="mx-auto w-full max-w-[220px]">
              <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#d9c7a8] via-[#8a8f8c] to-[#3b4a5a] shadow-medium ring-4 ring-default-100">
                {/* Barra de progreso de historia, solo decorativa */}
                <div className="absolute inset-x-3 top-3 h-0.5 rounded-full bg-white/50" />
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  {card.status === "loading" ? (
                    <Spinner color="white" />
                  ) : card.status === "error" ? (
                    <p className="px-2 text-center text-sm text-white">
                      No pudimos generar la imagen. Cierra y vuelve a
                      intentarlo.
                    </p>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={`Resumen de ${sessionName}`}
                      className="h-auto w-full drop-shadow-lg"
                      src={card.url}
                    />
                  )}
                </div>
              </div>
            </div>

            {card.status === "ready" ? (
              <ShareSteps
                copied={copy === "copied"}
                copyFailed={copy === "failed"}
                viaClipboard={canCopyImage}
              />
            ) : null}
          </ModalBody>
          <ModalFooter className="flex-col gap-2">
            {canCopyImage ? (
              // Degradado oficial de Instagram: el botón se reconoce de un
              // vistazo. Color fijo (no del tema), texto blanco legible.
              <Button
                fullWidth
                className="bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] font-semibold text-white"
                isDisabled={card.status !== "ready"}
                size="lg"
                startContent={<Icon icon="mdi:instagram" width={22} />}
                onPress={copyForInstagram}
              >
                {copy === "copied"
                  ? "Copiado · Abrir Instagram"
                  : "Copiar sticker para Instagram"}
              </Button>
            ) : null}
            <div className="flex w-full gap-2">
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
            </div>
          </ModalFooter>
        </ModalContent>
      </ClientSheet>
    </>
  );
}

/**
 * Cómo pegar el sticker en una historia de Instagram, siempre visible. Con
 * portapapeles: copiar → foto → «Añadir sticker»/«Pegar» → colocar. Sin él
 * (o si falló la copia): guardar la imagen y añadirla desde la galería.
 */
function ShareSteps({
  viaClipboard,
  copied,
  copyFailed,
}: {
  viaClipboard: boolean;
  copied: boolean;
  copyFailed: boolean;
}) {
  const clipboard = viaClipboard && !copyFailed;
  const steps: { icon: string; text: string; done?: boolean }[] = clipboard
    ? [
        {
          icon: "solar:copy-linear",
          text: "Toca «Copiar sticker». Se abrirá Instagram.",
          done: copied,
        },
        {
          icon: "solar:camera-linear",
          text: "Haz o elige la foto de tu historia.",
        },
        {
          icon: "solar:sticker-smile-square-linear",
          text: "Toca «Añadir sticker» o mantén pulsada la pantalla y elige «Pegar».",
        },
        {
          icon: "solar:hand-shake-linear",
          text: "Colócalo donde quieras y etiqueta a tu entrenador.",
        },
      ]
    : [
        {
          icon: "solar:download-linear",
          text: "Toca «Guardar imagen».",
        },
        {
          icon: "solar:camera-linear",
          text: "En Instagram, crea una historia con tu foto.",
        },
        {
          icon: "solar:gallery-add-linear",
          text: "Toca el icono de sticker, elige «Galería» y añade la imagen.",
        },
        {
          icon: "solar:hand-shake-linear",
          text: "Colócala donde quieras y etiqueta a tu entrenador.",
        },
      ];

  return (
    <div>
      {copyFailed ? (
        <p className="mb-2 text-xs text-danger">
          No se pudo copiar. Puedes guardarla y añadirla desde tu galería:
        </p>
      ) : null}
      <ol className="space-y-2.5">
        {steps.map((step, i) => (
          <li key={step.text} className="flex items-start gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done
                  ? "bg-success text-success-foreground"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {step.done ? (
                <Icon aria-hidden icon="solar:check-read-linear" width={16} />
              ) : (
                i + 1
              )}
            </span>
            <span className="flex flex-1 items-start gap-2 pt-1 text-sm text-default-700">
              <Icon
                aria-hidden
                className="mt-0.5 shrink-0 text-default-400"
                icon={step.icon}
                width={16}
              />
              {step.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
