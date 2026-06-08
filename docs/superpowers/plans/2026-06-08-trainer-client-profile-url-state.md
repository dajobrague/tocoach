# Trainer Client-Profile URL State — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reflect the trainer client-profile's navigation state (active tab, sub-tab, micro-tab, and open page-level modals) in the URL query string so a refresh restores the exact place, and the browser/PWA back button closes modals instead of jumping out.

**Architecture:** A small set of pure query-string helpers (unit-tested with vitest) plus a thin React hook layer (`useUrlParams` / `useUrlEnum` / `useModalParam`) built on Next's `useSearchParams`/`useRouter`. Existing `useState`-driven tabs and modals are migrated to read/write the URL. Selections write with `router.replace` (no history entry); modals write with `router.push` (Back closes them) — the "smart back" behavior from the spec. One `<Suspense>` boundary in `page.tsx` satisfies Next 15's `useSearchParams` requirement.

**Tech Stack:** Next.js 15 App Router (client components), `next/navigation`, vitest 4 (pure-function unit tests), Playwright (existing e2e harness, optional).

**Spec:** `docs/superpowers/specs/2026-06-08-trainer-client-profile-url-state-design.md`

**Scope of THIS plan:** foundation (helpers + hook), Suspense boundary, L1 tabs (`?tab`), page-level modals (`?modal`), L2 training tabs (`?sub`), L3 microcycle tabs (`?m`). **Out of scope (follow-up plan):** per-tab deep content state (nutrition plan index / add modals, forms selections / modals, workouts exercise expansion + history-date filter + modals, cardio/neat/supplements modals). Those repeat the exact pattern this plan establishes; the params (`nd`, `ft`, `fv`, `ex`, `hd`, etc.) are already reserved in `CHILD_PARAMS` so the follow-up needs no foundation changes.

**Testing approach (adapted to this codebase):** This repo has no committed unit-test runner; the real verification gates are `npm run type-check` and `npm run lint:check` (per CLAUDE.md), and behavior is verified by running the app. We unit-test the **pure** query-string logic with vitest (verified to run zero-config). React/glue changes are verified with `type-check`, `lint:check`, and an explicit manual checklist. An optional Playwright spec is included at the end.

---

## File Structure

**Create:**

- `components/dashboard/client-profile/url-state-helpers.ts` — pure functions over `URLSearchParams` (no React). Single responsibility: compute the next query string and read params with fallbacks.
- `components/dashboard/client-profile/url-state-helpers.test.ts` — vitest unit tests for the helpers.
- `components/dashboard/client-profile/use-url-state.ts` — React hooks (`useUrlParams`, `useUrlEnum`, `useModalParam`) wrapping the helpers + `next/navigation`.

**Modify:**

- `app/trainer/dashboard/clients/[clientId]/page.tsx` — add `<Suspense>` boundary; migrate the 3 page-level modals to `?modal`.
- `components/dashboard/client-profile/client-profile-tabs.tsx` — migrate `selectedTab` to `?tab`.
- `components/dashboard/client-profile/tabs/training-tabs.tsx` — migrate `active` to `?sub`.
- `components/dashboard/client-profile/tabs/microcycle-tab.tsx` — migrate `active` to `?m`.

---

## Task 1: Pure query-string helpers (TDD)

**Files:**

- Create: `components/dashboard/client-profile/url-state-helpers.ts`
- Test: `components/dashboard/client-profile/url-state-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `components/dashboard/client-profile/url-state-helpers.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  applyParams,
  patchWithChildrenCleared,
  readEnumParam,
  readStringParam,
} from "./url-state-helpers";

