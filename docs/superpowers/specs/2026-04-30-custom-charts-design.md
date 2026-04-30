# Custom Charting System — Design

**Status:** Approved (brainstorm phase)
**Author:** brainstorm session, 2026-04-30
**Audience:** Engineering team implementing the feature

---

## 1. Goal

Let trainers personalize the charts each of their clients sees on the client app, from the trainer app, picking from any data point we collect (curated catalog plus any numeric form question they have defined).

The trainer also gets a preview surface that shows exactly what the client sees. The same surface doubles as the editor (edit-in-preview / WYSIWYG).

## 2. Constraints & Key Decisions

The product is shipping as a complete, production-ready feature — not a minimum viable cut. The decisions below were validated through the brainstorm.

| Decision                     | Choice                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Default-state model          | Trainer-level template; per-client overrides win when present                                                                              |
| Data source scope            | Curated catalog (14 metrics) + any numeric form question defined by the trainer                                                            |
| Editing UX                   | Edit-in-preview (WYSIWYG) on a single surface, mode-toggleable                                                                             |
| Per-chart configurability    | Metric, label, chart type, color, target zone, aggregation, optional average line                                                          |
| Chart types                  | line, area, bar, stacked_bar, ring, kpi                                                                                                    |
| Override storage model       | Full snapshot per client (not a diff)                                                                                                      |
| Trainer-template propagation | Mirror `form_templates.auto_apply_to_new_clients`: new clients seeded; existing clients only via explicit "Apply to all" with confirmation |
| Dashboard period selector    | Existing 7d/30d/90d toggle stays; per-chart `aggregation` is bucketing inside that range                                                   |
| Layout                       | 1-col mobile, 2-col desktop. Up/down arrows for reorder (no drag-and-drop)                                                                 |
| Trainer template route       | `/trainer/dashboard/charts-template`                                                                                                       |
| Per-client editor route      | `/trainer/dashboard/clients/[clientId]/charts`                                                                                             |
| Client dashboard route       | `/[slug]/dashboard` (existing — chart rendering replaced)                                                                                  |

## 3. Data Model

### 3.1 Tables

```sql
-- One row per (tenant_slug, trainer_id). Holds the trainer's default template.
CREATE TABLE trainer_chart_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charts jsonb NOT NULL DEFAULT jsonb_build_object('version', 1, 'charts', '[]'::jsonb),
  auto_apply_to_new_clients boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_slug, trainer_id)
);

CREATE INDEX trainer_chart_templates_updated_at_idx
  ON trainer_chart_templates (updated_at DESC);

-- Per-client override. Row exists only when the trainer has customized this client.
CREATE TABLE client_chart_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_slug, client_id)
);

CREATE INDEX client_chart_configs_updated_at_idx
  ON client_chart_configs (updated_at DESC);

-- Audit (best-effort, non-blocking).
CREATE TABLE chart_config_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  actor_user_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('template','client')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('save','apply_to_all','reset_to_template')),
  before_charts jsonb,
  after_charts jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chart_config_audit_target_idx
  ON chart_config_audit (tenant_slug, target_kind, target_id, created_at DESC);
```

`set_updated_at()` triggers on both `trainer_chart_templates` and `client_chart_configs` (matching existing convention in the migrations folder).

### 3.2 `charts` JSONB shape

```ts
type ChartsDocument = {
  version: 1; // schema version, validated on read
  charts: ChartConfig[]; // ordered by position; position is materialized for drag UX even though array order is canonical
};

type ChartConfig = {
  id: string; // uuid; stable React key; survives reorders
  position: number; // 0-based; canonical for ordering
  label: string; // user-facing, "PESO"
  source: DataSourceRef;
  chart_type: "line" | "area" | "bar" | "stacked_bar" | "ring" | "kpi";
  color: ColorToken | ColorToken[]; // single token for 1-D, array for multi-dim sources
  target_zone?: {
    min: number;
    max: number;
    margin?: number; // optional yellow-band width below `min` (0 = no yellow)
  }; // for line / area / bar
  aggregation: "daily" | "checkin_period" | "weekly" | "range_total";
  show_average_line?: boolean; // for line / area / bar
};

type DataSourceRef =
  | { kind: "catalog"; id: CatalogId }
  | {
      kind: "form_question";
      form_type: "checkins" | "habits";
      question_id: string;
    };
```

