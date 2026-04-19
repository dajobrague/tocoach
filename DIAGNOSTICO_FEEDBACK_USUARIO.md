# Diagnóstico y plan de acción — Feedback usuario

**Fecha:** 2026-04-19
**Contexto:** Feedback recibido de un trainer sobre formularios y plan nutricional. Proyecto en producción — cambios deben ser incrementales y seguros.

---

## Resumen ejecutivo

Se identificaron **8 problemas concretos** agrupados en dos áreas: formularios (3) y plan nutricional (5). De ellos:

- **2 son bugs** (fotos/calorías desaparecen al asignar, ordenamiento al editar)
- **4 son features faltantes** (formulario inicial, plantillas forms, ocultar kcal, sección receta)
- **1 es gap de UX crítica** (tipos de pregunta multi/single choice)
- **1 es problema sistémico de performance** (N+1 masivo — afecta a todo el editor)

El problema de performance es el que más dolor causa al trainer (palabra "desesperante" en el feedback) y además es el que arrastra el bug de "calorías/fotos desaparecen" — en realidad es un síntoma del mismo problema subyacente: fetches anidados secuenciales que fallan silenciosamente.

---

## ÁREA 1 — Formularios

### Problema 1.1 — No existe formulario inicial configurable (fotos + medidas)

**Causa raíz:** El sistema solo soporta `form_type: "checkins" | "habits"` hardcodeados. No hay concepto de "formulario de alta / onboarding". No hay trigger al crear cliente.

**Decisión tomada:** disparar auto al crear cliente.

**Propuesta:**

1. **Nueva migración**: extender el enum/constraint de `form_type` con un tercer valor `"initial"` (o `"onboarding"`). Backward compatible porque es un valor nuevo, no cambia los existentes.
2. **Plantilla por defecto del tenant**: crear una `form_templates` semilla con preguntas típicas (fotos frontal/lateral/espalda + altura, peso, medidas corporales como cintura/pecho/cadera/brazo/muslo). Esto queda configurable por el trainer.
3. **Trigger en creación de cliente**: en el endpoint que crea `clients`, añadir un paso que inserte un `client_form_configs` de tipo `"initial"` copiando la plantilla activa del tenant. Si no hay plantilla activa, no falla — solo no crea el config (el trainer podrá crearlo después manualmente).
4. **Widget pendiente en dashboard del cliente**: cuando abre el dashboard por primera vez, ve una tarjeta "Completa tu formulario inicial" que no bloquea pero es visible. Menos fricción que un modal bloqueante.

**Complejidad:** Media. ~1 migración, 1 cambio al creador de clientes, 1 componente UI nuevo, reusa el `dynamic-form-modal` existente.

**Riesgos:** Bajo. Es feature aditiva. El único cuidado es que la migración del enum no rompa constraints existentes (solucionable con `ALTER TYPE ... ADD VALUE`).

---

### Problema 1.2 — Plantillas de formularios existen en DB pero la UI nunca se construyó

**Causa raíz:** Las tablas `form_templates` se crearon en la migración 020 con endpoints GET/POST/PUT funcionales, pero **nunca se construyó UI para gestionarlas**. El editor por cliente (`forms-tab.tsx`) tiene un default hardcodeado de 50+ líneas y cada edición setea `uses_template = false`. Resultado: el trainer reconstruye el formulario desde cero para cada cliente.

**Decisión abierta:** me pediste recomendación.

**Mi recomendación: patrón clone (igual que dietas).**

Razones:

- El patrón ya está probado en producción (`save-nutrition-template-modal.tsx` → `/api/nutrition/plans/{id}/save-as-template` → POST `/api/nutrition/plans` con `templateId`). Replicar un patrón conocido reduce riesgo.
- **Trainer quiere iterar por cliente sin miedo**. Si fuera referencia viva, cada edición en un cliente afectaría los otros y se volverían paranoicos al editar.
- El híbrido suena bien pero añade complejidad (dos flujos, UI de "resincronizar", estados intermedios). No lo recomiendo hasta que el patrón simple esté validado.

**Propuesta:**

