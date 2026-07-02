"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface EditorHeaderActionsProps {
  isDirty: boolean;
  isSaving: boolean;
  /** Save is allowed (name present and there are pending changes). */
  canSave: boolean;
  onPreview: () => void;
  onSave: () => void;
  onDelete: () => void;
}

/** The recipe editor's sticky-header toolbar: dirty state + preview/save/delete. */
export function EditorHeaderActions({
  isDirty,
  isSaving,
  canSave,
  onPreview,
  onSave,
  onDelete,
}: EditorHeaderActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="hidden items-center gap-1.5 text-xs font-medium md:flex">
        {isDirty ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
            <span className="text-warning-600">Cambios sin guardar</span>
          </>
        ) : (
          <>
            <Icon
              className="text-success-500"
              icon="solar:check-circle-bold"
              width={14}
            />
            <span className="text-default-500">Todo guardado</span>
          </>
        )}
      </span>
      <Button
        aria-label="Vista previa"
        className="min-w-0 px-0 sm:px-4"
        startContent={
          <Icon className="sm:-mr-1" icon="solar:eye-linear" width={18} />
        }
        variant="bordered"
        onPress={onPreview}
      >
        <span className="hidden sm:inline">Vista previa</span>
      </Button>
      <Button
        className="bg-black text-white"
        color="primary"
        isDisabled={canSave === false}
        isLoading={isSaving}
        startContent={
          isSaving ? null : <Icon icon="solar:diskette-linear" width={18} />
        }
        onPress={onSave}
      >
        Guardar
      </Button>
      <Button
        isIconOnly
        aria-label="Eliminar receta"
        color="danger"
        variant="solid"
        onPress={onDelete}
      >
        <Icon icon="solar:trash-bin-trash-linear" width={18} />
      </Button>
    </div>
  );
}