**Schema versioning.** The reader validates `charts.version === 1`. Future bumps add a migration step (or in-place upgrader) at read time. Unknown versions fall through to a no-op renderer with a Sentry warning, never crash.

**Rationale for JSONB.** Charts are read together as a unit. Schema iterates fast. We never query _across_ chart configs (e.g., "find all bar charts"). Same shape as `form_templates.questions_config`.

### 3.3 Color palette

Twelve curated tokens, defined once in `lib/charts/palette.ts`:

```
weight-amber, sleep-emerald, calorie-coral, protein-indigo, carbs-emerald-deep,
fats-amber-deep, mood-violet, steps-cyan, water-sky, training-blue,
cardio-rose, neutral-slate
```

Each token resolves to a `{ stroke, fill, soft }` triple at render time. Palette is verified for AA contrast on light + dark backgrounds.

### 3.4 Validation rules (cross-field)

`DataSourceRef` is a thin reference; the _adapter_ resolved from it carries the dimension contract. Validation looks up the adapter by `source.kind + source.id` (or `source.question_id` for form-question sources) and checks against `adapter.dimensions`.

| Rule                                                                                                        | Where enforced                            |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `chart_type ∈ {ring, stacked_bar}` ⇒ resolved adapter `dimensions === "multi"`                              | zod schema (server) + form panel (client) |
| `chart_type ∈ {line, area, bar, kpi}` ⇒ resolved adapter `dimensions === 1`                                 | same                                      |
| `color` is array iff resolved adapter `dimensions === "multi"`; array length equals adapter `series.length` | same                                      |
| `target_zone` only on `chart_type ∈ {line, area, bar}`                                                      | same                                      |
| `target_zone.margin >= 0` and `target_zone.margin < (max - min)` if set                                     | same                                      |
| `show_average_line` only on `chart_type ∈ {line, area, bar}`                                                | same                                      |
| `target_zone.min < target_zone.max`                                                                         | same                                      |
| `aggregation === "range_total"` only on `chart_type ∈ {ring, kpi}`; ring **requires** `range_total`         | same                                      |
| Form-question sources are 1-D (cannot back ring/stacked_bar)                                                | same                                      |

## 4. Data Source Registry

### 4.1 Adapter interface

```ts
interface ChartDataSource {
  id: string; // stable: "weight" | "habit:steps" | "form_q:<uuid>"
  label: string; // ES-localized
  unit?: string; // "kg" | "h" | "kcal"
  category: "checkin" | "habit" | "exercise" | "neat";
  dimensions: 1 | "multi";
  series?: Array<{ id: string; label: string; default_color: ColorToken }>;
  default_chart_type: ChartType;
  default_color: ColorToken | ColorToken[];

  load(
    clientId: string,
    range: DateRange,
    ctx: AdapterContext
  ): Promise<DataPoint[] | MultiSeriesPoint[]>;
  bucket(
    points: DataPoint[] | MultiSeriesPoint[],
    aggregation: Aggregation,
    schedule: CheckInSchedule
  ): BucketedPoint[];
}
```

`AdapterContext` carries cached batches (e.g., already-fetched `form_responses`) so multiple charts on the same underlying table share a single fetch.

### 4.2 Catalog adapters (predefined in code)

14 adapters total. Each wraps the existing `analytics-keys.ts` resolvers so trainer renames of canonical fields keep working.

| id                   | Source table                | Dimensions | Default type | Default color                                         |
| -------------------- | --------------------------- | ---------- | ------------ | ----------------------------------------------------- |
| `weight`             | `form_responses` (checkins) | 1          | area         | weight-amber                                          |
| `body_fat`           | `form_responses` (checkins) | 1          | area         | neutral-slate                                         |
| `sleep_hours`        | `form_responses` (habits)   | 1          | bar          | sleep-emerald                                         |
| `steps`              | `form_responses` (habits)   | 1          | bar          | steps-cyan                                            |
| `calories`           | `form_responses` (habits)   | 1          | bar          | calorie-coral                                         |
| `protein`            | `form_responses` (habits)   | 1          | area         | protein-indigo                                        |
| `carbs`              | `form_responses` (habits)   | 1          | area         | carbs-emerald-deep                                    |
| `fats`               | `form_responses` (habits)   | 1          | area         | fats-amber-deep                                       |
| `water`              | `form_responses` (habits)   | 1          | bar          | water-sky                                             |
| `mood`               | `form_responses` (habits)   | 1          | line         | mood-violet                                           |
| `energy`             | `form_responses` (habits)   | 1          | line         | mood-violet                                           |
| `stress`             | `form_responses` (habits)   | 1          | line         | mood-violet                                           |
| `macros_breakdown`   | `form_responses` (habits)   | multi      | ring         | [protein-indigo, carbs-emerald-deep, fats-amber-deep] |
| `training_breakdown` | `exercise_logs`             | multi      | stacked_bar  | [training-blue, cardio-rose]                          |

