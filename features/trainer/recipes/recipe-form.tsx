"use client";

import type {
  RecipeDetail,
  RecipeFormValues,
  RecipeIngredientItem,
} from "./recipe-api";

import {
  Button,
  Card,
  CardBody,
  Input,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DeleteRecipeModal } from "./delete-recipe-modal";
import { EditorHeaderActions } from "./editor-header-actions";
import { IngredientsSection } from "./ingredients-section";
import { MacroSummary } from "./macro-summary";
import { MediaUploader } from "./media-uploader";
import { PublishChecklist } from "./publish-checklist";
import { ErrorText, FormShell, SectionCard } from "./recipe-form-shell";
import { statusLabel } from "./recipe-format";
import { ingredientCountLabel, publishChecklist } from "./recipe-macros";
import {
  buildReplaceIngredientsBody,
  ingredientsEqual,
  previewTotals,
} from "./recipe-draft";
import { distinctMealTypes } from "./recipe-query";
import { RecipePreviewModal } from "./recipe-preview-modal";
import { RecipeSummaryStrip } from "./recipe-summary-strip";
import { TagsField } from "./tags-field";
import { UnsavedChangesModal } from "./unsaved-changes-modal";
import { useRecipe, useRecipeIngredients, useRecipeMedia } from "./use-recipe";
import { useRecipes } from "./use-recipes";
import {
  useCreateRecipe,
  useRemoveMedia,
  useReplaceIngredients,
  useUpdateRecipe,
  useUploadMedia,
} from "./use-recipe-mutations";

type Orientation = "vertical" | "horizontal";
type RecipeFormProps = { mode: "create" } | { mode: "edit"; recipeId: string };

const RECIPES_PATH = "/trainer/dashboard/recipes";
const EMPTY_VALUES: RecipeFormValues = {
  name: "",
  description: "",
  instructions: "",
  mealTypeTags: [],
  status: "draft",
};

function toFormValues(recipe: RecipeDetail): RecipeFormValues {
  return {
    name: recipe.name,
    description: recipe.description ?? "",
    instructions: recipe.instructions ?? "",
    mealTypeTags: recipe.meal_type_tags,
    status: recipe.status,
  };
}

// Field-by-field equality so the header Save button can stay disabled until the
// trainer actually changes something. Ingredients and media save instantly via
// their own mutations, so they are intentionally not part of this comparison.
function valuesEqual(a: RecipeFormValues, b: RecipeFormValues): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.instructions === b.instructions &&
    a.status === b.status &&
    a.mealTypeTags.length === b.mealTypeTags.length &&
    a.mealTypeTags.every((tag, index) => tag === b.mealTypeTags[index])
  );
}

export function RecipeForm(props: RecipeFormProps) {
  if (props.mode === "create") {
    return <CreateRecipeForm />;
  }

  return <EditRecipeForm recipeId={props.recipeId} />;
}

function CreateRecipeForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const create = useCreateRecipe();
  const nameEmpty = name.trim().length === 0;

  const save = () => {
    if (nameEmpty) return;
    const values: RecipeFormValues = { ...EMPTY_VALUES, name: name.trim() };

    create.mutate(values, {
      onSuccess: (recipe) =>
        router.push(`/trainer/dashboard/recipes/${recipe.id}/edit`),
    });
  };

  return (
    <FormShell breadcrumb="Nueva receta" title="Nueva receta">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pt-2 sm:pt-8">
        <Card className="border border-gray-200 bg-white shadow-sm">
          <CardBody className="gap-5 p-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                <Icon icon="solar:chef-hat-bold" width={26} />
              </span>
              <h2 className="text-lg font-bold text-gray-900">
                Empieza tu receta
              </h2>
              <p className="text-sm text-default-500">
                Solo necesitas un nombre. En el siguiente paso añadirás
                ingredientes, fotos y la nutrición se calculará sola.
              </p>
            </div>

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
                  save();
                }
              }}
              onValueChange={setName}
            />

            <Button
              className="w-full bg-black text-white"
              color="primary"
              isDisabled={nameEmpty}
              isLoading={create.isPending}
              startContent={
                create.isPending ? null : (
                  <Icon icon="solar:arrow-right-linear" width={18} />
                )
              }
              onPress={save}
            >
              Crear y continuar
            </Button>

            {create.isError && <ErrorText />}
          </CardBody>
        </Card>
      </div>
    </FormShell>
  );
}

