# Revisión — Feedback Jose Carlos · Ramas del 2026-09-02

> Revisión de código de las tres ramas producidas hoy a partir del plan `docs/superpowers/plans/2026-09-02-feedback-jose-carlos-plan.md`. Leída sobre los diffs completos (`main..HEAD`), no sobre los reportes de los agentes. Gates (`type-check`, `lint:check`, `vitest`) ejecutados de forma independiente en cada worktree. **Nada probado en navegador** — esa es la superficie de review de David.

| Rama | Fases | Commits | Ficheros | Gates |
|---|---|---|---|---|
| `feat/charts-media-units-calendar` | A + B | 1 | 24 | ✅ tsc · ✅ lint · 11/11 |
| `feat/tags-predictive-no-folders` | C | 4 | 17 | ✅ tsc · ✅ lint · 862/862 |
| `feat/nav-split-and-weight-access` | E + F | 4 | ~10 | ✅ tsc · ✅ lint · 46/46 |

Sin solapamiento de ficheros entre ramas. Sin residuos (`_tmp_*`, `.husky/_` no commiteado). Ninguna con push.

---

## Bloqueantes

**Ninguno.** Las tres ramas son mergeables.

---

## Decisiones que quedan en manos de David

### 1. ~~Las métricas custom no reciben unidad ni estrellas~~ — **RESUELTO 2026-09-03 tras prueba de David**

David probó en local y encontró una gráfica de valoración 1–5 con **media "52,3" y cinco estrellas llenas**, y estrellas distintas a las del formulario.

**Causa raíz (dos capas):**
- `demo-data.ts` mandaba toda fuente `form_question` al preset `DEFAULT` (0–100, arranque en 50). El editor de plantillas pinta **siempre** demo data. Con datos reales no pasaba (verificado: 1.600+ respuestas por pregunta, todas 1–5).
- El tipo de la pregunta **nunca llegaba a la capa de charts**: `resolveAdapter` construye un shell sin plantilla, el snapshot no publicaba metadata, y `ChartDataSource.y_max` existía pero nadie lo asignaba. Por eso el agente había puesto `metric-format.ts`: adivinar "rating" y unidad por substring del id. Parche de síntoma.

**Arreglo de raíz (`5a05614` + `da1bff5` en integración y en `feat/charts-media-units-calendar`):**
- `type: "rating"` de `form_templates` → adapter `kind: "rating"` → `metadata { y_max: RATING_MAX, rating: true }`.
- `resolveAdapter(ref, { sources })` fusiona la metadata conocida sobre el shell. El trainer la tiene en `useDataSources()`; el portal cliente la recibe en el snapshot (`sources`, nuevo).
- Demo data: fuente rating → enteros 1..5.
- `RatingStars`: `solar:star-bold` con `text-warning` / `text-default-300`, **las mismas del formulario**. `RATING_MAX = 5` vive en `lib/forms/types.ts` — la escala la define el formulario, no es configurable por pregunta.
- `metric-format.ts` y su test **borrados**. Las 17 preguntas numéricas del template default llevan `unit`; no hacía falta adivinar.
- Segundo fallo encontrado en la revisión: el `useMemo` de la demo no dependía de `sourcesQuery.data` → preview obsoleta hasta cambiar de rango. Corregido.
- Test de regresión: `lib/charts/__tests__/rating-source.test.ts` (3 casos: discovery, merge en resolveAdapter, rango de la demo).

**Lo que sigue siendo verdad:** una pregunta custom con `type: "number"` **sin** `unit` en su config no muestra unidad. Eso ya no es una heurística fallando: es el trainer sin rellenar el campo.

**Deuda dejada a propósito:** `dynamic-form-modal.tsx` sigue con el literal `[1, 2, 3, 4, 5]` en vez de `RATING_MAX`; los presets `mood/energy/stress` (máx. 10) de `demo-data.ts` son código muerto (no existen adapters de catálogo para ellos, cero charts en prod). Ninguno afecta al comportamiento.

### 2. El encabezado "PLANTILLAS" del sidebar se mantiene (nav)
JC dijo que *"los encabezados que haya ahora pueden desaparecer"*. El agente eliminó los tabs internos de la página pero conservó el grupo "PLANTILLAS" del sidebar porque también agrupa Gráficas / Check-in / Hábitos. Lectura defendible, pero no es literalmente lo que pidió. Confirmar con JC al enseñárselo.

### 3. La página v2 de planes nutricionales no tiene "Crear" ni "Editar" (nav)
En v2 las plantillas solo nacen desde "Guardar plantilla" en el plan de un cliente y se editan instanciándolas. No lo introdujimos nosotros; la entrada nueva del sidebar lo deja a la vista. Asimetría con Entrenamiento, que sí tiene "Crear Plantilla". Ticket aparte si chirría.