### 4.3 Form-question adapter (dynamic)

A single class that accepts `{ form_type, question_id }`. On `load`:

1. Reads `form_responses.answers[question_id]` from the cached batch.
2. Coerces with `Number(...)`; non-finite values → `null`.
3. Bucketing same as catalog adapters.

Only questions with `type ∈ {"number","decimal","integer"}` in the trainer's `form_templates.questions_config` are exposed in the data-source picker. Type changes after the chart was created go through the orphan-handling path (§5.3).

### 4.4 `listAvailableSources(trainerId)`

Returns `[ ...catalog, ...numericFormQuestions ]`, deduped (catalog wins on `id` collision). Backed by `/api/charts/data-sources`.

## 5. UI Surfaces

### 5.1 Component tree (shared by all three surfaces)

```
<ChartSurface mode="trainer-template" | "trainer-client" | "client-readonly">
├── <ChartHeader>                     // period selector + edit toggle (when applicable)
├── <ChartGrid>                       // 1-col mobile / 2-col desktop
│   └── <ErrorBoundary> per card
│       └── <ChartCard config data editable?>
│           ├── <ChartCardHeader>
│           ├── <ChartRenderer>       // dispatches on chart_type
│           └── <ChartCardEditOverlay>  // pencil + up/down + delete
├── <AddChartCard>                    // "+ Añadir gráfica" button
├── <ChartEditPanel>                  // slide-in side panel / bottom sheet on mobile
│   ├── <DataSourcePicker>
│   ├── <ChartTypePicker>
│   ├── <ColorPicker>
│   ├── <TargetZoneEditor>
│   ├── <AggregationPicker>
│   └── <AverageLineToggle>
└── <ApplyToAllConfirmDialog>         // template surface only
```

`mode` controls which affordances mount:

| Surface                 | mode               | Edit toggle default | Reset button | Apply-to-all |
| ----------------------- | ------------------ | ------------------- | ------------ | ------------ |
| Trainer template editor | `trainer-template` | ON                  | —            | yes          |
| Per-client chart editor | `trainer-client`   | OFF                 | yes          | —            |
| Client dashboard        | `client-readonly`  | (no toggle)         | —            | —            |

### 5.2 Generic `<ChartRenderer>`

Replaces the six bespoke components in `components/client-dashboard/progress-charts.tsx`. Dispatches on `config.chart_type`:

- **line** — Recharts `LineChart`.
- **area** — Recharts `AreaChart` with auto-generated gradient from the resolved color token.
- **bar** — Recharts `BarChart`. If `target_zone` set, bar fill colored per-bucket using these rules (where `m = target_zone.margin ?? 0`):

  - red: `value < target_zone.min - m`
  - yellow: `target_zone.min - m ≤ value < target_zone.min` (only when `m > 0`; otherwise no yellow band)
  - green: `target_zone.min ≤ value ≤ target_zone.max`
  - light green: `value > target_zone.max`

  If `show_average_line`, a `<ReferenceLine>` at the period mean.

- **stacked_bar** — multi-series `BarChart` with `stackId="a"`. Each series uses its own color from `config.color: ColorToken[]`. Legend rendered below.
- **ring** — conic-gradient ring (the existing macros-ring approach generalized over N series).
- **kpi** — single big-number tile with optional delta vs. previous period.

Each renderer is purely presentational; data fetching lives one level up.

### 5.3 Loading / empty / error / orphan states

Each `<ChartCard>` handles four explicit states:

- **Skeleton** — same shape as the rendered chart, animated gradient. HeroUI skeleton primitive.
- **Empty** — `0` data points returned: chart-type icon + "Sin datos" + a context-aware hint (per-client editor adds "El cliente no ha registrado este dato en los últimos 30 días.").
- **Error** — caught by per-card `<ErrorBoundary>`. Renders "Error al cargar gráfica" + retry button. Logs `{ chartId, sourceId, chartType }` to Sentry.
- **Orphan** — `source.kind === "form_question"` but the question_id is missing from the trainer's current template, OR the question's type changed away from numeric. Renders "Esta pregunta ya no existe" + pencil prompt to repick. Surface-level banner counts orphans on trainer surfaces.

