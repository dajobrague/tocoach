"use client";

import { Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import {
  SHOPPING_RANGE_OPTIONS,
  checkedStorageKey,
  computeRange,
  dedupeProducts,
  type ShoppingRangeKey,
} from "@/components/client-dashboard/shopping-list/shopping-list-helpers";
import { useClientShoppingList } from "@/lib/hooks/use-client-queries";

/** The client's local calendar day ("YYYY-MM-DD") — what they actually see. */
function browserTodayYmd(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
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

function RangeTabs({
  active,
  onChange,
}: {
  active: ShoppingRangeKey;
  onChange: (key: ShoppingRangeKey) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {SHOPPING_RANGE_OPTIONS.map((option) => {
        const isActive = option.key === active;

        return (
          <button
            key={option.key}
            aria-pressed={isActive}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-default-200 bg-content1 text-default-600"
            }`}
            data-testid="shopping-range"
            type="button"
            onClick={() => onChange(option.key)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The client's merged shopping list (nutrition-v2, P6-T3).
 *
 * Renders inside the v2 Nutrición view (MealCycleContent), the same nav spot
 * the legacy "Lista de Compras Semanal" section occupies in the old nutrition
 * view — so the existing `/nutricion` flag swap shows the new list when
 * nutrition_v2 is on and the old one when off. Fetches
 * `GET /api/client/shopping-list?from=&to=` for the selected range (this week
 * by default; next week / a 2-week window) and shows PRODUCTS ONLY — no
 * quantities or units, per the Jul 28 call decision ("el cliente ya sabrá
 * cuánto comprar con la experiencia") — deduped across units, and lets the
 * client check items off. Check state is local (localStorage, keyed per
 * range) — no backend — and survives within the session. Empty when there's
 * no active cycle / nothing in range.
 */
export function ShoppingListSection() {
  const [rangeKey, setRangeKey] = useState<ShoppingRangeKey>("this-week");
  // Capture "today" once per mount so the range is stable across re-renders.
  const [today] = useState(browserTodayYmd);
  const { from, to } = useMemo(
    () => computeRange(rangeKey, today),
    [rangeKey, today]
  );
  const { data, isPending, isError } = useClientShoppingList(from, to);

  const storageKey = checkedStorageKey(from, to);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  // Reload the checked set whenever the range (and thus the storage key) changes.
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

  const products = dedupeProducts(data?.items ?? []);

  return (
    <Card data-testid="shopping-list">
      <CardBody className="gap-3">
        <div className="flex items-center gap-2">
          <Icon
            className="text-primary"
            icon="solar:cart-large-2-bold"
            width={20}
          />
          <h2 className="text-base font-bold text-foreground">
            Lista de compras
          </h2>
        </div>

        <RangeTabs active={rangeKey} onChange={setRangeKey} />

        {isPending ? (
          <div className="flex justify-center py-6">
            <Spinner color="primary" size="sm" />
          </div>
        ) : isError ? (
          <p className="py-4 text-sm text-default-500">
            No pudimos cargar tu lista. Vuelve a intentarlo en un momento.
          </p>
        ) : products.length === 0 ? (
          <p
            className="py-4 text-sm text-default-500"
            data-testid="shopping-empty"
          >
            No hay nada que comprar para este rango.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {products.map((product) => {
              const isChecked = checked.has(product.key);

              return (
                <button
                  key={product.key}
                  aria-pressed={isChecked}
                  className="flex items-center gap-2 rounded-lg bg-default-50 px-3 py-2.5 text-left transition-colors active:scale-[0.99]"
                  data-checked={isChecked}
                  data-testid="shopping-item"
                  type="button"
                  onClick={() => toggle(product.key)}
                >
                  <Icon
                    className={isChecked ? "text-primary" : "text-default-300"}
                    icon={
                      isChecked
                        ? "solar:check-circle-bold"
                        : "solar:record-circle-linear"
                    }
                    width={20}
                  />
                  <span
                    className={`text-sm font-medium ${
                      isChecked
                        ? "text-default-400 line-through"
                        : "text-foreground"
                    }`}
                  >
                    {product.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