describe("applyParams", () => {
  it("sets a new key", () => {
    expect(applyParams(new URLSearchParams(""), { tab: "charts" })).toBe(
      "tab=charts"
    );
  });

  it("overwrites an existing key", () => {
    expect(
      applyParams(new URLSearchParams("tab=training"), { tab: "charts" })
    ).toBe("tab=charts");
  });

  it("removes a key when value is null", () => {
    expect(
      applyParams(new URLSearchParams("sub=workouts&tab=charts"), { sub: null })
    ).toBe("tab=charts");
  });

  it("removes a key when value is empty string", () => {
    expect(applyParams(new URLSearchParams("ex=squat"), { ex: "" })).toBe("");
  });

  it("applies multiple changes atomically", () => {
    expect(
      applyParams(new URLSearchParams("ex=squat&sub=workouts&tab=training"), {
        tab: "charts",
        sub: null,
        ex: null,
      })
    ).toBe("tab=charts");
  });

  it("emits keys in deterministic (sorted) order", () => {
    expect(
      applyParams(new URLSearchParams(""), { tab: "training", sub: "workouts" })
    ).toBe("sub=workouts&tab=training");
  });
});

describe("patchWithChildrenCleared", () => {
  it("sets the key and nulls every child the key owns", () => {
    const patch = patchWithChildrenCleared("tab", "charts");

    expect(patch.tab).toBe("charts");
    expect(patch.sub).toBeNull();
    expect(patch.modal).toBeNull();
    expect(patch.modalId).toBeNull();
  });

  it("returns just the key when it owns no children", () => {
    expect(patchWithChildrenCleared("ex", "squat")).toEqual({ ex: "squat" });
  });
});

describe("readEnumParam", () => {
  const allowed = ["training", "charts"] as const;

  it("returns the value when it is allowed", () => {
    expect(
      readEnumParam(
        new URLSearchParams("tab=charts"),
        "tab",
        allowed,
        "training"
      )
    ).toBe("charts");
  });

  it("falls back when the param is missing", () => {
    expect(
      readEnumParam(new URLSearchParams(""), "tab", allowed, "training")
    ).toBe("training");
  });

  it("falls back when the value is not in the allowed list", () => {
    expect(
      readEnumParam(
        new URLSearchParams("tab=garbage"),
        "tab",
        allowed,
        "training"
      )
    ).toBe("training");
  });
});