### 5.4 Data fetching — `useChartSurfaceData`

Single hook that:

1. Inspects `charts` to determine which underlying tables it needs.
2. Fires one batched fetch per table (re-using the existing `useFormResponses`, `useExerciseLogs`, `useNeatCards` hooks).
3. Walks each `ChartConfig`, calls `source.load(...) + source.bucket(...)` against the cached batches.
4. Returns `Map<chartId, ChartData>` plus per-chart `loading` / `error` flags.

Preserves today's "dashboard hits 4 endpoints, not 4×N" performance characteristic.

For the client dashboard surface (mobile / iframe), the `snapshot` endpoint (§6.1) does the bucketing server-side and returns one document, minimizing round-trips on slow links.

### 5.5 Demo-data provider (trainer template surface)

`<DemoDataProvider>` synthesizes 30 days of plausible numeric series per source (weight: random walk around 75kg ±2; sleep: 6.5–8.5h; calories: 1800–2400; protein 100-150g; etc.). Form-question sources get a generic random-in-[0,100] series with a banner: "Datos sintéticos: la gráfica refleja datos reales por cliente." Same hook signature as `useChartSurfaceData`.

### 5.6 Edit-mode interaction model

**Autosave with debounce.** Each panel field change schedules a 600ms-debounced `PUT` of the full `ChartConfig`. The surface tracks save state per chart: `idle | saving | saved | error`. A status pill at the top of `<ChartSurface>` shows "Guardado · hace 2s" / "Guardando…" / "Error al guardar — reintentar".

**Cancel.** The panel has an explicit Cancel button that reverts to the last saved state for that chart (revert is local; no server call).

**Reorder / add / delete.** Fire immediately (not debounced) with optimistic UI. The full updated `charts` array is sent in a single PUT. Rollback restores the previous order on 5xx.

**Concurrency.** Every save sends `If-Match: <last-known-updated_at>`. On `409 Conflict`:

1. Refetch the latest config.
2. If pending edits touch different chart ids → merge cleanly + non-blocking toast.
3. Same chart id → modal with side-by-side diff and three options: keep mine / keep theirs / merge both.

**Cross-tab support.** A storage event listener invalidates the local cache when another tab saves, so the user sees the updated state immediately on focus.

### 5.7 Mobile, accessibility, screen-share

- Edit panel is a bottom sheet on `<md`, side panel on `≥md`. Chart grid is single-column on `<md`, two-column on `≥md`.
- Tab order through chart cards; `Enter` opens edit panel; `Escape` closes. Up/down arrow buttons keyboard-accessible.
- `<ChartCard>` is `role="figure"` with `aria-labelledby` pointing to the label. `<ChartRenderer>` exposes a hidden `<table>` with the underlying data for screen readers.
- Edit-mode visibility: when off, pencil/reorder/delete buttons unmount entirely, so screen-share with a client doesn't leak editor chrome.

### 5.8 Empty trainer template

Zero-charts state shows a CTA: "Tu plantilla está vacía. Restaurar las gráficas por defecto" — a button that re-applies the starter template seed.

## 6. API Surface

Eight new routes under `app/api/charts/`. All responses follow the project's existing JSON shape `{ success, error?, details?, correlationId? }`. All routes propagate `correlationId` headers per the project convention.

### 6.1 Routes

