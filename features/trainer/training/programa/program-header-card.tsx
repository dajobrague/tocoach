"use client";

// Cabecera del programa seleccionado: nombre con rename inline (patrón de
// cycle-summary-card), chips de estado y categoría, fecha de inicio, menú ⋮
// (Editar / Guardar como plantilla / Eliminar) y strip de métricas hairline.

import type { WorkoutProgram } from "./training-api";

import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useRef, useState } from "react";

import {
  CATEGORY_VISUAL,
  formatDateEs,
  programCategory,
  programStatus,
} from "./programa-format";

interface ProgramHeaderCardProps {
  program: WorkoutProgram;
  /** Duración actual del microciclo (para la métrica "Microciclo"). */
  microcycleDays: number;
  isUpdating: boolean;
  updateError: string | null;
  onRename: (name: string) => void;
  /** Desactivar el programa (status → paused) tras confirmación. */
  onDeactivate: () => void;
  /** Reactivar un programa pausado (status → active), sin confirmación. */
  onReactivate: () => void;
  isDeactivating: boolean;
  onEdit: () => void;
  onSaveAsTemplate: () => void;
  onDelete: () => void;
}

export function ProgramHeaderCard({
  program,
  microcycleDays,
  isUpdating,
  updateError,
  onDeactivate,
  onReactivate,
  isDeactivating,
  onRename,
  onEdit,
  onSaveAsTemplate,
  onDelete,
}: ProgramHeaderCardProps) {
  const category = programCategory(program);
  const visual = CATEGORY_VISUAL[category];
  const status = programStatus(program.status);

  const [editingName, setEditingName] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  // Se marca en Escape para que el blur del input no committee el cambio.
  const cancelName = useRef(false);

  const exerciseCount = useMemo(
    () =>
      program.sessions.reduce(
        (total, session) => total + session.exercises.length,
        0
      ),
    [program.sessions]
  );

  const startEditName = () => {
    setNameDraft(program.name);
    setEditingName(true);
  };

  const commitName = () => {
    const next = nameDraft.trim();

    if (next.length > 0 && next !== program.name) onRename(next);
    setEditingName(false);
  };

  const metrics: Array<{ label: string; value: string }> = [
    {
      label: "Sesiones",
      value: String(program.sessions.length),
    },
    {
      label: "Microciclo",
      value: `${microcycleDays} ${microcycleDays === 1 ? "día" : "días"}`,
    },
    {
      label: "Ejercicios",
      value: String(exerciseCount),
    },
    {
      label: "Inicio",
      value: formatDateEs(program.assignedDate),
    },
  ];

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${visual.square}`}
            >
              <Icon icon={visual.icon} width={24} />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {editingName ? (
                  <input
                    autoFocus
                    aria-label="Nombre del programa"
                    className="min-w-0 rounded-medium border border-blue-400 bg-white px-2 py-0.5 text-base font-bold text-gray-900 outline-none"
                    value={nameDraft}
                    onBlur={() => {
                      if (cancelName.current) {
                        cancelName.current = false;
                        setEditingName(false);

                        return;
                      }
                      commitName();
                    }}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      else if (event.key === "Escape") {
                        cancelName.current = true;
                        event.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <button
                    className="group/name -mx-1.5 flex min-w-0 items-center gap-1.5 rounded-medium px-1.5 py-0.5 text-left transition-colors hover:bg-gray-100"
                    title="Editar nombre"
                    type="button"
                    onClick={startEditName}
                  >
                    <h2 className="truncate text-base font-bold text-gray-900 decoration-gray-300 decoration-dotted underline-offset-4 group-hover/name:underline">
                      {program.name}
                    </h2>
                    <Icon
                      className="shrink-0 text-default-400 transition-colors group-hover/name:text-default-700"
                      icon="solar:pen-linear"
                      width={14}
                    />
                  </button>
                )}
                {program.status === "active" ? (
                  <button
                    className="group/status"
                    title="Desactivar programa"
                    type="button"
                    onClick={() => setDeactivateOpen(true)}
                  >
                    <Chip
                      className="cursor-pointer transition-opacity group-hover/status:opacity-80"
                      color={status.color}
                      endContent={
                        <Icon icon="solar:alt-arrow-down-linear" width={11} />
                      }
                      size="sm"
                      variant="flat"
                    >
                      {status.label}
                    </Chip>
                  </button>
                ) : (
                  <>
                    <Chip color={status.color} size="sm" variant="flat">
                      {status.label}
                    </Chip>
                    {/* Reactivación directa (llamada 29 Jul): pausar ya no es
                        un viaje sin retorno. Sin confirmación — es reversible
                        con el mismo botón de desactivar. */}
                    {program.status === "paused" ? (
                      <Button
                        color="success"
                        isLoading={isDeactivating}
                        size="sm"
                        startContent={
                          isDeactivating ? null : (
                            <Icon icon="solar:play-circle-linear" width={14} />
                          )
                        }
                        variant="flat"
                        onPress={onReactivate}
                      >
                        Activar
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
              <p className="text-xs text-default-500">
                {program.type}
                {category === "strength" && program.division.length > 0
                  ? ` · ${program.division}`
                  : ""}
                {` · desde ${formatDateEs(program.assignedDate)}`}
              </p>
            </div>
          </div>

          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                isIconOnly
                aria-label="Acciones del programa"
                isDisabled={isUpdating}
                size="sm"
                variant="light"
              >
                <Icon icon="solar:menu-dots-bold" width={18} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Acciones del programa"
              onAction={(key) => {
                if (key === "edit") onEdit();
                else if (key === "template") onSaveAsTemplate();
                else if (key === "delete") onDelete();
              }}
            >
              <DropdownItem
                key="edit"
                startContent={<Icon icon="solar:pen-linear" width={16} />}
              >
                Editar
              </DropdownItem>
              <DropdownItem
                key="template"
                startContent={<Icon icon="solar:diskette-linear" width={16} />}
              >
                Guardar como plantilla
              </DropdownItem>
              <DropdownItem
                key="delete"
                className="text-danger"
                color="danger"
                startContent={
                  <Icon icon="solar:trash-bin-trash-linear" width={16} />
                }
              >
                Eliminar
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-large border border-gray-100 bg-gray-100 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex flex-col gap-0.5 bg-white p-3"
            >
              <span className="text-[11px] font-medium text-default-500">
                {metric.label}
              </span>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {metric.value}
              </span>
            </div>
          ))}
        </div>

        {updateError !== null && (
          <div className="flex items-center gap-2 rounded-large border border-danger-200 bg-danger-50 p-2.5 text-sm text-danger-700">
            <Icon icon="solar:danger-bold" width={16} />
            {updateError}
          </div>
        )}
      </CardBody>

      {/* Confirmación de desactivado: el programa desaparece de esta vista
          y el cliente deja de verlo. */}
      <Modal
        isOpen={deactivateOpen}
        placement="center"
        size="sm"
        onClose={() => setDeactivateOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Icon icon="solar:pause-circle-linear" width={18} />
            </span>
            Desactivar programa
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              <span className="font-semibold text-gray-900">
                {program.name}
              </span>{" "}
              pasará a pausado: tu cliente dejará de verlo en su app y quedará
              en la sección &ldquo;Pausados&rdquo; del selector, desde donde
              puedes reactivarlo. Las sesiones, ejercicios e historial se
              conservan.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={isDeactivating}
              variant="light"
              onPress={() => setDeactivateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              color="warning"
              isLoading={isDeactivating}
              onPress={() => {
                // Cerrar ANTES de mutar: la card no lleva `key` por programa,
                // así que un modal abierto sobrevive al cambio de selección y
                // quedaría apuntando al programa de fallback tras el pause
                // (segundo clic = pausar el programa equivocado). El error, si
                // lo hay, se muestra en la franja updateError de la card.
                setDeactivateOpen(false);
                onDeactivate();
              }}
            >
              Desactivar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