---

## A verificar en navegador (nadie lo ha hecho)

1. **Selector de periodo del portal cliente con 6 botones** (`dashboard-content.tsx:86`). Bajó a `px-1.5` + `whitespace-nowrap`. En 320px, "14 Días / 30 Días / 3 Meses / …" puede desbordar. Salida si pasa: acortar etiquetas.
2. **Autocomplete de etiquetas** (`tags-field.tsx`). Tras elegir con ratón el desplegable **se queda abierto** (`selectedKey={null}`); Enter con fila resaltada no debe añadir dos veces (guard `pickedRef` + `queueMicrotask`). Comportamiento dependiente de la versión de React Aria — probar ambos caminos.
3. **Calendario a 12 meses**: 52 filas con puntos de 5px en ~200px. Legibilidad del punto partido a ese tamaño.
4. **Tarjetas de carpeta con filtro de etiqueta activo** muestran "0 recetas" (el contador refleja el filtro, no el total). Puede leerse como carpeta vacía.

---

## Verificado y correcto — lo que importaba

**Gráficas**
- **`parseRange`** (`snapshot/route.ts:154`): anclar `to` a `tzNoon(todayYmd)` en vez de mañana 00:00Z. Verificado que `averageInWindow`/`sumInWindow` comparan por YMD (`bucketing.ts:377,411`), así que **no se pierden datos de hoy** y **la media del header no cambia** (el bucket fantasma era `null`). Único efecto visible: daily 8→7, 15→14, 31→30. Es arreglo de raíz, no parche del calendario.
- Preferencia por gráfica: clave `tc-chart-header-stat:<config.id>`, `Map` en memoria como fallback, sync cross-tab conservada. Default `average` en `parseHeaderStatMode`, así el valor huérfano de la clave global vieja degrada a Media.
- Calendario: `weekdayMondayFirst` usa `getUTCDay` sobre `T00:00:00Z` → correcto en cualquier tz. Filas contiguas garantizadas por `generateBuckets` daily. Validación exige `catalog/training_breakdown`. Editor bloquea agrupación en daily y esconde el tipo si la fuente no es Entrenamiento. `chart-renderer` tolera `colors[0]` undefined.
- Peso: `SYNTHETIC_WEIGHT_CHART` es `form_question/body_weight` → matchea `weight` → "kg". Correcto.
- 14d: `RANGE_DAYS` es fuente única; el snapshot route valida contra sus keys; `getEffectiveAggregation` devuelve daily.

**Etiquetas** — **REHECHO 2026-09-07** en `feat/library-tags-folders-split` (plan `docs/superpowers/plans/2026-09-07-library-tags-folders-split.md`). David probó en local el modelo "carpeta = etiqueta" de esta ronda y lo rechazó: las carpetas salían en sugerencias y filtros, mover a una carpeta añadía un chip, "Cenas" (carpeta) y "cenas" (etiqueta) eran lo mismo. Nada de aquello llegó a prod. Lo que hay ahora:
- **Modelo:** pertenencia a carpeta = `recipes.folder_id` / `programs.folder_id` (una carpeta por elemento, FK `ON DELETE SET NULL`). Etiquetas = registro `library_tags(tenant_host, kind, name)` por tenant; los elementos siguen guardando nombres en sus arrays (`@>` y GIN intactos). Ejercicios: etiquetas sí, carpetas no.
- **Invariantes:** una carpeta nunca aparece en sugerencias ni filtros; una etiqueta nunca crea ni implica una carpeta; un chip es siempre una etiqueta; una etiqueta existe aunque nadie la lleve.
- **Servidor:** `lib/library/tag-service.ts` + `/api/library-tags` (listado con conteo de uso en un RPC, crear idempotente, renombrar/borrar propagando a los arrays con RPCs `replace_*_tag` case-insensitive). `FolderService.update` ya no retagea. `?folder=root|<id>` y `PATCH { folder_id }` parciales en `/api/recipes/[id]` y `/api/templates/[templateId]` (paridad testeada). El import de comunidad registra las etiquetas copiadas.
- **UI compartida** (`features/trainer/library/`): `TagsField` (escribir + Enter crea en el registro y añade, sin fila "Crear"), `TagFilterSelect` (registro), `TagManagerPanel` (crear/renombrar/borrar con `confirmAfterPress`), `FolderBrowser`/`folder-tree` por `folder_id`, sin `hideTag`. Recetas ya no tiene copias propias.
- **Backfill reversible** (`20260907151000`): cada receta/plantilla con etiqueta homónima a una carpeta pasa a esa carpeta (la más profunda; empate → alfabético) y pierde solo esa etiqueta; `library_backfill_audit` guarda carpeta asignada, etiquetas quitadas y candidatas. Después se siembra el registro y se unifica la grafía de los arrays a la del registro. Etiquetas > 40 caracteres (27 en local, heredadas del seed de músculos/equipamiento) quedan en los arrays sin registrar.
- La decisión D2 ("dejar las carpetas auto-creadas") sigue vigente para las carpetas; los pares carpeta+etiqueta homónimos los resuelve el backfill.