| Method | Path                                      | Purpose                                                                       |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/api/charts/template`                    | Trainer's template                                                            |
| PUT    | `/api/charts/template`                    | Save trainer template (requires `If-Match: <updated_at>`)                     |
| POST   | `/api/charts/template/apply-to-all`       | Reset every client of this trainer to the template (DELETE all override rows) |
| GET    | `/api/charts/clients/[clientId]`          | Effective config (override if present, else template)                         |
| PUT    | `/api/charts/clients/[clientId]`          | Save per-client override (requires `If-Match`)                                |
| DELETE | `/api/charts/clients/[clientId]`          | Reset client → falls back to template                                         |
| GET    | `/api/charts/data-sources`                | Catalog + trainer's numeric form questions                                    |
| GET    | `/api/charts/clients/[clientId]/snapshot` | Effective config + all bucketed data, single round-trip                       |

### 6.2 Auth matrix

| Route                                           | Trainer session                                  | Client session                         |
| ----------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| `/api/charts/template` (GET / PUT)              | required (own row only)                          | denied                                 |
| `/api/charts/template/apply-to-all`             | required                                         | denied                                 |
| `/api/charts/clients/[clientId]` (GET)          | required (must own client via `trainer_clients`) | required (must be `clientId === self`) |
| `/api/charts/clients/[clientId]` (PUT / DELETE) | required (must own client)                       | denied                                 |
| `/api/charts/data-sources`                      | required                                         | denied                                 |
| `/api/charts/clients/[clientId]/snapshot`       | required (must own client)                       | required (must be self)                |

The dual-session check follows the existing pattern in `app/api/forms/responses/[clientId]/route.ts` (calls both `getTrainerSession()` and `getClientSession()`, takes whichever matches). Client routes that are reachable by client session use `clientFetch` (cookie + Bearer fallback) on the client side.

### 6.3 Validation

- All PUT/POST bodies validated by zod schemas in `lib/charts/validation.ts`.
- `ChartConfig` uses discriminated unions on `source.kind` and on `chart_type`.
- Cross-field rules (§3.4) live in a `.refine()` block.
- Failures return `422` with field-level errors:
  ```json
  {
    "success": false,
    "error": "validation_failed",
    "details": { "charts[2].chart_type": "ring requires multi-dim source" }
  }
  ```

### 6.4 Concurrency, errors, idempotency, rate limit

- **ETag.** Every PUT requires `If-Match: <last-known-updated_at>`. `409 Conflict` on mismatch with current `updated_at` in body.
- **Rate limit.** 60 req/min per session on save endpoints (existing rate-limit middleware). 10 req/min on `apply-to-all`.
- **Idempotency.** PUTs are naturally idempotent on `(target, body)`. `apply-to-all` is idempotent in effect (deleting an already-empty set is a no-op) and writes one audit row per call summarising the count of override rows removed and the snapshot of each row before deletion.

### 6.4.1 Apply-to-all semantics (precise)

`POST /api/charts/template/apply-to-all` performs:

```sql
DELETE FROM client_chart_configs
 WHERE tenant_slug = $tenant
   AND client_id IN (SELECT client_id FROM trainer_clients WHERE trainer_id = $actor)
RETURNING client_id, charts;
```

The trainer's clients then fall through to the template at read time (see §6.1 GET `/api/charts/clients/[clientId]`). The effect is "every client now sees the template, future template edits propagate to all of them again." The audit row records each deleted snapshot in `before_charts` (one audit row per affected client) so a support agent can manually restore an individual override if requested.

**Why DELETE rather than overwrite.** If apply-to-all wrote a row for every client, every client would now have an "override" matching the template — and future template edits would no longer propagate to anyone (because override-presence blocks template fall-through). DELETE preserves the inheritance model: the absence of an override row is what makes a client track the template.

### 6.5 `snapshot` endpoint

```
GET /api/charts/clients/[clientId]/snapshot?range=7d|30d|90d
```

Returns:

```json
{
  "success": true,
  "effective_charts": { "version": 1, "charts": [...] },
  "schedule": { ... },
  "range": { "from": "...", "to": "..." },
  "buckets": { "<chartId>": [{ "label": "...", "value": ..., "tooltip": "..." }, ...] }
}
```

The server runs every adapter's `load + bucket` so the client app does no aggregation. Cap at 60 buckets per chart (auto-fallback to weekly aggregation above the cap, with `meta.aggregationFallback: true` in the response so the UI can show a sub-label).

## 7. Security & RLS

### 7.1 Policies

```sql
-- trainer_chart_templates
CREATE POLICY trainer_owns_template ON trainer_chart_templates
  FOR ALL TO authenticated
  USING       (trainer_id = auth.uid() AND tenant_slug = current_tenant_slug())
  WITH CHECK  (trainer_id = auth.uid() AND tenant_slug = current_tenant_slug());

-- client_chart_configs (trainer manages)
CREATE POLICY trainer_manages_client_charts ON client_chart_configs
  FOR ALL TO authenticated
  USING (
    tenant_slug = current_tenant_slug()
    AND EXISTS (
      SELECT 1 FROM trainer_clients tc
       WHERE tc.client_id = client_chart_configs.client_id
         AND tc.trainer_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_slug = current_tenant_slug()
    AND EXISTS (
      SELECT 1 FROM trainer_clients tc
       WHERE tc.client_id = client_chart_configs.client_id
         AND tc.trainer_id = auth.uid()
    )
  );

-- client_chart_configs (client reads own only)
CREATE POLICY client_reads_own_charts ON client_chart_configs
  FOR SELECT TO authenticated
  USING (client_id = auth.uid() AND tenant_slug = current_tenant_slug());

-- chart_config_audit (insert by actor; read by actor or tenant admin)
CREATE POLICY audit_insert_self ON chart_config_audit
  FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() AND tenant_slug = current_tenant_slug());

