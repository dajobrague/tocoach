# Trainer Navigation Redesign — Iframe-Aware Dual Shell

**Date:** 2026-05-07
**Status:** Approved (design phase)
**Owner:** David Bracho

## 1. Context

The trainer app is used in two very different contexts:

1. **Embedded inside Go High Level** (desktop, primary): rendered via `<iframe>` alongside GHL's own left sidebar. Adding our own left sidebar would produce a "double sidebar" visual collision.
2. **Standalone** (PWA on mobile/desktop, or direct browser tab on `app.topcoach.io`): we have full chrome and can use a richer layout.

The current top-nav at `components/dashboard/top-navigation.tsx` is the same in both contexts and has accumulated problems:

- **Templates are scattered across three locations.** `Plantillas de Programas` (`/trainer/dashboard/templates`) and `Plantilla de Gráficas` (`/trainer/dashboard/charts-template`) are top-level nav items; `Plantilla de Check-in` (`/trainer/settings/checkin-defaults`) and `Plantilla de Hábitos Diarios` (`/trainer/settings/forms/habits`) are buried as link-cards inside `components/dashboard/settings-content.tsx:92-142`. There is no mental model that says "this is a template."
- **Hover-to-reveal labels.** Inactive nav items show only an icon and reveal text on hover (`top-navigation.tsx:148`). Violates the standard "icon + label" navigation rule and forces recall over recognition.
- **No hierarchy.** A daily-use page (Métricas) and a configure-once page (Plantilla de Gráficas) sit at the same visual weight.
- **Doesn't scale.** Seven items horizontally is already crowded.
- **Each top-level page re-implements its own nav.** `app/trainer/dashboard/page.tsx` and `app/trainer/dashboard/inventory/page.tsx` both render `<TopNavigation>` directly, with their own duplicated session-fetch logic. Sub-pages (`clients/[clientId]`, `settings/checkin-defaults`, `settings/forms/[formType]`) have NO nav at all today — the trainer has to use the browser back button.

Existing infrastructure that's already written but unused on the trainer dashboard:

- `components/dashboard/sidebar.tsx` — supports nested items via `SidebarItemType.Nest` and renders an accordion via HeroUI's `Accordion`.
- `components/dashboard/sidebar-drawer.tsx` — mobile drawer wrapper.

## 2. Goals

1. Group all four templates (`Programas`, `Gráficas`, `Check-in`, `Hábitos`) under a single expandable "Plantillas" item.
2. Render a top-nav when embedded in an iframe; render a left sidebar otherwise (PWA / browser).
3. Replace hover-to-reveal labels with always-visible labels in both shells.
4. Introduce a logical grouping: **Principal** (daily flow), **Bibliotecas** (catalog data), **Plantillas** (configuration set-and-forget).
5. Show the nav on every authenticated trainer page (including settings sub-pages, client profile, template editors) instead of only on the dashboard root and inventory.
6. Preserve all existing trainer functionality, URLs, and auth behavior. **Don't break the system.**

## 3. Non-goals

- **Not changing any existing trainer URL.** All four templates keep their current paths. We're regrouping the navigation, not refactoring the routing tree.
- Not changing trainer authentication, session cookies, or middleware behavior.
- Not changing client-portal navigation (`components/client-dashboard/*`).
- Not changing the platform-admin nav (`app/admin/*`).
- Not changing the underlying template data models, API endpoints, or feature behavior.
- Not introducing a settings-driven "let trainer pick their nav layout" feature. Detection + URL override is enough.

## 4. Detection: which shell to render

Detection runs on the client; the dashboard layout is already a client component (`app/trainer/dashboard/page.tsx:1`), so there is no SSR/hydration mismatch concern.

### Cascade (in order)

```ts
type ShellMode = "top" | "side";

function detectShellMode(): ShellMode {
  if (typeof window === "undefined") return "top"; // SSR-safe default = embedded (most common)

  // 1. Explicit URL override — escape hatch for support, debugging, or unforeseen GHL configs
  const param = new URLSearchParams(window.location.search).get("shell");
  if (param === "top" || param === "side") {
    localStorage.setItem("trainer.shellMode", param);
    return param;
  }

  // 2. Sticky memo from previous detection — eliminates flash on reload
  const memo = localStorage.getItem("trainer.shellMode");
  if (memo === "top" || memo === "side") return memo;

  // 3. Iframe detection — primary signal for GHL
  let inIframe = true;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  } // SOP throw = cross-origin iframe

  if (inIframe) {
    localStorage.setItem("trainer.shellMode", "top");
    return "top";
  }

  // 4. Standalone (PWA) or regular browser tab — both get sidebar
  localStorage.setItem("trainer.shellMode", "side");
  return "side";
}
```

