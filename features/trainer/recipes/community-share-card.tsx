"use client";

import { Button, Card, CardBody, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface ShareStatus {
  shared: boolean;
  updated_at: string | null;
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (response.ok === false || data?.success !== true) {
    throw new Error(data?.error ?? "Error de red");
  }

  return data.data as T;
}

function shareKey(recipeId: string) {
  return ["recipe-share", recipeId];
}

function formatDate(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

/**
 * Community sharing controls in the recipe editor sidebar (Jul 28 call,
 * copy-install model): share freezes the current recipe into the global
 * gallery; later edits stay private until "Actualizar publicación";
 * unsharing removes it from the gallery but never touches copies other
 * trainers already imported.
 */
export function CommunityShareCard({ recipeId }: { recipeId: string }) {
  const qc = useQueryClient();
  const statusQuery = useQuery<ShareStatus>({
    queryKey: shareKey(recipeId),
    queryFn: () =>
      fetch(`/api/recipes/${recipeId}/share`, {
        credentials: "same-origin",
        cache: "no-store",
      }).then(readEnvelope<ShareStatus>),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: shareKey(recipeId) });
  const shareM = useMutation({
    mutationFn: () =>
      fetch(`/api/recipes/${recipeId}/share`, {
        method: "POST",
        credentials: "same-origin",
      }).then(readEnvelope<unknown>),
    onSuccess: invalidate,
  });
  const unshareM = useMutation({
    mutationFn: () =>
      fetch(`/api/recipes/${recipeId}/share`, {
        method: "DELETE",
        credentials: "same-origin",
      }).then(readEnvelope<unknown>),
    onSuccess: invalidate,
  });

  const status = statusQuery.data;
  const busy = shareM.isPending || unshareM.isPending;

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon
              className="text-blue-600"
              icon="solar:global-linear"
              width={18}
            />
            <h3 className="text-sm font-semibold text-gray-900">Comunidad</h3>
          </div>
          {status?.shared === true && (
            <Chip color="primary" size="sm" variant="flat">
              Compartida
            </Chip>
          )}
        </div>

        {statusQuery.isLoading ? (
          <div className="flex justify-center py-3">
            <Spinner size="sm" />
          </div>
        ) : status?.shared === true ? (
          <>
            <p className="text-xs text-default-500">
              Visible para todos los entrenadores de TopCoach
              {status.updated_at !== null
                ? ` (publicada el ${formatDate(status.updated_at)})`
                : ""}
              . Tus cambios posteriores no se publican hasta que actualices.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                isDisabled={busy}
                isLoading={shareM.isPending}
                size="sm"
                startContent={
                  shareM.isPending ? null : (
                    <Icon icon="solar:upload-linear" width={15} />
                  )
                }
                variant="bordered"
                onPress={() => shareM.mutate()}
              >
                Actualizar publicación
              </Button>
              <Button
                className="text-danger"
                isDisabled={busy}
                isLoading={unshareM.isPending}
                size="sm"
                variant="light"
                onPress={() => unshareM.mutate()}
              >
                Dejar de compartir
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-default-500">
              Comparte esta receta con los demás entrenadores de TopCoach. Cada
              uno instala su propia copia — dejarla de compartir después no
              borra las copias ya añadidas.
            </p>
            <Button
              isDisabled={busy}
              isLoading={shareM.isPending}
              size="sm"
              startContent={
                shareM.isPending ? null : (
                  <Icon icon="solar:global-linear" width={15} />
                )
              }
              variant="bordered"
              onPress={() => shareM.mutate()}
            >
              Compartir con la comunidad
            </Button>
          </>
        )}

        {(shareM.isError || unshareM.isError) && (
          <p className="text-xs text-danger">
            No se pudo completar. Vuelve a intentarlo.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