CREATE POLICY audit_read_self_or_admin ON chart_config_audit
  FOR SELECT TO authenticated
  USING (
    tenant_slug = current_tenant_slug()
    AND (actor_user_id = auth.uid() OR is_tenant_admin())
  );
```

`current_tenant_slug()` and `is_tenant_admin()` are existing helpers used elsewhere in the migrations.

### 7.2 Service-role usage

Migration only. Normal request handling uses anon + RLS. Aligns with the project rule in CLAUDE.md (service role only for true admin operations).

### 7.3 Trainer impersonation

The existing `app/[slug]/auth/client-impersonate/` flow sets a _client_ session (not the trainer's). RLS on `client_chart_configs` therefore correctly denies write while impersonating. This is verified explicitly in the RLS test suite (§9.4).

## 8. Migration & Starter Template

### 8.1 Migration file

`supabase/migrations/082_create_chart_system.sql` (next free numbered slot at time of writing). All inside one `BEGIN; ... COMMIT;`:

1. `CREATE TABLE` for `trainer_chart_templates`, `client_chart_configs`, `chart_config_audit`.
2. Indexes.
3. `set_updated_at()` triggers on the two config tables.
4. Enable RLS + create policies.
5. Seed starter templates for every existing trainer.

### 8.2 Starter template seed

```sql
INSERT INTO trainer_chart_templates (tenant_slug, trainer_id, charts, auto_apply_to_new_clients)
SELECT
  tp.tenant_slug,
  tp.user_id,
  jsonb_build_object('version', 1, 'charts', $STARTER_CHARTS_JSONB),
  true
