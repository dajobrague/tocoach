"use client";

// Modales de ciclo de vida del programa: crear (con selector de plantilla),
// editar, eliminar (confirm) y guardar como plantilla. Todos pequeños,
// centrados, con errores inline — sin alert/confirm nativos.

import type {
  CreateProgramInput,
  ProgramCategory,
  WorkoutProgram,
} from "./training-api";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { programCategory } from "./programa-format";
import { useProgramMutations, useProgramTemplates } from "./use-training";

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-large border border-danger-200 bg-danger-50 p-2.5 text-sm text-danger-700">
      <Icon icon="solar:danger-bold" width={16} />
      {message}
    </div>
  );
}

interface ProgramFormState {
  name: string;
  category: ProgramCategory;
  type: string;
  division: string;
  goal: string;
  startDate: string;
  sessionsPerWeek: string;
  notes: string;
}

const EMPTY_FORM: ProgramFormState = {
  name: "",
  category: "strength",
  type: "",
  division: "",
  goal: "",
  startDate: "",
  sessionsPerWeek: "3",
  notes: "",
};

function formIsValid(form: ProgramFormState): boolean {
  const perWeek = Number(form.sessionsPerWeek);

  return (
    form.name.trim().length > 0 &&
    form.type.trim().length > 0 &&
    form.startDate.length > 0 &&
    Number.isInteger(perWeek) &&
    perWeek >= 1 &&
    perWeek <= 7 &&
    (form.category === "cardio" || form.division.trim().length > 0)
  );
}

function formToInput(form: ProgramFormState): CreateProgramInput {
  return {
    name: form.name.trim(),
    type: form.type.trim(),
    category: form.category,
    startDate: form.startDate,
    sessionsPerWeek: Number(form.sessionsPerWeek),
    ...(form.category === "strength" && form.division.trim().length > 0
      ? { division: form.division.trim() }
      : {}),
    ...(form.category === "cardio" && form.goal.trim().length > 0
      ? { goal: form.goal.trim() }
      : {}),
    ...(form.notes.trim().length > 0 ? { notes: form.notes.trim() } : {}),
  };
}

/** Campos compartidos entre crear y editar. */
function ProgramFormFields({
  form,
  isDisabled,
  onChange,
}: {
  form: ProgramFormState;
  isDisabled: boolean;
  onChange: (patch: Partial<ProgramFormState>) => void;
}) {
  return (
    <>
      <Input
        isRequired
        isDisabled={isDisabled}
        label="Nombre"
        placeholder="Ej: Full Body - Fase 1"
        value={form.name}
        variant="bordered"
        onValueChange={(name) => onChange({ name })}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          disallowEmptySelection
          isRequired
          isDisabled={isDisabled}
          label="Categoría"
          selectedKeys={[form.category]}
          variant="bordered"
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0];

            if (key === "strength" || key === "cardio") {
              onChange({ category: key });
            }
          }}
        >
          <SelectItem key="strength">Fuerza</SelectItem>
          <SelectItem key="cardio">Cardio</SelectItem>
        </Select>
        <Input
          isRequired
          isDisabled={isDisabled}
          label="Tipo"
          placeholder="Ej: Hipertrofia, HIIT..."
          value={form.type}
          variant="bordered"
          onValueChange={(type) => onChange({ type })}
        />
      </div>
      {form.category === "strength" ? (
        <Input
          isRequired
          isDisabled={isDisabled}
          label="División"
          placeholder="Ej: Full Body, Push/Pull/Legs..."
          value={form.division}
          variant="bordered"
          onValueChange={(division) => onChange({ division })}
        />
      ) : (
        <Input
          isDisabled={isDisabled}
          label="Objetivo"
          placeholder="Ej: Mejorar resistencia cardiovascular"
          value={form.goal}
          variant="bordered"
          onValueChange={(goal) => onChange({ goal })}
        />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          isRequired
          isDisabled={isDisabled}
          label="Fecha de inicio"
          type="date"
          value={form.startDate}
          variant="bordered"
          onValueChange={(startDate) => onChange({ startDate })}
        />
        <Input
          isRequired
          isDisabled={isDisabled}
          label="Sesiones por semana"
          max={7}
          min={1}
          type="number"
          value={form.sessionsPerWeek}
          variant="bordered"
          onValueChange={(sessionsPerWeek) => onChange({ sessionsPerWeek })}
        />
      </div>
      <Textarea
        isDisabled={isDisabled}
        label="Notas (opcional)"
        minRows={2}
        value={form.notes}
        variant="bordered"
        onValueChange={(notes) => onChange({ notes })}
      />
    </>
  );
}

// ─── Crear ──────────────────────────────────────────────────────────────────

