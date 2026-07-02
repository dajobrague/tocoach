"use client";

import type { RecipeFormValues } from "./recipe-api";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCreateRecipe } from "./use-recipe-mutations";

interface NewRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewRecipeModal({ isOpen, onClose }: NewRecipeModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const create = useCreateRecipe();
  const nameEmpty = name.trim().length === 0;

  const submit = () => {
    if (nameEmpty) return;
    const values: RecipeFormValues = {
      name: name.trim(),
      description: "",
      instructions: "",
      mealTypeTags: [],
      status: "draft",
    };

    create.mutate(values, {
      onSuccess: (recipe) => {
        setName("");
        onClose();
        router.push(`/trainer/dashboard/recipes/${recipe.id}/edit`);
      },
    });
  };

  return (
    <Modal
      isDismissable={create.isPending === false}
      isOpen={isOpen}
      placement="center"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon
            className="text-gray-700"
            icon="solar:chef-hat-linear"
            width={20}
          />
          Nueva receta
        </ModalHeader>
        <ModalBody className="gap-3">
          <p className="text-sm text-default-500">
            Empieza con un nombre. En el siguiente paso añadirás ingredientes,
            fotos y la nutrición se calculará sola.
          </p>
          <Input
            autoFocus
            isRequired
            isDisabled={create.isPending}
            label="Nombre de la receta"
            placeholder="Ej. Desayuno alto en proteína"
            value={name}
            variant="bordered"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                // Mirror the button: never re-submit while a create is in flight.
                if (create.isPending === false) submit();
              }
            }}
            onValueChange={setName}
          />
          {create.isError && (
            <p className="text-sm text-danger">
              No se pudo crear la receta. Inténtalo de nuevo.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={create.isPending}
            variant="light"
            onPress={() => {
              setName(""); // reopening should start blank
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button
            className="bg-black text-white"
            color="primary"
            isDisabled={nameEmpty}
            isLoading={create.isPending}
            startContent={
              create.isPending ? null : (
                <Icon icon="solar:arrow-right-linear" width={18} />
              )
            }
            onPress={submit}
          >
            Crear y continuar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
