"use client";

import type { LibraryTagKind } from "./use-library-tags";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { useLibraryTagMutations, useLibraryTags } from "./use-library-tags";

import { MAX_TAG_LENGTH } from "@/lib/library/parse-tags";
import { confirmAfterPress } from "@/lib/ui/native-dialog";

/** Usage nouns per library ("3 recetas"). */
const NOUNS: Record<LibraryTagKind, { singular: string; plural: string }> = {
  recipe: { singular: "receta", plural: "recetas" },
  exercise: { singular: "ejercicio", plural: "ejercicios" },
  program: { singular: "plantilla", plural: "plantillas" },
};

interface TagManagerProps {
  kind: LibraryTagKind;
  /** Pages that keep their item list outside react-query refetch here
   *  after a rename/remove changed the items' arrays. */
  onChanged?: () => void;
}

/** "Etiquetas" button that owns the panel; drop it next to a library's
 *  filters. */
export function TagManagerButton({
  kind,
  onChanged,
  className,
  iconOnly = false,
}: TagManagerProps & { className?: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className={className}
        variant="bordered"
        onPress={() => setOpen(true)}
        {...(iconOnly
          ? {
              isIconOnly: true,
              "aria-label": "Gestionar etiquetas",
              title: "Gestionar etiquetas",
            }
          : {
              startContent: <Icon icon="solar:tag-linear" width={18} />,
            })}
      >
        {iconOnly ? <Icon icon="solar:tag-linear" width={18} /> : "Etiquetas"}
      </Button>
      <TagManagerPanel
        isOpen={open}
        kind={kind}
        onClose={() => setOpen(false)}
        {...(onChanged !== undefined ? { onChanged } : {})}
      />
    </>
  );
}

/**
 * "Gestionar etiquetas" (Sep 7, David: a managed list per library). Lists
 * the registry with usage counts; create, rename and delete. Deleting
 * strips the tag from every item; renaming renames it everywhere. Folders
 * are a different thing and never show here.
 */
export function TagManagerPanel({
  kind,
  isOpen,
  onClose,
  onChanged,
}: TagManagerProps & { isOpen: boolean; onClose: () => void }) {
  const tags = useLibraryTags(kind);
  const { createM, renameM, removeM } = useLibraryTagMutations(kind);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null
  );
  const nouns = NOUNS[kind];
  const trimmedDraft = draft.trim();
  const canCreate =
    trimmedDraft.length > 0 && trimmedDraft.length <= MAX_TAG_LENGTH;

  const create = () => {
    if (canCreate === false) return;
    createM.mutate(trimmedDraft, { onSuccess: () => setDraft("") });
  };

  const saveRename = () => {
    if (editing === null) return;
    const name = editing.name.trim();

    if (name.length === 0 || name.length > MAX_TAG_LENGTH) return;
    renameM.mutate(
      { tagId: editing.id, name },
      {
        onSuccess: () => {
          setEditing(null);
          onChanged?.();
        },
      }
    );
  };

  const remove = (tag: { id: string; name: string; usage: number }) => {
    const where =
      tag.usage === 0
        ? "Ningún elemento la lleva."
        : `Se quitará de ${tag.usage} ${tag.usage === 1 ? nouns.singular : nouns.plural}.`;

    confirmAfterPress(`¿Eliminar la etiqueta «${tag.name}»? ${where}`).then(
      (confirmed) => {
        if (confirmed) {
          removeM.mutate(tag.id, { onSuccess: () => onChanged?.() });
        }
      }
    );
  };

  const busy = createM.isPending || renameM.isPending || removeM.isPending;
  const error =
    createM.error?.message ?? renameM.error?.message ?? removeM.error?.message;

  return (
    <Modal
      classNames={{ wrapper: "z-[100050]" }}
      isDismissable={busy === false}
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="md"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 border-b border-default-200 px-5 py-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Etiquetas de {nouns.plural}
          </h2>
          <p className="text-sm font-normal text-default-500">
            Sirven para filtrar. Renombrar o eliminar una etiqueta afecta a
            todas las {nouns.plural} que la llevan.
          </p>
        </ModalHeader>
        <ModalBody className="gap-4 px-5 py-5">
          <div className="flex items-center gap-2">
            <Input
              aria-label="Nueva etiqueta"
              isDisabled={busy}
              placeholder="Nueva etiqueta, ej. vegano"
              value={draft}
              variant="bordered"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  create();
                }
              }}
              onValueChange={setDraft}
            />
            <Button
              color="primary"
              isDisabled={canCreate === false}
              isLoading={createM.isPending}
              onPress={create}
            >
              Añadir
            </Button>
          </div>

          {error !== undefined && (
            <p className="text-sm text-danger">{error}</p>
          )}

          {tags.isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner color="primary" size="sm" />
            </div>
          ) : tags.isError ? (
            <p className="py-4 text-center text-sm text-default-500">
              No se pudieron cargar las etiquetas.
            </p>
          ) : (tags.data ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-default-500">
              Todavía no hay etiquetas. Añade la primera arriba.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {(tags.data ?? []).map((tag) => (
                <li
                  key={tag.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 [@media(hover:hover)]:hover:bg-default-50"
                >
                  {editing?.id === tag.id ? (
                    <Input
                      autoFocus
                      aria-label="Nuevo nombre"
                      className="flex-1"
                      isDisabled={renameM.isPending}
                      size="sm"
                      value={editing.name}
                      variant="bordered"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveRename();
                        } else if (event.key === "Escape") {
                          setEditing(null);
                        }
                      }}
                      onValueChange={(name) => setEditing({ id: tag.id, name })}
                    />
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {tag.name}
                      </span>
                      <span className="shrink-0 pr-1 text-xs tabular-nums text-default-500">
                        {tag.usage}{" "}
                        {tag.usage === 1 ? nouns.singular : nouns.plural}
                      </span>
                    </>
                  )}

                  {editing?.id === tag.id ? (
                    <>
                      <Button
                        isIconOnly
                        aria-label="Guardar nombre"
                        className="compact-control"
                        isLoading={renameM.isPending}
                        size="sm"
                        variant="light"
                        onPress={saveRename}
                      >
                        <Icon icon="solar:check-circle-linear" width={18} />
                      </Button>
                      <Button
                        isIconOnly
                        aria-label="Cancelar"
                        className="compact-control"
                        isDisabled={renameM.isPending}
                        size="sm"
                        variant="light"
                        onPress={() => setEditing(null)}
                      >
                        <Icon icon="solar:close-circle-linear" width={18} />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        isIconOnly
                        aria-label={`Renombrar ${tag.name}`}
                        className="compact-control text-default-500"
                        isDisabled={busy}
                        size="sm"
                        variant="light"
                        onPress={() =>
                          setEditing({ id: tag.id, name: tag.name })
                        }
                      >
                        <Icon icon="solar:pen-linear" width={17} />
                      </Button>
                      <Button
                        isIconOnly
                        aria-label={`Eliminar ${tag.name}`}
                        className="compact-control text-default-500 [@media(hover:hover)]:hover:text-danger"
                        isDisabled={busy}
                        size="sm"
                        variant="light"
                        onPress={() => remove(tag)}
                      >
                        <Icon icon="solar:trash-bin-trash-linear" width={17} />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
