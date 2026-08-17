"use client";

import type { FolderNode, RecipeFolder } from "./folder-tree";
import type { RecipeListItem } from "./recipe-query";

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  folderNodes,
  folderPath,
  looseTags,
  moveTargets,
  recipesInFolder,
  untaggedRecipes,
} from "./folder-tree";
import { updateRecipeTags } from "./recipe-api";
import { RecipeList } from "./recipe-list";
import { useFolderMutations, useRecipeFolders } from "./use-folders";

import { confirmAfterPress } from "@/lib/ui/native-dialog";

interface FolderBrowserProps {
  /** The full (non-archived) library; membership is computed client-side. */
  recipes: RecipeListItem[];
  isLoading: boolean;
  isError: boolean;
  onOpenRecipe: (id: string) => void;
  onDeleteRecipe: (recipe: RecipeListItem) => void;
  onCreateRecipe: () => void;
}

/**
 * Drive-style folder view of the recipe library (Jul 28 call, Pablo).
 * Folders are tags underneath: a recipe belongs by carrying the folder's
 * tag, and only the hierarchy lives in recipe_folders — so folders nest
 * freely while recipes keep their portable tag list. Every existing tag is
 * auto-materialized into a folder (no manual promotion), untagged recipes
 * live directly at the root like Drive files, and each recipe card offers
 * "move to folder" without opening the editor.
 */
export function FolderBrowser({
  recipes,
  isLoading,
  isError,
  onOpenRecipe,
  onDeleteRecipe,
  onCreateRecipe,
}: FolderBrowserProps) {
  const qc = useQueryClient();
  const foldersQuery = useRecipeFolders();
  const { createM, renameM, moveM, deleteM } = useFolderMutations();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [nameModal, setNameModal] = useState<
    | { mode: "create"; parentId: string | null; initial: string }
    | { mode: "rename"; folderId: string; initial: string }
    | null
  >(null);
  const [movingRecipe, setMovingRecipe] = useState<RecipeListItem | null>(null);

  const folders = foldersQuery.data ?? [];

  // Every tag IS a folder: silently materialize folder rows for tags that
  // don't have one yet (first visit after tagging in the editor, imports,
  // pre-folders libraries). The unique index dedupes concurrent tabs; the
  // ref stops re-attempts (and StrictMode double-runs) within this mount.
  const materializedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (foldersQuery.data === undefined) return;
    const missing = looseTags(recipes, foldersQuery.data).filter(
      (entry) => materializedRef.current.has(entry.tag.toLowerCase()) === false
    );

    if (missing.length === 0) return;
    for (const entry of missing) {
      materializedRef.current.add(entry.tag.toLowerCase());
    }

    void (async () => {
      for (const entry of missing) {
        try {
          await createM.mutateAsync({ name: entry.tag, parentId: null });
        } catch {
          // 409 (already created by another tab) or transient failure —
          // the next folders refetch reconciles either way.
        }
      }
    })();
  }, [recipes, foldersQuery.data, createM]);

  const moveRecipeM = useMutation({
    mutationFn: (vars: {
      recipe: RecipeListItem;
      targetFolderId: string | null;
    }) => {
      const currentTag =
        folderId !== null
          ? (folders.find((folder) => folder.id === folderId)?.name ?? null)
          : null;
      const target =
        vars.targetFolderId !== null
          ? (folders.find((folder) => folder.id === vars.targetFolderId) ??
            null)
          : null;
      const norm = (value: string) => value.trim().toLowerCase();
      // Leave the folder being viewed; keep every other tag (a recipe can
      // live in several folders at once, like Drive shortcuts).
      const without = vars.recipe.meal_type_tags.filter(
        (tag) => currentTag === null || norm(tag) !== norm(currentTag)
      );
      const next =
        target === null
          ? without
          : without.some((tag) => norm(tag) === norm(target.name))
            ? without
            : [...without, target.name];

      return updateRecipeTags(vars.recipe.id, next);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      setMovingRecipe(null);
    },
  });

  if (isLoading || foldersQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner color="primary" />
      </div>
    );
  }

  if (isError || foldersQuery.isError) {
    return (
      <p className="py-8 text-center text-sm text-default-500">
        No se pudieron cargar las carpetas. Vuelve a intentarlo.
      </p>
    );
  }

  const currentFolder =
    folderId !== null
      ? (folders.find((folder) => folder.id === folderId) ?? null)
      : null;
  // A folder deleted elsewhere while open falls back to the root.
  const effectiveId = currentFolder?.id ?? null;

  const nodes = folderNodes(folders, recipes, effectiveId);
  const shownRecipes =
    currentFolder !== null
      ? recipesInFolder(recipes, currentFolder)
      : untaggedRecipes(recipes);
  const breadcrumb =
    currentFolder !== null ? folderPath(folders, currentFolder.id) : [];

  const submitName = (name: string) => {
    if (nameModal === null) return;
    const close = { onSuccess: () => setNameModal(null) };

    if (nameModal.mode === "create") {
      createM.mutate({ name, parentId: nameModal.parentId }, close);
    } else {
      renameM.mutate({ folderId: nameModal.folderId, name }, close);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Breadcrumb
          path={breadcrumb}
          onNavigate={(target) => setFolderId(target)}
        />

        <Button
          size="sm"
          startContent={<Icon icon="solar:add-folder-linear" width={16} />}
          variant="bordered"
          onPress={() =>
            setNameModal({
              mode: "create",
              parentId: effectiveId,
              initial: "",
            })
          }
        >
          Nueva carpeta
        </Button>
      </div>

      {nodes.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {nodes.map((node) => (
            <FolderCard
              key={node.folder.id}
              folders={folders}
              node={node}
              onDelete={() => {
                confirmAfterPress(
                  `¿Eliminar la carpeta "${node.folder.name}"? Las recetas pasan a la raíz (o a sus otras carpetas) y las subcarpetas suben a la raíz.`
                ).then((confirmed) => {
                  if (confirmed) deleteM.mutate(node.folder.id);
                });
              }}
              onMove={(parentId) =>
                moveM.mutate({ folderId: node.folder.id, parentId })
              }
              onOpen={() => setFolderId(node.folder.id)}
              onRename={() =>
                setNameModal({
                  mode: "rename",
                  folderId: node.folder.id,
                  initial: node.folder.name,
                })
              }
            />
          ))}
        </div>
      )}

      {shownRecipes.length > 0 ? (
        <RecipeList
          isError={false}
          isLoading={false}
          recipes={shownRecipes}
          onCreate={onCreateRecipe}
          onDelete={onDeleteRecipe}
          onMove={setMovingRecipe}
          onOpen={onOpenRecipe}
        />
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-large border border-dashed border-gray-200 bg-gray-50/60 py-12 text-center">
          <Icon
            className="text-default-300"
            icon="solar:folder-open-linear"
            width={30}
          />
          <p className="max-w-sm text-sm text-default-500">
            {currentFolder !== null
              ? "Esta carpeta está vacía. Mueve recetas aquí desde sus tarjetas o crea una nueva."
              : "Crea tu primera receta o una carpeta para empezar a organizar."}
          </p>
          <Button
            className="bg-black text-white"
            color="primary"
            size="sm"
            startContent={<Icon icon="solar:add-circle-bold" width={16} />}
            onPress={onCreateRecipe}
          >
            Nueva receta
          </Button>
        </div>
      ) : null}

      <FolderNameModal
        error={
          (nameModal?.mode === "create" ? createM.error : renameM.error)
            ?.message ?? null
        }
        initial={nameModal?.initial ?? ""}
        isOpen={nameModal !== null}
        mode={nameModal?.mode ?? "create"}
        saving={createM.isPending || renameM.isPending}
        onClose={() => setNameModal(null)}
        onSave={submitName}
      />

      <MoveRecipeModal
        currentFolderId={effectiveId}
        folders={folders}
        moving={moveRecipeM.isPending}
        recipe={movingRecipe}
        onClose={() => setMovingRecipe(null)}
        onMove={(targetFolderId) => {
          if (movingRecipe !== null) {
            moveRecipeM.mutate({ recipe: movingRecipe, targetFolderId });
          }
        }}
      />
    </div>
  );
}

