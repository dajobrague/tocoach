# Design Unification — Fase 0 (Kit + Tema Trainer) + Fase 1 (Perfil del Cliente) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El trainer app adopta el tema del tenant (adiós override slate), los primitivos del lenguaje moderno se extraen a un kit compartido mínimo, y el perfil individual del cliente (trainer) se reskinea completo sobre ese kit.

**Architecture:** Fase 0 conecta el pipeline de tema existente (`lib/theme/render-css.ts`) a las rutas `/trainer/*` resolviendo el tenant desde la sesión del trainer (cookie → `tenant_host` → lookup por columna `host`), y extrae 4 primitivos (OutlineChip, CenteredState, SegmentedControl, IconTile) desde sus implementaciones canónicas del portal cliente. Fase 1 aplica tokens semánticos HeroUI + el kit a todo `components/dashboard/client-profile/` (excepto nutrition v1, que muere por rollout).

**Tech Stack:** Next.js 15 App Router, HeroUI v2, Tailwind v4, @iconify/react (set solar), vitest.

**Spec:** `.impeccable/critique/2026-08-18T03-54-34Z__app-trainer.md` (auditoría) + decisiones de David registradas en memoria `project-design-unification`: (1) trainer adopta color del tenant, (2) nutrition v1 NO se reskinea, (3) tokens dark-safe pero dark mode NO se activa, (4) kit mínimo + perfil completo.

## Global Constraints

- **Workflow**: git worktree aislado (skill `superpowers:using-git-worktrees`, symlink node_modules). Fase 0 = branch `feat/design-f0-kit-theme` → PR a main. Fase 1 = branch `feat/design-f1-client-profile` (desde main con F0 mergeado) → PR a main. NUNCA push directo a main.
- **Gates por tarea**: `npm run type-check` y `npm run lint:check` deben pasar (build NO chequea tipos — `ignoreBuildErrors: true`). `npm test` al final de cada tarea con tests.
- **TS estricto**: `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` activos. Nunca `!` para silenciar; narrow o default explícito.
- **Conventional Commits**: subject ≤100 chars, sin punto final.
- **Paridad visual en extracciones**: los componentes del kit reproducen las clases EXACTAS de su fuente canónica; migrar un consumidor no puede cambiar ni un píxel de las superficies modernas.
- **PROHIBIDO** importar de `components/ui/` (restos shadcn huérfanos con tokens inexistentes: `bg-destructive`, `ring-ring`).
- **Variables HeroUI son triples HSL** (`222 47% 11%`), NUNCA RGB (produce marrón — bug histórico documentado en `app/trainer/layout.tsx:19-22`).
- **Iconos**: `@iconify/react` set `solar:*` (`-linear` pasivo, `-bold` activo/énfasis). Nada de emoji ni glifos de texto (`▶`, `🏅`, `⚠️`, `★`) como iconos.
- **Dark-safe**: tintes con alpha (`border-warning/20 bg-warning/5`), nunca escalas fijas (`bg-warning-50`). Dark mode NO se activa en este proyecto.
- **Excluidos de Fase 1** (mueren con el rollout v2): `components/dashboard/client-profile/tabs/nutrition-tab.tsx` y `components/dashboard/client-profile/tabs/progress/nutrition-section.tsx`. Ningún grep-gate los cuenta y ninguna tarea los toca.
- **Copy es-ES intacto** — este proyecto cambia píxeles, no textos (excepción: reemplazar glifos por iconos).

### Tabla de Mapeo Canónica (todas las tareas de reskin la aplican)

| Legacy | Reemplazo | Nota |
|---|---|---|
| `bg-gray-50` (canvas de página) | `bg-background` | |
| `bg-white` (cards/slabs) | `bg-content1` | |
| `border-gray-100/200/300` | `border-default-100/200/300` | `divide-gray-100` → `divide-default-100` |
| `text-gray-900` / `text-black` | `text-foreground` | |
| `text-gray-700` | `text-default-700` | |
| `text-gray-500/600` | `text-default-500` | |
| `text-gray-400` | `text-default-400` | |
| `bg-gray-50/100` (tiles/inset) | `bg-default-50` / `bg-default-100` | |
| `text-blue-600`, `border-blue-500/600`, `bg-blue-600` (acentos) | `text-primary`, `border-primary`, `bg-primary` | |
| `bg-blue-50 border-blue-100/200` (info cards) | `rounded-large border border-primary/25 bg-primary/5` + texto `text-default-600`/`text-foreground` | receta canónica: `nutrition-tab-switch.tsx:45-57` |
| pills `bg-blue-50 text-blue-700 border-blue-200` | `<OutlineChip tone="primary">` | |
| `bg-red-50 text-red-600` (botones) | HeroUI `color="danger" variant="flat"` sin className de color | |
| cajas rojas `bg-red-50 border-red-200 text-red-700` | `border-danger/20 bg-danger/5` + `text-danger` | |
| `bg-emerald-100 text-emerald-700` (estado ok) | `border-success/40 bg-success/10 text-success-700` o Chip `color="success" variant="flat"` | |
| `bg-amber-100 text-amber-700` (estado pendiente) | `border-warning/40 bg-warning/10` análogo | |
| `bg-purple-*` / `indigo` / pasteles decorativos | `bg-primary/10 text-primary` o `bg-default-100 text-default-600` según intención | |
| `text-white` sobre botón de color | quitar (HeroUI pone foreground) o `text-primary-foreground` | |
| spinner div `animate-spin rounded-full border-b-2 ...` | `<Spinner color="primary" />` de HeroUI | |
| headings sin fuente | añadir `font-heading` a h1/h2/títulos de card | |
| empty/error states ad-hoc | `<CenteredState icon título subtítulo action?>` | |

**Colores de identidad que NO se tocan**: macros (protein=blue-500 etc., `macro-ui.tsx:11-15`), tipos de sesión (`session-type-style.ts:41-84`), tintes de meal-slot (`cycle-format.ts:21-58`), ámbar de récords (`exercise-progression-section.tsx:12-14`). Tienen rationale escrito; son producto, no deuda.

---

# FASE 0 — branch `feat/design-f0-kit-theme`

### Task 1: Foreground con contraste para primary/secondary

**Files:**
- Modify: `lib/theme/color-utils.ts` (añadir función al final)
- Test: `lib/theme/__tests__/foreground.test.ts` (crear)

**Interfaces:**
- Produces: `pickForegroundHSL(hex: string): string` — devuelve el triple HSL (`"0 0% 100%"` blanco o `"222 47% 11%"` oscuro) que más contraste da sobre `hex`. Usa `getContrastRatio` de `lib/theme/contrast.ts`.

- [ ] **Step 1: Test que falla**

