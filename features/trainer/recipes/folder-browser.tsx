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
import { useState } from "react";

import {
  folderNodes,
  folderPath,
  looseTags,
  moveTargets,
  recipesInFolder,
  untaggedRecipes,
} from "./folder-tree";
import { RecipeList } from "./recipe-list";
import { useFolderMutations, useRecipeFolders } from "./use-folders";

import { confirmAfterPress } from "@/lib/ui/native-dialog";

/** What the browser is currently showing. */
type Location =
  | { kind: "root" }
  | { kind: "folder"; folderId: string }
  | { kind: "tag"; tag: string }
  | { kind: "untagged" };

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
 * Folder view of the recipe library (Jul 28 call, Pablo). Folders are tags
 * underneath: a recipe belongs by carrying the folder's tag, and only the
 * hierarchy lives in recipe_folders — so folders can nest freely while
 * recipes keep their portable tag list. Tags no folder claims render as
 * flat "loose" cards (promotable to real folders), and untagged recipes get
 * their own card so nothing ever disappears from this view.
 */
export function FolderBrowser({
  recipes,
  isLoading,
  isError,
  onOpenRecipe,
  onDeleteRecipe,
  onCreateRecipe,
}: FolderBrowserProps) {
  const foldersQuery = useRecipeFolders();
  const { createM, renameM, moveM, deleteM } = useFolderMutations();
  const [location, setLocation] = useState<Location>({ kind: "root" });
  const [nameModal, setNameModal] = useState<
    | { mode: "create"; parentId: string | null; initial: string }
    | { mode: "rename"; folderId: string; initial: string }
    | null
  >(null);

  const folders = foldersQuery.data ?? [];

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
    location.kind === "folder"
      ? (folders.find((folder) => folder.id === location.folderId) ?? null)
      : null;
  // A folder deleted elsewhere while open falls back to the root.
  const effective: Location =
    location.kind === "folder" && currentFolder === null
      ? { kind: "root" }
      : location;

  const nodes =
    effective.kind === "root"
      ? folderNodes(folders, recipes, null)
      : effective.kind === "folder"
        ? folderNodes(folders, recipes, effective.folderId)
        : [];
  const loose = effective.kind === "root" ? looseTags(recipes, folders) : [];
  const untagged = effective.kind === "root" ? untaggedRecipes(recipes) : [];

  const shownRecipes =
    effective.kind === "folder" && currentFolder !== null
      ? recipesInFolder(recipes, currentFolder)
      : effective.kind === "tag"
        ? recipes.filter((recipe) =>
            recipe.meal_type_tags.some(
              (tag) =>
                tag.trim().toLowerCase() === effective.tag.trim().toLowerCase()
            )
          )
        : effective.kind === "untagged"
          ? untaggedRecipes(recipes)
          : [];

  const breadcrumb =
    effective.kind === "folder" && currentFolder !== null
      ? folderPath(folders, currentFolder.id)
      : [];

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
          virtualLabel={
            effective.kind === "tag"
              ? effective.tag
              : effective.kind === "untagged"
                ? "Sin clasificar"
                : null
          }
          onNavigate={(folderId) =>
            setLocation(
              folderId === null
                ? { kind: "root" }
                : { kind: "folder", folderId }
            )
          }
        />

        {(effective.kind === "root" || effective.kind === "folder") && (
          <Button
            size="sm"
            startContent={<Icon icon="solar:add-folder-linear" width={16} />}
            variant="bordered"
            onPress={() =>
              setNameModal({
                mode: "create",
                parentId: currentFolder?.id ?? null,
                initial: "",
              })
            }
          >
            Nueva carpeta
          </Button>
        )}
      </div>

      {(nodes.length > 0 || loose.length > 0 || untagged.length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {nodes.map((node) => (
            <FolderCard
              key={node.folder.id}
              folders={folders}
              node={node}
              onDelete={() => {
                confirmAfterPress(
                  `¿Eliminar la carpeta "${node.folder.name}"? Las recetas conservan su etiqueta y las subcarpetas pasan a la raíz.`
                ).then((confirmed) => {
                  if (confirmed) deleteM.mutate(node.folder.id);
                });
              }}
              onMove={(parentId) =>
                moveM.mutate({ folderId: node.folder.id, parentId })
              }
              onOpen={() =>
                setLocation({ kind: "folder", folderId: node.folder.id })
              }
              onRename={() =>
                setNameModal({
                  mode: "rename",
                  folderId: node.folder.id,
                  initial: node.folder.name,
                })
              }
            />
          ))}

          {loose.map((entry) => (
            <LooseTagCard
              key={entry.tag}
              count={entry.count}
              tag={entry.tag}
              onOpen={() => setLocation({ kind: "tag", tag: entry.tag })}
              onPromote={() =>
                createM.mutate({ name: entry.tag, parentId: null })
              }
            />
          ))}

          {untagged.length > 0 && (
            <button
              className="flex items-center gap-3 rounded-large border border-dashed border-gray-300 bg-white p-3 text-left transition-colors hover:border-gray-400"
              type="button"
              onClick={() => setLocation({ kind: "untagged" })}
            >
              <Icon
                className="shrink-0 text-default-300"
                icon="solar:folder-error-linear"
                width={22}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900">
                  Sin clasificar
                </span>
                <span className="block text-xs text-default-500">
                  {untagged.length}{" "}
                  {untagged.length === 1 ? "receta" : "recetas"}
                </span>
              </span>
            </button>
          )}
        </div>
      )}

      {effective.kind === "root" &&
        nodes.length === 0 &&
        loose.length === 0 &&
        untagged.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-200 bg-gray-50/60 py-10 text-center">
            <Icon
              className="text-default-300"
              icon="solar:folder-open-linear"
              width={28}
            />
            <p className="max-w-sm text-sm text-default-500">
              Crea tu primera carpeta o añade etiquetas a tus recetas para
              organizarlas aquí.
            </p>
          </div>
        )}

      {effective.kind !== "root" && (
        <RecipeList
          isError={false}
          isLoading={false}
          recipes={shownRecipes}
          onCreate={onCreateRecipe}
          onDelete={onDeleteRecipe}
          onOpen={onOpenRecipe}
        />
      )}

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
    </div>
  );
}