1. **Nuevo modal "Guardar como plantilla"** en `forms-tab.tsx` (análogo a `save-nutrition-template-modal`). Pide nombre y descripción.
2. **Endpoint nuevo** `POST /api/forms/templates/from-config/[clientId]` que clona el `questions_config` del cliente a un nuevo `form_templates` del tenant.
3. **Vista de plantillas**: nueva pestaña o botón en el editor que lista las plantillas del tenant para ese `form_type`. Trainer elige una → se clona a `client_form_configs` del cliente actual con `uses_template = true` y un snapshot de la plantilla.
4. **Guardar como default del tenant**: permitir marcar una plantilla como "default", y en la creación de cliente se usa esa como base para habits/checkins (en vez del hardcoded actual).

**Complejidad:** Media. 1 endpoint nuevo, 1 modal, 1 selector de plantillas. El backend de templates ya existe.

**Riesgos:** Bajo. Las plantillas están separadas de las respuestas históricas. Solo cuidado al eliminar una plantilla (debe ser soft-delete para no romper históricos de "esta plantilla se usó").

---

### Problema 1.3 — Faltan tipos de pregunta single_choice / multi_choice

**Causa raíz:** `QuestionType = "rating" | "number" | "text" | "boolean" | "photo" | "group"`. No hay selección con opciones predefinidas.

**Propuesta:**

1. **Extender el tipo** a `"single_choice"` y `"multi_choice"`.
2. **Schema de `QuestionConfig`**: añadir campo opcional `options?: { id: string, label: string, value?: string }[]` (solo aplica a choice types).
3. **Validación** (`lib/forms/validation.ts`): si `type === "single_choice" | "multi_choice"`, `options` es requerido y `answers` deben ser IDs válidos de opciones.
4. **Editor**: en `form-config-editor.tsx`, cuando el trainer selecciona choice types, le aparece un sub-editor para añadir/quitar opciones.
5. **Renderer** (`dynamic-form-modal.tsx`): renderizar radio para single_choice, checkboxes para multi_choice.
6. **Formato de respuesta en JSONB**: single → string con el ID de opción; multi → array de IDs.

**Complejidad:** Baja-Media. Toca 4-5 archivos bien delimitados. Sin migración de DB porque JSONB es flexible.

**Riesgos:** Medio — aquí es donde aparece el **riesgo del JSONB sin versionado**. Si el trainer borra una opción de una plantilla después de que ya hay respuestas, las respuestas viejas quedan con IDs huérfanos.

**Mitigación:** en el editor, **deshabilitar (no borrar) opciones** si ya hay respuestas con esa opción. Se marca `disabled: true` en el schema, se oculta en nuevos forms pero se mantiene visible en históricos. Este principio vale para todo el sistema de forms y conviene adoptarlo aunque solo sea para choice types al principio.

---

## ÁREA 2 — Plan nutricional

### Problema 2.1 — Fotos desaparecen, calorías desaparecen al cargar plan

**Causa raíz (diagnóstico):** El endpoint `/api/client/nutrition` hace un árbol de `Promise.all` anidado (plan → days → meals → options → ingredients). Si una rama falla, el catch silencioso devuelve arrays vacíos y calorías en 0. El plan "se carga" pero a medias. Las fotos probablemente se pierden por el mismo motivo: la query de `nutrition_meal_options` (donde vive `image_url`) queda sin hijos si falla el fetch anidado.

**Este bug es consecuencia del problema 2.5 (performance / N+1).** No vale la pena arreglarlo con un parche — se resuelve solo al reescribir las queries.

**Propuesta:** arreglarlo como parte del refactor de queries (ver 2.5). Mientras tanto, **quitar los catch silenciosos** y hacer que un fallo explote en lugar de devolver datos parciales — es preferible un error visible a datos corruptos en la UI del cliente.

**Complejidad:** Dependiente de 2.5.

**Riesgos:** Bajo si se quita solo el catch silencioso como parche inmediato — pero hay que añadir logging para capturar cuándo ocurre.

---

### Problema 2.2 — Al editar un alimento se va al final de la lista ✅ RESUELTO (2026-04-19)

**Estado:** Implementado vía Fase 4 (optimistic updates). `handleSaveEditIngredient` ahora actualiza la lista en memoria con `updateIngredientInMealNested` preservando `ingredient_order`; el PATCH se emite en background y el backend fue blindado para no sobreescribir `ingredient_order` cuando no viene en el body. Ya no hay refetch ni reordenamiento inesperado al editar.

