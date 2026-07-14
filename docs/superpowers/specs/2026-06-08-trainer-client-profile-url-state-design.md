# Trainer Client-Profile URL State — Design

**Date:** 2026-06-08
**Status:** Approved (pending implementation plan)
**Area:** Trainer app — client profile (`/trainer/dashboard/clients/[clientId]`)

## Problem

Inside the trainer's view of a client profile, all navigation lives in React
`useState`: the active tab, sub-tab, selected exercise/plan, expanded rows, and
every modal. The URL stays `/trainer/dashboard/clients/[clientId]` no matter how
deep the trainer drills in. A refresh (intentional or accidental) throws them
back to the top — L1 tab resets to _Entrenamientos_, L2 to _Microciclo_, and any
in-progress modal/selection is lost. This is a recurring annoyance.

**Goal:** reflect in-profile navigation state in the URL so a refresh restores
the trainer to the exact place they were, and the browser/PWA back button behaves
like a native app.

**Scope:** the trainer app only. The client-facing portal (`app/[slug]/*`) is
explicitly out of scope for this work.

## Requirements (decided during brainstorming)

- **Full depth, including modals.** Tab, sub-tab, deep selection, and open
  modals all restore on refresh.
- **Every modal restores — no exceptions.** Including the destructive page-level
  confirms (Delete client, Update status, Edit client). Reopening a confirm is
  safe because no action auto-executes; the trainer still has to click confirm.
- **Smart back button (Opción 1).** Switching tabs/selections updates the URL
  silently (no history entry). Opening a modal adds one history entry, so:
  - Back #1 → closes the modal.
  - Back #2 → leaves the section.
  - Tapping between tabs/days/exercises does **not** create per-tap back-steps.

## State surface (what is lost on refresh today)

| Level   | Component                                           | State                                                                                      |
| ------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Page    | `app/trainer/dashboard/clients/[clientId]/page.tsx` | Edit / Update-status / Delete-client modals                                                |
| L1 tabs | `client-profile-tabs.tsx`                           | `selectedTab` — training, charts, neat, nutrition, supplements, forms, access              |
| L2 tabs | `tabs/training-tabs.tsx`                            | `active` — microcycle, workouts, cardio                                                    |
| L3      | `tabs/microcycle-tab.tsx`                           | `active` — metrics, config (+ week navigation)                                             |
| Tab     | `tabs/nutrition-tab.tsx`                            | setup/progress sub-tab, `selectedPlanIndex`, add-day / add-meal modals                     |
| Tab     | `tabs/forms-tab.tsx`                                | `selectedFormType`, responses/config view, preview / add-question modals, viewing-response |
| Tab     | `tabs/neat-tab.tsx`                                 | add / edit card modals + selected card                                                     |
| Tab     | `tabs/supplements-tab.tsx`                          | assignment modal + selected supplement                                                     |
| Tab     | `tabs/workouts-tab.tsx`, `tabs/cardio-tab.tsx`      | expanded exercise rows, save-as-template & video modals, history date filter               |

## Approach (chosen)

**A — One shared `useUrlState` hook over query params, rolled out incrementally.**

Rejected alternatives:

- **B — Nested dynamic routes + intercepting routes.** Large re-architecture of a
  working, fully-client-rendered page; the client data is fetched once at the top
  and passed down, which fights deep route segments. High effort/risk, poor
  cost/benefit.
- **C — localStorage restoration.** Does not satisfy "reflect in the URL";
  refresh/share of a link carries nothing; messy with multiple clients open.

## Section 1 — Core mechanism

A single hook (proposed: `components/dashboard/client-profile/use-url-state.ts`).

```ts
// Read one named query param; returns [value, setValue].
const [tab, setTab] = useUrlState("tab", "training"); // selection → replace (default)
const [video, setVideo] = useUrlState("video", null, { history: "push" }); // modal → push
```

- **Read:** value comes from the URL query string; missing → provided default.
- **Write (selection, default `history: "replace"`):** `router.replace` — no
  back-step. Covers tab/sub-tab switches, selected plan/exercise, week nav.
- **Write (modal, `history: "push"`):** `router.push` — one back-step, so back
  closes the modal. Closing the modal (set param → null) does not push again.
- **Atomic multi-param write:** a lower-level `setParams({ tab: "charts", sub:
null, ex: null })` performs a single `router.replace`/`push`. Used when a write
  must change/clear more than one param (e.g. switching L1 tab clears stale L2/L3
  params).