```ts
// lib/theme/__tests__/foreground.test.ts
import { describe, expect, it } from "vitest";

import { pickForegroundHSL } from "../color-utils";

describe("pickForegroundHSL", () => {
  it("elige blanco sobre marcas oscuras", () => {
    expect(pickForegroundHSL("#0f172a")).toBe("0 0% 100%"); // slate-900
    expect(pickForegroundHSL("#7c2d12")).toBe("0 0% 100%"); // marrón oscuro
  });

  it("elige oscuro sobre primarios pastel (el caso que motivó el fix)", () => {
    expect(pickForegroundHSL("#fde047")).toBe("222 47% 11%"); // amarillo
    expect(pickForegroundHSL("#a7f3d0")).toBe("222 47% 11%"); // menta pastel
  });

  it("con hex inválido cae a blanco (comportamiento actual)", () => {
    expect(pickForegroundHSL("garbage")).toBe("0 0% 100%");
  });
});
```

- [ ] **Step 2: Verificar que falla** — Run: `npx vitest run lib/theme/__tests__/foreground.test.ts`. Expected: FAIL (`pickForegroundHSL` no existe).

- [ ] **Step 3: Implementación**

```ts
// al final de lib/theme/color-utils.ts
import { getContrastRatio } from "./contrast";

const DARK_FOREGROUND_HSL = "222 47% 11%"; // slate-900, ya usado como neutro oscuro del sistema
const LIGHT_FOREGROUND_HSL = "0 0% 100%";

/**
 * Elige el foreground (HSL triple) con mayor contraste WCAG sobre `hex`.
 * Sustituye el blanco fijo de --heroui-primary-foreground: con primarios
 * pastel, texto blanco era ilegible (regla documentada en
 * components/client-dashboard/dashboard-content.tsx:398-416).
 */
export function pickForegroundHSL(hex: string): string {
  try {
    const white = getContrastRatio("#ffffff", hex);
    const dark = getContrastRatio("#0f172a", hex);

    return dark > white ? DARK_FOREGROUND_HSL : LIGHT_FOREGROUND_HSL;
  } catch {
    return LIGHT_FOREGROUND_HSL;
  }
}
```

Nota: si `getContrastRatio` no lanza con input inválido sino que devuelve `NaN`, adaptar: `Number.isFinite(dark) && dark > white`. Leer `lib/theme/contrast.ts:34` antes de implementar.

- [ ] **Step 4: Verificar que pasa** — Run: `npx vitest run lib/theme/__tests__/foreground.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(theme): pick primary foreground by wcag contrast instead of fixed white"`

---

### Task 2: render-css usa el foreground calculado + variante scoped para trainer

**Files:**
- Modify: `lib/theme/render-css.ts:164` y `:178` (foregrounds), `:112` (firma), `:149-151` (selector)
- Test: `lib/theme/__tests__/render-css-scope.test.ts` (crear)

**Interfaces:**
- Consumes: `pickForegroundHSL` (Task 1).
- Produces: `generateThemeCSS(theme: ThemeConfig, opts?: { scope?: string }): string` — sin `opts`, output idéntico al actual salvo los dos foregrounds; con `scope: ".trainer-app"`, TODOS los bloques de selectores usan `.trainer-app` en lugar de `html.light, html:not(.dark)` y `html ` (prefijos de overrides de clase, `render-css.ts:222-299`). También `renderTrainerThemeCSS(context: TenantMetadata): string | null` — espejo de `renderInlineThemeCSS` (misma validación/sanidad, leerla antes de implementar) pero con scope `.trainer-app`.

- [ ] **Step 1: Test que falla**

```ts
// lib/theme/__tests__/render-css-scope.test.ts
import { describe, expect, it } from "vitest";

import { generateThemeCSS } from "../render-css";
import { DEFAULT_THEME } from "../schema"; // usar el default/validador real del módulo; ajustar import al leer schema.ts

describe("generateThemeCSS scope", () => {
  it("sin scope emite selectores html (comportamiento actual)", () => {
    const css = generateThemeCSS(DEFAULT_THEME);
    expect(css).toContain("html:not(.dark)");
    expect(css).not.toContain(".trainer-app");
  });

  it("con scope .trainer-app no queda ningún selector html", () => {
    const css = generateThemeCSS(DEFAULT_THEME, { scope: ".trainer-app" });
    expect(css).toContain(".trainer-app");
    expect(css).not.toMatch(/html\.light|html:not\(\.dark\)|^html /m);
  });

  it("primary-foreground ya no es blanco fijo para marcas claras", () => {
    const pastel = structuredClone(DEFAULT_THEME);
    pastel.colors.brand = "#fde047";
    expect(generateThemeCSS(pastel)).toContain(
      "--heroui-primary-foreground: 222 47% 11% !important"
    );
  });
});
```

Si `DEFAULT_THEME` no existe con ese nombre en `schema.ts`, usar el helper de default real del módulo (buscar `validateTheme`/defaults) y ajustar el import — el test debe usar un theme válido del sistema, no uno inventado.

- [ ] **Step 2: Verificar que falla** — Run: `npx vitest run lib/theme/__tests__/render-css-scope.test.ts`.
- [ ] **Step 3: Implementar**
  1. En `generateThemeCSS`, reemplazar `:164` `--heroui-primary-foreground: 0 0% 100% !important;` por `--heroui-primary-foreground: ${pickForegroundHSL(theme.colors.brand)} !important;` y `:178` (secondary) por `${pickForegroundHSL(theme.colors.accent)}`.
  2. Añadir `opts?: { scope?: string }`: `const sel = opts?.scope ?? "html.light,\nhtml:not(.dark)";` y usar `sel` en el bloque `:150-151`. Para los overrides de alta especificidad (`:222-299`, prefijo `html `), usar `` const prefix = opts?.scope ? `${opts.scope} ` : "html "; ``.
  3. Añadir `renderTrainerThemeCSS`: copiar la estructura de `renderInlineThemeCSS` (validación del theme, guard de CSS sospechoso, return null en fallo) llamando `generateThemeCSS(theme, { scope: ".trainer-app" })`.
- [ ] **Step 4: Verificar** — Run: `npx vitest run lib/theme/ && npm run type-check`. Expected: PASS, incluidos los tests preexistentes de `lib/theme/__tests__/` (si alguno asserta el blanco fijo, actualizarlo: el cambio de foreground es intencional).
- [ ] **Step 5: Reporte de tenants afectados** (verificación humana, no bloqueante): script rápido en scratchpad que recorra los `theme_json.colors.brand` de los tenants de prod (via MCP Supabase `execute_sql`: `select slug, theme_json->'colors'->>'brand' as brand from tenants where status='active'`) y aplique `pickForegroundHSL` a cada uno; listar cuáles flipean de blanco→oscuro para que David los revise visualmente tras el deploy. Guardar el listado en el PR description.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(theme): contrast-aware foregrounds and scoped css generation for trainer app"`

