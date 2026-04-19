# Plan de fix — Performance plan nutricional

**Fecha:** 2026-04-19
**Reportado por:** Carlos (aplica a todos los tenants por igual)
**Estado:** Fases 1, 2, 3 y 4 implementadas y verificadas por David en localhost. Fase 5 (limpieza) pendiente.

---

## Principios que voy a seguir

1. **Producción primero.** Cada fase es independiente y desplegable por separado. Podemos parar en cualquier fase si ya hay suficiente mejora.
2. **Cambios aditivos siempre que se pueda.** Nada de borrar código hasta validar que lo nuevo funciona.
3. **Rollout para todos a la vez.** Nada de canaries ni feature flags de activación gradual — cuando una fase se despliega, aplica a todos los tenants por igual. El rollback se hace con `git revert` si hace falta.
4. **Medir antes y después.** Sin métricas no sabemos si mejora o empeora.
5. **Rollback trivial por fase.** Cada merge es un commit atómico; revertir es un único `git revert`.

---

## Métricas de éxito (baseline que vamos a establecer)

Añadir logging server-side de latencia en los 4 endpoints clave:

| Endpoint                                          | Operación               | Baseline esperado (pre-fix) | Target (post-fix) |
| ------------------------------------------------- | ----------------------- | --------------------------- | ----------------- |
| `GET /api/client/nutrition`                       | Cargar plan del cliente | 1-4s (87 queries)           | <300ms            |
| `GET /api/nutrition/plans/[id]`                   | Cargar plan en editor   | 1-4s                        | <300ms            |
| `POST /api/nutrition/plans` (con templateId)      | Clonar plantilla        | 5-15s (101 queries)         | <1s               |
| `PATCH /api/nutrition/ingredients/[id]` + refetch | Editar cantidad         | 1-4s (1 PATCH + 87 queries) | <100ms percibido  |

La medición se hace con un `console.time` simple en cada endpoint más un middleware que loggea `duration_ms` y `query_count`. Nada pesado — solo logs estructurados que luego podemos revisar.

---

## Fase 1 — Instrumentación + fixes de seguridad ✅ IMPLEMENTADA

**Objetivo:** medir baseline real + arreglar el bug de "fotos/calorías desaparecen" (2.1) como efecto secundario.
**Riesgo:** Muy bajo.
**Impacto visible al usuario:** El bug 2.1 desaparece (o al menos deja de ser silencioso — ahora queda log). El resto es invisible (solo logs).

### Cambios realizados

**1.1 — Logger de performance reutilizable**

Nuevo archivo: `lib/utils/perf-logger.ts`. Exporta:

- `startPerfTimer(endpoint)` → devuelve `{ end(meta?) }`. Mide `performance.now()` y emite línea `[PERF] {...json}`.
- `logPartialLoad(endpoint, level, context, error)` → emite línea `[PERF_PARTIAL_LOAD] {...json}` cuando un sub-fetch falla silenciosamente.

Ambas funciones envuelven el `console.log` en `try/catch` vacío — la instrumentación no puede romper una request nunca.

**1.2 — Instrumentar los 4 endpoints**

Timer arrancado arriba del handler, `timer.end({...})` en cada exit path (incluyendo 401/404/400/500 y el success):

- `app/api/client/nutrition/route.ts` (GET)
- `app/api/nutrition/plans/route.ts` (POST — con meta `cloned_from_template`, `is_template`)
- `app/api/nutrition/plans/[id]/route.ts` (GET/PATCH/DELETE)
- `app/api/nutrition/ingredients/[ingredientId]/route.ts` (PATCH/DELETE — con `fields_updated` en PATCH)

**1.3 — Eliminar catches silenciosos en las lecturas anidadas**

En los 2 endpoints de lectura (`app/api/client/nutrition/route.ts` GET y `app/api/nutrition/plans/[id]/route.ts` GET), cada uno de los 4 niveles anidados (days → meals → options → ingredients) tenía un `try/catch` que devolvía `[]` ante error. Ese es el origen del bug "fotos/calorías desaparecen": el sub-fetch fallaba silenciosamente y el cliente veía un día sin comidas o una comida sin ingredientes.

Cambio aplicado (estrategia "más segura" del plan original):

- Se mantiene el `console.error(...)` que ya existía para no romper dashboards externos.
- Se añade `logPartialLoad(endpoint, level, context, error)` con contexto estructurado (`client_id`, `plan_id`, `day_id`, `meal_id`, `option_id`).
- Se incrementa `partialLoadCount` local.
- Se añade flag `_partial_load: true` al objeto devuelto al cliente — útil para el frontend más adelante, hoy no lo rompe (es una propiedad extra).
- En el `timer.end` final del endpoint se emite `partial_load_count` para poder filtrar desde logs.

