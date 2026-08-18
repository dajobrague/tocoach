"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import {
  checkedStorageKey,
  dedupeProducts,
  type ShoppingProduct,
} from "@/components/client-dashboard/shopping-list/shopping-list-helpers";
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
 * of the meal-cycle view that opens the list in a modal. PRODUCTS ONLY — no
 * quantities, units or ranges: one deduped list covering the coming week,
 * with the product photo when the ingredients cache knows it. Check state is
 * local (localStorage, keyed per range) — no backend.
 */
export function ShoppingListSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="flex w-full items-center gap-3 rounded-2xl border border-default-200 bg-content1 p-4 text-left shadow-sm transition-colors active:scale-[0.995] hover:bg-default-50"
        data-testid="shopping-list-trigger"
        type="button"
        onClick={() => setOpen(true)}
      >
        {/* Solid primary + primary-foreground: tenant themes only guarantee
            contrast for that pairing — a primary/10 tint can render solid
            under some theme_json shapes and swallow the glyph. */}
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Icon icon="solar:cart-large-2-bold" width={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block text-base text-foreground"
            style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}
          >
            Lista de la compra
          </span>
          <span
            className="block text-xs text-default-500"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Los productos de tu plan de los próximos días
          </span>
        </span>
        <Icon
          className="shrink-0 text-default-300"
          icon="solar:alt-arrow-right-linear"
          width={20}
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
  const { data, isPending, isError } = useClientShoppingList(from, to);

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
    <Modal
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="md"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3 pb-2 pr-10">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Icon icon="solar:cart-large-2-bold" width={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block text-base text-foreground"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}
            >
              Lista de la compra
            </span>
            <span
              className="block text-xs font-normal text-default-500"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {products.length > 0
                ? `${checkedCount} de ${products.length} en el carro`
                : "Próximos 7 días"}
            </span>
          </span>
        </ModalHeader>
        <ModalBody className="gap-1 py-2" data-testid="shopping-list">
          {isPending ? (
            <div className="flex justify-center py-10">
              <Spinner color="primary" size="sm" />
            </div>
          ) : isError ? (
            <p className="py-8 text-center text-sm text-default-500">
              No pudimos cargar tu lista. Vuelve a intentarlo en un momento.
            </p>
          ) : products.length === 0 ? (
            <div
              className="flex flex-col items-center gap-2 py-10 text-center"
              data-testid="shopping-empty"
            >
              <Icon
                className="text-default-300"
                icon="solar:cart-large-2-linear"
                width={30}
              />
              <p className="text-sm text-default-500">
                No hay nada que comprar por ahora.
              </p>
            </div>
          ) : (
            products.map((product) => (
              <ProductRow
                key={product.key}
                checked={checked.has(product.key)}
                product={product}
                onToggle={() => toggle(product.key)}
              />
            ))
          )}
        </ModalBody>
        <ModalFooter className="justify-between pt-2">
          {checkedCount > 0 ? (
            <Button size="sm" variant="light" onPress={clearChecked}>
              Vaciar carro
            </Button>
          ) : (
            <span />
          )}
          <Button
            className="bg-primary text-primary-foreground"
            size="sm"
            onPress={onClose}
          >
            Listo
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
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
      aria-pressed={checked}
      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors active:scale-[0.99] ${
        checked ? "opacity-55" : "hover:bg-default-50"
      }`}
      data-checked={checked}
      data-testid="shopping-item"
      type="button"
      onClick={onToggle}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-default-100 bg-default-50">
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
            className="text-default-300"
            icon="solar:chef-hat-linear"
            width={20}
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-medium ${
            checked ? "text-default-400 line-through" : "text-foreground"
          }`}
          style={{ fontFamily: "var(--font-body)" }}
        >
          {product.name}
        </span>
        {product.brand !== null && (
          <span className="block truncate text-xs text-default-400">
            {product.brand}
          </span>
        )}
      </span>
      <Icon
        className={`shrink-0 ${checked ? "text-primary" : "text-default-200"}`}
        icon={
          checked ? "solar:check-circle-bold" : "solar:record-circle-linear"
        }
        width={22}
      />
    </button>
  );
}