---

### Task 3: El trainer app adopta el tema del tenant

**Files:**
- Modify: `lib/tenant/loader.ts` (añadir `loadTenantMetadataByHost`)
- Modify: `app/trainer/layout.tsx` (client → server + inyección de tema)
- Create: `features/trainer/nav/trainer-shell-gate.tsx` (client component con la lógica actual de pathname)

**Interfaces:**
- Consumes: `renderTrainerThemeCSS` (Task 2), `getTrainerSession` (`lib/auth/session.ts` — verificar nombre exacto del helper server-side que lee la cookie `trainer-session`; el interface `TrainerSession` está en `session.ts:71` y trae `tenant_host: string`).
- Produces: `loadTenantMetadataByHost(host: string): Promise<TenantMetadata | null>` — igual que `loadTenantMetadata` pero `.eq("host", ...)` con su propio cache (prefijo de key `host:` para no colisionar con el cache por slug).

- [ ] **Step 1: Añadir `loadTenantMetadataByHost` a `loader.ts`** — copiar la estructura de `loadTenantMetadata` (`loader.ts:51-118`: mismo select, mismo TTL, mismo logging) cambiando el filtro a `.eq("host", normalizedHost)` y cacheando bajo `` `host:${normalizedHost}` ``. Exportarla. Actualizar `clearTenantCache` (`loader.ts:172`) para limpiar también la key `host:` (el bug de cache dual slug/host ya mordió una vez — ver historial).
- [ ] **Step 2: Crear el gate cliente**

```tsx
// features/trainer/nav/trainer-shell-gate.tsx
"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { TrainerNavShell } from "@/features/trainer/nav/trainer-nav-shell";

const SHELL_PATH_PREFIXES = ["/trainer/dashboard", "/trainer/settings"];

export function TrainerShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const useShell = SHELL_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  return useShell ? <TrainerNavShell>{children}</TrainerNavShell> : children;
}
```

- [ ] **Step 3: Reescribir `app/trainer/layout.tsx` como server component**

```tsx
import React from "react";

import { getTrainerSession } from "@/lib/auth/session"; // verificar nombre real del export
import { loadTenantMetadataByHost } from "@/lib/tenant/loader";
import { renderTrainerThemeCSS } from "@/lib/theme/render-css";
import { TrainerShellGate } from "@/features/trainer/nav/trainer-shell-gate";

// Fallback monocromo (login/register o sesión sin tenant): el bloque slate
// histórico, intacto. HeroUI resuelve --heroui-* dentro de hsl(), así que los
// valores DEBEN ser triples HSL (RGB aquí produjo marrón — no repetir).
const TRAINER_FALLBACK_CSS = `
  .trainer-app {
    --heroui-primary-50: 210 40% 98% !important;
    --heroui-primary-100: 210 40% 96% !important;
    --heroui-primary-200: 214 32% 91% !important;
    --heroui-primary-300: 213 27% 84% !important;
    --heroui-primary-400: 215 20% 65% !important;
    --heroui-primary-500: 215 16% 47% !important;
    --heroui-primary-600: 215 19% 35% !important;
    --heroui-primary-700: 215 25% 27% !important;
    --heroui-primary-800: 217 33% 18% !important;
    --heroui-primary-900: 222 47% 11% !important;
    --heroui-primary: 222 47% 11% !important;
    --heroui-primary-foreground: 0 0% 100% !important;
  }
`;

export default async function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let themeCss: string | null = null;

  try {
    const session = await getTrainerSession();

    if (session?.tenant_host) {
      const tenant = await loadTenantMetadataByHost(session.tenant_host);

      if (tenant && tenant.status === "active") {
        themeCss = renderTrainerThemeCSS(tenant);
      }
    }
  } catch {
    themeCss = null; // cae al fallback slate; nunca romper el render por tema
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{ __html: themeCss ?? TRAINER_FALLBACK_CSS }}
      />
      <div className="trainer-app">
        <TrainerShellGate>{children}</TrainerShellGate>
      </div>
    </>
  );
}
```

Si `getTrainerSession` requiere `cookies()`/`headers()` explícitos o tiene otro nombre, adaptar leyendo `lib/auth/session.ts` completo primero. Si un layout server con cookies genera error de static rendering en alguna ruta `/trainer/*`, añadir `export const dynamic = "force-dynamic"` (verificar impacto: estas rutas ya son dinámicas por auth).

- [ ] **Step 4: Verificar** — Run: `npm run type-check && npm run lint:check && npm test`. Expected: PASS. Luego `npm run dev` y smoke manual: (a) `/trainer/login` sigue monocromo slate; (b) `/trainer/dashboard` con sesión del tenant de David muestra el color de marca del tenant en botones `color="primary"`, checkboxes, tabs de HeroUI; (c) portal cliente `/{slug}/dashboard` intacto.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(trainer): adopt tenant theme in trainer app via session host lookup"`

---

### Task 4: Kit — OutlineChip + CenteredState

**Files:**
- Create: `components/shared/outline-chip.tsx`, `components/shared/centered-state.tsx`
- Modify (migración de canónicos): `components/client-dashboard/meal-cycle/menu-picker.tsx:41-61`, `components/client-dashboard/meal-cycle/meal-cycle-content.tsx:68-88`
- Test: `components/shared/__tests__/kit.test.tsx` (crear; usar el setup de testing existente en `components/client-dashboard/__tests__/` como referencia de imports/config)

**Interfaces:**
- Produces: `OutlineChip({ children, tone = "primary", className }: { children: React.ReactNode; tone?: "primary" | "muted" | "success" | "warning" | "danger"; className?: string })` y `CenteredState({ icon, title, subtitle, action }: { icon: string; title: string; subtitle?: string; action?: React.ReactNode })`.

- [ ] **Step 1: Tests que fallan**

```tsx
// components/shared/__tests__/kit.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CenteredState } from "../centered-state";
import { OutlineChip } from "../outline-chip";

describe("OutlineChip", () => {
  it("tone primary reproduce la receta canónica de menu-picker", () => {
    render(<OutlineChip tone="primary">Activo</OutlineChip>);
    const chip = screen.getByText("Activo");
    expect(chip.className).toContain("border-primary/50");
    expect(chip.className).toContain("text-primary");
    expect(chip.className).toContain("rounded-full");
  });

  it("tone muted usa default-300/500", () => {
    render(<OutlineChip tone="muted">Off</OutlineChip>);
    expect(screen.getByText("Off").className).toContain("border-default-300");
  });
});

describe("CenteredState", () => {
  it("renderiza icono, título y subtítulo opcional", () => {
    render(
      <CenteredState
        icon="solar:ghost-linear"
        subtitle="Sin datos"
        title="Vacío"
      />
    );
    expect(screen.getByText("Vacío")).toBeTruthy();
    expect(screen.getByText("Sin datos")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verificar que fallan** — Run: `npx vitest run components/shared/__tests__/kit.test.tsx`.
- [ ] **Step 3: Implementar**

```tsx
// components/shared/outline-chip.tsx
import React from "react";

