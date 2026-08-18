"use client";

import type { CommunityRecipeSummary } from "@/lib/nutrition/community/community-recipe-service";

import { Button, Card, CardBody, Chip, Input, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

async function readEnvelope<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (response.ok === false || data?.success !== true) {
    throw new Error(data?.error ?? "Error de red");
  }

  return data.data as T;
}

/**
 * The shared recipe gallery (Jul 28 call): recipes trainers across TopCoach
 * chose to share, importable into your own library as standalone copies
 * (they land tagged "Comunidad", which materializes as a folder). Search is
 * client-side over the loaded catalog.
 */
export function CommunityGallery() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [importedIds, setImportedIds] = useState<Set<string>>(() => new Set());

  const catalogQuery = useQuery<CommunityRecipeSummary[]>({
    queryKey: ["community-recipes"],
    queryFn: () =>
      fetch("/api/community-recipes", {
        credentials: "same-origin",
        cache: "no-store",
      }).then(readEnvelope<CommunityRecipeSummary[]>),
  });

  const importM = useMutation({
    mutationFn: (communityId: string) =>
      fetch(`/api/community-recipes/${communityId}/import`, {
        method: "POST",
        credentials: "same-origin",
      }).then(readEnvelope<unknown>),
    onSuccess: (_data, communityId) => {
      setImportedIds((previous) => new Set(previous).add(communityId));
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const needle = query.trim().toLowerCase();
  const items = (catalogQuery.data ?? []).filter(
    (item) =>
      needle.length === 0 ||
      item.name.toLowerCase().includes(needle) ||
      item.meal_type_tags.some((tag) => tag.toLowerCase().includes(needle)) ||
      (item.shared_by ?? "").toLowerCase().includes(needle)
  );

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Link
                aria-label="Volver a recetas"
                className="flex h-8 w-8 items-center justify-center rounded-full text-default-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                href="/trainer/dashboard/recipes"
              >
                <Icon icon="solar:arrow-left-linear" width={18} />
              </Link>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Comunidad
              </h1>
            </div>
            <p className="text-sm text-default-500">
              Recetas compartidas por entrenadores de TopCoach. Al añadir una,
              se instala una copia propia en tu biblioteca.
            </p>
          </div>

          <Input
            isClearable
            className="sm:max-w-sm"
            placeholder="Buscar por nombre, etiqueta o autor..."
            startContent={
              <Icon
                className="text-default-400"
                icon="solar:magnifer-linear"
                width={18}
              />
            }
            value={query}
            variant="bordered"
            onClear={() => setQuery("")}
            onValueChange={setQuery}
          />
        </div>

        {catalogQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner color="primary" />
          </div>
        ) : catalogQuery.isError ? (
          <p className="py-12 text-center text-sm text-default-500">
            No se pudo cargar la comunidad. Vuelve a intentarlo.
          </p>
        ) : items.length === 0 ? (
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardBody className="flex flex-col items-center gap-3 p-12 text-center">
              <Icon
                className="text-default-300"
                icon="solar:global-linear"
                width={40}
              />
              <div className="flex max-w-md flex-col gap-1">
                <p className="font-semibold text-gray-900">
                  {needle.length > 0
                    ? "Sin resultados"
                    : "Aún no hay recetas compartidas"}
                </p>
                <p className="text-sm text-default-500">
                  {needle.length > 0
                    ? "Prueba con otro nombre o etiqueta."
                    : "Sé el primero: abre una receta tuya y pulsa “Compartir con la comunidad”."}
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <CommunityCard
                key={item.id}
                imported={importedIds.has(item.id)}
                importing={importM.isPending && importM.variables === item.id}
                item={item}
                onImport={() => importM.mutate(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommunityCard({
  item,
  imported,
  importing,
  onImport,
}: {
  item: CommunityRecipeSummary;
  imported: boolean;
  importing: boolean;
  onImport: () => void;
}) {
  return (
    <Card className="h-full w-full overflow-hidden border border-gray-200 bg-white shadow-sm">
      <CardBody className="flex h-full flex-col p-0">
        <div className="relative h-40 w-full shrink-0 overflow-hidden bg-slate-100">
          {item.thumbnail_url !== null ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={item.name}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              src={item.thumbnail_url}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon
                className="text-slate-300"
                icon="solar:chef-hat-linear"
                width={44}
              />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
            {item.name}
          </h3>
          {item.shared_by !== null && (
            <p className="text-xs text-default-500">por {item.shared_by}</p>
          )}
          <p className="text-xs text-default-500 tabular-nums">
            {Math.round(item.kcal)} kcal · P {Math.round(item.protein_g)}g · C{" "}
            {Math.round(item.carbs_g)}g · G {Math.round(item.fat_g)}g ·{" "}
            {item.ingredient_count} ingr.
          </p>
          {item.meal_type_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.meal_type_tags.slice(0, 3).map((tag) => (
                <Chip key={tag} size="sm" variant="flat">
                  {tag}
                </Chip>
              ))}
            </div>
          )}

          <div className="mt-auto pt-2">
            {item.mine === true ? (
              <Chip color="default" size="sm" variant="flat">
                Compartida por ti
              </Chip>
            ) : imported ? (
              <Chip
                color="success"
                size="sm"
                startContent={
                  <Icon icon="solar:check-circle-bold" width={14} />
                }
                variant="flat"
              >
                Añadida a tu biblioteca
              </Chip>
            ) : (
              <Button
                className="bg-black text-white"
                color="primary"
                isLoading={importing}
                size="sm"
                startContent={
                  importing ? null : (
                    <Icon icon="solar:add-circle-bold" width={15} />
                  )
                }
                onPress={onImport}
              >
                Añadir a mi biblioteca
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