**1.4 — Índices compuestos**

Migración nueva: `supabase/migrations/078_add_nutrition_order_indexes.sql`:

```sql
CREATE INDEX IF NOT EXISTS nutrition_meal_options_meal_order_idx
  ON nutrition_meal_options (meal_id, option_order);

CREATE INDEX IF NOT EXISTS nutrition_ingredients_option_order_idx
  ON nutrition_ingredients (option_id, ingredient_order);
```

Son compuestos `(parent_fk, child_order)` porque los endpoints hacen siempre `.eq(fk, X).order(child_order)`. Con un índice simple el planner tiene que sortear en memoria; con compuesto los devuelve ya ordenados. Las tablas son pequeñas, la creación es en milisegundos.

Aditivo, `IF NOT EXISTS`, no reescribe la tabla. Los índices simples sobre `meal_id` y `option_id` ya los crearon las migraciones 018 y 073 — los compuestos son aditivos a esos.

### Validación Fase 1

Lo que el **usuario** tiene que hacer en localhost antes de subir a prod:

1. Arrancar `pnpm dev` (o el equivalente del repo) y revisar que los logs `[PERF] {...}` salgan al hacer cualquier llamada a los 4 endpoints. Por ejemplo abrir un plan como entrenador → debe salir `[PERF] {"endpoint":"GET /api/nutrition/plans/[id]", "duration_ms":..., "plans":..., "partial_load_count":0, ...}`.
2. Aplicar la migración 078 en el Supabase local (`supabase db push` o el comando del proyecto). Verificar con `\d nutrition_meal_options` que el índice `nutrition_meal_options_meal_order_idx` aparece.
3. Reproducir el bug de "fotos/calorías desaparecen" si es posible (p.ej. forzando un error en Supabase) y confirmar que aparece `[PERF_PARTIAL_LOAD] {...}` con `level`, `meal_id`, etc.
4. Comprobar que la UI sigue funcionando como antes (ningún cliente se ha tocado — solo API y log util nuevo).

Checks automáticos ya ejecutados:

- `npx tsc --noEmit` → 0 errores.
- `npx eslint --fix` → 0 errores, 37 warnings (todos preexistentes, `no-console` en otros archivos).

### Rollback Fase 1

`git revert` del commit (o de los commits si se decide separar). La migración 078 se queda: es aditiva, no estorba y la Fase 2 se va a apoyar en ella.

---

## Fase 2 — Refactor de lectura (N+1 → 1 query) ✅ IMPLEMENTADA

**Objetivo:** Convertir los 87+ queries anidados en 1 sola query que usa PostgREST embedded resources.
**Riesgo:** Medio. Cambio de forma de construir el response (mismo shape de salida, implementación distinta).
**Impacto visible al usuario:** Carga del plan pasa de 1-4s a <300ms. Massive win.
**Verificación localhost:** David confirmó que la UI se ve idéntica a como estaba (orden, fotos, nombres, ingredientes).

### Cambios

**2.1 — Reescribir `GET /api/client/nutrition`**

Reemplazar el Promise.all anidado de 4 niveles (líneas 24-148) por una única query Supabase con embedded selects:

```javascript
// Conceptual, no código final:
supabase
  .from("nutrition_plans")
  .select(
    `
    *,
    nutrition_days!inner(
      *,
      nutrition_meals(
        *,
        nutrition_meal_options(
          *,
          nutrition_ingredients(*)
        )
      )
    )
  `
  )
  .eq("client_id", clientId)
  .order("created_at", { ascending: false });
```

PostgREST genera internamente un JOIN/LATERAL en SQL → un único round-trip. El ordenamiento de las relaciones anidadas se gestiona con `.order()` en el embed, o con un post-sort en JS si Supabase no lo soporta bien en el nesting que necesitamos (a verificar durante implementación).

Mantener el mismo shape de response para no tocar el cliente: `{ success, data: [...] }`.

**2.2 — Reescribir `GET /api/nutrition/plans/[id]`**

Mismo patrón. Mismo contract de salida.

**2.3 — Tests de regresión manual en localhost**

Antes de merge a prod:

- Validar que un plan con 7 días × 4 comidas × 3 opciones × 5 ingredientes devuelve exactamente los mismos datos.
- Validar el orden correcto (day_order, meal_order, option_order, ingredient_order).
- Validar que plans sin ingredientes / sin opciones no explotan.
- Validar que los logs `[PERF]` de Fase 1 muestran la latencia cayendo a <300ms.