const TONES = {
  primary: "border-primary/50 text-primary",
  muted: "border-default-300 text-default-500",
  success: "border-success/50 text-success-700",
  warning: "border-warning/50 text-warning-700",
  danger: "border-danger/50 text-danger",
} as const;

/** Chip outline canónico del lenguaje moderno: borde + texto tintado sobre el
 *  fondo de la card, legible con cualquier tema de tenant (un tinte relleno
 *  puede tragarse texto del mismo tono). Fuente: meal-cycle/menu-picker. */
export function OutlineChip({
  children,
  className = "",
  tone = "primary",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
```

```tsx
// components/shared/centered-state.tsx
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

/** Empty/error state canónico: card con icono 44px, título y subtítulo.
 *  Fuente: meal-cycle-content CenteredState. */
export function CenteredState({
  action,
  icon,
  subtitle,
  title,
}: {
  action?: React.ReactNode;
  icon: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <Card className="mt-6">
      <CardBody className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Icon className="text-default-400" icon={icon} width={44} />
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {subtitle !== undefined ? (
          <p className="max-w-sm text-sm text-default-500">{subtitle}</p>
        ) : null}
        {action ?? null}
      </CardBody>
    </Card>
  );
}
```

Ojo `exactOptionalPropertyTypes`: los props opcionales se declaran `subtitle?: string` y los call-sites que hoy pasan `subtitle={undefined}` deben omitir el prop.

- [ ] **Step 4: Migrar los canónicos** — En `menu-picker.tsx`: borrar el `StatusChip` local (`:41-61`) e importar `OutlineChip` (`tone="muted"` donde usaba `tone: "muted"`; el sizing local era `px-1.5 text-[10px]` vs kit `px-2 text-[11px]` — para paridad de píxel EXACTA, pasar `className="px-1.5 text-[10px]"` en los usos migrados de menu-picker). En `meal-cycle-content.tsx`: borrar `CenteredState` local (`:68-88`) e importar del kit; verificar que ningún uso pasaba `subtitle={undefined}` explícito.
- [ ] **Step 5: Verificar** — Run: `npx vitest run components/shared && npm run type-check && npm run lint:check && npm test`. Expected: PASS. Smoke visual: `/{slug}/plan-de-comidas` idéntico.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(kit): extract OutlineChip and CenteredState from meal-cycle canonicals"`

---

### Task 5: Kit — SegmentedControl

**Files:**
- Create: `components/shared/segmented-control.tsx`
- Modify (migración): `components/client-dashboard/dashboard-content.tsx:561-593` (selector de período)
- Test: añadir a `components/shared/__tests__/kit.test.tsx`

**Interfaces:**
- Produces: `SegmentedControl<K extends string>({ ariaLabel, onChange, options, value }: { ariaLabel: string; onChange: (key: K) => void; options: readonly { key: K; label: string }[]; value: K })`.

- [ ] **Step 1: Test que falla**

```tsx
// añadir a kit.test.tsx
import { SegmentedControl } from "../segmented-control";

describe("SegmentedControl", () => {
  it("marca la opción activa con la pill bg-content1 y aria-selected", () => {
    render(
      <SegmentedControl
        ariaLabel="Período"
        options={[
          { key: "7d", label: "7 días" },
          { key: "30d", label: "30 días" },
        ]}
        value="30d"
        onChange={() => {}}
      />
    );
    const active = screen.getByRole("tab", { selected: true });
    expect(active.textContent).toBe("30 días");
    expect(active.className).toContain("bg-content1");
  });
});
```

- [ ] **Step 2: Verificar que falla.** — Run: `npx vitest run components/shared/__tests__/kit.test.tsx`.
- [ ] **Step 3: Implementar** — clases EXACTAS del canónico `dashboard-content.tsx:567-591` (el comentario en `:561-566` explica por qué NO se usa `<Tabs>` de HeroUI — conservarlo en el kit):

```tsx
// components/shared/segmented-control.tsx
import React from "react";

/** Segmented control manual (track soft + pill activa con shadow). Se usa en
 *  lugar de <Tabs> de HeroUI: variant="bordered" + color="primary" se sentía
 *  como control de formulario y desfasaba con los cards soft del lenguaje
 *  moderno. Fuente: dashboard-content / training-tabs. */
export function SegmentedControl<K extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (key: K) => void;
  options: readonly { key: K; label: string }[];
  value: K;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="flex w-full rounded-lg bg-default-100 p-1"
      role="tablist"
    >
      {options.map(({ key, label }) => {
        const isActive = value === key;

        return (
          <button
            key={key}
            aria-selected={isActive}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs transition ${
              isActive
                ? "bg-content1 text-foreground shadow-sm font-medium"
                : "text-default-500 hover:text-default-700 font-normal"
            }`}
            role="tab"
            type="button"
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Migrar `dashboard-content.tsx:561-593`** al kit (mismo render exacto; conservar el comentario histórico en el call-site o moverlo al kit).
- [ ] **Step 5: Verificar** — Run: `npx vitest run components/shared && npm run type-check && npm run lint:check && npm test`. Smoke: sección Progreso del dashboard cliente idéntica.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(kit): extract SegmentedControl from client dashboard period selector"`

---

### Task 6: Kit — IconTile

**Files:**
- Create: `components/shared/icon-tile.tsx`
- Test: añadir a `components/shared/__tests__/kit.test.tsx`

**Interfaces:**
- Produces: `IconTile({ className, icon, size = "md", tone = "primary" }: { className?: string; icon: string; size?: "sm" | "md" | "lg"; tone?: "primary" | "success" | "warning" | "danger" | "default" })`. Tiles con paleta custom (tipos de sesión) siguen usando su markup propio — NO migrar `session-card.tsx` (su tinte viene de `session-type-style.ts`, identidad de producto).

- [ ] **Step 1: Test que falla**

```tsx
// añadir a kit.test.tsx
import { IconTile } from "../icon-tile";

describe("IconTile", () => {
  it("tone primary = tinte alpha + icono primary", () => {
    const { container } = render(<IconTile icon="solar:pen-bold" />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.className).toContain("bg-primary/10");
    expect(tile.className).toContain("rounded-xl");
  });
});
```

- [ ] **Step 2: Verificar que falla.**
- [ ] **Step 3: Implementar**

```tsx
// components/shared/icon-tile.tsx
import { Icon } from "@iconify/react";
import React from "react";

const TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success-700",
  warning: "bg-warning/10 text-warning-700",
  danger: "bg-danger/10 text-danger",
  default: "bg-default-100 text-default-600",
} as const;

const SIZES = {
  sm: { box: "h-9 w-9", icon: 18 },
  md: { box: "h-10 w-10", icon: 20 },
  lg: { box: "h-12 w-12", icon: 24 },
} as const;

/** Tile cuadrado con icono tintado — el elemento líder ubicuo del lenguaje
 *  moderno (cards, headers de modal, filas). Tintes alpha dark-safe. */
export function IconTile({
  className = "",
  icon,
  size = "md",
  tone = "primary",
}: {
  className?: string;
  icon: string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
}) {
  const s = SIZES[size];

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl ${s.box} ${TONES[tone]} ${className}`}
    >
      <Icon icon={icon} width={s.icon} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar** — Run: `npx vitest run components/shared && npm run type-check && npm run lint:check`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(kit): add IconTile primitive with alpha-tinted tones"`

