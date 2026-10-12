"use client";

import {
  Button,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import {
  ClientSheet,
  ClientSheetGrabber,
} from "@/components/client-dashboard/client-sheet";
import { NutritionState } from "@/components/client-dashboard/meal-cycle/macro-ui";
import {
  checkedStorageKey,
  dedupeProducts,
  type ShoppingProduct,
} from "@/components/client-dashboard/shopping-list/shopping-list-helpers";
import { IconTile } from "@/components/shared/icon-tile";
import { useClientShoppingList } from "@/lib/hooks/use-client-queries";

/** Days covered by the list: today plus the coming week. */
const RANGE_DAYS = 7;
const MS_PER_DAY = 86_400_000;

/** The client's local calendar day ("YYYY-MM-DD") — what they actually see. */
function browserTodayYmd(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-");
  const ms =
    Date.UTC(Number(year), Number(month) - 1, Number(day)) + days * MS_PER_DAY;

  return new Date(ms).toISOString().slice(0, 10);
}

/** Read the bought/checked set for this range from localStorage (best-effort). */
function loadChecked(key: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(key);

    if (raw === null) {
      return new Set();
    }

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed)
      ? new Set(
          parsed.filter((value): value is string => typeof value === "string")
        )
      : new Set();
  } catch {
    return new Set();
  }
}

/** Persist the checked set so it survives within the session (best-effort). */
function saveChecked(key: string, set: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // Private mode / quota — check state is purely cosmetic, so ignore.
  }
}

/**
 * Shopping list entry point (Jul 28 call): a quiet card-button at the bottom
 * of the meal-cycle view that opens the list in a sheet. PRODUCTS ONLY — no
 * quantities, units or ranges: one deduped list covering the coming week,
 * with the product photo when the ingredients cache knows it. Check state is
 * local (localStorage, keyed per range) — no backend.
 */