export function CreateProgramModal({
  isOpen,
  clientId,
  focusTemplates,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  clientId: string;
  /** true cuando se abre desde "Usar una plantilla" del empty state. */
  focusTemplates: boolean;
  onClose: () => void;
  onCreated: (programId: string) => void;
}) {
  const { createProgram } = useProgramMutations(clientId);
  const [form, setForm] = useState<ProgramFormState>(EMPTY_FORM);
  const [templateId, setTemplateId] = useState<string>("");
  const { templates, isLoading: templatesLoading } = useProgramTemplates(
    form.category
  );

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setTemplateId("");
      createProgram.reset();
    }
  }, [isOpen]);

  const patch = (next: Partial<ProgramFormState>) => {
    // Cambiar de categoría deja la plantilla elegida fuera de la lista del
    // Select; sin este reset el POST seguiría clonando la plantilla de la
    // otra categoría aunque el campo se vea vacío.
    if (next.category !== undefined && next.category !== form.category) {
      setTemplateId("");
    }
    setForm((prev) => ({ ...prev, ...next }));
  };

  const submit = () => {
    if (formIsValid(form) === false || createProgram.isPending) return;
    createProgram.mutate(
      {
        ...formToInput(form),
        ...(templateId.length > 0 ? { templateId } : {}),
      },
      {
        onSuccess: (refs) => {
          onCreated(refs.programId);
          onClose();
        },
      }
    );
  };

  return (
    <Modal
      isDismissable={createProgram.isPending === false}
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon
            className="text-gray-700"
            icon="solar:add-circle-bold"
            width={20}
          />
          Nuevo programa
        </ModalHeader>
        <ModalBody className="gap-4">
          <Select
            autoFocus={focusTemplates}
            isDisabled={createProgram.isPending}
            isLoading={templatesLoading}
            label="Empezar desde plantilla (opcional)"
            placeholder={
              templates.length === 0
                ? "No hay plantillas para esta categoría"
                : "Selecciona una plantilla"
            }
            selectedKeys={templateId.length > 0 ? [templateId] : []}
            variant="bordered"
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0];
              const template = templates.find((t) => t.id === key);

              if (template === undefined) {
                setTemplateId("");

                return;
              }
              setTemplateId(template.id);
              setForm((prev) => ({
                ...prev,
                name: template.name,
                type: template.type,
                category: template.category,
                division: template.division ?? "",
                goal: template.goal ?? "",
                sessionsPerWeek: String(template.sessionsPerWeek ?? 3),
              }));
            }}
          >
            {templates.map((template) => (
              <SelectItem key={template.id} textValue={template.name}>
                {template.name} ({template.sessionCount} sesiones,{" "}
                {template.exerciseCount} ejercicios)
              </SelectItem>
            ))}
          </Select>
          <ProgramFormFields
            form={form}
            isDisabled={createProgram.isPending}
            onChange={patch}
          />
          {createProgram.isError && (
            <ErrorNote
              message={
                createProgram.error instanceof Error
                  ? createProgram.error.message
                  : "No se pudo crear el programa"
              }
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={createProgram.isPending}
            variant="light"
            onPress={onClose}
          >
            Cancelar
          </Button>
          <Button
            className="bg-slate-900 text-white"
            isDisabled={formIsValid(form) === false}
            isLoading={createProgram.isPending}
            onPress={submit}
          >
            Crear programa
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Editar ─────────────────────────────────────────────────────────────────

export function EditProgramModal({
  isOpen,
  clientId,
  program,
  onClose,
}: {
  isOpen: boolean;
  clientId: string;
  program: WorkoutProgram | null;
  onClose: () => void;
}) {
  const { updateProgram } = useProgramMutations(clientId);
  const [form, setForm] = useState<ProgramFormState>(EMPTY_FORM);
  // El PUT actual no acepta `status` (UpdateProgramInput no lo incluye y la
  // ruta lo ignora, igual que en el tab viejo); el Select queda como estado
  // visual hasta que el backend lo soporte.
  const [status, setStatus] = useState("active");

  useEffect(() => {
    if (isOpen === false || program === null) return;
    setForm({
      name: program.name,
      category: programCategory(program),
      type: program.type,
      division: program.division,
      goal: (program as { goal?: string }).goal ?? "",
      startDate: program.assignedDate.slice(0, 10),
      sessionsPerWeek: String(program.sessionsPerWeek),
      notes: program.notes ?? "",
    });
    setStatus(program.status);
    updateProgram.reset();
  }, [isOpen, program]);

  const patch = (next: Partial<ProgramFormState>) =>
    setForm((prev) => ({ ...prev, ...next }));

  const submit = () => {
    if (
      program === null ||
      formIsValid(form) === false ||
      updateProgram.isPending
    ) {
      return;
    }
    updateProgram.mutate(
      { programId: program.programId, input: formToInput(form) },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal
      isDismissable={updateProgram.isPending === false}
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon className="text-gray-700" icon="solar:pen-linear" width={20} />
          Editar programa
        </ModalHeader>
        <ModalBody className="gap-4">
          <ProgramFormFields
            form={form}
            isDisabled={updateProgram.isPending}
            onChange={patch}
          />
          {/* Solo lectura: el PUT no acepta status (reconstruye metadata) y
              este Select era un no-op silencioso. El camino real es el chip
              de estado del header card (PATCH dedicado). */}
          <Select
            isDisabled
            description="Para activar o pausar el programa usa el chip de estado en la cabecera."
            label="Estado"
            selectedKeys={[status]}
            variant="bordered"
          >
            <SelectItem key="active">Activo</SelectItem>
            <SelectItem key="paused">Pausado</SelectItem>
            <SelectItem key="completed">Completado</SelectItem>
            <SelectItem key="cancelled">Cancelado</SelectItem>
          </Select>
          {updateProgram.isError && (
            <ErrorNote
              message={
                updateProgram.error instanceof Error
                  ? updateProgram.error.message
                  : "No se pudo guardar el programa"
              }
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={updateProgram.isPending}
            variant="light"
            onPress={onClose}
          >
            Cancelar
          </Button>
          <Button
            className="bg-slate-900 text-white"
            isDisabled={formIsValid(form) === false}
            isLoading={updateProgram.isPending}
            onPress={submit}
          >
            Guardar cambios
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Eliminar ───────────────────────────────────────────────────────────────

export function DeleteProgramModal({
  isOpen,
  clientId,
  program,
  onClose,
  onDeleted,
}: {
  isOpen: boolean;
  clientId: string;
  program: WorkoutProgram | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { deleteProgram } = useProgramMutations(clientId);

  useEffect(() => {
    if (isOpen) deleteProgram.reset();
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} placement="center" size="sm" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <Icon icon="solar:trash-bin-trash-linear" width={18} />
          </span>
          Eliminar programa
        </ModalHeader>
        <ModalBody className="gap-3">
          <p className="text-sm text-default-700">
            ¿Eliminar <strong>{program?.name}</strong>? Se borrarán
            permanentemente todas sus sesiones, los ejercicios asignados y el
            historial de entrenamientos completados. Esta acción no se puede
            deshacer.
          </p>
          {deleteProgram.isError && (
            <ErrorNote
              message={
                deleteProgram.error instanceof Error
                  ? deleteProgram.error.message
                  : "No se pudo eliminar el programa"
              }
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={deleteProgram.isPending}
            variant="light"
            onPress={onClose}
          >
            Cancelar
          </Button>
          <Button
            color="danger"
            isLoading={deleteProgram.isPending}
            onPress={() => {
              if (program === null || deleteProgram.isPending) return;
              deleteProgram.mutate(program.programId, {
                onSuccess: () => {
                  onDeleted();
                  onClose();
                },
              });
            }}
          >
            Eliminar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Guardar como plantilla ─────────────────────────────────────────────────

export function SaveTemplateModal({
  isOpen,
  clientId,
  program,
  onClose,
}: {
  isOpen: boolean;
  clientId: string;
  program: WorkoutProgram | null;
  onClose: () => void;
}) {
  const { saveAsTemplate } = useProgramMutations(clientId);
  const [name, setName] = useState("");

  useEffect(() => {
    if (isOpen && program !== null) {
      setName(`Plantilla: ${program.name}`);
      saveAsTemplate.reset();
    }
  }, [isOpen, program]);

  const submit = () => {
    if (
      program === null ||
      name.trim().length === 0 ||
      saveAsTemplate.isPending
    ) {
      return;
    }
    saveAsTemplate.mutate(
      { programId: program.programId, templateName: name.trim() },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal isOpen={isOpen} placement="center" size="sm" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon
            className="text-gray-700"
            icon="solar:diskette-bold"
            width={20}
          />
          Guardar como plantilla
        </ModalHeader>
        <ModalBody className="gap-3">
          <p className="text-sm text-default-500">
            Clona las sesiones y ejercicios de este programa como plantilla
            reutilizable para otros clientes.
          </p>
          <Input
            autoFocus
            isDisabled={saveAsTemplate.isPending}
            label="Nombre de la plantilla"
            value={name}
            variant="bordered"
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            onValueChange={setName}
          />
          {saveAsTemplate.isError && (
            <ErrorNote
              message={
                saveAsTemplate.error instanceof Error
                  ? saveAsTemplate.error.message
                  : "No se pudo guardar la plantilla"
              }
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={saveAsTemplate.isPending}
            variant="light"
            onPress={onClose}
          >
            Cancelar
          </Button>
          <Button
            className="bg-slate-900 text-white"
            isDisabled={name.trim().length === 0}
            isLoading={saveAsTemplate.isPending}
            onPress={submit}
          >
            Guardar plantilla
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
