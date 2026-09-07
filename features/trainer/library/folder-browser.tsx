"use client";

import type { Folder, FolderNode } from "./folder-tree";
import type { FolderHooks } from "./use-folders";
import type { ReactNode } from "react";

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
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { createFolderTree, folderPath, moveTargets } from "./folder-tree";

import { confirmAfterPress } from "@/lib/ui/native-dialog";

/** Copy for one library. Nouns are feminine ("receta", "plantilla") — the
 *  sentences below conjugate for that; add a gender flag if a masculine
 *  library ever uses the browser. */
export interface FolderBrowserLabels {
  /** Breadcrumb root ("Mis recetas"). */
  root: string;
  singular: string;
  plural: string;
  /** Create-item CTA ("Nueva receta"). */
  create: string;
  /** Example folder name for the placeholder ("Desayunos"). */
  folderExample: string;
}

/** What the browser needs from an item: identity, a title and its folder. */
export interface FolderItem {
  id: string;
  name: string;
  folder_id: string | null;
}

interface FolderBrowserProps<T extends FolderItem> {
  /** The full library; membership is computed client-side from folder_id. */
  items: T[];
  /** Active tag filter: composes with the open folder (folder AND tags). */
  tags: string[];
  isLoading: boolean;
  isError: boolean;
  hooks: FolderHooks;
  tagsOf: (item: T) => readonly string[];
  /** Persist a move: PATCH the item's folder_id (null = root). */
  moveItem: (item: T, folderId: string | null) => Promise<unknown>;
  /** Called after a successful move so the caller refetches its list. */
  onMoved: () => void;
  labels: FolderBrowserLabels;
  /** Render the items of the open folder (or the root); `onMove` opens the
   *  move dialog for one of them. */
  renderItems: (
    items: T[],
    context: { onMove: (item: T) => void }
  ) => ReactNode;
  onCreateItem: () => void;
}

/**
 * Drive-style folder view of a trainer library (Jul 28 call, Pablo). An
 * item lives in one folder or at the root (`folder_id`), tags are a
 * separate axis that filters within a folder (Sep 7, David: "tags are one
 * thing, folders another"), and each card offers "move to folder" without
 * opening the editor.
 */
export function FolderBrowser<T extends FolderItem>({
  items,
  tags,
  isLoading,
  isError,
  hooks,
  tagsOf,
  moveItem,
  onMoved,
  labels,
  renderItems,
  onCreateItem,
}: FolderBrowserProps<T>) {
  const foldersQuery = hooks.useFolders();
  const { createM, renameM, moveM, deleteM } = hooks.useFolderMutations();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [nameModal, setNameModal] = useState<
    | { mode: "create"; parentId: string | null; initial: string }
    | { mode: "rename"; folderId: string; initial: string }
    | null
  >(null);
  const [movingItem, setMovingItem] = useState<T | null>(null);

  const folders = foldersQuery.data ?? [];
  const tree = createFolderTree<T>(tagsOf);

  const moveItemM = useMutation({
    mutationFn: (vars: { item: T; targetFolderId: string | null }) =>
      moveItem(vars.item, vars.targetFolderId),
    onSuccess: () => {
      onMoved();
      setMovingItem(null);
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

  // Tag filter first, so folder counts and the open folder both reflect it.
  const visible = tree.filterByTags(items, tags);
  const nodes = tree.folderNodes(folders, visible, effectiveId);
  const shownItems =
    currentFolder !== null
      ? tree.itemsInFolder(visible, currentFolder)
      : tree.itemsOutsideFolders(visible, folders);
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
          root={labels.root}
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
              labels={labels}
              node={node}
              onDelete={() => {
                confirmAfterPress(
                  `¿Eliminar la carpeta "${node.folder.name}"? Sus ${labels.plural} y subcarpetas pasan a la raíz; las etiquetas no cambian.`
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

      {shownItems.length > 0 ? (
        renderItems(shownItems, { onMove: setMovingItem })
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-large border border-dashed border-gray-200 bg-gray-50/60 py-12 text-center">
          <Icon
            className="text-default-300"
            icon="solar:folder-open-linear"
            width={30}
          />
          <p className="max-w-sm text-sm text-default-500">
            {tags.length > 0
              ? `Ninguna ${labels.singular} aquí tiene esas etiquetas.`
              : currentFolder !== null
                ? `Esta carpeta está vacía. Mueve ${labels.plural} aquí desde sus tarjetas o crea una nueva.`
                : `Crea tu primera ${labels.singular} o una carpeta para empezar a organizar.`}
          </p>
          <Button
            className="bg-black text-white"
            color="primary"
            size="sm"
            startContent={<Icon icon="solar:add-circle-bold" width={16} />}
            onPress={onCreateItem}
          >
            {labels.create}
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
        labels={labels}
        mode={nameModal?.mode ?? "create"}
        saving={createM.isPending || renameM.isPending}
        onClose={() => setNameModal(null)}
        onSave={submitName}
      />

      <MoveItemModal
        folders={folders}
        item={movingItem}
        labels={labels}
        moving={moveItemM.isPending}
        onClose={() => setMovingItem(null)}
        onMove={(targetFolderId) => {
          if (movingItem !== null) {
            moveItemM.mutate({ item: movingItem, targetFolderId });
          }
        }}
      />
    </div>
  );
}

function Breadcrumb({
  path,
  root,
  onNavigate,
}: {
  path: Folder[];
  root: string;
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
        {root}
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
  labels,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: {
  node: FolderNode;
  folders: Folder[];
  labels: FolderBrowserLabels;
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
            {node.itemCount}{" "}
            {node.itemCount === 1 ? labels.singular : labels.plural}
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
                  {labels.root} (raíz)
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

function MoveItemModal({
  item,
  folders,
  labels,
  moving,
  onClose,
  onMove,
}: {
  item: FolderItem | null;
  folders: Folder[];
  labels: FolderBrowserLabels;
  moving: boolean;
  onClose: () => void;
  onMove: (targetFolderId: string | null) => void;
}) {
  const currentFolderId = item?.folder_id ?? null;
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
      isOpen={item !== null}
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
            <span className="block truncate">Mover “{item?.name}”</span>
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
              {labels.root} (raíz)
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
              Crea una carpeta primero para poder mover {labels.plural}.
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
  labels,
  saving,
  error,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  mode: "create" | "rename";
  initial: string;
  labels: FolderBrowserLabels;
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
          <Input
            autoFocus
            isRequired
            isDisabled={saving}
            label="Nombre"
            placeholder={`Ej. ${labels.folderExample}`}
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