**Causa raíz:** `handleSaveEditIngredient` en `nutrition-tab.tsx` hace PATCH enviando solo `name`, `quantity`, `unit`, **nunca `ingredient_order`**. Luego `refreshPlan()` refetcha todo. La DB sí tiene columna `ingredient_order` y los queries ordenan por ella.

El bug real es que al editar (o posiblemente al mover por drag-drop si existe), el `ingredient_order` no se está persistiendo correctamente. **Tengo que verificar si hay un mutation separado para reorder que quizás no se está disparando**, o si el problema es que al guardar con otro cambio se sobreescribe el order con un valor por defecto.

**Propuesta:**

1. **Verificar** primero si el bug es que falta persistir `ingredient_order` en el PATCH, o si hay otro handler (drag-drop) que falla. Esto requiere mirar el código con más detalle antes de implementar.
2. **Fix**: asegurarse que todos los endpoints de mutación (PATCH ingredient, PATCH meal, PATCH option) mantienen el `*_order` actual si no se envía explícitamente (no lo sobreescriben con NULL o 0).
3. **Añadir drag-drop explícito** si no existe, usando `dnd-kit` que ya está en el proyecto. Este es un feature que completa el fix.
4. **Backfill**: todos los planes existentes deberían tener `ingredient_order` coherente, pero conviene correr un script de verificación.

**Complejidad:** Baja para el fix, Media si se añade drag-drop.

**Riesgos:** Bajo. Es un fix quirúrgico en handlers existentes.

---

### Problema 2.3 — Falta toggle "ocultar calorías" ✅ IMPLEMENTADO (2026-04-19)

**Estado:** Implementado con herencia en 2 niveles (no 3, se dejó el nivel de macros individuales para futuro).

- `nutrition_plans.show_calories BOOLEAN DEFAULT true` (migración 079) — toggle global del plan.
- `nutrition_meals.show_calories BOOLEAN NULL` (migración 079) — override tri-estado por comida (null = heredar, true = forzar mostrar, false = forzar ocultar).
- Backend: whitelist explícito en PATCH `/nutrition/plans/[id]` y `/nutrition/meals/[mealId]` respetando el tri-estado; clonación de template preserva el flag.
- UI trainer: Switch "Mostrar calorías al cliente" en el modal de plan; botón cíclico por comida con icono Eye/EyeOff y label del estado.
- UI cliente: `MacroRow` / `MacroRangeRow` / `MealMultiOptionClientSection` ocultan el Chip de kcal cuando resolved = false; totales del día ocultan la celda kcal cuando el plan lo oculta (grid pasa de 4 a 3 columnas).
- Migración 079 pendiente de correr manualmente (ver al final).

**Causa raíz:** Existe `show_meal_images` en `nutrition_plans` pero no un análogo para calorías.

**Decisión tomada:** a cada nivel que el entrenador quiera.

**Propuesta:** implementar en 3 niveles con herencia:

1. **Nivel plan** (`nutrition_plans.show_calories BOOLEAN DEFAULT true`): toggle global. Si está en `false`, no se muestra ninguna caloría en todo el plan.
2. **Nivel comida** (`nutrition_meals.show_calories BOOLEAN NULL`): si es NULL, hereda del plan; si tiene valor, lo sobreescribe. Permite decir "el plan sí muestra kcal pero esta comida en concreto no".
3. **Nivel macro individual** (`nutrition_plans.visible_macros JSONB DEFAULT '["protein","carbs","fats","calories"]'`): permite mostrar solo proteína y esconder kcal, o cualquier combo.

**Herencia**: el cliente renderiza según `meal.show_calories ?? plan.show_calories`. El trainer ve un checkbox global en config del plan y un override por comida en el editor.

**Complejidad:** Baja-Media. 1 migración con 3 columnas nuevas (todas con defaults que no rompen nada), cambios en el renderer cliente y en el editor trainer.

**Riesgos:** Bajo. Feature aditiva, valores por defecto mantienen comportamiento actual.

---

### Problema 2.4 — Falta sección de receta (descripción, tiempo de cocción, instrucciones) ✅ IMPLEMENTADO (2026-04-19)

**Estado:** Implementado a nivel de `nutrition_meal_options` tal como se propuso (cada variante puede tener receta distinta).

