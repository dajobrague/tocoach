"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import { useDeleteRecipe } from "./use-recipe-mutations";

interface DeleteRecipeModalProps {
  recipe: { id: string; name: string } | null;
  onClose: () => void;
  /** Runs after a successful delete (e.g. navigate away from the editor). */
  onDeleted?: () => void;
}

export function DeleteRecipeModal({
  recipe,
  onClose,
  onDeleted,
}: DeleteRecipeModalProps) {
  const del = useDeleteRecipe();

  const confirm = () => {
    if (recipe === null) return;
    del.mutate(recipe.id, {
      onSuccess: () => {
        onClose();
        onDeleted?.();
      },
    });
  };

  return (
    <Modal
      isDismissable={del.isPending === false}
      isOpen={recipe !== null}
      placement="center"
      size="sm"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-50 text-danger">
            <Icon icon="solar:trash-bin-trash-linear" width={20} />
          </span>
          Eliminar receta
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-600">
            ¿Seguro que quieres eliminar{" "}
            <span className="font-semibold text-gray-900">{recipe?.name}</span>?
            Se quitará de tu biblioteca.
          </p>
          {del.isError && (
            <p className="text-sm text-danger">
              No se pudo eliminar. Inténtalo de nuevo.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={del.isPending} variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            color="danger"
            isLoading={del.isPending}
            startContent={
              del.isPending ? null : (
                <Icon icon="solar:trash-bin-trash-linear" width={18} />
              )
            }
            onPress={confirm}
          >
            Eliminar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