function EditRecipeForm({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const recipeQuery = useRecipe(recipeId);
  const ingredientsQuery = useRecipeIngredients(recipeId);
  const mediaQuery = useRecipeMedia(recipeId);
  // Full library, only to suggest existing tags in the tag editor.
  const libraryQuery = useRecipes({});

  const update = useUpdateRecipe(recipeId);
  const replaceIngredients = useReplaceIngredients(recipeId);
  const uploadMedia = useUploadMedia(recipeId);
  const removeMedia = useRemoveMedia(recipeId);

  const recipe = recipeQuery.data;
  const [values, setValues] = useState<RecipeFormValues>(EMPTY_VALUES);
  // Last persisted snapshot — drives the dirty indicator on the Save button.
  const [savedValues, setSavedValues] =
    useState<RecipeFormValues>(EMPTY_VALUES);
  const [seeded, setSeeded] = useState(false);

  // Buffered ingredient list — every edit stays local until "Guardar".
  const [draftIngredients, setDraftIngredients] = useState<
    RecipeIngredientItem[]
  >([]);
  const [savedIngredients, setSavedIngredients] = useState<
    RecipeIngredientItem[]
  >([]);
  const [ingredientsSeeded, setIngredientsSeeded] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  useEffect(() => {
    if (recipe !== undefined && seeded === false) {
      const next = toFormValues(recipe);

      setValues(next);
      setSavedValues(next);
      setSeeded(true);
    }
  }, [recipe, seeded]);

  const serverIngredients = ingredientsQuery.data;

  useEffect(() => {
    if (serverIngredients !== undefined && ingredientsSeeded === false) {
      setDraftIngredients(serverIngredients);
      setSavedIngredients(serverIngredients);
      setIngredientsSeeded(true);
    }
  }, [serverIngredients, ingredientsSeeded]);

  const media = mediaQuery.data ?? [];
  const nameEmpty = values.name.trim().length === 0;
  const textDirty = valuesEqual(values, savedValues) === false;
  const ingredientsDirty =
    ingredientsEqual(draftIngredients, savedIngredients) === false;
  const isDirty = textDirty || ingredientsDirty;
  const busy = update.isPending || replaceIngredients.isPending;
  const isSaving = busy && publishing === false;

  // Native warning when closing/refreshing the tab with unsaved edits.
  useEffect(() => {
    if (isDirty === false) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);

    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  if (recipeQuery.isLoading) {
    return (
      <FormShell breadcrumb="Editar receta" title="Editar receta">
        <div className="flex justify-center py-12">
          <Spinner color="primary" size="lg" />
        </div>
      </FormShell>
    );
  }

  if (recipe === undefined) {
    return (
      <FormShell breadcrumb="Editar receta" title="Editar receta">
        <ErrorText />
      </FormShell>
    );
  }

  // Live per-serving preview from the buffered list (the server recomputes the
  // authoritative totals on save), overlaid with the buffered form fields so
  // the summary strip / sidebar / preview always show the latest local edits.
  const totals = previewTotals(draftIngredients);
  const previewRecipe: RecipeDetail = {
    ...recipe,
    ...totals,
    name: values.name,
    description: values.description.length > 0 ? values.description : null,
    instructions: values.instructions.length > 0 ? values.instructions : null,
    meal_type_tags: values.mealTypeTags,
    status: values.status,
  };

  // Persist the buffered edits: ingredients first (server recomputes totals),
  // then the recipe fields. `publishNow` also flips status to active.
  const persist = async (publishNow: boolean) => {
    if (ingredientsDirty) {
      const rows = await replaceIngredients.mutateAsync(
        buildReplaceIngredientsBody(draftIngredients)
      );

      setDraftIngredients(rows);
      setSavedIngredients(rows);
    }

    const nextValues: RecipeFormValues = publishNow
      ? { ...values, status: "active" }
      : values;

    if (valuesEqual(nextValues, savedValues) === false) {
      await update.mutateAsync(nextValues);
      setValues(nextValues);
      setSavedValues(nextValues);
    }
  };

  const save = () => {
    if (nameEmpty || isDirty === false) return;
    // Mutation state (update/replaceIngredients isError) drives the UI; the
    // catch only keeps a failed save from surfacing as an unhandled rejection.
    persist(false).catch((error) =>
      console.error("[RecipeForm] save failed:", error)
    );
  };

  const publish = () => {
    setPublishing(true);
    persist(true)
      .catch((error) => console.error("[RecipeForm] publish failed:", error))
      .finally(() => setPublishing(false));
  };

  // Return true to block the Back link's navigation and warn instead; return
  // false to let the link navigate to the list normally.
  const handleBack = (): boolean => {
    if (isDirty) {
      setLeaveOpen(true);

      return true;
    }

    return false;
  };

  const checklist = publishChecklist({
    hasName: nameEmpty === false,
    ingredientCount: draftIngredients.length,
    kcal: totals.kcal,
    hasInstructions: values.instructions.trim().length > 0,
    hasPhoto: media.some((item) => item.type === "image"),
  });

  const metaParts = [
    statusLabel(values.status),
    ingredientCountLabel(draftIngredients.length),
    `${Math.round(totals.kcal)} kcal`,
  ];

  const action = (
    <EditorHeaderActions
      canSave={nameEmpty === false && isDirty}
      isDirty={isDirty}
      isSaving={isSaving}
      onDelete={() => setDeleteOpen(true)}
      onPreview={() => setPreviewOpen(true)}
      onSave={save}
    />
  );

  return (
    <FormShell
      action={action}
      breadcrumb="Editar receta"
      meta={metaParts}
      title={recipe.name || "Editar receta"}
      onBack={handleBack}
    >
      <div className="flex flex-col gap-6">
        <RecipeSummaryStrip recipe={previewRecipe} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main column: the content the trainer actively edits. */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <SectionCard
              icon="solar:document-text-linear"
              title="Información básica"
            >
              <BasicInfoFields
                disabled={busy}
                values={values}
                onChange={setValues}
              />

              <TagsField
                disabled={busy}
                suggestions={distinctMealTypes(libraryQuery.data ?? [])}
                value={values.mealTypeTags}
                onChange={(tags) =>
                  setValues({ ...values, mealTypeTags: tags })
                }
              />
            </SectionCard>

            <IngredientsSection
              disabled={busy}
              ingredients={draftIngredients}
              onChange={setDraftIngredients}
            />

            <SectionCard icon="solar:chef-hat-linear" title="Preparación">
              <InstructionsField
                disabled={busy}
                values={values}
                onChange={setValues}
              />
            </SectionCard>

            <SectionCard icon="solar:gallery-linear" title="Fotos y videos">
              <MediaUploader
                busy={uploadMedia.isPending}
                media={media}
                onRemove={(mediaId) => removeMedia.mutate(mediaId)}
                onUpload={(file, orientation) => {
                  const arg: { file: File; orientation?: Orientation } = {
                    file,
                  };

                  if (orientation !== undefined) arg.orientation = orientation;
                  uploadMedia.mutate(arg);
                }}
              />
            </SectionCard>
          </div>

          {/* Sidebar: focused on nutrition + publish readiness. */}
          <aside className="flex flex-col gap-6">
            <MacroSummary recipe={previewRecipe} />

            <PublishChecklist
              isPublished={values.status === "active"}
              isPublishing={publishing}
              ready={checklist.ready}
              onPublish={publish}
            />
          </aside>
        </div>
      </div>

      <RecipePreviewModal
        ingredients={draftIngredients}
        isOpen={previewOpen}
        media={media}
        recipe={previewRecipe}
        onClose={() => setPreviewOpen(false)}
      />
      <DeleteRecipeModal
        recipe={deleteOpen ? { id: recipeId, name: recipe.name } : null}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => router.push(RECIPES_PATH)}
      />
      <UnsavedChangesModal
        isOpen={leaveOpen}
        onCancel={() => setLeaveOpen(false)}
        onDiscard={() => {
          setLeaveOpen(false);
          router.push(RECIPES_PATH);
        }}
      />
    </FormShell>
  );
}

interface FieldGroupProps {
  values: RecipeFormValues;
  disabled: boolean;
  onChange: (values: RecipeFormValues) => void;
}

function BasicInfoFields({ values, disabled, onChange }: FieldGroupProps) {
  const set = (patch: Partial<RecipeFormValues>) => {
    onChange({ ...values, ...patch });
  };

  return (
    <>
      <Input
        isRequired
        isDisabled={disabled}
        label="Nombre"
        placeholder="Ej. Desayuno alto en proteína"
        value={values.name}
        variant="bordered"
        onValueChange={(value) => set({ name: value })}
      />

      <Textarea
        isDisabled={disabled}
        label="Descripción"
        maxRows={4}
        minRows={2}
        placeholder="Una línea sobre la receta (opcional)"
        value={values.description}
        variant="bordered"
        onValueChange={(value) => set({ description: value })}
      />
    </>
  );
}

function InstructionsField({ values, disabled, onChange }: FieldGroupProps) {
  const set = (patch: Partial<RecipeFormValues>) => {
    onChange({ ...values, ...patch });
  };

  return (
    <Textarea
      isDisabled={disabled}
      label="Pasos de preparación"
      minRows={4}
      placeholder="Escribe los pasos de preparación..."
      value={values.instructions}
      variant="bordered"
      onValueChange={(value) => set({ instructions: value })}
    />
  );
}
