"use client";

import { Button, Card, CardBody, Checkbox, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { summarizeImportResult } from "./import-api";
import { CandidateCard } from "./candidate-card";
import { useApproveImport, useImportCandidates } from "./use-import";

const LIBRARY_PATH = "/trainer/dashboard/recipes";

export function RecipeImportContent() {
  const router = useRouter();
  const { data, isLoading, isError } = useImportCandidates();
  const approve = useApproveImport();

  const candidates = useMemo(() => data ?? [], [data]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<string | null>(null);

  // Session imports + names already in the library (server-computed) — the
  // "Importada" mark survives reloads, so re-running never looks pending.
  const isImported = (candidate: (typeof candidates)[number]): boolean =>
    importedIds.has(candidate.legacyOptionId) ||
    candidate.alreadyImported === true;
  const selectable = candidates.filter(
    (candidate) => isImported(candidate) === false
  );
  const allSelected =
    selectable.length > 0 &&
    selectable.every((candidate) => selected.has(candidate.legacyOptionId));

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);

      next.has(id) ? next.delete(id) : next.add(id);

      return next;
    });
  }

  function toggleAll(): void {
    setSelected(
      allSelected
        ? new Set()
        : new Set(selectable.map((candidate) => candidate.legacyOptionId))
    );
  }

  function importSelected(): void {
    const ids = [...selected];

    if (ids.length === 0) {
      return;
    }

    approve.mutate(ids, {
      onSuccess: (result) => {
        setImportedIds(
          (prev) =>
            new Set([
              ...prev,
              ...result.created.map((item) => item.legacyOptionId),
            ])
        );
        setSummary(summarizeImportResult(result));
        setSelected(new Set());
      },
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <Header onBack={() => router.push(LIBRARY_PATH)} />
      <HelperNote />

      {summary !== null ? (
        <ResultBanner
          summary={summary}
          onViewLibrary={() => router.push(LIBRARY_PATH)}
        />
      ) : null}

      {isLoading ? <StateCard spinner /> : null}
      {isError ? (
        <StateCard
          icon="solar:danger-triangle-linear"
          message="No se pudieron cargar los planes antiguos."
          tone="danger"
        />
      ) : null}

      {isLoading === false && isError === false && candidates.length === 0 ? (
        <StateCard
          icon="solar:inbox-linear"
          message="No encontramos recetas en tus planes antiguos para importar."
        />
      ) : null}

      {candidates.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <Checkbox isSelected={allSelected} onValueChange={toggleAll}>
              <span className="text-sm text-default-600">
                Seleccionar todo ({selectable.length})
              </span>
            </Checkbox>
            <Button
              color="primary"
              isDisabled={selected.size === 0}
              isLoading={approve.isPending}
              startContent={
                approve.isPending ? undefined : (
                  <Icon icon="solar:import-linear" width={18} />
                )
              }
              onPress={importSelected}
            >
              Importar seleccionadas ({selected.size})
            </Button>
          </div>

          {approve.isError ? (
            <p className="text-sm text-danger">
              No se pudo importar. Inténtalo de nuevo.
            </p>
          ) : null}

          <div className="flex flex-col gap-3">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.legacyOptionId}
                candidate={candidate}
                imported={isImported(candidate)}
                selected={selected.has(candidate.legacyOptionId)}
                onToggle={toggle}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <button
        className="flex w-fit items-center gap-1 text-sm text-default-500 hover:text-default-700"
        type="button"
        onClick={onBack}
      >
        <Icon icon="solar:alt-arrow-left-linear" width={16} />
        Volver a recetas
      </button>
      <h1 className="text-xl font-bold text-gray-900">
        Importar de planes antiguos
      </h1>
      <p className="text-sm text-default-500">
        Revisa las recetas de tus planes anteriores y elige cuáles añadir a tu
        biblioteca.
      </p>
    </div>
  );
}

function HelperNote() {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-gray-700">
      <Icon
        aria-hidden
        className="mt-0.5 shrink-0 text-amber-500"
        icon="solar:info-circle-linear"
        width={16}
      />
      <p>
        <span className="font-semibold">Plan original</span> es el dato que tú
        anotaste en el plan anterior — se muestra solo como referencia.{" "}
        <span className="font-semibold">Total calculado</span> es lo que la
        nueva receta calculará a partir de sus ingredientes, y puede ser 0 hasta
        que cada ingrediente tenga sus macros.
      </p>
    </div>
  );
}

function ResultBanner({
  summary,
  onViewLibrary,
}: {
  summary: string;
  onViewLibrary: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-success-200 bg-success-50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-success-800">
        <Icon icon="solar:check-circle-bold" width={18} />
        <span>{summary}</span>
      </div>
      <Button color="success" size="sm" variant="flat" onPress={onViewLibrary}>
        Ver biblioteca
      </Button>
    </div>
  );
}

function StateCard({
  spinner,
  icon,
  message,
  tone,
}: {
  spinner?: boolean;
  icon?: string;
  message?: string;
  tone?: "danger";
}) {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="flex flex-col items-center gap-2 p-12 text-center">
        {spinner ? (
          <Spinner color="primary" size="lg" />
        ) : (
          <Icon
            className={tone === "danger" ? "text-danger" : "text-default-300"}
            icon={icon ?? "solar:inbox-linear"}
            width={36}
          />
        )}
        {message !== undefined ? (
          <p className="text-default-500">{message}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