describe("readStringParam", () => {
  it("returns the raw value", () => {
    expect(readStringParam(new URLSearchParams("ex=squat"), "ex")).toBe(
      "squat"
    );
  });

  it("returns the fallback (null) when missing", () => {
    expect(readStringParam(new URLSearchParams(""), "ex")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node_modules/.bin/vitest run components/dashboard/client-profile/url-state-helpers.test.ts`
Expected: FAIL — `Failed to resolve import "./url-state-helpers"` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `components/dashboard/client-profile/url-state-helpers.ts`:

```ts
/**
 * Pure helpers for reading/writing the trainer client-profile URL query
 * string. No React, no `next/navigation` — fully unit-testable.
 */

export type ParamPatch = Record<string, string | null>;

/**
 * For each "owner" param, the child params it clears when it changes. Keeps
 * the parent→child ownership in one place so a tab switch never leaves stale
 * descendant state in the URL. Extend this map as deeper params are added in
 * the follow-up per-tab plan.
 */
export const CHILD_PARAMS: Record<string, string[]> = {
  tab: ["sub", "m", "nd", "ndv", "ft", "fv", "ex", "hd", "modal", "modalId"],
  sub: ["m", "ex", "hd", "modal", "modalId"],
};

/**
 * Apply a patch to a query snapshot, returning the new search string (without
 * a leading "?"). A null or empty-string value removes the key. Output is
 * sorted for deterministic, stable URLs.
 */
export function applyParams(
  current: URLSearchParams,
  patch: ParamPatch
): string {
  const next = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  next.sort();

  return next.toString();
}

/**
 * Build a patch that sets `key`=`value` and clears every child param that
 * `key` owns (see CHILD_PARAMS).
 */
export function patchWithChildrenCleared(
  key: string,
  value: string | null
): ParamPatch {
  const patch: ParamPatch = { [key]: value };

  for (const child of CHILD_PARAMS[key] ?? []) {
    patch[child] = null;
  }

  return patch;
}

/**
 * Read an enum param. Returns the value only if it is present in `allowed`,
 * otherwise `fallback`. Guards against stale/hand-edited URLs.
 */
export function readEnumParam<T extends string>(
  current: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = current.get(key);

  return raw !== null && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

/**
 * Read a free-form string param. Returns the raw value, or `fallback`
 * (default null) when missing or empty.
 */
export function readStringParam(
  current: URLSearchParams,
  key: string,
  fallback: string | null = null
): string | null {
  const raw = current.get(key);

  return raw !== null && raw !== "" ? raw : fallback;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node_modules/.bin/vitest run components/dashboard/client-profile/url-state-helpers.test.ts`
Expected: PASS — all suites green (15 assertions across 4 describe blocks).

- [ ] **Step 5: Type-check and lint**

Run: `npm run type-check`
Expected: no errors.
Run: `npm run lint:check 2>&1 | grep -E "url-state-helpers" || echo "clean"`
Expected: `clean` (no lint errors in the new files).

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/client-profile/url-state-helpers.ts components/dashboard/client-profile/url-state-helpers.test.ts
git commit -m "feat(trainer): pure query-string helpers for client-profile URL state"
```

---

## Task 2: React hook layer

**Files:**

- Create: `components/dashboard/client-profile/use-url-state.ts`

There is no committed React-hook test runner (no jsdom/RTL), so this hook is verified by `type-check`, `lint:check`, and downstream usage in Tasks 3–6. The risky logic it depends on (param math) is already unit-tested in Task 1.

- [ ] **Step 1: Write the hook**

Create `components/dashboard/client-profile/use-url-state.ts`:

```ts
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import {
  applyParams,
  patchWithChildrenCleared,
  readEnumParam,
  readStringParam,
  type ParamPatch,
} from "./url-state-helpers";

type HistoryMode = "push" | "replace";

/**
 * Low-level access to the profile URL's query params. `setParams` writes the
 * current pathname with the patched query, defaulting to `replace` (no history
 * entry). Pass `{ history: "push" }` for modal opens so Back closes them.
 */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (patch: ParamPatch, opts?: { history?: HistoryMode }) => {
      const search = applyParams(
        new URLSearchParams(searchParams.toString()),
        patch
      );
      const url = search ? `${pathname}?${search}` : pathname;

      if (opts?.history === "push") {
        router.push(url, { scroll: false });
      } else {
        router.replace(url, { scroll: false });
      }
    },
    [router, pathname, searchParams]
  );

  return { searchParams, setParams };
}

/**
 * Bind an enum/selection param to the URL. Reads with a whitelist fallback;
 * writes with `replace` and clear any child params the key owns.
 */
export function useUrlEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): [T, (next: T) => void] {
  const { searchParams, setParams } = useUrlParams();
  const value = readEnumParam(searchParams, key, allowed, fallback);
  const setValue = useCallback(
    (next: T) =>
      setParams(patchWithChildrenCleared(key, next), { history: "replace" }),
    [setParams, key]
  );

  return [value, setValue];
}

/**
 * Bind the single `modal` param (+ optional `modalId`) to the URL. Opening
 * pushes one history entry (Back closes the modal); closing replaces it so no
 * extra entry accumulates.
 */
export function useModalParam(): {
  modal: string | null;
  modalId: string | null;
  openModal: (name: string, id?: string) => void;
  closeModal: () => void;
} {
  const { searchParams, setParams } = useUrlParams();
  const modal = readStringParam(searchParams, "modal");
  const modalId = readStringParam(searchParams, "modalId");

  const openModal = useCallback(
    (name: string, id?: string) =>
      setParams({ modal: name, modalId: id ?? null }, { history: "push" }),
    [setParams]
  );
  const closeModal = useCallback(
    () => setParams({ modal: null, modalId: null }, { history: "replace" }),
    [setParams]
  );

  return { modal, modalId, openModal, closeModal };
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors. (Note: `exactOptionalPropertyTypes` is on — `id?: string` passed to `modalId: id ?? null` is handled by the `?? null` coalesce, no `undefined` leaks into the patch.)

- [ ] **Step 3: Lint**

Run: `npm run lint:check 2>&1 | grep -E "use-url-state" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/client-profile/use-url-state.ts
git commit -m "feat(trainer): useUrlParams/useUrlEnum/useModalParam hooks"
```

---

## Task 3: Migrate L1 tabs to `?tab`

**Files:**

- Modify: `components/dashboard/client-profile/client-profile-tabs.tsx`

This migrates `selectedTab` (`useState`) to the URL while preserving the existing forms-dirty `window.confirm` guard.

- [ ] **Step 1: Add the import and tab-key tuple**

In `components/dashboard/client-profile/client-profile-tabs.tsx`, the existing imports include `import { Icon } from "@iconify/react";` and `import { useRef, useState } from "react";`. Replace the React import line and add the hook import:

```ts
import { useRef } from "react";

import { useUrlEnum } from "./use-url-state";
```

(Remove `useState` from the React import — it is no longer used; `useRef` stays for `formsUnsavedRef`.)

Immediately after the existing `TAB_ITEMS` const (which ends with `] as const;`), add a typed key tuple:

```ts
const TAB_KEYS = [
  "training",
  "charts",
  "neat",
  "nutrition",
  "supplements",
  "forms",
  "access",
] as const;
```

- [ ] **Step 2: Replace the state with the URL hook**

Replace this line:

```ts
const [selectedTab, setSelectedTab] = useState("training");
```

with:

```ts
const [selectedTab, setSelectedTab] = useUrlEnum("tab", TAB_KEYS, "training");
```

- [ ] **Step 3: Update the change handler's type**

The existing `handleTabChange` is typed `(key: string)`. Narrow it to the tuple type so `setSelectedTab` accepts it. Replace the handler signature line:

```ts
  const handleTabChange = (key: string) => {
```

with:

```ts
  const handleTabChange = (key: (typeof TAB_KEYS)[number]) => {
```

The body is unchanged — the `window.confirm` guard still runs first, and `setSelectedTab(key)` now writes the URL (via `replace`, clearing `sub`/`m`/modal/etc. through `patchWithChildrenCleared`). In the render, `tab.key` is already the literal union (from `TAB_ITEMS as const`), so `onClick={() => handleTabChange(tab.key)}` type-checks.

- [ ] **Step 4: Type-check and lint**

Run: `npm run type-check`
Expected: no errors.
Run: `npm run lint:check 2>&1 | grep -E "client-profile-tabs" || echo "clean"`
Expected: `clean`.

- [ ] **Step 5: Manual verification**

Start the app (`npm run dev`), log in as a trainer, open a client profile.

- Click the **Gráficas** tab → URL becomes `…/clients/<id>?tab=charts`.
- **Refresh** → still on Gráficas (not reset to Entrenamientos).
- Click between several tabs, then press browser **Back** once → it leaves the profile (selections do not stack history). ✔ matches Opción 1.
- Open **Formularios**, make a config change (so the dirty guard arms), click another tab → the "¿descartar?" confirm still appears.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/client-profile/client-profile-tabs.tsx
git commit -m "feat(trainer): persist client-profile L1 tab in ?tab"
```

---

## Task 4: Migrate page-level modals to `?modal`

**Files:**

- Modify: `app/trainer/dashboard/clients/[clientId]/page.tsx`

This wraps the page body in a `<Suspense>` boundary (required because it now calls `useSearchParams` via `useModalParam`) and drives Edit / Update-status / Delete modals from the URL.

- [ ] **Step 1: Replace the file with the Suspense-wrapped version**

Replace the entire contents of `app/trainer/dashboard/clients/[clientId]/page.tsx` with:

```tsx
/* eslint-disable no-console */
"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import ClientProfileHeader from "@/components/dashboard/client-profile/client-profile-header";
import ClientProfileTabs from "@/components/dashboard/client-profile/client-profile-tabs";
import DeleteClientModal from "@/components/dashboard/client-profile/delete-client-modal";
import UpdateStatusModal from "@/components/dashboard/client-profile/update-status-modal";
import { useModalParam } from "@/components/dashboard/client-profile/use-url-state";
import EditClientModal from "@/components/dashboard/edit-client-modal";
import { MockClient } from "@/lib/mock-data/client-profile-mock";

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-default-500 font-body">{message}</p>
        </div>
      </div>
    </div>
  );
}

function ClientProfileInner() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const { modal, openModal, closeModal } = useModalParam();
  const [client, setClient] = useState<MockClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/clients/${clientId}/profile`);

      if (!response.ok) {
        throw new Error("Failed to fetch client data");
      }

      const data = await response.json();

      setClient(data);
    } catch (err) {
      console.error("Error fetching client data:", err);
      setError("No se pudo cargar el perfil del cliente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [clientId]);

  const handleBack = () => {
    router.push("/trainer/dashboard?tab=clients");
  };

  const handleEditSuccess = () => {
    fetchClientData();
  };

  const handleStatusUpdateSuccess = () => {
    fetchClientData();
  };

  const handleDeleteSuccess = () => {
    router.push("/trainer/dashboard?tab=clients");
  };

  if (loading) {
    return <LoadingScreen message="Cargando perfil del cliente..." />;
  }

  if (error || !client) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-danger text-lg mb-4">
              {error || "Cliente no encontrado"}
            </p>
            <button className="text-black hover:underline" onClick={handleBack}>
              Volver a Clientes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <ClientProfileHeader
        client={client}
        onBack={handleBack}
        onDelete={() => openModal("delete")}
        onEdit={() => openModal("edit")}
        onUpdateStatus={() => openModal("status")}
      />
      <ClientProfileTabs clientId={clientId} clientName={client.name} />

      {/* Edit Client Modal */}
      {client && (
        <EditClientModal
          clientData={{
            firstName: client.firstName,
            lastName: client.lastName,
            nickName: client.nickName || "",
            email: client.email,
            phone: client.phone || "",
            occupation: client.occupation || "",
            dob: client.dob || "",
            city: client.location?.city || "",
            state: client.location?.state || "",
            country: client.location?.country || "",
            zip: client.location?.zip || "",
            nationalId: client.nationalId || "",
            status: client.status || "",
          }}
          clientId={clientId}
          isOpen={modal === "edit"}
          onClose={closeModal}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Update Status Modal */}
      {client && (
        <UpdateStatusModal
          clientId={clientId}
          clientName={client.name}
          currentStatus={client.status}
          isOpen={modal === "status"}
          onClose={closeModal}
          onSuccess={handleStatusUpdateSuccess}
        />
      )}

      {/* Delete Client Modal */}
      {client && (
        <DeleteClientModal
          clientId={clientId}
          clientName={client.name}
          isOpen={modal === "delete"}
          onClose={closeModal}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}

export default function ClientProfilePage() {
  return (
    <Suspense fallback={<LoadingScreen message="Cargando..." />}>
      <ClientProfileInner />
    </Suspense>
  );
}
```

Key changes from the original: the body moved into `ClientProfileInner` (so `useModalParam`/`useSearchParams` sits under `<Suspense>`); the three `is*ModalOpen` booleans and their `handle*`/`setIs*Open` openers are gone; `onEdit`/`onUpdateStatus`/`onDelete` call `openModal(...)`; each modal's `isOpen` derives from `modal === "<name>"`; every `onClose` calls `closeModal`. `handleEditSuccess`/`handleStatusUpdateSuccess` keep refetching (the modals close themselves via `onClose`); `handleDeleteSuccess` navigates away as before.

- [ ] **Step 2: Type-check and lint**

Run: `npm run type-check`
Expected: no errors.
Run: `npm run lint:check 2>&1 | grep -E "clients/\[clientId\]/page" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Manual verification**

In the running app, on a client profile:

- Click the header **Editar** action → URL gains `?modal=edit` and the Edit modal opens.
- **Refresh** → the Edit modal reopens (state restored).
- Press browser **Back** → the modal closes and the URL loses `modal=edit` (does not jump out of the profile). ✔ Opción 1.
- Repeat for **Actualizar estado** (`?modal=status`) and **Eliminar** (`?modal=delete`). Confirm Delete reopens on refresh and that confirming still deletes + navigates to the clients list.
- Combine with Task 3: go to `?tab=charts`, open a modal (`?tab=charts&modal=edit`), refresh → both restored.

- [ ] **Step 4: Commit**

```bash
git add "app/trainer/dashboard/clients/[clientId]/page.tsx"
git commit -m "feat(trainer): drive client-profile page modals from ?modal + add Suspense boundary"
```

---

## Task 5: Migrate L2 training sub-tabs to `?sub`

**Files:**

- Modify: `components/dashboard/client-profile/tabs/training-tabs.tsx`

- [ ] **Step 1: Replace state with the URL hook**

In `components/dashboard/client-profile/tabs/training-tabs.tsx`, replace the React import:

```ts
import { useState } from "react";
```

with:

```ts
import { useUrlEnum } from "../use-url-state";
```

After the existing `SUB_TABS` const, add the key tuple (must match the `SubTabKey` union — `microcycle`, `workouts`, `cardio`):

```ts
const SUB_TAB_KEYS = ["microcycle", "workouts", "cardio"] as const;
```

Replace the state line:

```ts
const [active, setActive] = useState<SubTabKey>("microcycle");
```

with:

```ts
const [active, setActive] = useUrlEnum("sub", SUB_TAB_KEYS, "microcycle");
```

The rest of the component (the `SUB_TABS.map`, the `onClick={() => setActive(t.key)}`, and the `active === "…"` render guards) is unchanged. `t.key` is the `SubTabKey` literal union, so `setActive` type-checks.

- [ ] **Step 2: Type-check and lint**

Run: `npm run type-check`
Expected: no errors.
Run: `npm run lint:check 2>&1 | grep -E "training-tabs" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Manual verification**

On a client profile (Entrenamientos tab is `?tab=training`):

- Click the **Cardio** sub-tab → URL becomes `?tab=training&sub=cardio`.
- **Refresh** → still on Cardio.
- Switch L1 to **Nutrición** → URL becomes `?tab=nutrition` and `sub` is cleared (no stale `sub=cardio`). ✔ parent clears children.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/client-profile/tabs/training-tabs.tsx
git commit -m "feat(trainer): persist training sub-tab in ?sub"
```

---

## Task 6: Migrate L3 microcycle sub-tabs to `?m`

**Files:**

- Modify: `components/dashboard/client-profile/tabs/microcycle-tab.tsx`

- [ ] **Step 1: Replace state with the URL hook**

In `components/dashboard/client-profile/tabs/microcycle-tab.tsx`, replace the React import:

```ts
import { useState } from "react";
```

with:

```ts
import { useUrlEnum } from "../use-url-state";
```

After the existing `SUB_TABS` const, add the key tuple (matching the `SubTab` union — `metrics`, `config`):

```ts
const MICRO_TAB_KEYS = ["metrics", "config"] as const;
```

Replace the state line:

```ts
const [active, setActive] = useState<SubTab>("metrics");
```

with:

```ts
const [active, setActive] = useUrlEnum("m", MICRO_TAB_KEYS, "metrics");
```

The rest is unchanged, including `onSwitchToConfig={() => setActive("config")}` (now writes `?m=config`).

- [ ] **Step 2: Type-check and lint**

Run: `npm run type-check`
Expected: no errors.
Run: `npm run lint:check 2>&1 | grep -E "microcycle-tab" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Manual verification**

On a client profile, Entrenamientos → Microciclo sub-tab:

- Click **Configuración** → URL becomes `?tab=training&sub=microcycle&m=config`.
- **Refresh** → still on Configuración.
- From the Métricas view, use the "switch to config" action → URL updates to `m=config`.
- Switch the L2 sub-tab to **Cardio** → `m` is cleared (`?tab=training&sub=cardio`). ✔ parent clears children.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle-tab.tsx
git commit -m "feat(trainer): persist microcycle sub-tab in ?m"
```

---

## Task 7: Optional Playwright e2e (deep-link restore + back closes modal)

**Files:**

- Create: `tests/e2e/trainer-profile-url-state.spec.ts`

This repo's e2e harness (`tests/e2e/`, `lib/test/`, `.env.test`) is currently uncommitted/in-progress and requires a running app + seeded test DB + trainer auth helpers. **Only do this task if that harness is present and runnable** (`tests/e2e/helpers/auth` exports a trainer auth cookie helper and a seeded `TEST_CLIENT_ID`). Otherwise, the manual checklists in Tasks 3–6 are the acceptance gate; skip to the final verification.

- [ ] **Step 1: Confirm the harness exists**

Run: `ls tests/e2e/helpers/ && grep -rl "TEST_CLIENT_ID\|TEST_TRAINER_ID" lib/test/ | head`
Expected: an `auth` helper file and a test-db module. If either is missing, **skip this task** and proceed to Final Verification.

- [ ] **Step 2: Write the spec**

Create `tests/e2e/trainer-profile-url-state.spec.ts` using the same auth/seed helpers the existing specs import (adapt the import paths to whatever the trainer helper actually exports — mirror `tests/e2e/week-logging.spec.ts`):

```ts
import { expect, test } from "@playwright/test";

import { TEST_CLIENT_ID } from "../../lib/test/nutrition-test-db";

import { addTrainerAuthCookie } from "./helpers/auth";

const PROFILE = `/trainer/dashboard/clients/${TEST_CLIENT_ID}`;

test.beforeEach(async ({ context }) => {
  await addTrainerAuthCookie(context);
});

test("deep-link restores the active tab on load", async ({ page }) => {
  await page.goto(`${PROFILE}?tab=charts`);
  await expect(page.getByRole("tab", { name: "Gráficas" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});

test("switching tabs updates the URL without stacking history", async ({
  page,
}) => {
  await page.goto(PROFILE);
  await page.getByRole("tab", { name: "Gráficas" }).click();
  await expect(page).toHaveURL(/tab=charts/);
  await page.goBack();
  // One back leaves the profile (selections use replace), not steps through tabs.
  await expect(page).not.toHaveURL(/clients\//);
});

test("opening a modal adds history so Back closes it", async ({ page }) => {
  await page.goto(PROFILE);
  await page.getByRole("button", { name: /Editar/i }).click();
  await expect(page).toHaveURL(/modal=edit/);
  await page.goBack();
  await expect(page).not.toHaveURL(/modal=edit/);
  await expect(page).toHaveURL(/clients\//); // still on the profile
});
```

- [ ] **Step 3: Run the spec**

Run: `node_modules/.bin/playwright test tests/e2e/trainer-profile-url-state.spec.ts`
Expected: 3 passed. (If the trainer auth helper differs, fix the import/selectors to match the existing harness — do not invent helpers.)

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/trainer-profile-url-state.spec.ts
git commit -m "test(trainer): e2e for client-profile URL state restore + smart back"
```

---

## Final Verification

- [ ] **Full type-check:** `npm run type-check` → no errors.
- [ ] **Full lint:** `npm run lint:check` → no new errors in touched files.
- [ ] **Unit tests:** `node_modules/.bin/vitest run components/dashboard/client-profile/url-state-helpers.test.ts` → all pass.
- [ ] **End-to-end manual smoke (the core acceptance):** open a client profile → Nutrición tab → refresh → still Nutrición. Entrenamientos → Cardio → refresh → still Cardio. Open Editar modal → refresh → modal reopens → Back closes it (stays on profile). Switch L1 tab → child params (`sub`/`m`/`modal`) clear from the URL.
- [ ] **Confirm scope boundary:** deeper per-tab content state (selected nutrition plan, forms selections, workouts exercise expansion, history date filter) is intentionally NOT yet persisted — that is the follow-up plan. Note this to the user so it is not mistaken for a bug.

---

## Follow-up (separate plan)

Per-tab deep content state, each repeating the Task 3 pattern (`useUrlEnum` for selections, `useModalParam` or a per-tab modal param for dialogs), extending `CHILD_PARAMS` as needed:

- **Nutrición** (`nutrition-tab.tsx`): setup/progress sub-tab + `selectedPlanIndex` → `ndv`/`nd`; add-day / add-meal modals.
- **Formularios** (`forms-tab.tsx`): `selectedFormType` → `ft`; responses/config view → `fv`; preview / add-question / viewing-response modals.
- **Entrenamientos/Cardio** (`workouts-tab.tsx`, `cardio-tab.tsx`): expanded exercise → `ex`; history date filter → `hd`; save-as-template & video modals.
- **NEAT / Suplementos** (`neat-tab.tsx`, `supplements-tab.tsx`): add/edit/assign modals + selected item id.
