"use client";

// Aviso de novedad en Inicio (David, 28 oct): músculos en la biblioteca +
// asistente + lo que ganan (sus clientes comparten el entreno con el mapa).
// Patrón de Mobbin (Lovable, Quicken, Meetup): modal centrado una sola vez,
// imagen real del producto a la izquierda, beneficios y una acción clara a
// la derecha. La imagen es un ejercicio con sus músculos en el mapa, claro y
// grande (David: la historia oscura con logo no se leía). Solo sale si le
// faltan ejercicios por completar. Se abre sola la primera vez; después
// queda una franja en Inicio para volver a verla mientras falten.

import { Button, Chip, Modal, ModalBody, ModalContent } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { IconTile } from "@/components/shared/icon-tile";
import { MuscleMap } from "@/components/shared/muscle-map";
import { OutlineChip } from "@/components/shared/outline-chip";
import { type MuscleId, muscleLabel } from "@/lib/training/muscles";

const DISMISSED_KEY = "topcoach:trainer:muscles-announcement-v1";
/** Mismo valor que OPEN_REVIEW_KEY en exercise-library-content. */
const OPEN_REVIEW_KEY = "topcoach:trainer:open-muscle-review";
// Ejemplo del panel: un press banca etiquetado.
const EXAMPLE = {
  name: "Press banca plano",
  primary: ["pectoral"] as MuscleId[],
  secondary: ["deltoides_anterior", "triceps"] as MuscleId[],
};

const BENEFITS = [
  {
    icon: "solar:body-bold",
    title: "Músculos en cada ejercicio",
    text: "Marca el principal y los secundarios. Filtra tu biblioteca por músculo.",
  },
  {
    icon: "solar:magic-stick-3-linear",
    title: "El asistente los completa por ti",
    text: "Sugiere los músculos de toda tu biblioteca en segundos. Tú revisas y guardas.",
  },
  {
    icon: "solar:share-linear",
    title: "Tus clientes lo comparten con tu marca",
    text: "Al terminar un entreno publican el mapa de lo que trabajaron en Instagram.",
  },
] as const;

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Sin almacenamiento: volverá a salir, no pasa nada.
  }
}

export function MusclesAnnouncement() {
  const router = useRouter();
  const [missing, setMissing] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const seen = isDismissed();

    fetch("/api/exercises?limit=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((exercises) => {
        const count = Number(exercises?.missing_muscles ?? 0);

        if (cancelled || !exercises?.success || count === 0) return;
        setMissing(count);
        if (seen) return;
        // Un respiro tras cargar Inicio: que no salte encima de la página.
        window.setTimeout(() => !cancelled && setOpen(true), 700);
      })
      .catch(() => {
        // Sin datos no hay aviso; la biblioteca tiene su propio banner.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (missing === 0) return null;

  const close = () => {
    dismiss();
    setOpen(false);
  };

  const goToReview = () => {
    dismiss();
    setOpen(false);
    try {
      sessionStorage.setItem(OPEN_REVIEW_KEY, "1");
    } catch {
      // Sin almacenamiento: llega a la biblioteca con el banner.
    }
    router.push("/trainer/dashboard/exercise-library");
  };

  return (
    <>
      {/* Ya vista: franja discreta para volver a abrirla mientras falten. */}
      {!open && isDismissed() ? (
        <div className="flex flex-col gap-3 rounded-xl border border-default-200 bg-content1 px-4 py-3 sm:flex-row sm:items-center">
          <IconTile icon="solar:body-bold" size="sm" />
          <p className="min-w-0 flex-1 text-sm text-default-600">
            <span className="font-semibold text-foreground">
              Músculos en tu biblioteca.
            </span>{" "}
            {missing === 1
              ? "Te falta 1 ejercicio por completar."
              : `Te faltan ${missing} ejercicios por completar.`}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="light" onPress={() => setOpen(true)}>
              Ver novedad
            </Button>
            <Button
              color="primary"
              size="sm"
              startContent={
                <Icon icon="solar:magic-stick-3-linear" width={16} />
              }
              variant="flat"
              onPress={goToReview}
            >
              Completar con el asistente
            </Button>
          </div>
        </div>
      ) : null}
      <Modal
        backdrop="blur"
        classNames={{ base: "overflow-hidden", body: "p-0" }}
        isOpen={open}
        placement="center"
        size="3xl"
        onClose={close}
      >
        <ModalContent>
          <ModalBody>
            <div className="grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="flex flex-col items-center justify-center gap-4 bg-default-100 px-6 py-8">
                <div className="w-full max-w-[264px] rounded-2xl bg-content1 p-4 shadow-small">
                  <p className="text-sm font-semibold text-foreground">
                    {EXAMPLE.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {EXAMPLE.primary.map((id) => (
                      <span
                        key={id}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        {muscleLabel(id)}
                      </span>
                    ))}
                    {EXAMPLE.secondary.map((id) => (
                      <OutlineChip key={id} tone="muted">
                        {muscleLabel(id)}
                      </OutlineChip>
                    ))}
                  </div>
                  <MuscleMap
                    className="mt-4"
                    labels={false}
                    outlineWidth={1}
                    primary={EXAMPLE.primary}
                    secondary={EXAMPLE.secondary}
                  />
                </div>
                <p className="max-w-[240px] text-center text-xs text-default-500">
                  Principal en tu color, secundarios más claros. Así lo verán
                  también tus clientes al compartir su entreno.
                </p>
              </div>

              <div className="flex flex-col gap-5 px-6 py-7 sm:px-8">
                <div className="flex flex-col gap-2">
                  <Chip
                    className="self-start"
                    color="primary"
                    size="sm"
                    variant="flat"
                  >
                    Nuevo
                  </Chip>
                  <h2 className="text-2xl font-semibold leading-tight tracking-[-0.01em] text-foreground [text-wrap:balance]">
                    Tu biblioteca ahora sabe qué músculos trabaja cada ejercicio
                  </h2>
                </div>

                <ul className="flex flex-col gap-4">
                  {BENEFITS.map((benefit) => (
                    <li key={benefit.title} className="flex items-start gap-3">
                      <IconTile icon={benefit.icon} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {benefit.title}
                        </p>
                        <p className="mt-0.5 text-sm text-default-600">
                          {benefit.text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex flex-col gap-3 border-t border-default-200 pt-4">
                  <p className="text-sm text-default-600">
                    {missing === 1
                      ? "Te falta 1 ejercicio por completar."
                      : `Te faltan ${missing} ejercicios por completar.`}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button color="primary" onPress={goToReview}>
                      Completar con el asistente
                    </Button>
                    <Button variant="light" onPress={close}>
                      Ahora no
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