**2.4 — Sin feature flag: rollback = git revert**

Como acordamos, el cambio aplica a todos los tenants a la vez. Si algo explota en prod, el rollback es `git revert` del commit. Dado que estamos cambiando la implementación (misma shape de response, distinta construcción), la validación manual en localhost tiene que ser exhaustiva antes de subir.

### Validación Fase 2

- En localhost, comparar response antes/después con un script de diff (o a ojo con un plan real de Carlos).
- Subir a prod.
- Observar logs `[PERF]` 24-48h: p95 de GET plan < 300ms, 0 errores nuevos.
- Si aparece regresión → `git revert` inmediato.

### Rollback Fase 2

`git revert` del commit de Fase 2.

---

## Fase 3 — Refactor de clonación de plantilla ✅ IMPLEMENTADA

**Objetivo:** POST `/api/nutrition/plans` con templateId pasa de 101 queries secuenciales a ~10-15 con paralelismo y batch inserts.
**Riesgo:** Medio-alto. Es un INSERT masivo — si algo falla a mitad, hay que garantizar atomicidad.
**Impacto visible al usuario:** "Cargar un plan" pasa de 5-15s a <1s.
**Verificación localhost:** David confirmó que el clonado desde template funciona sin problemas. Durante la verificación se detectó un bug de UI preexistente en el DELETE de plan (`setNutritionPlan(null)` no refrescaba `allPlans`), arreglado en el mismo pase.

**Nota de semántica:** la implementación pre-Fase-3 usaba `continue` en errores y podía dejar planes clonados parcialmente en silencio. La implementación Fase 3 es atómica: cualquier fallo en los batch inserts borra el plan recién creado (cascade) y devuelve 500.

### Cambios

**3.1 — Fetch template completo en una query**

Misma técnica que Fase 2: fetch del template y toda su estructura anidada en un solo `select` embebido.

**3.2 — Batch inserts por nivel con Promise.all**

Estrategia:

1. Insert plan → obtiene `newPlanId`.
2. Batch insert de todos los days (Promise.all con paralelismo). Devuelve array de `newDayId` mapeables a `templateDayId`.
3. Batch insert de todos los meals usando el map día viejo → día nuevo. Similar mapping.
4. Batch insert de todas las options.
5. Batch insert de todos los ingredients.

Cada nivel se hace en paralelo internamente (un solo insert con múltiples filas por nivel), pero los niveles son secuenciales porque cada uno depende de los IDs del anterior.

**3.3 — Manejo de fallos parciales**

Si el insert de un nivel falla, hay que borrar el plan recién creado + cascada (si las FKs tienen ON DELETE CASCADE ya lo hacen; verificar en migraciones). Si no, añadir rollback manual.

Supabase no expone transacciones multi-statement desde el cliente JS. Opciones:

- **Opción A:** usar un `execute_sql` RPC para envolver los inserts en una transacción. Máxima seguridad, más complejidad.
- **Opción B:** hacer los inserts en orden y en caso de fallo en paso N, borrar el plan creado (cascada limpia lo demás). Más simple, requiere que las FKs tengan `ON DELETE CASCADE`.

**Verificar FKs cascade en migración 018 antes de elegir.** Si ya tienen cascade (lo más probable), opción B es suficiente.

**3.4 — Sin feature flag: rollback = git revert**

Igual que Fase 2. La validación manual en localhost tiene que ser exhaustiva: al ser INSERT masivo, una regresión podría dejar datos corruptos.

### Validación Fase 3

En localhost, con una copia de datos reales si es posible:

- Clonar un plan complejo desde plantilla existente (misma que Carlos usó).
- Comparar resultado con el path viejo (un commit anterior): mismos days, meals, options, ingredients, orden, macros.
- Medir latencia en logs `[PERF]` — tiene que caer a <1s.
- Probar caso de error (simular insert failure en options) y verificar que el plan raíz queda borrado por cascade.
- Solo si todo pasa, subir a prod.

### Rollback Fase 3

`git revert` del commit. Los datos ya creados en prod se mantienen (son planes nuevos válidos).

---

## Fase 4 — Optimistic updates en el editor (frontend) ✅ IMPLEMENTADA

**Objetivo:** eliminar las esperas percibidas al editar. Cada cambio es instantáneo en la UI; la sincronización con el backend ocurre en background.
**Riesgo:** Medio. Si el PATCH falla, hay que hacer rollback visual y mostrar error.
**Impacto visible al usuario:** Enorme. La UI responde en <50ms en lugar de 1-4s.
**Verificación localhost:** David confirmó que todas las ediciones se sienten instantáneas.