function Breadcrumb({
  path,
  onNavigate,
}: {
  path: RecipeFolder[];
  onNavigate: (folderId: string | null) => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      <button
        className={
          path.length === 0
            ? "font-semibold text-gray-900"
            : "text-default-500 hover:text-gray-900"
        }
        type="button"
        onClick={() => onNavigate(null)}
      >
        Mis recetas
      </button>
      {path.map((folder, index) => (
        <span key={folder.id} className="flex items-center gap-1">
          <Icon
            className="text-default-300"
            icon="solar:alt-arrow-right-linear"
            width={13}
          />
          <button
            className={
              index === path.length - 1
                ? "font-semibold text-gray-900"
                : "text-default-500 hover:text-gray-900"
            }
            type="button"
            onClick={() => onNavigate(folder.id)}
          >
            {folder.name}
          </button>
        </span>
      ))}
    </nav>
  );
}

function FolderCard({
  node,
  folders,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: {
  node: FolderNode;
  folders: RecipeFolder[];
  onOpen: () => void;
  onRename: () => void;
  onMove: (parentId: string | null) => void;
  onDelete: () => void;
}) {
  const targets = moveTargets(folders, node.folder.id);
  const subfolders = node.children.length;

  return (
    <div className="group flex items-center gap-3 rounded-large border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50/60">
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        type="button"
        onClick={onOpen}
      >
        <Icon
          className="shrink-0 text-amber-500"
          icon="solar:folder-bold"
          width={24}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">
            {node.folder.name}
          </span>
          <span className="block text-xs text-default-500">
            {node.recipeCount} {node.recipeCount === 1 ? "receta" : "recetas"}
            {subfolders > 0 &&
              ` · ${subfolders} ${subfolders === 1 ? "carpeta" : "carpetas"}`}
          </span>
        </span>
      </button>

      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Button
            isIconOnly
            aria-label={`Acciones de ${node.folder.name}`}
            className="shrink-0 text-default-400"
            radius="full"
            size="sm"
            variant="light"
          >
            <Icon icon="solar:menu-dots-bold" width={16} />
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Acciones de carpeta"
          onAction={(key) => {
            const action = String(key);

            if (action === "rename") onRename();
            else if (action === "delete") onDelete();
            else if (action === "move-root") onMove(null);
            else if (action.startsWith("move:"))
              onMove(action.slice("move:".length));
          }}
        >
          <DropdownItem
            key="rename"
            startContent={<Icon icon="solar:text-field-linear" width={15} />}
          >
            Renombrar
          </DropdownItem>
          <DropdownSection showDivider title="Mover a">
            <>
              {node.folder.parent_id !== null && (
                <DropdownItem
                  key="move-root"
                  startContent={
                    <Icon icon="solar:folder-open-linear" width={15} />
                  }
                >
                  Mis recetas (raíz)
                </DropdownItem>
              )}
              {targets.map((target) => (
                <DropdownItem
                  key={`move:${target.id}`}
                  startContent={<Icon icon="solar:folder-linear" width={15} />}
                >
                  {target.name}
                </DropdownItem>
              ))}
            </>
          </DropdownSection>
          <DropdownItem
            key="delete"
            className="text-danger"
            color="danger"
            startContent={
              <Icon icon="solar:trash-bin-trash-linear" width={15} />
            }
          >
            Eliminar carpeta
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}

function MoveRecipeModal({
  recipe,
  folders,
  currentFolderId,
  moving,
  onClose,
  onMove,
}: {
  recipe: RecipeListItem | null;
  folders: RecipeFolder[];
  currentFolderId: string | null;
  moving: boolean;
  onClose: () => void;
  onMove: (targetFolderId: string | null) => void;
}) {
  // Full paths ("Desayunos / Dulces") so nested folders are unambiguous.
  const options = folders
    .filter((folder) => folder.id !== currentFolderId)
    .map((folder) => ({
      id: folder.id,
      label: folderPath(folders, folder.id)
        .map((step) => step.name)
        .join(" / "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <Modal
      isDismissable={moving === false}
      isOpen={recipe !== null}
      placement="center"
      scrollBehavior="inside"
      size="sm"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon
            className="text-amber-500"
            icon="solar:folder-bold"
            width={20}
          />
          <span className="min-w-0">
            <span className="block truncate">Mover “{recipe?.name}”</span>
          </span>
        </ModalHeader>
        <ModalBody className="gap-1 pb-4">
          {currentFolderId !== null && (
            <button
              className="flex items-center gap-2.5 rounded-medium border border-gray-200 px-3 py-2.5 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-50"
              disabled={moving}
              type="button"
              onClick={() => onMove(null)}
            >
              <Icon
                className="text-default-400"
                icon="solar:folder-open-linear"
                width={17}
              />
              Mis recetas (raíz)
            </button>
          )}
          {options.map((option) => (
            <button
              key={option.id}
              className="flex items-center gap-2.5 rounded-medium border border-gray-200 px-3 py-2.5 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-50"
              disabled={moving}
              type="button"
              onClick={() => onMove(option.id)}
            >
              <Icon
                className="text-amber-500"
                icon="solar:folder-bold"
                width={17}
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
            </button>
          ))}
          {options.length === 0 && currentFolderId === null && (
            <p className="py-4 text-center text-sm text-default-500">
              Crea una carpeta primero para poder mover recetas.
            </p>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function FolderNameModal({
  isOpen,
  mode,
  initial,
  saving,
  error,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  mode: "create" | "rename";
  initial: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  // Re-seed when a different folder/mode opens the modal.
  const [seedKey, setSeedKey] = useState("");
  const currentKey = `${mode}:${initial}:${isOpen}`;

  if (isOpen && seedKey !== currentKey) {
    setName(initial);
    setSeedKey(currentKey);
  }

  const trimmed = name.trim();

  return (
    <Modal
      isDismissable={saving === false}
      isOpen={isOpen}
      placement="center"
      size="sm"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon
            className="text-amber-500"
            icon="solar:folder-bold"
            width={20}
          />
          {mode === "create" ? "Nueva carpeta" : "Renombrar carpeta"}
        </ModalHeader>
        <ModalBody className="gap-3">
          {mode === "rename" && (
            <p className="text-xs text-default-500">
              Al renombrar, la etiqueta de todas sus recetas se actualiza
              también.
            </p>
          )}
          <Input
            autoFocus
            isRequired
            isDisabled={saving}
            label="Nombre"
            placeholder="Ej. Desayunos"
            value={name}
            variant="bordered"
            onKeyDown={(event) => {
              if (event.key === "Enter" && trimmed.length > 0) {
                event.preventDefault();
                onSave(trimmed);
              }
            }}
            onValueChange={setName}
          />
          {error !== null && <p className="text-sm text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={saving} variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-black text-white"
            color="primary"
            isDisabled={trimmed.length === 0}
            isLoading={saving}
            onPress={() => onSave(trimmed)}
          >
            {mode === "create" ? "Crear" : "Guardar"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