export function ShoppingListSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="flex min-h-14 w-full items-center gap-3 rounded-large bg-content1 px-4 py-2.5 text-left shadow-small transition-transform active:scale-[0.98] motion-reduce:transition-none [@media(hover:hover)]:hover:bg-default-50"
        data-testid="shopping-list-trigger"
        type="button"
        onClick={() => setOpen(true)}
      >
        <IconTile icon="solar:cart-large-2-linear" size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground">
            Lista de la compra
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-default-500">
            Los productos de tu plan de los próximos días
          </span>
        </span>
        <Icon
          className="shrink-0 text-default-400"
          icon="solar:alt-arrow-right-linear"
          width={18}
        />
      </button>

      <ShoppingListModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ShoppingListModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  // Capture "today" once per mount so the range is stable across re-renders.
  const [today] = useState(browserTodayYmd);
  const from = today;
  const to = useMemo(() => addDays(today, RANGE_DAYS - 1), [today]);
  const { data, isPending, isError, refetch } = useClientShoppingList(from, to);

  const products = useMemo(
    () => dedupeProducts(data?.items ?? []),
    [data?.items]
  );

  const storageKey = checkedStorageKey(from, to);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setChecked(loadChecked(storageKey));
  }, [storageKey]);

  function toggle(key: string) {
    setChecked((previous) => {
      const next = new Set(previous);

      if (next.has(key) === true) {
        next.delete(key);
      } else {
        next.add(key);
      }

      saveChecked(storageKey, next);

      return next;
    });
  }

  function clearChecked() {
    setChecked(() => {
      const next = new Set<string>();

      saveChecked(storageKey, next);

      return next;
    });
  }

  const checkedCount = products.filter((product) =>
    checked.has(product.key)
  ).length;

  return (
    <ClientSheet isOpen={isOpen} size="lg" onClose={onClose}>
      <ModalContent>
        {(close) => (
          <>
            <ClientSheetGrabber onClose={close} />
            <ModalHeader className="flex-col items-start gap-0.5 pb-2 pr-12 pt-1 sm:pt-4">
              <span className="font-heading text-[22px] leading-tight tracking-[-0.015em] text-foreground">
                Lista de la compra
              </span>
              <span
                aria-live="polite"
                className="text-sm font-normal text-default-500"
              >
                {products.length > 0 ? (
                  <>
                    <span className="font-semibold text-foreground tabular-nums">
                      {checkedCount} de {products.length}
                    </span>{" "}
                    en el carro · Próximos 7 días
                  </>
                ) : (
                  "Próximos 7 días"
                )}
              </span>
            </ModalHeader>
            <ModalBody className="pb-4 pt-2" data-testid="shopping-list">
              {isPending ? (
                <div className="flex justify-center py-12" role="status">
                  <Spinner color="default" size="sm" />
                </div>
              ) : isError ? (
                <NutritionState
                  flat
                  action={
                    <Button
                      className="h-9 rounded-full bg-content1 px-3.5 text-sm font-semibold text-foreground"
                      size="sm"
                      startContent={
                        <Icon icon="solar:refresh-linear" width={18} />
                      }
                      variant="flat"
                      onPress={() => void refetch()}
                    >
                      Reintentar
                    </Button>
                  }
                  icon="solar:danger-triangle-linear"
                  subtitle="Vuelve a intentarlo en un momento."
                  title="No pudimos cargar tu lista"
                  tone="danger"
                />
              ) : products.length === 0 ? (
                <NutritionState
                  flat
                  icon="solar:cart-large-2-linear"
                  testId="shopping-empty"
                  title="No hay nada que comprar por ahora."
                />
              ) : (
                <div className="divide-y divide-default-200/70 overflow-hidden rounded-large bg-default-100">
                  {products.map((product) => (
                    <ProductRow
                      key={product.key}
                      checked={checked.has(product.key)}
                      product={product}
                      onToggle={() => toggle(product.key)}
                    />
                  ))}
                </div>
              )}
            </ModalBody>
            {products.length > 0 ? (
              <ModalFooter className="gap-2.5 pt-2">
                {checkedCount > 0 ? (
                  <Button
                    className="h-[52px] flex-1 rounded-medium bg-default-100 text-base font-semibold text-foreground"
                    variant="flat"
                    onPress={clearChecked}
                  >
                    Vaciar carro
                  </Button>
                ) : null}
                <Button
                  className="h-[52px] flex-1 rounded-medium text-base font-semibold"
                  color="primary"
                  onPress={close}
                >
                  Listo
                </Button>
              </ModalFooter>
            ) : null}
          </>
        )}
      </ModalContent>
    </ClientSheet>
  );
}

function ProductRow({
  product,
  checked,
  onToggle,
}: {
  product: ShoppingProduct;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-checked={checked}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-default-200/60"
      data-checked={checked}
      data-testid="shopping-item"
      role="checkbox"
      type="button"
      onClick={onToggle}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-content1 transition-opacity duration-200 ${
          checked ? "opacity-50" : ""
        }`}
      >
        {product.imageUrl !== null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-full w-full object-cover"
            decoding="async"
            loading="lazy"
            src={product.imageUrl}
          />
        ) : (
          <Icon
            className="text-default-400"
            icon="solar:chef-hat-linear"
            width={20}
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[15px] font-semibold transition-colors ${
            checked ? "text-default-500 line-through" : "text-foreground"
          }`}
        >
          {product.name}
        </span>
        {product.brand !== null && (
          <span
            className={`block truncate text-[13px] text-default-500 ${
              checked ? "opacity-50" : ""
            }`}
          >
            {product.brand}
          </span>
        )}
      </span>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${
          checked
            ? "bg-primary text-primary-foreground"
            : "text-transparent ring-2 ring-inset ring-default-300"
        }`}
      >
        <Icon icon="solar:unread-linear" width={16} />
      </span>
    </button>
  );
}
