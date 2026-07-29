# Estado: feedback llamada 15-jul + rediseño Entrenamiento

> Documento de continuidad (Jul 28 2026). Fuente: llamada con José Carlos del
> 15-jul + decisiones de David durante el desarrollo. Actualizar al completar
> cada bloque.

## Contexto git / entorno (Jul 28 2026)

- **Worktree de trabajo**: `/Users/davidbracho/top_coach-training-wins` (repo principal `/Users/davidbracho/top_coach` queda en `feat/nutrition-v2-foundations`; el dev server :3000 corre DESDE EL WORKTREE).
- **`main` LOCAL** contiene todo lo mergeado (nutrición + training quick wins + duplicación + rediseño rebanadas 1-3 + Videos; último merge `c6bba44`). **NO PUSHEADO**: `origin/main` = `ac4ad75` (PR #14) = lo deployado. Un `git push` de main deployaría todo → siempre por rama + PR cuando David lo pida.
- Rama actual: `feat/training-progreso` (rebanada 4, recién abierta sobre local main).
- Migraciones aplicadas a LOCAL (psql :54422) **y PROD** (MCP `apply_migration`, proyecto `ydqhndnvrkvycnkaghro`): `client_nutrition_visibility` (20260728130000) y `exercise_video_reviews` (20260728200000, incluye los valores de enum `video_feedback` y `video_upload` en `notification_type`). Ledger caveat de siempre (repair antes de cualquier `db push`).
- Verificación estándar por ronda: `npm run type-check` + `npm run lint` (0 errors; ~1130 warnings pre-existentes OK) + `npx vitest run` (762/762 al cierre de la rebanada Videos).

## Feedback nutrición (llamada 15-jul) — ✅ COMPLETO

- ✅ Marca/supermercado visible en TODAS partes donde se muestra un ingrediente (commit `f421371`, rama nutrición → ya en local main). Shopping list mergea por (name, brand, unit).
- ✅ Visibilidad de nutrición elegida por el trainer (plan/pdf/objetivos multi-select, "Automático" = escalera vieja; tabla `client_nutrition_visibility` en local+prod; commit `8f66a75`).

## Feedback entrenamiento (llamada 15-jul)

### Hecho ✅
1. ✅ **Comentarios previos del ejercicio visibles para el cliente** (history endpoint + filas expandibles). Rama quick-wins.
2. ✅ **Hora de inicio del entrenamiento** — POST `/start`, columna `scheduled_time`, auto-registro al entrar hoy + chip editable; el trainer la ve como chip "Empezó HH:MM" en el detalle del día.
3. ✅ **Marcar entrenamiento como completado** (con ejercicios saltados) — POST `/complete`, `metadata.completed_manually`, undo, guard en DELETE de logs, regla compartida `lib/training/session-completion.ts`. El trainer ve Hecho/Empezado/Sin hacer (palabras, no %) respetando el completado manual.
4. ✅ **Duplicar sesión** (modal con nombre, server-side deep clone, queda debajo del original) y **duplicar ejercicio** (clon server-side completo, chip "Copia", aviso de swap slot-aware arreglado). Endpoints `.../duplicate`.
5. ✅ **Vista calendario del trainer** (item Fase 5, absorbido): Seguimiento tiene toggle Semana/Mes; mes = grilla estilo nutrición con chips de estado; misma derivación/etiquetas que la semana (`day-label.ts`, `use-month-metrics.ts`).

6. ✅ **Videos tab (rebanada 2) — COMPLETO, ampliado sobre el plan original**:
   - Trainer: pill **Videos** con contador azul circular de pendientes, feed agrupado por día (nuevo→viejo) con miniaturas que respetan la orientación (vertical 9:16 / horizontal 16:9, primer frame vía `preload="metadata"`), filtros Sin revisar/Todos/Revisados portaleados a la fila de pills, franja de stats, toggle **Revisado** + **comentario del coach** (compositor inline compartido `review-composer.tsx`; editar no re-notifica; quitar revisión con comentario pide confirmación).
   - Cliente: notificación `video_feedback` SOLO cuando aparece comentario → **visor estilo story de Instagram** (`video-feedback-story-viewer.tsx`: fullscreen, barra de progreso, zonas de tap, burbuja del comentario); el comentario queda permanente en el historial del ejercicio ("Comentario del coach" + replay).
   - Trainer, descubrimiento: tarjeta **"Videos por revisar"** en Métricas (cola transversal de todos los clientes, GET `/api/trainer/pending-video-reviews`, ventana 90 días, revisar inline desde ahí) + campana `video_upload` al subir video (insertada en el upload — la URL se acuña una sola vez ahí; sin apilar si hay una sin leer del mismo cliente).
   - Toast realtime del cliente ahora theme-proof (superficie neutra content1/foreground, acento solo en el icono) — aplica a TODAS las notificaciones realtime, no solo videos.
   - Datos: `exercise_video_reviews` por (client_id, video_url) + columna `comment`; lecturas tolerantes a 42P01; migración aplicada a local **y prod**.

### Pendiente ⏳ (en orden acordado)
7. ⏳ **PRÓXIMO — 1RM + récords + celebración (Fase 4 / rebanada 4)** — EL ITEM ESTRELLA para José. Decidido: Epley (reps≥7) + Brzycki (2-6), 1 rep = peso. Diseño validado por Plan agent: TODO computed-on-the-fly (nada almacenado; `personal_records` sigue dormida), `lib/training/e1rm.ts` puro compartido, endpoints gemelos `/progression` (cliente+trainer, filtro finalized_at, `?days` 365/730), detección de récord EN el POST de logs al finalizar (prior bests con `exercise_log_id != current` → response `newRecords|null`, `firstTime` sin confetti), fix del history endpoint (hoy el PR puede ganarlo un autosave), migración índice `exercise_logs (client_id, exercise_id, completed_at DESC)`. UI: pestaña **Progreso** (4ª pill) con chart e1RM (volumen como toggle secundario — decisión David), lista récords por reps ("6×102,5"), celebración cliente = upgrade de PrBanner + addToast (no hay confetti lib). En el detalle del día del trainer YA hay medalla 🏅 por peso máximo histórico (upgrade a e1RM al llegar esta fase).
8. ⏳ **Ejercicio de otro día sobre la marcha (cliente)** — Fase 5: picker desde el cache de `usePrograms()` (datos ya en cliente), patrón `extraLoggedExercises` en `active-session-view.tsx`. Limitación v1 documentada: sin overrides del trainer ni last_used_weights.
9. ⏳ **Rebanada 5 — limpieza**: borrar `workouts-tab.tsx` y `cardio-tab.tsx` (~6.600 líneas, ya deswireados), `calendar-tab.tsx` + `gallery-tab.tsx` (muertos con mocks), `microcycle-config.tsx` + slider + aside (reemplazados), `apply-template-section` revisar (solo lo usa forms). Decidir si retirar "Categoría" a nivel programa de los modales (David abierto a ello). Posible "Ver pausados" en el selector de programas (hoy un programa pausado solo vuelve por datos).
10. ⏳ **José puede mandar un Loom** sobre representación de progresión — si contradice el split Epley/Brzycki, ajustar. También quedó pendiente de su lado: tickets vía su Airtable (revisar tras entregar features) y confirmar factura 15-jul.

## Rediseño tab Entrenamiento (aprobado por David, mockups en artifacts)

Shell = pills estilo nutrición: **Seguimiento · Programa · (Videos) · (Progreso)** — pills muertas no se muestran.

- ✅ **Rebanada 1 — Seguimiento** (rama redesign-shell, en local main): semana/mes, celdas de semana = anatomía de celda del mes (chip compartido `day-cell-chip.tsx`), detalle del día rediseñado (strip de stats hairline, filas con punto de estado, **mini-tabla de series a ancho completo en UNA grilla** — badges no desalinean columnas, video botón azul, récord 🏅 por máximo histórico, reps bajo objetivo en ámbar, notas como cita "Cliente", fuera-de-plan en tarjeta punteada, prescripción plegada tras "Ver prescripción", saltados visibles como "sin registros"). Hoy = número azul (sin pip negro — pedido David).
- ✅ **Rebanada 3 — Programa** (rama actual): builder ÚNICO fuerza+cardio en `features/trainer/training/programa/` (13 archivos: data layer react-query con reorder optimista `training-api.ts`/`use-training.ts`, selector portaleado a la fila de pills, header card con rename inline + strip de métricas + **Activo clickeable → confirm → PATCH status paused** (nuevo handler; el PUT nunca actualizó status), días del microciclo = réplica EXACTA del day-selector de nutrición (auto-cols-fr, paginación >10 con flechas, "+" junto al último día, × 16px sin círculo, confirm si el día tenía sesión, corrimiento al quitar), fecha inicio = pill editable en popover con guardarraíl, sesiones con **tipo POR SESIÓN** (corrección David: programas mezclan fuerza y cardio; `sessions.session_type` ya existía; POST acepta `sessionType`; transform emite `sessionType`; add-modal con botones Fuerza=esmeralda/Cardio=rosa), fila de sesión = chip + menú ⋮ (Duplicar/Renombrar/Eliminar) + chevron, thumbnails de ejercicio 36px (bug: guard de image_url crasheaba con NULL — 978/2556 ejercicios tienen imagen), drawer 600px con biblioteca SIN filtrar por tipo + **campos según el EJERCICIO elegido** + chips de filtro rápido por categoría + validación inline + aviso de swap de dos toques; "Guardar como plantilla" con icono `solar:diskette-linear` (`solar:save-bold` NO existe). Cero alert()/confirm() nativos en la superficie nueva.
- ✅ **Rebanada 2 — Videos** (punto 6 arriba; incluye cola en Métricas + campanas en ambos sentidos + visor story del cliente).
- ⏳ **Rebanada 4 — Progreso + 1RM** (punto 7). PRÓXIMA.
- ⏳ **Rebanada 5 — limpieza** (punto 9).

## Recordatorios técnicos que cuestan caro olvidar

- Iconos `solar:*`: verificar que existan (`save-bold` y `check-linear` NO existen — renderizan vacío).
- HeroUI + native `confirm()`/`alert()` congela la página (usar `confirmAfterPress` en código viejo; modales chicos en el nuevo).
- `exercise_log_sets` se BORRAN y reinsertan en cada autosave → nunca colgar estado durable de esas filas (por eso reviews por URL y récords computados).
- `exactOptionalPropertyTypes`: spreads condicionales para payloads.
- Migraciones: aplicar a local (psql :54422) y prod (MCP), NUNCA `db push` sin repair del ledger.
- El PUT de programas reconstruye metadata entera (mandar form completo) y NO toca status (usar el PATCH nuevo).
- Estado Select del modal Editar programa sigue siendo visual-only (el PATCH nuevo es el camino real).