function Breadcrumb({
  path,
  virtualLabel,
  onNavigate,
}: {
  path: RecipeFolder[];
  virtualLabel: string | null;
  onNavigate: (folderId: string | null) => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      <button
        className={
          path.length === 0 && virtualLabel === null
            ? "font-semibold text-gray-900"
            : "text-default-500 hover:text-gray-900"
        }
        type="button"
        onClick={() => onNavigate(null)}
      >
        Carpetas
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
      {virtualLabel !== null && (
        <span className="flex items-center gap-1">
          <Icon
            className="text-default-300"
            icon="solar:alt-arrow-right-linear"
            width={13}
          />
          <span className="font-semibold text-gray-900">{virtualLabel}</span>
        </span>
      )}
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
    <div className="group flex items-center gap-3 rounded-large border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:border-gray-300">
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
                  Raíz
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

function LooseTagCard({
  tag,
  count,
  onOpen,
  onPromote,
}: {
  tag: string;
  count: number;
  onOpen: () => void;
  onPromote: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-large border border-gray-200 bg-gray-50/50 p-3 transition-colors hover:border-gray-300">
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        type="button"
        onClick={onOpen}
      >
        <Icon
          className="shrink-0 text-default-400"
          icon="solar:tag-linear"
          width={20}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">
            {tag}
          </span>
          <span className="block text-xs text-default-500">
            {count} {count === 1 ? "receta" : "recetas"} · etiqueta
          </span>
        </span>
      </button>
      <button
        className="shrink-0 text-[11px] font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-blue-700"
        title="Crear una carpeta con esta etiqueta para poder anidarla y gestionarla"
        type="button"
        onClick={onPromote}
      >
        Hacer carpeta
      </button>
    </div>
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
