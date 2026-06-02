"use client";

import type { RecipeDetail, RecipeFormValues } from "./recipe-api";
import type { RecipeStatus } from "./recipe-query";

import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
  Spinner,
  Textarea,
  type Selection,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { IngredientRow } from "./ingredient-row";
import { IngredientSearch } from "./ingredient-search";
import { MacroSummary } from "./macro-summary";
import { MediaUploader } from "./media-uploader";
import { statusLabel } from "./recipe-format";
import { useRecipe, useRecipeIngredients, useRecipeMedia } from "./use-recipe";
import {
  useAddIngredient,
  useCreateRecipe,
  useRemoveIngredient,
  useRemoveMedia,
  useUpdateIngredient,
  useUpdateRecipe,
  useUploadMedia,
} from "./use-recipe-mutations";

type Orientation = "vertical" | "horizontal";
type RecipeFormProps = { mode: "create" } | { mode: "edit"; recipeId: string };

const STATUS_OPTIONS: RecipeStatus[] = ["draft", "active", "archived"];
const EMPTY_VALUES: RecipeFormValues = {
  name: "",
  description: "",
  instructions: "",
  mealTypeTags: [],
  status: "draft",
};

function firstKey(keys: Selection): string {
  if (keys === "all") return "";
  const first = Array.from(keys)[0];

  return first === undefined ? "" : String(first);
}

function isRecipeStatus(value: string): value is RecipeStatus {
  return value === "draft" || value === "active" || value === "archived";
}

function toFormValues(recipe: RecipeDetail): RecipeFormValues {
  return {
    name: recipe.name,
    description: recipe.description ?? "",
    instructions: recipe.instructions ?? "",
    mealTypeTags: recipe.meal_type_tags,
    status: recipe.status,
  };
}

export function RecipeForm(props: RecipeFormProps) {
  if (props.mode === "create") {
    return <CreateRecipeForm />;
  }

  return <EditRecipeForm recipeId={props.recipeId} />;
}

function CreateRecipeForm() {
  const router = useRouter();
  const [values, setValues] = useState<RecipeFormValues>(EMPTY_VALUES);
  const create = useCreateRecipe();
  const nameEmpty = values.name.trim().length === 0;

  const save = () => {
    if (nameEmpty) return;
    create.mutate(values, {
      onSuccess: (recipe) =>
        router.push(`/trainer/dashboard/recipes/${recipe.id}/edit`),
    });
  };

  return (
    <FormShell title="Nueva receta">
      <RecipeFields
        disabled={create.isPending}
        values={values}
        onChange={setValues}
      />
      <div className="flex justify-end">
        <Button
          color="primary"
          isDisabled={nameEmpty}
          isLoading={create.isPending}
          onPress={save}
        >
          Crear receta
        </Button>
      </div>
      {create.isError && <ErrorText />}
    </FormShell>
  );
}