**Resumen de lo implementado:** 2 helpers nuevos (`updateIngredientInMealNested`, `updateOptionInMealNested`); 5 handlers migrados (`handleSaveEditIngredient`, `handleSaveOptionMacros`, `handleSaveOptionName`, `handleSaveNewIngredient` mejorado en error path, `handleAddAlternative` con `refreshPlan()` superfluo quitado). Los deletes de plan/day/meal/option siguen con `refreshPlan()` intencionadamente — son acciones menos frecuentes con confirmación modal. Se mantiene `alert()` para errores (consistente con el resto del archivo).

### Cambios

**4.1 — Patrón de optimistic update**

En `nutrition-tab.tsx`, reemplazar el patrón:

```
await fetch(PATCH)
await refreshPlan()  // ← 87 queries
```

Por:

```
1. Modificar el estado local (setNutritionPlan con cambio aplicado)
2. Disparar fetch PATCH en background
3. Si éxito → no hacer nada (el estado local ya es correcto)
4. Si fallo → revertir estado local + toast de error
```

Handlers a migrar (orden de dolor reportado por Carlos):

1. `handleSaveEditIngredient` (línea 1687) — el que más duele
2. `handleConfirmDeleteIngredient` (dentro de `handleConfirmDelete` línea 1758)
3. `handleSaveOptionMacros` (línea 1430)
4. `handleSaveOptionName` (línea 1457)
5. `handleSaveNewIngredient` (línea 1270) — ya tiene optimistic add parcial, mejorar
6. `handleAddAlternative` (línea 1362)

**4.2 — Helper reutilizable**

Extraer un helper `applyOptimisticIngredientChange(planState, ingredientId, changes)` que busca dentro del árbol anidado y devuelve el plan con el cambio aplicado. Esto evita duplicar la lógica de navegación del árbol en cada handler.

**4.3 — Mantener `refreshPlan()` solo como fallback**

`refreshPlan()` no se borra. Se usa:

- Al montar el componente (carga inicial).
- Si el usuario pulsa botón manual "Recargar".
- **No** tras cada mutación.

**4.4 — Opcional (si tiempo permite): migrar a React Query**

Cambiar el estado local a un `useQuery(["trainer", "nutrition", clientId])` y los handlers a `useMutation` con `onMutate` + `onError`. Es más robusto pero más invasivo. **Recomendación: no hacerlo en esta fase.** Dejar nota en el código y hacerlo en una fase futura si el patrón 4.1 no es suficiente.

**4.5 — Sin feature flag: rollback = git revert**

Cambio va para todos a la vez. Al ser frontend, revertir implica redeploy — por eso la validación en localhost tiene que ser muy completa antes de subir.

### Validación Fase 4

- Probar en localhost con un plan real.
- Verificar: edición de cantidad, nombre, unit, delete, add, reorder — todos deben sentirse instantáneos.
- Forzar fallo de red (devtools) y verificar que aparece el toast de error y la UI revierte.
- Forzar error del servidor (apagar Supabase local) y verificar comportamiento.
- Solo si todo pasa, subir a prod.

### Rollback Fase 4

`git revert` + redeploy. No instantáneo, por eso se hace al final cuando el backend ya es estable.

---

## Items de feedback 2.2 / 2.3 / 2.4 ✅ IMPLEMENTADOS (2026-04-19)

Cerrados en batch tras autorización explícita de David. Detalle completo en `DIAGNOSTICO_FEEDBACK_USUARIO.md`.

- **2.2 Edición reordena al final:** Resuelto como efecto lateral de Fase 4 + fix defensivo en PATCH `/nutrition/ingredients/[id]` para no sobreescribir `ingredient_order` cuando no viene en el body.
- **2.3 Toggle ocultar calorías:** herencia plan → comida (tri-estado). Migración 079, whitelist backend, UI trainer (Switch plan + botón cíclico por comida), UI cliente (oculta kcal en `MacroRow`, `MacroRangeRow`, `MealMultiOptionClientSection` y celda de totales del día).
- **2.4 Receta por opción:** 5 campos (`instructions`, `prep_time_minutes`, `cooking_time_minutes`, `servings`, `recipe_notes`). Migración 080, whitelist con normalizadores, UI trainer colapsable con 3 estados, UI cliente `RecipeSection` colapsable con chip de tiempos.