---

### Task 7: Gates de Fase 0 + PR

- [ ] **Step 1:** Run: `npm run type-check && npm run lint:check && npm test`. Expected: todo PASS.
- [ ] **Step 2:** Run: `npm run build`. Expected: build limpio (recordar: build no chequea tipos, por eso el paso 1 es obligatorio).
- [ ] **Step 3:** Detector sobre lo tocado: `node /Users/davidbracho/.claude/skills/impeccable/scripts/detect.mjs --json components/shared app/trainer/layout.tsx features/trainer/nav/trainer-shell-gate.tsx`. Expected: 0 hallazgos reales (los FP de spinner documentados no aplican a estos archivos).
- [ ] **Step 4:** Smoke en dev con David: trainer app con color de tenant, login slate, portal cliente intacto, foregrounds correctos con el reporte de tenants del Task 2 Step 5 a mano.
- [ ] **Step 5:** PR a main titulado `feat(design): fase 0 — tenant theme in trainer app + shared design kit`, body con el reporte de tenants que flipean foreground. Esperar merge de David antes de arrancar Fase 1.

---

# FASE 1 — branch `feat/design-f1-client-profile` (desde main con F0)

### Task 8: Frame del perfil — página + tab bar

**Files:**
- Modify: `app/trainer/dashboard/clients/[clientId]/page.tsx:15-26` (LoadingScreen), `:17,83,99` (canvas), `:81-96` (error)
- Modify: `components/dashboard/client-profile/client-profile-tabs.tsx:75-124` (guard + tab bar + canvas)

**Interfaces:**
- Consumes: `CenteredState` (Task 4), `Spinner` de HeroUI.

- [ ] **Step 1: Página** — en `page.tsx`: (a) los tres `bg-gray-50` → `bg-background`; (b) `LoadingScreen` reemplaza el spinner div por HeroUI:

```tsx
function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Spinner color="primary" size="lg" />
          <p className="font-body text-default-500">{message}</p>
        </div>
      </div>
    </div>
  );
}
```

(c) el estado de error (`:81-96`) pasa a:

```tsx
if (error || !client) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-lg px-4">
        <CenteredState
          action={
            <Button color="primary" variant="flat" onPress={handleBack}>
              Volver a Clientes
            </Button>
          }
          icon="solar:user-cross-linear"
          title={error || "Cliente no encontrado"}
        />
      </div>
    </div>
  );
}
```

(imports: `Button, Spinner` de `@heroui/react`, `CenteredState` de `@/components/shared/centered-state`).

- [ ] **Step 2: Tab bar** — en `client-profile-tabs.tsx`: barra `bg-white border-gray-200` (`:92`) → `bg-content1 border-default-200`; canvas `bg-gray-50` (`:124`) → `bg-background`; el ternario del botón (`:105-109`) →

```tsx
className={`relative flex h-12 flex-shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium outline-none transition-colors ${
  isSelected
    ? "border-primary text-primary"
    : "border-transparent text-default-500 hover:text-default-700"
}`}
```

- [ ] **Step 3: Guard sin `window.confirm`** — reemplazar el bloque `:76-87` por estado + Modal HeroUI (el `confirm()` nativo dentro de handlers congela la página — patrón prohibido documentado):

```tsx
const [pendingTab, setPendingTab] = useState<TabKey | null>(null);

const handleTabChange = (key: TabKey) => {
  if (selectedTab === "forms" && formsUnsavedRef.current && key !== "forms") {
    setPendingTab(key);

    return;
  }
  setSelectedTab(key);
};
```

y al final del JSX raíz:

```tsx
<Modal isOpen={pendingTab !== null} size="sm" onClose={() => setPendingTab(null)}>
  <ModalContent>
    <ModalHeader className="font-heading">Cambios sin guardar</ModalHeader>
    <ModalBody className="text-sm text-default-600">
      Tienes cambios sin guardar en la configuración de formularios. ¿Quieres
      descartarlos?
    </ModalBody>
    <ModalFooter>
      <Button variant="light" onPress={() => setPendingTab(null)}>
        Cancelar
      </Button>
      <Button
        color="danger"
        onPress={() => {
          if (pendingTab) {
            formsUnsavedRef.current = false;
            setSelectedTab(pendingTab);
          }
          setPendingTab(null);
        }}
      >
        Descartar cambios
      </Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

(definir `type TabKey = (typeof TAB_KEYS)[number]`; imports de `@heroui/react`). El `tabLoading` (`:14-18`) pasa a `<Spinner color="primary" size="lg" />`.

- [ ] **Step 4: Verificar** — `npm run type-check && npm run lint:check`; `grep -n "gray-\|blue-\|bg-white" app/trainer/dashboard/clients/[clientId]/page.tsx components/dashboard/client-profile/client-profile-tabs.tsx` → 0 hits. Smoke: navegar tabs, provocar guard de forms.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "refactor(profile): tokenize page frame and tab bar, replace native confirm"`

---

### Task 9: Header del perfil

**Files:**
- Modify: `components/dashboard/client-profile/client-profile-header.tsx` (reskin completo)

**Interfaces:**
- Consumes: `OutlineChip` (Task 4).