FROM trainer_profiles tp
ON CONFLICT (tenant_slug, trainer_id) DO NOTHING;
```

`$STARTER_CHARTS_JSONB` is the literal JSON for the six default charts, sourced from `supabase/migrations/082_starter_charts.json` (a fragment included in the migration via `\set` or generated inline — implementation detail). Six entries:

| Position | Label         | Source                       | Type        | Color                                                 | Target zone          | Avg line |
| -------- | ------------- | ---------------------------- | ----------- | ----------------------------------------------------- | -------------------- | -------- |
| 0        | PESO          | `catalog:weight`             | area        | weight-amber                                          | —                    | —        |
| 1        | SUEÑO         | `catalog:sleep_hours`        | bar         | sleep-emerald                                         | min:7 max:9 margin:1 | —        |
| 2        | CALORÍAS      | `catalog:calories`           | bar         | calorie-coral                                         | —                    | yes      |
| 3        | PROTEÍNA      | `catalog:protein`            | area        | protein-indigo                                        | —                    | yes      |
| 4        | MACROS        | `catalog:macros_breakdown`   | ring        | [protein-indigo, carbs-emerald-deep, fats-amber-deep] | —                    | —        |
| 5        | ENTRENAMIENTO | `catalog:training_breakdown` | stacked_bar | [training-blue, cardio-rose]                          | —                    | —        |

`aggregation` is `checkin_period` for entries 0–3 and 5; `MACROS` uses `range_total` (computed once across the dashboard's selected range, matching today's `avgMacros` calculation in `dashboard-content.tsx`). The `margin:1` on SUEÑO preserves today's red/yellow/green/light-green four-color scheme.

### 8.3 Idempotency & atomicity

- `ON CONFLICT DO NOTHING` keeps customized templates intact across re-runs.
- Whole migration is one transaction; partial failures roll back table creation too.

### 8.4 Trainers created after migration

The migration seeds rows for trainers existing at apply time. For trainers created _afterwards_, the GET `/api/charts/template` route lazy-creates the row using the same starter JSON if it doesn't exist (mirroring the existing lazy-creation pattern in `/api/forms/configs/[clientId]/route.ts`). The lazy-create helper lives in `lib/charts/template-loader.ts` and is also called from the trainer signup flow as a best-effort eager seed. Either way, every trainer ends up with a starter template the first time the chart system is touched.

### 8.5 Rollout

No feature flag. The starter template reproduces today's dashboard exactly, so the cutover is invisible to users that don't go editing things. Deploy is a single PR that ships:

- The migration.
- New tables/routes/components.
- A flip in `dashboard-content.tsx` to use `<ChartSurface mode="client-readonly">` instead of the bespoke chart components.

### 8.6 Reversion seam

Deploy is tagged. The legacy `progress-charts.tsx` and the legacy chart-rendering branch in `dashboard-content.tsx` stay in place behind a config-driven branch (a constant in `lib/charts/index.ts`) for one full cycle (~2 weeks). After clean telemetry, a follow-up PR removes the legacy code. Reverting before that point is `git revert` on the deploy tag — the tables remain (orphaned, harmless).

## 9. Testing Strategy

### 9.1 Unit (Vitest)

- `ChartConfig` zod schemas, including all cross-field rules in §3.4.
- Each catalog adapter's `load + bucket` against fixture data.
- Form-question adapter against a fixture `form_responses` batch.
- Target-zone bar coloring rules.
- `<ChartRenderer>` dispatch — one test per chart_type with a snapshot of the rendered SVG.
- Demo-data generator (deterministic seed → known output).
- Color-token resolver (token → `{stroke, fill, soft}`).

### 9.2 Component (Vitest + Testing Library)

- `<ChartCard>` four states: skeleton, data, empty, orphan, error.
- `<ChartEditPanel>` autosave debounce, cancel, ETag-conflict modal flows.
- `<ChartSurface>` add / reorder / delete optimism + rollback on simulated 5xx.
- `<ApplyToAllConfirmDialog>` requires double confirmation before triggering POST.

### 9.3 API integration

- All 8 routes against a Supabase test database.
- Auth matrix per §6.2 — every cell exercised, success and denial paths.
- 422 validation: malformed `chart_type`, missing fields, dimension mismatch.
- 409 concurrency: stale `If-Match`.
- 429 rate-limit.
- Audit-table writes occur on every save and on `apply-to-all`.

### 9.4 RLS (pgTAP-style SQL inside `supabase/tests/`)

- Trainer A cannot SELECT Trainer B's template (same tenant).
- Trainer cannot SELECT a template from a different tenant.
- Client cannot SELECT another client's row in same tenant.
- Client cannot INSERT/UPDATE/DELETE own row.
- Trainer impersonating a client (client session) cannot INSERT/UPDATE/DELETE chart configs.
- Tenant admin can read audit rows; non-admin actor reads only own.

### 9.5 Migration (test runner + visual regression)

- Apply migration on staging DB with N seeded trainers.
- `SELECT count(*) FROM trainer_chart_templates` equals N.
- Re-applying migration changes nothing (idempotency).
- Modify a trainer's template, re-run migration, confirm it survives.

### 9.6 E2E (Playwright)

- Trainer creates a chart on template → newly-created client inherits it.
- Trainer overrides a client → editing template doesn't propagate.
- Trainer hits "Apply to all" → all client override rows deleted; subsequent template edits propagate to those clients (with confirmation modal showing affected client count).
- Client mobile dashboard renders inside iframe (Safari ITP path).
- Orphaned form-question source shows the orphan empty-state and prompts repick.

### 9.7 Visual regression

- Pre/post-migration screenshots of the client dashboard at 7d/30d/90d for `chart_test_client.sql` fixture.
- Tight pixel-diff threshold (≤ 1% delta). Confirms the starter template reproduces today's dashboard.

### 9.8 Test fixtures

`supabase/fixtures/chart_test_client.sql` — one trainer + one client + 90 days of varied form responses (some days missing, some with text-coerced values, some at extreme values to exercise target-zone coloring). Used as input for both the visual-regression baseline and the API tests.

## 10. Observability

- **Logs.** Every server route propagates `correlationId` (existing pattern). Save endpoints log `{ correlationId, actor: "trainer:<id>", target: "template" | "client:<id>", chart_count, action }`.
- **Sentry breadcrumbs.** Chart render errors include `{ chartId, sourceId, chartType, hasData }`.
- **Metrics counters** (existing telemetry hook):
  - `chart.save` (template / client)
  - `chart.apply_to_all` (count of override rows deleted)
  - `chart.render_error`
  - `chart.orphan_source`
- **Alert.** Spike in `chart.render_error > 1%` of dashboard loads pages on-call. Threshold + routing follow `docs/architecture/security-baseline.md`.

## 11. Open Risks (with mitigations)

1. **Form-question id rename.** `questions_config` doesn't enforce immutability. _Mitigation:_ on form-template save, scan `trainer_chart_templates` + `client_chart_configs` for the id; if referenced, show a confirmation modal listing affected charts with a "rewrite references" option.
2. **Performance on wide ranges.** 90d × N form questions × bucketing client-side. _Mitigation:_ server-side bucketing on `snapshot`. 60-bucket cap with auto-fallback to weekly.
3. **Cross-tenant RLS bug.** Highest-impact failure mode. _Mitigation:_ exhaustive RLS tests (§9.4) + manual security review pre-deploy.
4. **Numeric coercion of text answers.** Trainer creates a `text` question for "weight." _Mitigation:_ picker only exposes questions with `type ∈ {number, decimal, integer}`. Type-changes after the chart was created go through the orphan path.
5. **iOS Safari iframe edge cases.** _Mitigation:_ chart endpoints reuse `clientFetch` which already does cookie + Bearer fallback. Tested in E2E.
6. **Concurrent edits across trainer devices.** _Mitigation:_ ETag/409 + side-by-side merge modal with three options (keep mine / keep theirs / merge both for non-overlapping ids).
7. **Audit-table growth.** _Mitigation:_ partial index for retrieval; a documented cleanup job at 12-month retention added to the cron sidecar TODO list (not implemented in this scope).
8. **Brand-color palette collisions.** _Mitigation:_ documented as future enhancement (per-tenant token override map). Out of this scope.

## 12. Out of Scope

Not in the build. Architecture must accommodate adding them later without rework.

- **Drag-and-drop reordering** — up/down arrow buttons only. Drag-on-iframe-mobile is unreliable; revisit after one quarter of usage data.
- **Exercise PRs / `client_measurements` / nutrition adherence as data sources** — adapter pattern accommodates them later. Out of this scope to limit blast radius.
- **Comparison charts** — "this client vs goal", "this period vs previous", multi-axis layers.
- **Chart annotations** — pinned trainer notes on a date / value.
- **Export to PDF / PNG** — different rendering pipeline.
- **Per-tenant brand-color theming on charts** — charts use the curated palette tokens; tenant brand colors continue applying to chrome only.
- **Client-side chart editing** — clients cannot edit their charts. RLS denies write.
- **Realtime updates** — charts refresh on dashboard load, not via Supabase realtime.
- **Multi-language catalog labels** — Spanish only at launch. `getSourceLabel(locale)` resolver is in place so adding locales later is mechanical.
- **Multi-source composition by trainers** — composite sources are predefined in code; trainers cannot build their own.

## 13. Acceptance Criteria

The feature is complete when:

1. **Migration applies cleanly** on production-equivalent staging; all existing trainers have a starter template row; the visual-regression suite confirms client dashboards render visually equivalent to pre-migration within a 1% pixel-diff threshold (the threshold absorbs minor rendering deltas from the new generic renderer; functional equivalence is verified by the suite's per-bucket value assertions).
2. **Trainer template editor** at `/trainer/dashboard/charts-template` lets a trainer add, edit, reorder, and delete charts with autosave + ETag concurrency, and lets them apply the template to all clients via a confirmation dialog.
3. **Per-client editor** at `/trainer/dashboard/clients/[clientId]/charts` shows the effective config bound to real client data, supports the same edit affordances, has a "reset to template" button, and shows orphan banners when applicable.
4. **Client dashboard** at `/[slug]/dashboard` renders the effective config (override if present, else template), works on iOS Safari inside the iframe, handles the snapshot endpoint's auto-fallback to weekly aggregation gracefully.
5. **Data-source picker** exposes the 14 catalog adapters plus every numeric form question the trainer has defined, with the trainer's labels.
6. **All RLS tests pass** — trainer cannot read another trainer's template, client cannot write any chart config, impersonated client cannot write.
7. **All API tests pass** — auth matrix, validation, ETag, rate-limit, audit writes.
8. **All E2E flows pass** — template-to-client inheritance, override isolation, apply-to-all, orphan handling, mobile iframe.
9. **Telemetry is live** — counters increment, alert routing is configured, Sentry breadcrumbs flow.
10. **Reversion seam intact** — legacy `progress-charts.tsx` still in tree behind a constant in `lib/charts/index.ts`; deploy is git-revertable.

After two clean weeks in production, the legacy chart code is removed in a follow-up PR.