- Migración 080 añade `instructions TEXT`, `prep_time_minutes INTEGER`, `cooking_time_minutes INTEGER`, `servings INTEGER`, `recipe_notes TEXT` (todos nullables, con CHECK NOT VALID para tiempos >= 0 y servings >= 1).
- Backend: whitelist en PATCH `/nutrition/options/[optionId]` con normalizadores (string vacío → NULL, enteros inválidos → NULL); la clonación de templates copia los 5 campos.
- Tipos: `NutritionMealOption` y `UpdateNutritionMealOptionRequest` extendidos.
- UI trainer: panel "Receta" colapsable por opción con 3 estados (editar / ver / vacío); optimistic update con rollback. Se evita escribir sobre `temp-` options.
- UI cliente: `RecipeSection` colapsable (retorna null si todos los campos vienen vacíos), muestra chip de tiempos (prep + cocción + servings), instrucciones con `whitespace-pre-wrap` y notas en itálica.
- Migración 080 pendiente de correr manualmente (ver al final).

**Causa raíz:** Las tablas `nutrition_meals` y `nutrition_meal_options` solo tienen `name`, `image_url` y macros. No hay campos textuales largos ni metadatos de receta.

**Propuesta:**

Añadir a `nutrition_meal_options` (donde vive el detalle por variante de comida):

- `instructions TEXT` — pasos de preparación (soporta markdown/rich text)
- `prep_time_minutes INTEGER`
- `cooking_time_minutes INTEGER`
- `servings INTEGER DEFAULT 1`
- `notes TEXT` — notas sueltas del trainer

**Por qué a nivel option y no meal:** diferentes opciones de la misma comida pueden ser recetas distintas (pechuga a la plancha vs. salmón al horno como alternativas para "cena"). Si fuera a nivel meal se compartiría y no tiene sentido.

En el editor, añadir una sección colapsable "Receta" por opción. En la vista del cliente, mostrar un botón "Ver preparación" que despliega los campos si están rellenos.

**Futuro posible (no ahora):** tabla `nutrition_recipes` separada con recetas reutilizables tipo biblioteca, referenciables desde varias comidas. Evalúa esto solo si el usuario lo pide explícitamente — añade complejidad.

**Complejidad:** Baja. 1 migración aditiva, cambios UI en editor y viewer.

**Riesgos:** Bajo. Campos nullables, backward compatible.

---

### Problema 2.5 — Performance desesperante (crear plan, eliminar, modificar)

**Causa raíz:** N+1 masivo en cascada. Por cada operación se ejecutan decenas de queries secuenciales:

- Crear plan desde plantilla: ~40+ queries (inserta plan → loop days → loop meals → loop options → loop ingredients)
- Cargar plan del cliente: ~30-100+ queries (Promise.all anidado)
- Editar un ingrediente: refetcha el plan completo → otras 30+ queries por cada keystroke si no hay debounce
- Además: no hay optimistic updates — la UI espera respuesta del servidor para todo

**Este es el problema más grave.** Causa la queja "desesperante" y arrastra el bug 2.1 (errores silenciosos en el Promise.all).

**Decisión abierta:** me pediste recomendación sobre el alcance.

**Mi recomendación: fix incremental quirúrgico primero, luego refactor completo en una segunda fase.**

Razones:

- El proyecto está en producción y me dijiste explícitamente que tenga cuidado. Un refactor completo de golpe es el cambio más arriesgado.
- El fix quirúrgico atacando los 3 hotspots da 60-70% de mejora con 20% del riesgo. Suficiente para quitar la sensación de "desesperante".
- RPC + Postgres functions es lo más rápido pero acopla la app a Supabase y bloquea iteración. No lo recomiendo ahora.

**Plan en dos fases:**

**Fase A — Quirúrgico (primera iteración):**

1. **Optimistic updates en mutations** (`useMutation` con `onMutate` que actualiza la cache de React Query antes del response). Afecta: editar cantidad, editar nombre, añadir/eliminar ingrediente. Elimina la espera percibida.
2. **Debounce de 300-500ms** en inputs numéricos y de texto antes de disparar el PATCH.
3. **Batch insert al clonar plantilla**: el endpoint `POST /api/nutrition/plans` con `templateId` debería hacer `INSERT ... SELECT` o `INSERT ... VALUES (multi)` en vez de loop secuencial. Una sola query por nivel en lugar de N.
4. **Eliminar refetch completo tras cada edit**: después de un PATCH exitoso, invalidar solo la rama afectada (ese ingrediente, no todo el plan).
5. **Quitar catches silenciosos** en `/api/client/nutrition` (ver 2.1) — esto arregla el bug de fotos/calorías desaparecidas como efecto secundario.

