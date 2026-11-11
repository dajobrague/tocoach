"use client";

import {
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { MuscleBody } from "@/components/shared/muscle-body";
import { SegmentedControl } from "@/components/shared/segmented-control";
import {
  setFigureSex,
  useFigureSex,
  type FigureSex,
} from "@/lib/hooks/use-figure-sex";
import { useLibraryMedia } from "@/lib/hooks/use-library-media";
import { MUSCLES, muscleLabel, type MuscleId } from "@/lib/training/muscles";

interface CatalogItem {
  slug: string;
  name: string;
  category: string;
  primary_muscles: MuscleId[];
  secondary_muscles: MuscleId[];
  equipment: string | null;
  has_animation: boolean;
  added: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called after an exercise was added/linked, so the library can refresh. */
  onAdded: () => void;
}

const TYPES = [
  ["all", "Todos"],
  ["strength", "Fuerza"],
  ["flexibility", "Movilidad"],
  ["cardio", "Cardio"],
  ["olympic", "Olímpico"],
  ["plyometric", "Pliométrico"],
] as const;

const FIGURES: readonly [FigureSex, string][] = [
  ["male", "Hombre"],
  ["female", "Mujer"],
];

/** A selectable option: same shape for types and muscle groups. */
function Pill({
  active,
  disabled = false,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`compact-control inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-default-200 text-default-600 [@media(hover:hover)]:hover:border-default-400"
      }`}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** An applied filter, shown above the results with its own remove button. */
function AppliedFilter({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary">
      {children}
      <button
        aria-label={`Quitar filtro: ${label}`}
        className="compact-control rounded-full p-0.5 transition-colors duration-150 [@media(hover:hover)]:hover:bg-primary/20"
        type="button"
        onClick={onRemove}
      >
        <Icon icon="solar:close-circle-bold" width={14} />
      </button>
    </span>
  );
}

function CatalogCard({
  item,
  poster,
  clip,
  adding,
  onAdd,
}: {
  item: CatalogItem;
  poster?: string | undefined;
  clip?: string | undefined;
  adding: boolean;
  onAdd: () => void;
}) {
  // The clip is only mounted while hovering with a mouse: no 40 videos on load.
  const [hovered, setHovered] = useState(false);
  const shown = item.primary_muscles.slice(0, 2);
  const extra = item.primary_muscles.length - shown.length;

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-default-200 bg-content1 transition-[border-color,box-shadow] duration-150 [@media(hover:hover)]:hover:border-default-300 [@media(hover:hover)]:hover:shadow-medium">
      <div
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-white"
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-full w-full object-contain"
            decoding="async"
            loading="lazy"
            src={poster}
          />
        ) : (
          <Icon
            className="text-default-300"
            icon="solar:dumbbell-linear"
            width={40}
          />
        )}
        {clip && hovered ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
            className="absolute inset-0 h-full w-full bg-white object-contain motion-reduce:hidden"
            poster={poster}
            src={clip}
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {item.name}
        </h3>
        <div className="flex flex-wrap items-center gap-1">
          {shown.map((id) => (
            <span
              key={id}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
            >
              {muscleLabel(id)}
            </span>
          ))}
          {extra > 0 ? (
            <span className="text-[11px] text-default-500">+{extra}</span>
          ) : null}
          {item.equipment ? (
            <span className="truncate text-xs text-default-500">
              {item.equipment}
            </span>
          ) : null}
        </div>
        <Button
          fullWidth
          className="mt-auto"
          color={item.added ? "default" : "primary"}
          isDisabled={item.added}
          isLoading={adding}
          size="sm"
          startContent={
            item.added || adding ? undefined : (
              <Icon icon="solar:add-circle-bold" width={16} />
            )
          }
          variant={item.added ? "flat" : "solid"}
          onPress={onAdd}
        >
          {item.added ? "Añadido" : "Añadir"}
        </Button>
      </div>
    </li>
  );
}

/**
 * Browser for the licensed exercise catalog (701). Filters on the left, big
 * cards on the right (poster, animation on hover). Adding one creates it in
 * the trainer's own library, or links an existing one with the same name.
 */
