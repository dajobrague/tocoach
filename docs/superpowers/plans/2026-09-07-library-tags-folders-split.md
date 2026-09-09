# Biblioteca: separar etiquetas de carpetas — Plan · 2026-09-07

> **Sustituye** el modelo "carpeta = etiqueta" de las Fases C (C2–C4) y D (D2–D3) del plan del 2 de septiembre. Nada de eso está desplegado; se rehace antes del merge. Feedback de David tras probar en local: *"los tags deben ser una cosa, las carpetas otra; si creamos una carpeta no puede estar dentro de la lista de tags; y debe haber una manera más fácil de crear tags. Tanto para entrenamientos como ejercicios y nutrición."*

**Rama:** `feat/library-tags-folders-split` (worktree `top_coach-library`), partida de `integration/jc-feedback-2026-09-02`.

## Decisiones cerradas por David (2026-09-07)

| # | Decisión | Elección |
|---|---|---|
| 1 | Pertenencia a carpeta | **Una carpeta por elemento, como Google Drive.** Columna `folder_id`. Lo transversal ("vegano", "sin gluten") son etiquetas. |
| 2 | Naturaleza de las etiquetas | **Lista gestionada por tenant** (`library_tags`). Una etiqueta existe aunque nadie la use. Panel "Gestionar etiquetas" por biblioteca. |
| 3 | Datos existentes | **Mover a la carpeta y quitar la etiqueta homónima.** Reversible: la migración registra qué quitó. |
| 4 | Dónde se crean | **Inline** (escribes y Enter crea al instante) **y** en el panel de gestión. Mismo componente en recetas, ejercicios y plantillas. |

## Modelo objetivo

- **Carpetas**: `recipe_folders` y `program_folders` como hoy (jerarquía). Nuevo: `recipes.folder_id` y `programs.folder_id` (`uuid null`, FK `ON DELETE SET NULL`). Pertenencia = `folder_id`. Renombrar carpeta **no** toca etiquetas. Borrar carpeta: hijas a la raíz, elementos a la raíz. **Ejercicios no tienen carpetas** (JC).
- **Etiquetas**: tabla `library_tags(id, tenant_host, kind ∈ recipe|exercise|program, name, created_at)`, única por `(tenant_host, kind, lower(name))`. Los elementos **siguen guardando nombres** en sus arrays (`recipes.meal_type_tags`, `exercises.tags`, `programs.tags`): conserva filtros `@>`, índices GIN y todas las queries actuales. El registro es la fuente de verdad de *qué etiquetas existen*; renombrar = registro + `array_replace` (RPCs `replace_recipe_tag` / `replace_program_tag` ya existentes; crear `replace_exercise_tag`).
- **Invariantes**: una carpeta nunca aparece en sugerencias ni filtros de etiquetas; una etiqueta nunca crea ni implica una carpeta; un chip en una tarjeta es siempre una etiqueta.

## Migraciones (`20260907150000_*`, `20260907151000_*`) — se escriben y se aplican en LOCAL; prod por MCP tras prueba de David

1. `library_tags` + índice único + RLS permisivo espejo (el aislamiento sigue en servicio; ver `rls-hardening-impact-2026-09-07.md`).
2. `recipes.folder_id`, `programs.folder_id` + índices.
3. **Backfill reversible**: tabla `library_backfill_audit(item_kind, item_id, folder_id, stripped_tags text[], at)`. Para cada receta/plantilla cuyo array contenga un nombre que coincida (`lower`) con una carpeta de su tenant: `folder_id` = esa carpeta (si varias coinciden, la más profunda; empate → alfabético; se registra), y se quita **esa** etiqueta del array. Se anota en la auditoría.
4. Seed de `library_tags` con los nombres distintos que queden en los arrays, por tenant y kind.
5. `replace_exercise_tag` (espejo de las otras dos).

## Servidor