**Nav + peso**
- Sin URL rota: `/trainer/dashboard/templates` sigue sirviendo entrenamiento; nutrición es subruta nueva. Subruta en vez de query param porque `useActiveKey` resalta por prefijo de pathname.
- `nutrition/page.tsx` usa **el mismo** `useNutritionV2FlagStatus` + `resolveNutritionTabView` que `nutrition-tab-switch.tsx:25-26`. Las dos superficies coinciden por construcción.
- Borrado v1/v2 **no puede cruzarse**: `templates-content.tsx` (v1) intacto; `cycle-templates-content.tsx` (v2) solo conoce hooks de `use-cycles`. No hay un `if` que se pueda equivocar. Borrar invalida `["cycle-templates"]`, la misma key que lee "Desde plantilla".
- `WeightHistoryModal` reutilizado, no gráfica nueva. Sin acoplamiento con calculadora ni metas. `confirmAfterPress`, no `confirm()` nativo.

---

## Deuda menor (no bloquea)

- Los puntos del calendario son `<span title>`: sin acceso por teclado ni lector de pantalla más allá del hover.
- `weight-history-modal` no ofrece 14d (fuera de alcance, pero inconsistente con el resto).
- `recipe-card.tsx` y `templates-content.tsx` usan `text-gray-900` / `bg-black text-white` — **preexistente**, lo absorbe el proyecto de unificación de diseño. Los chips nuevos sí usan tokens.
- La clave global vieja `tc-chart-header-stat` queda huérfana en localStorage. Inofensiva.
- `chartPeriodCountForRange` recibió `"14d": 8` sin llamadores externos.
- `memoryPrefs` `Map` crece una entrada por gráfica vista. Irrelevante en la práctica.

---

## Orden de merge recomendado

1. **`feat/nav-split-and-weight-access`** — la más pequeña e independiente. Que JC vea el sidebar partido y el botón de peso cuanto antes.
2. **`feat/charts-media-units-calendar`** — P0 declarada por JC. Lleva el fix de `parseRange`, que cambia N+1→N en barras diarias de producción: avisar a JC de que la barra vacía del final desaparece.
3. **`feat/tags-predictive-no-folders`** — después de probar el Autocomplete en navegador.
4. **`feat/training-tags-and-folders`** (Fase D, en curso) — parte de la rama de etiquetas; si C cambia tras la prueba, D necesita rebase antes de PR.

Ninguna rama debe salir del worktree hasta que David la pruebe en local.

---

## Actualización 2026-09-07 — RLS (Opción A) integrada

- Rama `fix/rls-hardening` (4 commits, desde `main`) revisada línea a línea y **mergeada en `integration/jc-feedback-2026-09-02`** sin conflictos (cero solapamiento de ficheros). 27 commits sobre main; type-check limpio; **896/896** tests; integración contra base local 122/122.
- Verificado por mí, no por el reporte: `fetchWithAuth` respeta el `Authorization` global (supabase-js 2.81.1); supabase-js inyecta siempre su propio `accessToken` en Realtime (por eso hace falta el callback en `supabase-browser.ts`); los triggers `auto_confirm_*` cuelgan de `public.trainers`/`admin_users`, no de `auth.users` → el alta no depende de `supabase_auth_admin`.
- El REVOKE aplicado en la base **local** había roto el servidor de integración (27 `permission denied`); tras el merge y reinicio en 3001: login 401 limpio, `/api/realtime/token` 401 sin sesión (secret cargado), 0 `permission denied`.
- `npm i --no-save server-only` en el `node_modules` del repo principal (package.json/lock intactos); el worktree `top_coach-rls` tiene ahora `node_modules` propio (npm sustituyó el symlink).
- **Producción, orden obligatorio:** (1) desplegar código (`SUPABASE_JWT_SECRET` ya está en Railway); (2) verificar login, chat, campana; (3) aplicar `20260907120000_revoke_anon_table_access.sql` por MCP con confirmación de David.
- Deuda señalada por el agente, fuera de alcance: `notifications.tenant_slug` tiene FK a `tenants(host)` pero el chat guarda el slug (falla silenciosa 23503 si host≠slug); `forms/notifications/create` guarda host; 61 políticas `anon → true` inertes en otras tablas; CLAUDE.md sigue mencionando `trainer_profiles`/`client_profiles` que no existen en prod.
