"use client";

import type { ShoppingListItem } from "@/lib/nutrition/shopping/shopping-list";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import {
  formatItemLine,
  itemKey,
} from "@/components/client-dashboard/shopping-list/shopping-list-helpers";

function loadChecked(key: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);

    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is string => typeof v === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function saveChecked(key: string, set: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // Private mode / quota — check state is cosmetic, ignore.
  }
}

/**
 * The consolidated shopping list with check-off (P-wizard). Each item is
 * `name · qty unit` (quantity rounded for display); tapping marks it bought and
 * de-emphasizes it. Check state is local (localStorage, keyed per week) and
 * survives within the session — same behavior as the old auto list.
 */
export function ShoppingResultList({
  items,
  storageKey,
}: {
  items: ShoppingListItem[];
  storageKey: string;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setChecked(loadChecked(storageKey));
  }, [storageKey]);

  function toggle(key: string) {
    setChecked((previous) => {
      const next = new Set(previous);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      saveChecked(storageKey, next);

      return next;
    });
  }

  if (items.length === 0) {
    return (
      <p className="py-6 text-sm text-default-500" data-testid="shopping-empty">
        Aún no elegiste comidas. Selecciona algunas y genera tu lista.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1" data-testid="shopping-list">
      {items.map((item) => {
        const key = itemKey(item);
        const isChecked = checked.has(key);

        return (
          <button
            key={key}
            aria-pressed={isChecked}
            className="flex items-center gap-2 rounded-lg bg-default-50 px-3 py-2.5 text-left transition-colors active:scale-[0.99]"
            data-checked={isChecked}
            data-testid="shopping-item"
            type="button"
            onClick={() => toggle(key)}
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
                isChecked ? "text-default-400 line-through" : "text-foreground"
              }`}
            >
              {formatItemLine(item)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