**Suspense:** `useSearchParams()` in Next 15 requires a `<Suspense>` boundary.
Wrap the profile page content (`ClientProfileTabs` + page-level modals) in **one**
`<Suspense>` boundary in `page.tsx`. That single top boundary covers every
descendant hook — no per-component Suspense. The hook is built on
`useSearchParams()` + `usePathname()` + `useRouter()` and is reactive; no manual
`window.location` reads or `popstate` wiring.

## Section 2 — Param naming & ownership

Every param has a short, namespaced key. Each level **owns** its children and
clears them when it changes.

| Param      | Owner           | Values                                                                                          | Write    |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------- | -------- |
| `tab`      | L1              | training / charts / neat / nutrition / supplements / forms / access                             | replace  |
| `sub`      | L2 (training)   | microcycle / workouts / cardio                                                                  | replace  |
| `m`        | L3 (microcycle) | metrics / config                                                                                | replace  |
| `nd`       | nutrition       | plan index, setup/progress view                                                                 | replace  |
| `ft`, `fv` | forms           | form type, responses/config view                                                                | replace  |
| `ex`       | workouts/cardio | selected/expanded exercise id                                                                   | replace  |
| `hd`       | workouts        | history date filter                                                                             | replace  |
| `modal`    | any level       | edit / status / delete / video / addDay / addMeal / assign / preview / addQuestion / response … | **push** |
| `modalId`  | companion       | entity id the modal targets                                                                     | push     |

Example URL:
`/trainer/dashboard/clients/123?tab=training&sub=workouts&ex=squat&modal=video`

**Rules:**

1. **One `modal` param, namespaced by value** (+ optional `modalId`). Only one
   modal open at a time, matching current UX. Restores any modal on refresh.
2. **Parents clear children.** Changing `tab` clears `sub`, `m`, `ex`, `hd`, etc.;
   changing `sub` clears `m`, `ex`. Each tab declares its owned child keys in one
   place so the clear list is not scattered.
3. **Unknown/invalid values fall back to the default** (`tab=garbage` →
   `training`), so a stale or hand-edited URL never renders a broken screen.

**Destructive confirms:** Delete / Update-status / Edit-client are URL-restorable
like every other modal (no exceptions). Safe because no action auto-executes.

## Section 3 — Rollout, edge cases, testing

**Incremental rollout (each step ships independently, lowest risk first):**

1. Build `useUrlState` + the single Suspense boundary in `page.tsx`. No behavior
   change.
2. L1 tabs (`client-profile-tabs`) → `tab`. Biggest win, smallest change.
3. Page-level modals → `modal=edit|status|delete`.
4. L2 + L3 (`training-tabs`, `microcycle-tab`) → `sub`, `m`.
5. Per-tab deep state, one tab at a time: workouts/cardio (`ex`, `hd`, modals),
   nutrition (`nd`, add-day/meal), forms (`ft`, `fv`, modals), neat, supplements.

**Edge cases:**

- **Forms unsaved-changes guard:** `client-profile-tabs` already blocks tab
  changes with a `window.confirm` when forms are dirty. The URL write happens
  only after the guard passes (`setTab` called on confirm). Native back while
  dirty cannot be intercepted cleanly — this is an existing risk we do not expand
  scope to solve here.
- **Header back-link** (`/trainer/dashboard?tab=clients`) is a different page —
  unaffected.
- **Invalid param values** → defaults (rule 3).
- **Deep-link entry:** a URL with `?tab=nutrition&nd=…` must render that state on
  first paint with no flash. The hook reads the URL synchronously on mount.
- **Dashboard `localStorage.activeSection`** is unrelated and untouched.

**Error handling:** the hook is pure URL read/write — no network, no throw paths.
Malformed query strings are handled by `URLSearchParams`.

**Testing:**

- **Unit (`useUrlState`):** read/default, replace vs push, atomic multi-param,
  clear-children, invalid-fallback.
- **Component (`client-profile-tabs`):** renders the tab named by `?tab=`;
  switching tabs updates URL without adding history; clears child params on tab
  change.
- **E2E (Playwright, trainer flow):** open a client → Nutrición → open a modal →
  refresh → assert same tab + modal restored; press back → modal closes (not
  section exit); back again → leaves per Opción 1.

**Out of scope (YAGNI):** the client-facing portal; solving unsaved-form-loss on
native back.