- [ ] **Step 1: Aplicar** — sobre el archivo actual (203 líneas), estos reemplazos exactos:
  - `:48` `bg-white border-b border-gray-200` → `bg-content1 border-b border-default-200`
  - `:53` botón Volver: `className="text-gray-600 hover:text-gray-900"` → `className="text-default-500 hover:text-foreground"`
  - `:66-70` Editar: quitar `className="text-white font-semibold"` → `className="font-semibold"` (el foreground lo pone el theme desde F0)
  - `:80` Estado: `className="bg-gray-100 text-gray-700 font-semibold"` + `variant="flat"` → quitar className de color: `className="font-semibold"`, `variant="flat"` (queda default flat tokenizado)
  - `:93` Eliminar: `className="bg-red-50 text-red-600 font-semibold"` → `className="font-semibold"`, añadir `color="danger"`, mantener `variant="flat"`
  - `:121` h1: `text-3xl font-bold text-gray-900` → `font-heading text-3xl font-bold text-foreground`
  - `:132` fila contacto: `text-gray-600` → `text-default-500`
  - `:159,165` quick-info tiles: `bg-gray-50 px-3 py-2 rounded-lg` → `rounded-xl border border-default-200 bg-content2 px-3 py-2`; labels `text-gray-500` → `text-default-500`; valores `text-gray-900` → `text-foreground`, añadir `tabular-nums` al de edad
  - `:177` icono objetivos: `text-blue-600` → `text-primary`
  - `:182` label: `text-gray-700` → `text-default-600`
  - `:186-193` pills de objetivos → `<OutlineChip key={index} tone="primary">{goal}</OutlineChip>` (import del kit; eliminar el span manual)
- [ ] **Step 2: Verificar** — `npm run type-check && npm run lint:check`; `grep -n "gray-\|blue-\|red-\|text-white\|bg-white" components/dashboard/client-profile/client-profile-header.tsx` → 0 hits. Smoke visual con David: header con marca del tenant.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "refactor(profile): reskin header on semantic tokens with kit chips"`

---

### Task 10: Familia de modales del perfil

**Files:**
- Modify: `components/dashboard/client-profile/delete-client-modal.tsx`, `components/dashboard/client-profile/update-status-modal.tsx`, `components/dashboard/edit-client-modal.tsx`

**Interfaces:**
- Consumes: `IconTile` (Task 6).

- [ ] **Step 1: delete-client-modal** — `:77` tile `bg-red-50` → `<IconTile icon="solar:trash-bin-trash-bold" tone="danger" />`; `:93-95` caja de advertencia: `bg-red-50 border-red-200` + emoji `⚠️` → `rounded-large border border-danger/20 bg-danger/5` + `<Icon className="text-danger" icon="solar:danger-triangle-bold" width={18} />`; `:144-148` confirm hand-styled `bg-red-600 text-white` / disabled `bg-gray-200 text-gray-400` → `<Button color="danger" isDisabled={...} isLoading={...}>` sin classNames de color.
- [ ] **Step 2: update-status-modal** — `:124` tile `bg-blue-50` → `<IconTile icon="solar:refresh-bold" />`; `:170` submit `className="bg-blue-600 text-white"` → `color="primary"` sin className.
- [ ] **Step 3: edit-client-modal** (el fósil azul, también lo usa la página de clientes — mejora doble) — `:202-203` header `bg-blue-50` + `text-blue-600` → `<IconTile icon="solar:pen-bold" />`; `:219` error box `bg-red-50 border-red-200 text-red-700` → `rounded-large border border-danger/20 bg-danger/5 text-danger`; `:400` submit `bg-blue-600 text-white` → `color="primary"`; barrer el resto de grays del archivo con la Tabla de Mapeo; eliminar todo `focus:outline-none` que suprima el focus ring de HeroUI (regresión a11y).
- [ ] **Step 4: Verificar** — `npm run type-check && npm run lint:check`; `grep -n "blue-\|red-50\|red-600\|gray-\|text-white" components/dashboard/client-profile/delete-client-modal.tsx components/dashboard/client-profile/update-status-modal.tsx components/dashboard/edit-client-modal.tsx` → 0 hits. Smoke: abrir los 3 modales (via `?modal=`), submit y cancel.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "refactor(profile): retheme delete/status/edit client modals on semantic tokens"`

---

### Task 11: Training tab — pasada de paleta

**Files:**
- Modify: `components/dashboard/client-profile/tabs/training-tabs.tsx:43-47,82`
- Modify: `components/dashboard/client-profile/tabs/microcycle/week-strip.tsx:76,97`, `month-grid.tsx:118,128,147-166`, `day-cell-chip.tsx:116-118`, `day-detail.tsx:187-204,584,604,613`, `metrics-section.tsx:172-191`, `exercise-metrics-popover.tsx:60,69`
- Modify: `components/dashboard/client-profile/tabs/workouts/history-date-filter.tsx:142,212-231`, `exercise-history-table.tsx` (callout ámbar: dejar; grays → tokens)

**Interfaces:**
- Consumes: `SegmentedControl` (Task 5), Tabla de Mapeo.