- `lib/library/tag-service.ts` (nuevo): `list(tenant, kind)` con conteo de uso, `create`, `rename` (registro + RPC), `remove` (registro + quitar del array en los elementos). Validación de nombre (trim, no vacío, ≤ 40).
- `lib/library/folder-service.ts`: `update` deja de retagear. `remove` confía en las FKs.
- Rutas: `GET/POST /api/library-tags?kind=`, `PATCH/DELETE /api/library-tags/[tagId]`. Guard `getTrainerSession()` → `tenant_host`.
- Filtro por carpeta en servidor: `?folder=<id>` (`.eq("folder_id")`) y `?folder=root` (`is null`) en `/api/recipes` y `/api/templates`. Compone con `?tag=` (`@>`).
- Mover a carpeta = `PATCH /api/recipes/[id]` y `PATCH /api/templates/[id]` con `{ folder_id }` (parcial, sin tocar nada más).

## UI compartida (`features/trainer/library/`)

- `TagsField`: sugerencias **solo** del registro (`useLibraryTags(kind)`). Escribir un nombre que no existe + Enter → lo crea en el registro y lo añade al elemento, una sola acción, sin fila "Crear etiqueta «…»". Chips con quitar.
- `TagManagerPanel` (nuevo, modal): lista con conteo de uso, crear, renombrar, borrar (confirm con `confirmAfterPress`; borrar quita la etiqueta de todos los elementos). Botón "Etiquetas" junto a los filtros de cada biblioteca.
- `TagFilterSelect`: opciones del registro.
- `FolderBrowser` / `folder-tree`: por `folder_id`. Contadores por subárbol de `folder_id`. "Mover a" → PATCH `folder_id`. Sin `hideTag`. Raíz = `folder_id IS NULL`.
- Vista Lista: agrupada por carpeta real (`folder_id`), "Sin carpeta" al final.

## Dominios

| Dominio | Etiquetas | Carpetas |
|---|---|---|
| Recetas | `meal_type_tags`, kind `recipe` | `recipe_folders` + `recipes.folder_id` |
| Plantillas de entrenamiento | `programs.tags`, kind `program` | `program_folders` + `programs.folder_id` |
| Ejercicios | `exercises.tags`, kind `exercise` | **ninguna** |

Recetas deja de tener copias propias (`features/trainer/recipes/folder-browser.tsx`, `folder-tree.ts`, `use-folders.ts`): consume lo compartido.

## Orden de trabajo (un agente, un commit por paso)

1. Migraciones + aplicar en local + verificación SQL del backfill.
2. `tag-service` + rutas `/api/library-tags` + tests.
3. `folder-service` sin retag; `?folder=` y `PATCH folder_id` en recetas y plantillas; tests de paridad servidor.
4. UI compartida: `TagsField`, `TagManagerPanel`, `TagFilterSelect`, `FolderBrowser`/`folder-tree` por `folder_id`.
5. Recetas sobre lo compartido (borrar copias propias).
6. Plantillas de entrenamiento.
7. Ejercicios (solo etiquetas + panel).
8. Actualizar `docs/development/jc-feedback-review-2026-09-02.md` y el plan del 2 de septiembre (C2–C4, D2–D3 → sustituidos por este).

## Verificación manual (David, en 3001 tras re-merge)

- Crear carpeta "Cenas" → **no** aparece en sugerencias ni en el filtro de etiquetas.
- Escribir "vegano" + Enter en una receta → chip al instante; aparece en "Etiquetas" (panel) con conteo 1; sigue existiendo si se quita de la receta.
- Mover receta a "Cenas" → sin chip nuevo; entra en la carpeta; filtrar "vegano" dentro de "Cenas" funciona.
- Renombrar carpeta → las recetas siguen dentro; sus etiquetas no cambian.
- Renombrar etiqueta en el panel → todos los chips cambian.
- Mismo recorrido en Plantillas; en Ejercicios solo etiquetas + panel + filtro en el selector de sesión.
- Datos migrados en local: las recetas con carpeta+etiqueta homónima aparecen en su carpeta sin el chip duplicado.