### Why iframe is the primary signal (not PWA)

| Context                          | iframe? | PWA? | Result |
| -------------------------------- | ------- | ---- | ------ |
| Embedded in GHL                  | ✅      | ❌   | `top`  |
| PWA installed                    | ❌      | ✅   | `side` |
| Browser tab on `app.topcoach.io` | ❌      | ❌   | `side` |

Keying off PWA would push browser-tab users into the cramped top-nav; keying off iframe correctly classifies all three. The iframe signal is reliable because `next.config.js:90-92` confirms GHL uses real iframe embedding (the codebase explicitly removes `X-Frame-Options` to allow it).

### Edge cases handled

- **GHL changes embedding mechanism** (e.g. uses popup): the `?shell=top` URL param lets the trainer or support force the right layout.
- **First-load flash:** the `localStorage` memo is read synchronously inside a `useState` initializer — first-ever load may show the default (top) for one frame before swapping; subsequent loads are stable. This is acceptable.
- **Trainer toggles between contexts:** clearing `localStorage.trainer.shellMode` (or signing out) re-runs detection.

## 5. Information architecture

### New nav item structure (one source of truth)

```ts
// features/trainer/nav/nav-items.ts
export type TrainerNavItem = {
  key: string;
  title: string;
  icon: string;
  href?: string;
  items?: TrainerNavItem[]; // for grouped/expandable items
};

export type TrainerNavSection = {
  key: string;
  title: string; // "Principal", "Bibliotecas", "Plantillas"
  items: TrainerNavItem[];
};

export const TRAINER_NAV: TrainerNavSection[] = [
  {
    key: "principal",
    title: "Principal",
    items: [
      {
        key: "metricas",
        title: "Métricas",
        icon: "solar:chart-line-duotone",
        href: "/trainer/dashboard/metricas",
      },
      {
        key: "clients",
        title: "Clientes",
        icon: "solar:users-group-rounded-linear",
        href: "/trainer/dashboard/clients",
      },
      {
        key: "messaging",
        title: "Mensajería",
        icon: "solar:chat-round-dots-linear",
        href: "/trainer/dashboard/messaging",
      },
    ],
  },
  {
    key: "bibliotecas",
    title: "Bibliotecas",
    items: [
      {
        key: "exercise-library",
        title: "Ejercicios",
        icon: "solar:dumbbell-linear",
        href: "/trainer/dashboard/exercise-library",
      },
      {
        key: "inventory",
        title: "Suplementos",
        icon: "solar:box-linear",
        href: "/trainer/dashboard/inventory",
      },
    ],
  },
  {
    key: "plantillas",
    title: "Plantillas",
    items: [
      {
        key: "templates-group",
        title: "Plantillas",
        icon: "solar:folder-with-files-linear",
        items: [
          {
            key: "templates-programs",
            title: "Programas",
            icon: "solar:document-add-linear",
            href: "/trainer/dashboard/templates",
          },
          {
            key: "templates-charts",
            title: "Gráficas",
            icon: "solar:chart-square-linear",
            href: "/trainer/dashboard/charts-template",
          },
          {
            key: "templates-checkin",
            title: "Check-in",
            icon: "solar:calendar-mark-linear",
            href: "/trainer/settings/checkin-defaults",
          },
          {
            key: "templates-habits",
            title: "Hábitos diarios",
            icon: "solar:notebook-linear",
            href: "/trainer/settings/forms/habits",
          },
        ],
      },
    ],
  },
];
```

**No URLs are changed.** The four templates keep their existing paths; the nav config simply collects them under one "Plantillas" group.

### What's removed from the existing nav

- Top-level `Plantillas de Programas` and `Plantilla de Gráficas` items move into the `Plantillas` group.
- The two card-links in `components/dashboard/settings-content.tsx:92-142` (Plantilla de Check-in, Plantilla de Hábitos Diarios) are removed; settings keeps Profile + Brand only.
- The `setup` (onboarding) item stays as today: shown only when `session.onboarding_completed === false`, and it short-circuits to the redirect handled in `app/trainer/dashboard/page.tsx:215-243`. Onboarding logic untouched.

### What stays in the avatar dropdown (top-right corner of both shells)