export function LibraryCatalogModal({ isOpen, onClose, onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [muscle, setMuscle] = useState("");
  const [includeSecondary, setIncludeSecondary] = useState(false);
  // How many results each type would give with the current search + muscle.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const figureSex = useFigureSex();
  // Posters and clips for what is on screen (signed URLs, cached).
  const media = useLibraryMedia(items.map((i) => i.slug));

  const load = useCallback(
    async (nextPage: number, mode: "replace" | "append") => {
      const request = ++requestRef.current;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: query,
          category,
          muscle,
          secondary: includeSecondary ? "1" : "0",
          page: String(nextPage),
        });
        const res = await fetch(`/api/library/exercises?${params}`);

        if (!res.ok) throw new Error("search");
        const data = (await res.json()) as {
          items: CatalogItem[];
          total: number;
          categoryCounts?: Record<string, number>;
        };

        if (request !== requestRef.current) return; // a newer search won
        setItems((prev) =>
          mode === "append" ? [...prev, ...data.items] : data.items
        );
        setTotal(data.total);
        if (data.categoryCounts) setCounts(data.categoryCounts);
        setPage(nextPage);
      } catch {
        if (request === requestRef.current) {
          setError("No se pudo cargar el catálogo. Inténtalo de nuevo.");
        }
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [query, category, muscle, includeSecondary]
  );

  // Debounced search; resets to page 1 whenever a filter changes.
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => void load(1, "replace"), 250);

    return () => clearTimeout(timer);
  }, [isOpen, load]);

  // Load the next page when the end of the grid scrolls into view.
  const hasMore = items.length < total;

  useEffect(() => {
    const node = sentinelRef.current;

    if (!isOpen || !node || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void load(page + 1, "append");
      },
      { rootMargin: "300px" }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isOpen, hasMore, loading, load, page]);

  const add = async (item: CatalogItem) => {
    setAdding(item.slug);
    setError(null);
    try {
      const res = await fetch(`/api/library/exercises/${item.slug}/add`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("add");
      setItems((prev) =>
        prev.map((i) => (i.slug === item.slug ? { ...i, added: true } : i))
      );
      onAdded();
    } catch {
      setError(`No se pudo añadir "${item.name}".`);
    } finally {
      setAdding(null);
    }
  };

  const filtered = query !== "" || category !== "all" || muscle !== "";
  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setMuscle("");
    setIncludeSecondary(false);
  };
  const typeLabel = TYPES.find(([id]) => id === category)?.[1] ?? "";
  const countAll = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <Modal
      hideCloseButton
      classNames={{
        base: "m-0 h-[calc(100vh-48px)] max-h-[calc(100vh-48px)] w-[min(1560px,calc(100vw-48px))] max-w-none",
        header: "border-b border-default-200 px-6 py-4",
        body: "overflow-hidden p-0",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="5xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              Explorar catálogo
            </h2>
            <p className="text-sm font-normal text-default-500">
              Ejercicios con animación y músculos. Al añadir uno se copia a tu
              biblioteca y puedes editarlo.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SegmentedControl
              ariaLabel="Figura de los ejercicios"
              className="!w-auto"
              options={FIGURES.map(([key, label]) => ({ key, label }))}
              size="md"
              value={figureSex}
              onChange={setFigureSex}
            />
            <Button variant="bordered" onPress={onClose}>
              Cerrar
            </Button>
          </div>
        </ModalHeader>

        <ModalBody>
          <div className="flex h-full min-h-0">
            {/* Filters: they combine (type AND muscle AND search). */}
            <nav
              aria-label="Filtros del catálogo"
              className="hidden w-[300px] shrink-0 flex-col gap-8 overflow-y-auto border-r border-default-200 p-5 lg:flex"
            >
              <section className="flex flex-col gap-2.5">
                <h3 className="text-sm font-semibold text-foreground">Tipo</h3>
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map(([id, label]) => {
                    const n = id === "all" ? countAll : (counts[id] ?? 0);

                    return (
                      <Pill
                        key={id}
                        active={category === id}
                        disabled={id !== "all" && n === 0 && category !== id}
                        onClick={() => setCategory(id)}
                      >
                        {label}
                        <span className="text-xs tabular-nums opacity-60">
                          {n}
                        </span>
                      </Pill>
                    );
                  })}
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Músculo
                  </h3>
                  {muscle ? (
                    <button
                      className="compact-control text-xs text-default-500 underline-offset-2 [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:hover:underline"
                      type="button"
                      onClick={() => setMuscle("")}
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
                <p className="text-xs text-default-500">
                  Toca el cuerpo o elige un grupo.
                </p>
                {muscle ? (
                  <Checkbox
                    isSelected={includeSecondary}
                    size="sm"
                    onValueChange={setIncludeSecondary}
                  >
                    <span className="text-sm text-default-600">
                      Incluir ejercicios donde es músculo secundario
                    </span>
                  </Checkbox>
                ) : null}
                <MuscleBody
                  className="mx-auto w-[150px]"
                  primary={muscle ? [muscle as MuscleId] : []}
                  secondary={[]}
                  onToggle={(id) => setMuscle(id === muscle ? "" : id)}
                />
                <div className="flex flex-wrap gap-1.5">
                  {MUSCLES.map((m) => (
                    <Pill
                      key={m.id}
                      active={muscle === m.id}
                      onClick={() => setMuscle(muscle === m.id ? "" : m.id)}
                    >
                      {m.label}
                    </Pill>
                  ))}
                </div>
              </section>
            </nav>

            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
              {/* Search stays on top of the grid; below lg the filters join it. */}
              <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-default-200 bg-content1 px-6 py-3">
                <Input
                  isClearable
                  aria-label="Buscar ejercicio"
                  className="min-w-[200px] flex-1"
                  classNames={{ inputWrapper: "bg-content1" }}
                  placeholder="Buscar: press banca, sentadilla…"
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
                <div className="flex w-full gap-2 lg:hidden">
                  <Select
                    disallowEmptySelection
                    aria-label="Tipo"
                    selectedKeys={[category]}
                    variant="bordered"
                    onSelectionChange={(keys) =>
                      setCategory(String([...keys][0] ?? "all"))
                    }
                  >
                    {TYPES.map(([id, label]) => (
                      <SelectItem key={id}>{label}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    aria-label="Músculo"
                    placeholder="Todos los músculos"
                    selectedKeys={muscle ? [muscle] : []}
                    variant="bordered"
                    onSelectionChange={(keys) =>
                      setMuscle(String([...keys][0] ?? ""))
                    }
                  >
                    {MUSCLES.map((m) => (
                      <SelectItem key={m.id}>{m.label}</SelectItem>
                    ))}
                  </Select>
                </div>
                <p
                  className="shrink-0 text-sm tabular-nums text-default-500"
                  role="status"
                >
                  {loading && items.length === 0
                    ? "Cargando…"
                    : `${total} ${total === 1 ? "ejercicio" : "ejercicios"}`}
                </p>
                {category !== "all" || muscle ? (
                  <div className="flex w-full flex-wrap items-center gap-1.5">
                    <span className="text-xs text-default-500">Filtros:</span>
                    {category !== "all" ? (
                      <AppliedFilter
                        label={typeLabel}
                        onRemove={() => setCategory("all")}
                      >
                        {typeLabel}
                      </AppliedFilter>
                    ) : null}
                    {muscle ? (
                      <AppliedFilter
                        label={muscleLabel(muscle as MuscleId)}
                        onRemove={() => {
                          setMuscle("");
                          setIncludeSecondary(false);
                        }}
                      >
                        {muscleLabel(muscle as MuscleId)}
                        {includeSecondary ? " · también secundario" : ""}
                      </AppliedFilter>
                    ) : null}
                    <Button
                      className="compact-control"
                      size="sm"
                      variant="light"
                      onPress={clearFilters}
                    >
                      Limpiar todo
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex-1 p-6">
                {error ? (
                  <p
                    className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}

                <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 p-0">
                  {items.map((item) => (
                    <CatalogCard
                      key={item.slug}
                      adding={adding === item.slug}
                      clip={media[item.slug]?.video}
                      item={item}
                      poster={media[item.slug]?.poster}
                      onAdd={() => void add(item)}
                    />
                  ))}
                </ul>

                {!loading && items.length === 0 && !error ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <p className="text-sm text-default-500">
                      No hay ejercicios con esos filtros.
                    </p>
                    {filtered ? (
                      <Button size="sm" variant="flat" onPress={clearFilters}>
                        Limpiar filtros
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {hasMore ? (
                  <div ref={sentinelRef} className="flex justify-center py-6">
                    <Button
                      isLoading={loading}
                      variant="flat"
                      onPress={() => void load(page + 1, "append")}
                    >
                      Cargar más
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