function EditRecipeForm({ recipeId }: { recipeId: string }) {
  const recipeQuery = useRecipe(recipeId);
  const ingredientsQuery = useRecipeIngredients(recipeId);
  const mediaQuery = useRecipeMedia(recipeId);

  const update = useUpdateRecipe(recipeId);
  const addIngredient = useAddIngredient(recipeId);
  const updateIngredient = useUpdateIngredient(recipeId);
  const removeIngredient = useRemoveIngredient(recipeId);
  const uploadMedia = useUploadMedia(recipeId);
  const removeMedia = useRemoveMedia(recipeId);

  const recipe = recipeQuery.data;
  const [values, setValues] = useState<RecipeFormValues>(EMPTY_VALUES);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (recipe !== undefined && seeded === false) {
      setValues(toFormValues(recipe));
      setSeeded(true);
    }
  }, [recipe, seeded]);

  if (recipeQuery.isLoading) {
    return (
      <FormShell title="Editar receta">
        <div className="flex justify-center py-12">
          <Spinner color="primary" size="lg" />
        </div>
      </FormShell>
    );
  }

  if (recipe === undefined) {
    return (
      <FormShell title="Editar receta">
        <ErrorText />
      </FormShell>
    );
  }

  const ingredients = ingredientsQuery.data ?? [];
  const media = mediaQuery.data ?? [];
  const ingredientBusy =
    updateIngredient.isPending || removeIngredient.isPending;

  return (
    <FormShell title="Editar receta">
      <RecipeFields
        disabled={update.isPending}
        values={values}
        onChange={setValues}
      />
      <div className="flex justify-end">
        <Button
          color="primary"
          isDisabled={values.name.trim().length === 0}
          isLoading={update.isPending}
          onPress={() => update.mutate(values)}
        >
          Guardar cambios
        </Button>
      </div>

      <MacroSummary recipe={recipe} />

      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardBody className="gap-4 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Ingredientes</h3>
          <IngredientSearch
            busy={addIngredient.isPending}
            onAdd={(food, quantity) => addIngredient.mutate({ food, quantity })}
          />
          {ingredients.length > 0 && (
            <div className="flex flex-col">
              {ingredients.map((item) => (
                <IngredientRow
                  key={item.id}
                  busy={ingredientBusy}
                  item={item}
                  onRemove={(id) => removeIngredient.mutate(id)}
                  onUpdateQuantity={(id, quantity) =>
                    updateIngredient.mutate({ ingredientRowId: id, quantity })
                  }
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardBody className="gap-4 p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Fotos y videos
          </h3>
          <MediaUploader
            busy={uploadMedia.isPending}
            media={media}
            onRemove={(mediaId) => removeMedia.mutate(mediaId)}
            onUpload={(file, orientation) => {
              const arg: { file: File; orientation?: Orientation } = { file };

              if (orientation !== undefined) arg.orientation = orientation;
              uploadMedia.mutate(arg);
            }}
          />
        </CardBody>
      </Card>
    </FormShell>
  );
}

function FormShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      {children}
    </div>
  );
}

function ErrorText() {
  return (
    <p className="text-sm text-danger">Algo salió mal. Inténtalo de nuevo.</p>
  );
}

interface RecipeFieldsProps {
  values: RecipeFormValues;
  disabled: boolean;
  onChange: (values: RecipeFormValues) => void;
}

function RecipeFields({ values, disabled, onChange }: RecipeFieldsProps) {
  const [tagInput, setTagInput] = useState("");

  const set = (patch: Partial<RecipeFormValues>) => {
    onChange({ ...values, ...patch });
  };

  const addTag = () => {
    const tag = tagInput.trim();

    if (tag.length > 0 && values.mealTypeTags.includes(tag) === false) {
      set({ mealTypeTags: [...values.mealTypeTags, tag] });
    }
    setTagInput("");
  };

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardBody className="gap-4 p-4">
        <Input
          isRequired
          isDisabled={disabled}
          label="Nombre"
          value={values.name}
          variant="bordered"
          onValueChange={(value) => set({ name: value })}
        />

        <Textarea
          isDisabled={disabled}
          label="Descripción"
          minRows={2}
          value={values.description}
          variant="bordered"
          onValueChange={(value) => set({ description: value })}
        />

        <Textarea
          isDisabled={disabled}
          label="Instrucciones"
          minRows={3}
          value={values.instructions}
          variant="bordered"
          onValueChange={(value) => set({ instructions: value })}
        />

        <div className="flex flex-col gap-2">
          <Input
            isDisabled={disabled}
            label="Tipos de comida (Enter para añadir)"
            value={tagInput}
            variant="bordered"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTag();
              }
            }}
            onValueChange={setTagInput}
          />
          {values.mealTypeTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {values.mealTypeTags.map((tag) => (
                <Chip
                  key={tag}
                  variant="flat"
                  onClose={() =>
                    set({
                      mealTypeTags: values.mealTypeTags.filter(
                        (existing) => existing !== tag
                      ),
                    })
                  }
                >
                  {tag}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <Select
          disallowEmptySelection
          isDisabled={disabled}
          label="Estado"
          selectedKeys={[values.status]}
          variant="bordered"
          onSelectionChange={(keys) => {
            const key = firstKey(keys);

            if (isRecipeStatus(key)) set({ status: key });
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option}>{statusLabel(option)}</SelectItem>
          ))}
        </Select>
      </CardBody>
    </Card>
  );
}