Same as today: Configuración (brand + profile only now), Ayuda y soporte, Cerrar sesión.

## 6. Active state derivation

Both shells derive the active nav key from the current URL via `usePathname()`, not from `localStorage.activeSection` state.

The legacy `localStorage.activeSection` machinery in `dashboard/page.tsx:36-54` was a workaround for the state-based content switcher in that single file. Once the dashboard's section pages are reachable directly via URL (which they already are: `/trainer/dashboard/metricas`, `/trainer/dashboard/clients`, etc.), pathname-based active state is the natural choice and:

- makes browser back/forward work correctly,
- makes deep links work correctly (e.g. an email pointing at `/trainer/dashboard/messaging`),
- removes the brittleness of the `localStorage.activeSection` migration logic.

We retain `localStorage.activeSection` only as input to the existing onboarding redirect logic (we don't change that).

Mapping rule: the active key is the longest-prefix match against `item.href` for any leaf item in `TRAINER_NAV`. The `Plantillas` group is "expanded" if the current pathname matches any of its child hrefs.

## 7. Architecture

```
features/trainer/nav/
  ├── nav-items.ts                  ← TRAINER_NAV constant; one source of truth
  ├── use-shell-mode.ts             ← detection hook (cascade in §4)
  ├── use-active-key.ts             ← derives active leaf key from pathname
  ├── trainer-nav-shell.tsx         ← picks top vs side, renders correct shell
  └── shells/
      ├── top-shell.tsx             ← horizontal nav for embedded/iframe context
      └── side-shell.tsx            ← left sidebar for PWA/browser context

components/trainer/nav/
  └── plantillas-dropdown.tsx       ← shared dropdown panel for "Plantillas ▾" in top shell

app/trainer/
  ├── layout.tsx                    ← UNCHANGED — keeps existing trainer-app theme CSS
  ├── dashboard/
  │   └── layout.tsx                ← NEW — wraps `dashboard/*` with TrainerNavShell
  ├── settings/
  │   └── layout.tsx                ← NEW — wraps `settings/*` with TrainerNavShell
  └── (auth pages stay untouched: login, register, forgot-password, reset-password, setup-password)
```

### Why two layouts (dashboard/ + settings/) instead of one at /trainer

Auth pages (`login`, `register`, `forgot-password`, `reset-password`, `setup-password`) live at `app/trainer/*` and **must not** render the nav shell. Putting the shell in `app/trainer/layout.tsx` would put it on login pages.

Adding two sub-layouts (`dashboard/layout.tsx` and `settings/layout.tsx`) places the shell exactly on the authenticated routes that need it, without disturbing auth flows.

Trainer root `/trainer` (`app/trainer/page.tsx`) is a server-side redirect to either `/trainer/dashboard` or `/trainer/login` — never renders content, so it doesn't need the shell.

### Component responsibilities

**`use-shell-mode.ts`** — exposes `useShellMode(): "top" | "side"`. Reads from URL param > localStorage memo > iframe detect > fallback. Persists every detection. Subscribes to `display-mode` media query changes (rare, but handles the case of a trainer installing the PWA mid-session).

**`use-active-key.ts`** — exposes `useActiveKey(): string`. Reads `usePathname()`, longest-prefix matches against `TRAINER_NAV` leaf hrefs, returns the matching key (or empty string).

**`trainer-nav-shell.tsx`** — top-level wrapper. Reads `useShellMode()` + `useActiveKey()`, renders `<TopShell>` or `<SideShell>` with `{children}` for page content. Handles session fetch (lifted from the duplicated logic in `dashboard/page.tsx` and `inventory/page.tsx`), realtime-message badge, notification dropdown, avatar menu, logout.

**`top-shell.tsx`** — refined version of today's `TopNavigation`:

- Always-visible labels (kill the hover-to-reveal CSS — `top-navigation.tsx:147-152`).
- "Plantillas" rendered as a HeroUI `Dropdown` with a panel listing the four children, each with icon + title + brief subtitle.
- Mobile fallback: the existing `NavbarMenu` mobile drawer, but with the templates group rendered as an accordion section instead of flat items.

**`side-shell.tsx`** — uses the existing `Sidebar` component (`components/dashboard/sidebar.tsx`) configured with:

- Three `ListboxSection` blocks (one per nav section: Principal, Bibliotecas, Plantillas).
- Plantillas group rendered as `SidebarItemType.Nest` (the accordion variant already implemented at `sidebar.tsx:85-204`).
- Mobile: wrapped in `SidebarDrawer` triggered by a hamburger in the top bar.

### What changes in the existing pages

- **`app/trainer/dashboard/page.tsx`** — drop the `<TopNavigation>` render and the duplicated session/realtime-message logic; both move into `TrainerNavShell` (which is provided by the new `dashboard/layout.tsx`). The existing `activeSection` switch-case for content rendering stays as-is for backwards compatibility, but the `activeSection` value is no longer read from `localStorage` — it's derived from URL via `useActiveKey()`. The localStorage code becomes a one-time migration that clears the legacy value.
- **`app/trainer/dashboard/inventory/page.tsx`** — drop the `<TopNavigation>` render and duplicated session-fetch; rely on `dashboard/layout.tsx` to provide the shell.
- **`app/trainer/settings/checkin-defaults/page.tsx`**, **`app/trainer/settings/forms/[formType]/page.tsx`** — no internal changes; they automatically inherit the new shell via `settings/layout.tsx`.
- **`app/trainer/dashboard/clients/[clientId]/*`** and other dashboard sub-pages — no changes; they automatically inherit the new shell.
- **`components/dashboard/settings-content.tsx`** — remove the two `<Card as={Link}>` blocks at lines 92-142.

## 8. Visual design

Same look-and-feel system the app already uses — HeroUI v2, Tailwind v4, Solar icons, slate/black palette. No new design tokens. The trainer-app theme CSS in `app/trainer/layout.tsx` continues to apply.

### Top shell (embedded mode)

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Logo] TOP COACH    Métricas  Clientes  Mensajería                      │
│        Dashboard    Ejercicios  Suplementos  Plantillas ▾  [🔔][Avatar▾]│
└────────────────────────────────────────────────────────────────────────┘
```

Plantillas dropdown panel:

```
┌────────────────────────────┐
│  📁 Plantillas             │
├────────────────────────────┤
│  📄 Programas              │
│  📊 Gráficas               │
│  📅 Check-in               │
│  📓 Hábitos diarios        │
└────────────────────────────┘
```

### Side shell (PWA / browser)

```
┌──────────────────────────┐  ┌─────────────────────────────────┐
│  [TC]  TOP COACH         │  │ [☰ on mobile]      [🔔] [Avatar]│
│        Dashboard         │  ├─────────────────────────────────┤
├──────────────────────────┤  │                                 │
│ PRINCIPAL                │  │     Page content here           │
│  📊  Métricas    (active)│  │                                 │
│  👥  Clientes            │  │                                 │
│  💬  Mensajería     [3]  │  │                                 │
│                          │  │                                 │
│ BIBLIOTECAS              │  │                                 │
│  🏋   Ejercicios         │  │                                 │
│  📦  Suplementos         │  │                                 │
│                          │  │                                 │
│  📁  Plantillas       ▾  │  │                                 │
│       └ Programas        │  │                                 │
│       └ Gráficas         │  │                                 │
│       └ Check-in         │  │                                 │
│       └ Hábitos diarios  │  │                                 │
└──────────────────────────┘  └─────────────────────────────────┘
```

UX rules applied (from `ui-ux-pro-max`):

- `nav-label-icon`: every item has both icon and visible label.
- `nav-state-active`: current location highlighted via `data-[selected=true]:bg-default-100` (already in sidebar.tsx) and bold weight (top shell).
- `nav-hierarchy`: section headers (Principal/Bibliotecas/Plantillas) provide visual grouping.
- `touch-target-size`: existing `h-11` (44px) on sidebar items, `h-9` (36px) on top-nav buttons — bump top-nav to `h-10` minimum to meet 40px tap-target floor in embedded mode.
- `state-preservation`: derive active from URL not state, so back/forward works.

## 9. What we explicitly do NOT break

| Area                         | Behavior preserved                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trainer authentication       | `lib/auth/session.ts` untouched; cookies, JWT, middleware unchanged.                                                                                                      |
| All existing URLs            | No route moves, no redirects, no path renames. Bookmarks, GHL config, support docs all keep working.                                                                      |
| Onboarding flow              | The `setup` redirect logic in `dashboard/page.tsx:215-243` remains; new shell respects `session.onboarding_completed`.                                                    |
| `localStorage.activeSection` | A one-time effect on first page load after the redesign clears the legacy value if found. The setup-completion guard logic still reads/writes it (we don't disturb that). |
| Messaging unread badge       | `useRealtimeMessages` integration in `dashboard/page.tsx:247-260` moves into `TrainerNavShell` with no logic change; functionally identical.                              |
| Notification bell            | `TrainerNotificationsDropdown` moves into the top bar of both shells unchanged.                                                                                           |
| API routes                   | None touched.                                                                                                                                                             |
| Settings page                | Profile + Brand tabs unchanged; only the two template card-links removed.                                                                                                 |
| Dynamic forms route          | `app/trainer/settings/forms/[formType]/page.tsx` is not modified; it's just linked into the new "Plantillas" group at the same URL it already serves.                     |
| Iframe embedding             | `next.config.js` headers untouched. GHL iframe continues to work.                                                                                                         |
| Theme CSS                    | `app/trainer/layout.tsx` is not modified — its trainer-app theme classes still apply globally.                                                                            |
| Auth pages                   | `login`, `register`, `forgot-password`, `reset-password`, `setup-password` unchanged; do not get the nav shell.                                                           |

## 10. Migration & rollout

This is a single-deploy migration; no DB changes, no API changes. The new shell either renders or it doesn't.

### Phase A — additive scaffolding (safe to merge alone)

1. Add `features/trainer/nav/` module (nav-items, hooks, shell, sub-shells).
2. Add `app/trainer/dashboard/layout.tsx` and `app/trainer/settings/layout.tsx` rendering `<TrainerNavShell>{children}</TrainerNavShell>`.
3. At this point: every page under `/trainer/dashboard/*` and `/trainer/settings/*` now renders **both** the new shell (from layout) AND its own existing `<TopNavigation>` (where present). This is intentional — verify one full visual pass before continuing.

### Phase B — remove duplicates

4. Remove the inline `<TopNavigation>` and duplicated session-fetch from `app/trainer/dashboard/page.tsx`.
5. Remove the inline `<TopNavigation>` and duplicated session-fetch from `app/trainer/dashboard/inventory/page.tsx`.
6. Remove the two template card-links from `components/dashboard/settings-content.tsx:92-142`.
7. Run `npm run type-check` and `npm run lint:check`.

### Phase C — cleanup

8. Delete `components/dashboard/sidebar-items.tsx` (replaced by `nav-items.ts`).
9. Delete `components/dashboard/top-navigation.tsx` (replaced by `top-shell.tsx`).
10. Delete `components/dashboard/sidebar.tsx`'s active-section state machinery if unused elsewhere (verify with grep first).

### Rollback plan

- **From Phase B:** revert the four file deletions/edits. Phase A scaffolding can stay (it does nothing harmful when no layout uses it).
- **From Phase A:** delete the two new layout files. The trainer area returns to its current state because each top-level page still owns its own nav.

The rollback granularity is the git revert of one phase. We commit each phase separately to make this clean.

## 11. Testing strategy

- **Unit-ish (Jest):** snapshot of `TRAINER_NAV` so accidental edits to the config are caught in review.
- **Detection hook (Jest):** tests covering each cascade branch — URL param, localStorage memo, iframe true, iframe false + standalone, iframe false + browser. Mock `window`, `matchMedia`, `localStorage`.
- **Active-key hook (Jest):** longest-prefix matching across all `TRAINER_NAV` leaf hrefs.
- **Manual matrix** (the codebase has no automated browser tests today):
  1. Open `/trainer/dashboard` in a regular browser tab → side shell renders.
  2. Open the PWA-installed app → side shell renders.
  3. Open `/trainer/dashboard` in a small `<iframe>` (build a one-page test harness or use a GHL sandbox) → top shell renders.
  4. Visit `/trainer/dashboard?shell=top` in a browser tab → top shell forces.
  5. Visit `/trainer/dashboard?shell=side` inside iframe → side shell forces.
  6. Click each item under "Plantillas" — confirm the existing four pages render unchanged inside the new shell.
  7. Mobile (375px viewport) in side mode → drawer opens via hamburger; templates accordion expands and lists all four.
  8. Trainer with `session.onboarding_completed = false` → setup item shows; redirect to `/trainer/dashboard/setup` still works.
  9. With `localStorage.activeSection = "templates"` previously set, load `/trainer/dashboard` — confirm value is cleared without disrupting active highlighting.
  10. Sub-pages that previously had no nav (e.g. `/trainer/dashboard/clients/[clientId]`, `/trainer/settings/forms/habits`) — confirm they now show the nav shell, with Plantillas → Hábitos highlighted on the latter.
  11. Logout from the avatar dropdown — confirm session cleared, redirect to `/trainer/login`, login page does NOT show the nav shell.
  12. Open the app, install as PWA, open the PWA → side shell takes effect (memo persists across browser-PWA boundary because both share localStorage on the same origin).

## 12. Risks & open questions

- **Risk: layout double-wrap before Phase B.** Between Phase A and Phase B, top-level pages render both the new shell and their own `<TopNavigation>`. This is visible and ugly. Mitigation: keep Phase A and B in the same PR (review-only Phase A artifacts in commit history; only deploy after Phase B). Or feature-flag the layouts to no-op until Phase B lands. Default: same-PR.
- **Risk: localStorage flush.** A trainer who clears site data sees one frame of `top` shell (the SSR default) before detection runs and possibly switches to `side`. Acceptable trade-off; alternative is server-side detection via cookie which we explicitly didn't do.
- **Risk: iframe detection false negative.** If GHL changes embedding mechanism (e.g. uses a popup), `window.self !== window.top` returns false. Mitigation: `?shell=top` URL param escape hatch, plus the localStorage memo persists once a user has been detected once correctly.
- **Open: trainer cookie SameSite=Lax in iframe.** Out of scope for this redesign but flagged: how does trainer auth currently survive cross-origin iframe embedding given `lib/auth/session.ts:15` sets `sameSite: "lax"`? Worth a separate investigation. Not blocking this work because we're not changing auth.
- **Open: PWA on landscape tablet.** Sidebar is the right call but we should confirm the breakpoint at which we collapse the sidebar to icon-rail (current sidebar supports `isCompact` at `sidebar.tsx:49`). Suggested: collapse below 1024px.

## 13. Summary of files touched

**New:**

- `features/trainer/nav/nav-items.ts`
- `features/trainer/nav/use-shell-mode.ts`
- `features/trainer/nav/use-active-key.ts`
- `features/trainer/nav/trainer-nav-shell.tsx`
- `features/trainer/nav/shells/top-shell.tsx`
- `features/trainer/nav/shells/side-shell.tsx`
- `components/trainer/nav/plantillas-dropdown.tsx`
- `app/trainer/dashboard/layout.tsx`
- `app/trainer/settings/layout.tsx`

**Modified:**

- `app/trainer/dashboard/page.tsx` — strip out `<TopNavigation>` import + render, strip duplicated session-fetch + realtime hook, keep onboarding-redirect + section-switch logic; clear legacy `localStorage.activeSection` once on mount.
- `app/trainer/dashboard/inventory/page.tsx` — strip out `<TopNavigation>` import + render and duplicated session-fetch; rely on layout-provided shell.
- `components/dashboard/settings-content.tsx` — remove the two `<Card as={Link}>` blocks at lines 92-142 (Plantilla de Check-in, Plantilla de Hábitos Diarios).

**Untouched (explicitly):**

- `app/trainer/layout.tsx` — keep theme CSS as-is.
- `app/trainer/login/`, `register/`, `forgot-password/`, `reset-password/`, `setup-password/` — auth flows untouched.
- `app/trainer/dashboard/templates/`, `charts-template/`, `setup/`, `clients/`, `messaging/`, `metricas/`, `exercise-library/` — no internal changes; they inherit the shell from the new `dashboard/layout.tsx`.
- `app/trainer/settings/checkin-defaults/`, `settings/forms/[formType]/` — no internal changes; they inherit the shell from the new `settings/layout.tsx`.
- `lib/auth/*`, `middleware.ts`, `next.config.js` — auth and security configuration untouched.
- All API routes, all data layer, all features — untouched.

**Deleted (Phase C):**

- `components/dashboard/sidebar-items.tsx`
- `components/dashboard/top-navigation.tsx`

## 14. Acceptance criteria

- All four templates appear under a single "Plantillas" expandable item in the new nav, in both shells.
- The two template card-links no longer appear on `/trainer/settings`.
- In iframe context (GHL or test harness): top shell renders.
- In standalone context (PWA, browser tab): side shell renders.
- `?shell=top` and `?shell=side` URL params override detection.
- All existing trainer URLs continue to work without redirects.
- `npm run type-check` and `npm run lint:check` pass.
- No change in behavior for: auth flows, onboarding, messaging realtime badge, notification dropdown, avatar dropdown menu, theme CSS.
- Manual matrix in §11 passes end-to-end.