- [ ] **Step 1: training-tabs.tsx** — pills: `tabList: "rounded-large bg-gray-100"` → `"rounded-large bg-default-100"`; `cursor: "bg-white shadow-sm"` → `"bg-content1 shadow-sm"`; `group-data-[selected=true]:text-gray-900` → `...:text-foreground`; badge de videos `:82` `bg-blue-600` → `bg-primary text-primary-foreground`.
- [ ] **Step 2: Selección y hoy** — `week-strip.tsx:76` `border-blue-500 bg-blue-50/50 ring-1 ring-blue-500` → `border-primary bg-primary/5 ring-1 ring-primary`; `:97` `text-blue-600` → `text-primary`; mismos cambios en `month-grid.tsx:118,128`.
- [ ] **Step 3: Estados** — `day-cell-chip.tsx:116-118`: `bg-emerald-100 text-emerald-700` → `bg-success/15 text-success-700`; `bg-amber-100 text-amber-700` → `bg-warning/15 text-warning-700`; `bg-gray-100 text-gray-500` → `bg-default-100 text-default-500`; leyenda de `month-grid.tsx:147-166` en sintonía.
- [ ] **Step 4: day-detail.tsx** — `:584` card `border-gray-200 bg-white shadow-sm` → `border-default-200 bg-content1 shadow-sm`; `:604` chip hora `bg-blue-100 text-blue-700` → `bg-primary/10 text-primary`; `:196-204` chip video: `border-blue-200 bg-blue-50 text-blue-700` → `border-primary/25 bg-primary/5 text-primary` y el círculo `bg-blue-600` con glifo `▶` → `<Icon icon="solar:play-bold" width={12} />` sobre `bg-primary text-primary-foreground`; `:187-191` chip récord: emoji `🏅` → `<Icon icon="solar:medal-ribbons-star-bold" width={14} />` (mantener el ámbar — identidad de récords); mismo swap de emoji en `exercise-metrics-popover.tsx:69`; `:60` `text-blue-600` → `text-primary`.
- [ ] **Step 5: metrics-section.tsx** — toggle Semana/Mes (`:172-191`) → `<SegmentedControl>` del kit; el banner de error `:205` ya es semántico — NO tocar.
- [ ] **Step 6: workouts/** — `history-date-filter.tsx:142` focus `border-blue-400 ring-blue-100` → `border-primary ring-primary/20`; `:212-231` grays y `text-blue-600` según tabla; `exercise-history-table.tsx`: grays → tokens (el callout ámbar de notas se queda — deliberado).
- [ ] **Step 7: Verificar** — `npm run type-check && npm run lint:check && npm test` (los tests de training existentes deben seguir en verde); `grep -rn "blue-\|gray-\|bg-white\|emerald-\|amber-100" components/dashboard/client-profile/tabs/microcycle components/dashboard/client-profile/tabs/workouts components/dashboard/client-profile/tabs/training-tabs.tsx` → 0 hits (el ámbar del callout de notas y récords usa `amber-300/amber-50` — permitido, documentar con comentario de identidad si el grep lo caza). Smoke: semana/mes, day-detail, historial.
- [ ] **Step 8: Commit** — `git add -A && git commit -m "refactor(profile): training tab palette to theme tokens, icons replace glyphs"`

---

### Task 12: Data-viz atoms de progreso

**Files:**
- Modify: `components/dashboard/client-profile/tabs/progress/ui-atoms.tsx:10-44` (ACCENT_COLORS pastel)
- Modify: `components/dashboard/client-profile/tabs/neat/client-steps-section.tsx` y `components/dashboard/client-profile/tabs/progress/neat-section.tsx:78-106` (hex de recharts)

**Interfaces:**
- Produces: los StatCards de progreso aceptan tonos semánticos (`primary | success | warning | danger | default`) en lugar de nombres de paleta pastel (`purple`, `blue`...). Call-sites actualizados en el mismo task.

- [ ] **Step 1:** Reescribir `ACCENT_COLORS` con tintes alpha (`bg-primary/10 text-primary`, `bg-success/10 text-success-700`, etc.) y renombrar keys a tonos semánticos; actualizar todos los call-sites (grep `accent="` en `tabs/`), mapeando `purple`→`primary`, `blue`→`primary`, `green`→`success`, `orange`→`warning`.
- [ ] **Step 2:** recharts: `#7c3aed` (línea steps) → leer el color primario en runtime con el patrón ya usado por `components/charts/` (si `lib/charts/palette.ts` expone helper, usarlo; si no, `getComputedStyle(document.documentElement).getPropertyValue("--heroui-primary")` envuelto en `hsl(...)` con fallback `#0ea5e9`); grid `#e5e7eb` → `hsl(var(--heroui-default-200))` con el mismo patrón; ticks `#6b7280` → `hsl(var(--heroui-default-500))`. Nota: recharts acepta strings CSS — `"hsl(var(--heroui-primary))"` funciona como prop de color; probar primero esa vía (cero JS).
- [ ] **Step 3: Verificar** — `npm run type-check && npm run lint:check`; smoke: gráfico de pasos del NEAT tab renderiza con color de marca.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "refactor(profile): tokenize progress stat cards and neat chart colors"`

---

### Task 13: NEAT tab

**Files:**
- Modify: `components/dashboard/client-profile/tabs/neat-tab.tsx` (reskin completo: `:294-298,316,333-349,380-450,494`)

- [ ] **Step 1:** Aplicar Tabla de Mapeo a todo el archivo. Puntos nombrados: info card `:333-349` (`bg-blue-50 border-blue-200`, `text-blue-600/900/700`) → receta info canónica (`border-primary/25 bg-primary/5`, icono `text-primary`, título `text-foreground`, cuerpo `text-default-600`); cards tri-pastel `:380` `border-2 border-gray-200` → `border border-default-200` (hairline, no `border-2`); tile `:385` `bg-blue-100` → `bg-primary/10 text-primary`; notas `:431` → receta info; weekdays `:438-446` `bg-purple-50 border-purple-100 text-purple-700` → `bg-default-100 text-default-600` (son metadata, no acento); header duplicado `:316` `text-2xl font-bold text-gray-900` → eliminar el título de página duplicado dentro del tab (el tab bar ya lo nombra) o degradarlo a `font-heading text-lg font-semibold text-foreground`; errores `:294-298` `text-red-500/600` → `<CenteredState icon="solar:danger-triangle-linear" title=... />`; headers de modal `:494` `bg-blue-50` → `<IconTile ... />`.
- [ ] **Step 2: Verificar** — `npm run type-check && npm run lint:check`; `grep -n "blue-\|purple-\|gray-\|red-\|bg-white" components/dashboard/client-profile/tabs/neat-tab.tsx` → 0. Smoke: NEAT con objetivos, sin datos, modales.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "refactor(profile): reskin neat tab on semantic tokens"`

---

### Task 14: Supplements tab

**Files:**
- Modify: `components/dashboard/client-profile/tabs/supplements-tab.tsx` (`:330,348,378,381,505,551`)

- [ ] **Step 1:** Tabla de Mapeo en todo el archivo. Nombrados: cards `:378` `bg-white border-gray-200 shadow-sm` → `bg-content1 border-default-200 shadow-sm`; hover `:551` `hover:border-slate-400` → `hover:border-default-400`; filas info `:330,348` `bg-gray-50/bg-slate-100` → `bg-default-50`; tile modal `:505` `bg-slate-100` → `<IconTile tone="default" ... />`; empty state `:381` círculo gris → `<CenteredState icon="solar:health-linear" title="Sin suplementos asignados" subtitle=... />`.
- [ ] **Step 2: Verificar** — grep del archivo → 0 legacy; type-check + lint. Smoke: tab con y sin suplementos.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "refactor(profile): reskin supplements tab on semantic tokens"`

---

### Task 15: Access tab

**Files:**
- Modify: `components/dashboard/client-profile/tabs/access-tab.tsx` (`:73,91-92,107,116,157,199,217,237,276`)

- [ ] **Step 1:** Tabla de Mapeo. Nombrados: tile `:91-92` → `<IconTile icon="solar:key-bold" />`; panels `:107,237` `bg-white border-gray-200 rounded-2xl shadow-sm` → `bg-content1 border-default-200 rounded-2xl shadow-sm`; círculos de paso `:116,157,199` `bg-blue-600 text-white` → `bg-primary text-primary-foreground`; final `:217` `bg-green-600` → `bg-success text-success-foreground`; troubleshooting ámbar `:276` → `border-warning/20 bg-warning/5` + textos `text-warning-700`/`text-default-600`; loading `:73` → `Spinner color="primary"`. Los emoji dentro del texto de WhatsApp (`:316-328`) son CONTENIDO del mensaje — no tocar.
- [ ] **Step 2: Verificar** — grep → 0 legacy (excluyendo el string del mensaje WhatsApp); type-check + lint; smoke.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "refactor(profile): reskin access tab on semantic tokens"`

---

### Task 16: Forms tab (shell)

**Files:**
- Modify: `components/dashboard/client-profile/tabs/forms-tab.tsx` (`:877-885,915-921,962,1017,1041,1158,1182,2204`)

- [ ] **Step 1:** Unificar el tercer sistema de tabs: los dos `Tabs` con `cursor: "bg-black"` + `group-data-[selected=true]:text-black` (`:877-885`, `:915-921`) → mismas classNames pill que `training-tabs.tsx` post-Task 11 (`tabList: "rounded-large bg-default-100"`, `cursor: "bg-content1 shadow-sm"`, `group-data-[selected=true]:text-foreground`). Cards `bg-white border-gray-200` (`:962,1017,1041`) → `bg-content1 border-default-200`; info cards azules (`:1158,1182,2204`) → receta info canónica; resto por Tabla de Mapeo.
- [ ] **Step 2: Verificar** — `grep -n "blue-\|gray-\|bg-white\|bg-black\|text-black" components/dashboard/client-profile/tabs/forms-tab.tsx` → 0; type-check + lint; smoke: sub-tabs check-in/hábitos, sticky save bar intacta.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "refactor(profile): unify forms tab pills and tokenize cards"`

---

### Task 17: form-config-editor

**Files:**
- Modify: `components/dashboard/client-profile/tabs/form-config-editor.tsx` (`:106-115,582,616-619,665-666,695,779,783-792,818,829,836,924-969,945,990,1158-1187,1176,1207,1412,1438,1541,1602,1612,1643,1661,1706,1726,1753`)

- [ ] **Step 1:** `TYPE_CHIP_STYLES` (`:106-115`): reescribir el mapa de pasteles fijos con tintes alpha semánticos manteniendo la distinción por tipo: number→`bg-primary/10 text-primary`, boolean→`bg-success/10 text-success-700`, choice→`bg-warning/10 text-warning-700`, text→`bg-default-100 text-default-600`, scale→`bg-secondary/10 text-secondary`, photo→`bg-danger/10 text-danger`, group→`bg-default-100 text-default-600` (ajustar keys reales al leer el mapa).
- [ ] **Step 2:** Switches: quitar `group-data-[selected=true]:!bg-amber-500` / `!bg-emerald-500` (`:924-927,:966-969,:1158-1161,:1184-1187`) → `color="warning"` / `color="success"` en el prop del Switch; labels `text-amber-700`/`text-emerald-700` → `text-warning-700`/`text-success-700`. Glifo `★ Oblig.` (`:945,:1176`) → `<Icon icon="solar:star-bold" width={12} />` + `Oblig.`.
- [ ] **Step 3:** Grays y acentos sueltos por Tabla de Mapeo (`:582,616-619,695,779,783-792,818,829,836`); tres estilos de CTA (`:1412,1541,1612,1753`) → un único `color="primary"`; modales (`:1438,1643,1706`) → `IconTile` con tonos; info boxes (`:1602,1661,1726`) → recetas alpha (info→primary, warning→warning); raw `<button>` (`:665,990,1207`) → HeroUI `Button variant="light" size="sm"` isIconOnly donde aplique.
- [ ] **Step 4: Verificar** — grep del archivo → 0 legacy; type-check + lint + `npm test`; smoke: drag & drop de preguntas sigue OK (dnd-kit no se toca), switches, modales.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "refactor(profile): retokenize form config editor chips switches and ctas"`

---

### Task 18: Barrido final + gates de Fase 1 + PR

- [ ] **Step 1: Leftovers** — `features/trainer/cycles/cycle-builder-content.tsx:216` `bg-gray-50` → `bg-default-50` (una línea; el panel v2 queda 100% limpio). Luego grep-gate global del área:

```bash
grep -rn "text-gray-\|bg-gray-\|bg-white\|slate-\|blue-\([0-9]\)\|text-black" \
  components/dashboard/client-profile app/trainer/dashboard/clients \
  --include="*.tsx" \
  | grep -v "nutrition-tab.tsx" | grep -v "progress/nutrition-section.tsx" \
  | grep -v "__tests__"
```

Expected: 0 líneas (o solo identidades documentadas con comentario, p.ej. ámbar de récords). Cada hit restante se corrige con la Tabla de Mapeo antes de seguir.

- [ ] **Step 2: Detector** — `node /Users/davidbracho/.claude/skills/impeccable/scripts/detect.mjs --json components/dashboard/client-profile` → 0 hallazgos nuevos (los 4 previos del área deben haber desaparecido).
- [ ] **Step 3: Gates** — `npm run type-check && npm run lint:check && npm test && npm run build`. Expected: todo PASS.
- [ ] **Step 4: Smoke completo con David** — perfil de un cliente real en dev: las 7 tabs, 3 modales, guard de forms, training week/month, con SU tema de tenant puesto. Comparar contra el portal cliente: debe sentirse el mismo producto.
- [ ] **Step 5: PR** a main `feat(design): fase 1 — client profile reskin on tenant theme + shared kit`. Tras merge y verificación de David en prod, correr `/impeccable critique` sobre `app/trainer` para medir la subida desde 19/40 y actualizar la memoria `project-design-unification`.

---

## Self-Review (hecho al escribir el plan)

- **Cobertura vs spec**: P0-1 (fundación tema trainer) → Tasks 1-3; P0-2 (frame perfil + barrido azul) → Tasks 8-11; kit mínimo → Tasks 4-6; modales/estados (P1-9, spec item 8-9) → Tasks 8/10; data-viz (spec item 7) → Task 12; tabs restantes → Tasks 13-17. Nutrition v1 excluida por decisión. Wizard, shell trainer, páginas de lista, form modal cliente, chart renderers cliente: fases futuras — fuera de este plan a propósito.
- **Riesgo señalado**: el cambio de foreground (Task 1-2) afecta también al portal cliente de tenants con marca clara — por eso el reporte de tenants del Task 2 Step 5 y el smoke del Task 7 Step 4 son obligatorios antes del PR.
- **Tipos consistentes**: `pickForegroundHSL(hex) → string` usada en Task 2; `OutlineChip/CenteredState/SegmentedControl/IconTile` con las firmas de Tasks 4-6 consumidas en Tasks 8-17; `loadTenantMetadataByHost` de Task 3 solo se consume en el layout del mismo task.