**Fase B — Refactor a JOINs (segunda iteración, cuando A esté validado en prod):**

6. **Reescribir `GET /api/client/nutrition` y `GET /api/nutrition/plans/[id]`** para usar un único query con JOINs + agrupación en código (o `json_agg` de Postgres). Cambia ~50 queries por 1.
7. **Verificar índices**: todas las FKs (`plan_id`, `day_id`, `meal_id`, `option_id`) deben tener índices. Añadir los que falten.

**Complejidad:**

- Fase A: Media. Bien acotada a handlers de mutation y al endpoint de crear plan.
- Fase B: Alta. Toca shape de APIs y requiere testing cuidadoso.

**Riesgos:**

- Fase A: Medio. Optimistic updates mal implementados pueden dejar UI desincronizada si falla el backend — hay que tener rollback bien hecho.
- Fase B: Alto. Cambios en shape de response pueden romper el cliente si no se versiona bien. Hacer detrás de feature flag o tras tests E2E.

---

## Priorización propuesta (orden sugerido de ataque)

| #   | Problema                           | Impacto  | Esfuerzo   | Riesgo | Cuándo                                                    |
| --- | ---------------------------------- | -------- | ---------- | ------ | --------------------------------------------------------- |
| 1   | **2.5 Fase A — Perf quirúrgico**   | Altísimo | Medio      | Medio  | Primero — el usuario está desesperado                     |
| 2   | **2.2 Fix ordenamiento alimentos** | Alto     | Bajo       | Bajo   | Junto con 2.5A, bug que duele a diario                    |
| 3   | **2.1 Quitar catches silenciosos** | Medio    | Trivial    | Bajo   | Parte de 2.5A                                             |
| 4   | **1.2 UI de plantillas de forms**  | Alto     | Medio      | Bajo   | Segundo — quita el "follón" de repetir                    |
| 5   | **1.3 Single/multi choice**        | Medio    | Bajo-Medio | Medio  | Junto con 1.2                                             |
| 6   | **2.4 Sección de receta**          | Medio    | Bajo       | Bajo   | Tercero — feature value, bajo riesgo                      |
| 7   | **2.3 Toggle ocultar calorías**    | Medio    | Bajo       | Bajo   | Junto con 2.4                                             |
| 8   | **1.1 Formulario inicial**         | Medio    | Medio      | Bajo   | Cuarto — nuevo flujo, mejor una vez lo demás esté estable |
| 9   | **2.5 Fase B — Refactor JOINs**    | Alto     | Alto       | Alto   | Último — solo si Fase A no basta                          |

---

## Riesgos transversales a tener presentes

**JSONB sin versionado en forms.** Si el trainer edita una plantilla o config, las respuestas históricas pueden quedar huérfanas. Recomiendo **nunca permitir borrar preguntas**, solo deshabilitarlas (`disabled: true` en el schema). Adoptar esto como principio antes de empujar más features de forms.

**Backfills al añadir campos.** Al añadir `show_calories`, `instructions`, etc., los planes existentes tendrán NULL/default. Esto es backward compatible pero conviene correr un script que verifique que ningún plan queda en estado inválido tras la migración.

**Producción significa cero downtime.** Todas las migraciones propuestas son aditivas (ADD COLUMN con default, nuevos valores de enum con ADD VALUE). Ninguna requiere bloquear tablas o rewrite.

**Feature flags.** Para cambios de comportamiento (refactor de queries, nueva herencia de `show_calories`), usar flags a nivel tenant permite rollout gradual y rollback inmediato si algo explota.

---

## Preguntas pendientes antes de arrancar

1. ¿Quieres que el formulario inicial sea un **tercer `form_type` separado** (`initial`) o que forme parte del flujo de "habits" con una primera página especial? (Mi recomendación: separado para no mezclar conceptos.)
2. ¿Hay un tenant/trainer específico con el que validar Fase A de performance antes de rollout global? Un canary reduciría riesgo.
3. ¿Existe algún SLA o métrica de latencia que estén midiendo, para saber cuándo considerar "suficiente" la mejora de performance?
4. Para las instrucciones de receta: ¿texto plano, markdown o rich text con imágenes? (Recomendación: empezar con markdown simple, renderizar con `react-markdown`.)