**Migraciones pendientes de correr manualmente en Supabase:** 079 y 080 (ver abajo).

Validación: `tsc --noEmit` exit 0, `eslint` 0 errores.

---

## Fase 5 — Limpieza

**Objetivo:** consolidar lo que ha funcionado, declarar el fix completo.

### Cambios

1. Tras 1-2 semanas de métricas estables en prod con las fases 2-4, revisar si queda código muerto (comentarios, helpers no usados) y limpiarlo.
2. Consolidar los logs `[PERF]` / `[PERF_PARTIAL_LOAD]` en algo persistente si se quiere (Supabase log drains a una tabla, o integración con herramienta externa). Opcional.
3. Revisar si merece eliminar `console.error` duplicados en los endpoints ahora que tenemos los logs estructurados.

Sin feature flags que borrar — no se crearon.

---

## Orden y tiempos estimados

| Fase                       | Dependencias                | Tiempo estimado dev | Tiempo observación en prod |
| -------------------------- | --------------------------- | ------------------- | -------------------------- |
| 1. Instrumentación + fixes | —                           | 1-2 sesiones        | 2-3 días (baseline)        |
| 2. Refactor lectura        | Fase 1 (para medir mejora)  | 2-3 sesiones        | 2-3 días                   |
| 3. Refactor clonación      | Fase 2 (mismo patrón)       | 2 sesiones          | 2-3 días                   |
| 4. Optimistic updates      | Fases 2-3 (backend estable) | 3-4 sesiones        | 3-5 días                   |
| 5. Limpieza                | Todo lo anterior validado   | 1 sesión            | —                          |

Total: ~10 sesiones de trabajo distribuidas en 3-4 semanas calendario. Cada fase la valida David en localhost antes de subir a prod; tras subir, se observan logs durante los días indicados antes de pasar a la siguiente.

---

## Riesgos y mitigaciones

**Riesgo 1: El cambio de Promise.all anidado a query nested rompe el shape del response.**
Mitigación: tests manuales exhaustivos comparando ambos outputs lado a lado en localhost antes de merge. Sin feature flag, el rollback es `git revert`.

**Riesgo 2: Los embedded selects de PostgREST tienen límites de profundidad/complejidad que no conocemos hasta probar.**
Mitigación: prototipo en Fase 2 antes de commit. Si no funciona con 4 niveles de nesting, caer en un patrón con 2 queries (plan+days en una, meals+options+ingredients en otra) que sigue siendo muchísimo mejor que 87 queries.

**Riesgo 3: Los batch inserts de Fase 3 fallan parcialmente y dejan planes corruptos.**
Mitigación: verificar que todas las FKs tienen ON DELETE CASCADE antes de empezar. En caso de fallo, borrar el plan raíz y la cascada limpia lo demás. Log de error detallado.

**Riesgo 4: Los optimistic updates se desincronizan si el trainer edita dos cosas a la vez y el segundo PATCH falla.**
Mitigación: los handlers se bloquean mientras hay uno en vuelo (disable del input). O permitir colas con indicador visual. Empezar con disable simple.

**Riesgo 5: Aparecen regresiones en prod que no detectamos en localhost.**
Mitigación: validación exhaustiva en localhost con planes de prueba que imiten los de los entrenadores reales (7 días × 4 comidas × 3 opciones × 5 ingredientes). Observar logs `[PERF]` y `[PERF_PARTIAL_LOAD]` durante los primeros días tras cada despliegue — cualquier pico de errores o latencia dispara un `git revert` inmediato.

---

## Preguntas / decisiones ya resueltas

1. ✅ David tiene acceso a Supabase dashboard — puede verificar `pg_indexes` y ver logs.
2. ✅ Sin canaries. El cambio aplica a todos los tenants a la vez; Carlos fue quien reportó pero el bug lo tienen todos.
3. ✅ Fase 1 implementada antes de planear 2-5 con detalle — así tenemos baseline real.
4. ✅ No hay staging. Validación en localhost antes de subir a prod. Cada fase se sube como commit aislado; rollback = `git revert`.

---

## Resumen ejecutivo

**Total esperado:** reducir latencia percibida de 1-15 segundos por operación a menos de 300ms. Eliminar el bug de "fotos/calorías desaparecen" como efecto secundario de la Fase 1.

**Plan de ejecución:** 5 fases independientes, cada una desplegable y reversible por separado. Rollout para todos los tenants a la vez; rollback por `git revert`.

**Riesgo global:** Medio. Todas las fases son aditivas y la Fase 1 instrumenta lo necesario para detectar cualquier regresión rápido.
