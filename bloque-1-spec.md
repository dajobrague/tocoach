# Bloque 1 — Rediseño del flujo de entrenamiento del cliente

> **Fuente de verdad para la implementación del Bloque 1.** Este documento contiene decisiones de producto, modelo de datos, APIs, cambios por archivo de código y orden de implementación. Si algo aquí está desactualizado respecto al código real, **el documento gana** hasta que se actualice o se decida lo contrario explícitamente.

**Vinculado a:** `requerimientos-llamada-2026-04-22.md` (decisiones tomadas en la llamada del 22/4/2026 con Jose Carlos y Adrián).

---

## 0. Reglas de implementación (leer antes de escribir código)

Estas reglas aplican a TODO el código que se escriba o reescriba en este bloque. La razón existencial de muchas de ellas es evitar repetir el patrón actual de `workouts-content.tsx` (1788 líneas, todo mezclado en un solo archivo, prácticamente imposible de debuggear sin scroll infinito).

**0.1 Modularización**

- Tamaño objetivo por archivo: **≤ 300 líneas**. Tope duro: **500 líneas**. Si un archivo está por cruzar las 300, dividir **antes** de seguir agregando.
- Un archivo = una responsabilidad clara. Si la frase "este archivo se encarga de X" no cabe en una línea, falta dividir.
- **No mezclar** en el mismo archivo: fetching de datos + lógica de negocio + render. Hooks de datos en archivos `use-*.ts` separados; componentes solo renderizan.
- Subcomponentes que existen "solo para no agrandar el padre" se extraen a archivos hermanos en la misma carpeta, no se inlinean.

**0.2 Tipos**

- Todos los tipos del dominio entrenamiento viven en `/types/training.ts`. Extender, no duplicar.
- Nuevos tipos del bloque se añaden a ese archivo en una sección clara (`// === Microcycles ===`).
- Evitar `any`. El proyecto tiene `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` activos — narrar tipos correctamente, no `!` ni casts perezosos.

**0.3 Convenciones del repo (ya existentes)**

- Conventional Commits con scopes claros: `feat(microcycle): add slots config UI`, `refactor(workouts): split workouts-content into next-workout-list`.
- ESLint + Prettier hacen el pulido en `--fix`. No pelear con el autofixer.
- Antes de declarar trabajo terminado: `npm run type-check && npm run lint:check`. El `npm run build` no falla por errores de TS ni de ESLint (deuda existente del proyecto), así que la verificación es responsabilidad nuestra.

**0.4 Cuidado con producción**

- El proyecto está en producción. Cualquier cambio de schema entra como **migración numerada nueva**, nunca editando una vieja.
- Cambios de UI deben ser backward-compatible mientras no exista microciclo configurado: si un cliente no tiene microciclo, la app debe seguir mostrando algo razonable (ver §5.2).
- `next.config.js` ignora errores de TS/ESLint en build. **No es licencia** para meter código sucio — solo significa que el deploy no nos cubre las espaldas. Verificamos a mano.

**0.5 Logging**

- Logs en server boundaries con `correlationId`. Patrón establecido: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`.

---

## 1. Decisiones consolidadas

Tomadas en la sesión de planeación posterior a la llamada (5/5/2026).

| ID      | Decisión                                                                                                                            | Razón                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| a       | Fecha del registro = hoy por defecto, editable                                                                                      | 95% del tiempo es hoy; date picker secundario para los casos restantes              |
| b       | Cliente elige libremente cualquier sesión, en cualquier orden                                                                       | Maximiza flexibilidad (lesiones, cansancio, cambios de plan)                        |
| c       | "Día de descanso" es opcional como slot explícito en el microciclo. Si un día queda sin slot, se considera descanso automáticamente | Permite que el entrenador deje constancia de descansos planificados sin obligarlo   |
| d       | Microciclo = secuencia ordenada de N días. Default 7, configurable                                                                  | Cubre el caso de Adrián (microciclos de 6 días, etc.); reusa estructuras existentes |
| e       | "Cardio" y "Descanso" se modelan con los `session_type` ya existentes (`cardio`, `recovery`)                                        | No crear conceptos nuevos cuando los actuales sirven                                |
| f       | El microciclo se repite igual cada vuelta (no varía semana 1 vs semana 2)                                                           | "Microciclos progresivos" es otro proyecto; mantener simple para esta iteración     |
| g       | Modal de ejercicio muestra **las últimas 3 sesiones** de ese ejercicio                                                              | Suficiente para ver tendencia; costo de query mínimo                                |
| h       | Modal de ejercicio muestra también **mejor marca histórica (PR)**                                                                   | Información clave para el cliente, se calcula al vuelo desde `exercise_log_sets`    |
| i       | Calendario tiene selector de vista: **Mes / Quincena / Semana**                                                                     | Cubre los hábitos de revisión más comunes sin sobrecargar                           |
| j       | Calendario muestra **solo entrenamientos completados**. Sin sugerencias futuras                                                     | Evita complicar el modelo y se alinea con (b): el cliente decide cuándo             |
| extra-1 | Plan semanal (vista microciclo) = pura referencia. **Sin CTA "Comenzar"** desde ahí                                                 | Mezclar dos modelos (elección libre + iniciar desde el plan) confunde al cliente    |
| extra-2 | Sin edición retroactiva en calendario en este bloque                                                                                | Fuera de scope; añadir como ticket separado si surge necesidad                      |

---

## 2. Estado actual del código (referencia)

Resumen de hallazgos del mapeo. Citas con `path:linea`.

**Vista cliente — entrada principal:**

- Ruta: `app/[slug]/ejercicio/page.tsx` → `<WorkoutsContent />`.
- Componente: `components/client-dashboard/workouts-content.tsx` (1788 líneas).
- Renderiza secciones fijas: Hoy, Mañana, Próximos (21d), Ayer, Pasados (14d).
- **No existe** lista de "todas las sesiones disponibles".

**Cómo se calculan las fechas hoy:**

- En BD **NO hay fechas fijas para futuros entrenamientos**.
- Cada `session.metadata.day_of_week` (Lun, Mar, ...) define cuándo se sugiere.
- `workouts-content.tsx:464-545` genera slots de -14 a +21 días alrededor de hoy y matchea por día de la semana.
- `scheduled_sessions` se crea **lazy** — solo cuando hay reschedule o se marca completado.

**Modelo de datos relevante** (de `supabase/migrations/008_*.sql`, `016_*.sql`, `076_*.sql`):

- `programs` — plantilla del programa.
- `client_programs` — asignación cliente↔programa con `start_date`, `status`.
- `sessions` — sesiones plantilla del programa. Tiene `session_type` (`'strength' | 'cardio' | 'flexibility' | 'sports' | 'recovery' | 'other'`) y `metadata.day_of_week`.
- `session_exercises` — ejercicios por sesión, con sets/reps/peso objetivo.
- `scheduled_sessions` — overrides explícitos: `client_id`, `session_id`, `scheduled_date`, `status`, `completion_date`.
- `exercise_logs` — registros del cliente: `client_id`, `exercise_id`, `scheduled_session_id`, `completed_at`, `video_url`.
- `exercise_log_sets` — sets dentro del log: `set_number`, `reps`, `weight_kg`.

**Modal de ejercicio:**

- Componente: `components/client-dashboard/exercise-log-modal.tsx`.
- Muestra video, objetivo, formulario de registro.
- **Cero referencias a entrenamientos previos** (verificado con grep).

**Calendario:**

- Componente: `components/client-dashboard/calendar-content.tsx:72`.
- Usa `getMockCalendarEvents("demo-client-id")` — **datos mock hardcodeados**, no `scheduled_sessions` reales.
- Bug preexistente. Lo arreglamos en este bloque.

**No existe:**

- Concepto de "microciclo" / "plantilla semanal" / "rutina" formal en BD ni en código.
- UI del entrenador para configurar la estructura semanal del cliente (los entrenadores configuran sesiones individuales con `day_of_week`).

**Riesgos detectados:**

- RLS permisiva en tablas de training (`supabase/migrations/017_*.sql` y posteriores hasta `083_*.sql`). El patrón consistente del repo es policies tipo `FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)` con autorización 100% en capa API (`withTenantProtection`, `getTrainerSession`, `getClientSession`). Migración 083 lo documenta como decisión deliberada. La tabla nueva sigue ese mismo patrón por consistencia (ver §7.1).
- **Dualidad de tablas de cliente y trainer.** Hay dos tablas para cada rol coexistiendo: `clients` (BIGINT, legacy) + `client_profiles` (UUID, alineada con `auth.users`); y `trainers` (legacy) + `trainer_profiles`. Las tablas de training (`client_programs`, `scheduled_sessions`, `exercise_logs`) usan `client_id BIGINT REFERENCES clients(id)` y `trainer_id REFERENCES trainers(id)` — las legacy. La nueva tabla `microcycles` apunta a `client_programs(id)` (UUID) y NO referencia clientes/trainers directamente, así que no introduce conflicto. Pero los endpoints de Fase 1 SÍ tienen que mapear correctamente desde la sesión de auth a las IDs legacy. Replicar el patrón de endpoints existentes, no reinventar.
- `personal_records` ya existe como tabla (migración 016) pero está dormida — cero referencias en el código actual. Calcular PR al vuelo en Fase 1 sigue siendo el plan; si en el futuro se activa esa tabla, habrá que reconciliarlo.
- Lógica template-vs-rescheduled en `workouts-content.tsx` es frágil. La reescritura del componente es buena ocasión para simplificarla.

---

## 3. Modelo de datos — cambios

### 3.1 Tablas nuevas

**Nueva migración:** siguiente número disponible en `supabase/migrations/`. Al momento de escribir esta spec la última es `083_create_chart_system.sql`, así que la nueva sería `084_create_microcycles.sql`. Confirmar el número leyendo el directorio antes de crear el archivo.

**Convenciones aplicadas (extraídas del patrón del repo, sobre todo las migraciones 074/076/083):**

- Envuelto en `BEGIN; ... COMMIT;`.
- `CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`.
- FK explícito de `tenant_host` a `tenants(host) ON DELETE CASCADE`.
- Naming de índices con sufijo `_idx` (no prefijo `idx_`).
- Trigger `update_${table}_updated_at` reutilizando la función helper `update_updated_at_column()` definida en migración 001.
- RLS permisiva consistente con el repo (ver §7.1 para el razonamiento).
- `COMMENT ON TABLE` y `COMMENT ON COLUMN` para documentación inline.

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS microcycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
  client_program_id UUID NOT NULL REFERENCES client_programs(id) ON DELETE CASCADE,
  duration_days INTEGER NOT NULL DEFAULT 7 CHECK (duration_days BETWEEN 1 AND 28),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_program_id)
);

CREATE TABLE IF NOT EXISTS microcycle_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  microcycle_id UUID NOT NULL REFERENCES microcycles(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL CHECK (day_index >= 1),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (microcycle_id, day_index)
);

CREATE INDEX IF NOT EXISTS microcycles_client_program_idx ON microcycles(client_program_id);
CREATE INDEX IF NOT EXISTS microcycles_tenant_host_idx ON microcycles(tenant_host);
CREATE INDEX IF NOT EXISTS microcycle_slots_microcycle_idx ON microcycle_slots(microcycle_id);

DROP TRIGGER IF EXISTS update_microcycles_updated_at ON microcycles;
CREATE TRIGGER update_microcycles_updated_at
  BEFORE UPDATE ON microcycles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE microcycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE microcycle_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY microcycles_all ON microcycles
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY microcycle_slots_all ON microcycle_slots
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

COMMENT ON TABLE microcycles IS 'Secuencia ordenada de N días que estructura el plan de un cliente sobre un client_program. Se repite igual cada vuelta hasta que el entrenador la modifique.';
COMMENT ON TABLE microcycle_slots IS 'Slots ordenados (day_index 1..N) que apuntan a una session, o representan un día de descanso explícito si session_id es NULL.';
COMMENT ON COLUMN microcycles.duration_days IS 'Cantidad de días del microciclo. Default 7. Rango 1–28 como guardrail.';
COMMENT ON COLUMN microcycle_slots.session_id IS 'NULL = día de descanso explícito. Días sin slot también son descanso (descanso automático, ver decisión c en §1).';

COMMIT;
```

**Notas de schema:**

- `UNIQUE (client_program_id)` impone "un microciclo por programa de cliente". Si en el futuro se quieren microciclos progresivos (semana 1 ≠ semana 2), se quita este constraint y se agrega una columna `cycle_index` o `effective_from`.
- `session_id NULL` es la representación canónica de "día de descanso explícito". Días no listados (`day_index` ausente) también son descanso pero implícito (decisión c).
- `duration_days` máximo 28 es un guardrail: nadie debería querer microciclos de meses; si alguien pide más, se conversa.
- `tenant_host TEXT REFERENCES tenants(host)` sigue la convención del repo aunque la columna `host` de `tenants` contenga ahora slugs (`lib/tenant/loader.ts:50`). No es un cambio que toque este bloque.

### 3.2 Cambio de uso en `scheduled_sessions`

**No cambia el schema**, cambia el contrato de uso.

- **Hoy:** `scheduled_sessions` se crea lazy, solo para overrides (reschedule, completed).
- **Mañana:** se crea **siempre que el cliente registra un entrenamiento**. Una row por sesión completada.
- `scheduled_date` = la fecha que el cliente eligió al registrar (default hoy).
- `session_id` = la sesión que el cliente eligió hacer.
- `status` = `'completed'` cuando hay `exercise_logs` cubriendo todos los ejercicios; `'scheduled'` para registros parciales.

**Migración de datos:** ninguna. Las rows viejas siguen siendo válidas. Las nuevas siguen el mismo schema con uso más consistente.

### 3.3 Tipos TypeScript

Extender `/types/training.ts` con:

```typescript
// === Microcycles ===

export interface Microcycle {
  id: string;
  tenant_host: string;
  client_program_id: string;
  duration_days: number;
  created_at: string;
  updated_at: string;
}

export interface MicrocycleSlot {
  id: string;
  microcycle_id: string;
  day_index: number;
  session_id: string | null; // null = descanso explícito
  created_at: string;
}

export interface MicrocycleWithSlots extends Microcycle {
  slots: MicrocycleSlot[];
}

// View model que combina slot + sesión expandida (para el cliente)
export interface MicrocycleSlotView {
  day_index: number;
  type: "session" | "rest";
  session?: {
    id: string;
    name: string;
    session_type: SessionType;
    duration_minutes: number | null;
  };
}

// === Exercise history (para modal) ===

export interface ExerciseHistoryEntry {
  scheduled_date: string;
  exercise_log_id: string;
  sets: Array<{
    set_number: number;
    reps: number;
    weight_kg: number | null;
  }>;
}

export interface ExerciseHistoryResponse {
  exercise_id: string;
  recent: ExerciseHistoryEntry[]; // últimas 3, orden descendente
  pr: {
    weight_kg: number;
    reps: number;
    achieved_at: string; // scheduled_date del set ganador
  } | null;
}
```

---

## 4. APIs nuevas y modificadas

### 4.1 Cliente

**`GET /api/client/sessions`** _(nuevo)_

Lista de todas las sesiones del programa activo del cliente (la pantalla "Escoge tu siguiente").

```
Response 200:
{
  program: { id, name },
  sessions: [
    { id, name, session_type, duration_minutes, exercise_count }
  ]
}
```

Si el cliente no tiene programa activo: `200` con `sessions: []` y `program: null`. El cliente lo maneja con un empty state.

**`GET /api/client/microcycle`** _(nuevo)_

Microciclo del programa activo del cliente, con slots expandidos (incluye nombre de la sesión, no solo ID).

```
Response 200:
{
  microcycle: {
    duration_days: 7,
    slots: MicrocycleSlotView[]  // ya incluye descansos implícitos completados a duration_days
  } | null
}
```

`null` si el entrenador no ha configurado microciclo todavía. La UI muestra mensaje tipo "tu entrenador no ha armado tu plan semanal".

**Importante:** este endpoint **completa los descansos implícitos** del lado servidor. Si el microciclo es de 7 días y solo hay slots para 1, 2, 4, 5, el response trae 7 entradas, con los días 3, 6, 7 marcados `type: 'rest'`. Esto evita lógica de "días faltantes" en el cliente.

**`GET /api/client/exercises/:exerciseId/history?limit=3`** _(nuevo)_

Últimas N sesiones del cliente para un ejercicio dado, más PR.

```
Response 200: ExerciseHistoryResponse
```

Query a `exercise_logs` joineado con `exercise_log_sets`, filtrado por `client_id` + `exercise_id`, ordenado por `completed_at DESC`, limit N. PR se calcula con `MAX(weight_kg)` sobre todos los sets del cliente para ese ejercicio (no solo dentro del top 3).

**`GET /api/client/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`** _(nuevo)_

Entrenamientos completados del cliente en rango. Solo `status = 'completed'`. Sin sugerencias futuras (decisión j).

```
Response 200:
{
  entries: [
    {
      scheduled_date: '2026-05-03',
      sessions: [
        { id, name, session_type, exercises_completed: 7, exercises_total: 7 }
      ]
    }
  ]
}
```

**`POST /api/clients/[clientId]/exercise-logs`** _(modificado — ya existe)_

Endpoint actual: `app/api/clients/[clientId]/exercise-logs/route.ts`. Lógica de "crea `scheduled_sessions` row si no existe" se conserva. Cambios:

- El endpoint actualmente acepta `scheduledDate` (camelCase) en el body como campo requerido. **Mantener ese nombre** para no romper el cliente que ya lo manda. Cambio: hacerlo opcional. Si no viene, default = `getLocalTodayYmd()` (de `lib/forms/client-helpers.ts:19`) — ojo: el "hoy" debe calcularse del lado cliente con la TZ del usuario, NO en el servidor; los endpoints viejos ya siguen este patrón.
- Si la sesión registrada cubre todos los `session_exercises`, marcar `scheduled_sessions.status = 'completed'`.

### 4.2 Entrenador

> **Nota de path:** estos endpoints viven bajo `/api/clients/[clientId]/...`, no bajo `/api/trainer/clients/...`. Es el patrón consistente del repo para "acciones del trainer sobre un cliente concreto" — lo siguen `/api/clients/[clientId]/programs`, `/api/clients/[clientId]/exercise-logs`, `/api/clients/[clientId]/scheduled-sessions`, etc. El namespace `/api/trainer/*` se usa solo para acciones del trainer sobre sí mismo (ej. `/api/trainer/profile`).

**`GET /api/clients/[clientId]/microcycle`** _(nuevo)_

Devuelve el microciclo configurado del cliente, sin expandir descansos implícitos (la UI del entrenador trabaja con slots crudos).

```
Response 200:
{
  microcycle: MicrocycleWithSlots | null,
  available_sessions: Session[]  // del programa activo del cliente
}
```

**`PUT /api/clients/[clientId]/microcycle`** _(nuevo)_

Crea o actualiza el microciclo del cliente.

```
Request body:
{
  duration_days: 7,
  slots: [
    { day_index: 1, session_id: 'uuid-A' },
    { day_index: 2, session_id: 'uuid-cardio' },
    { day_index: 3, session_id: null },        // descanso explícito
    { day_index: 4, session_id: 'uuid-B' },
    ...
  ]
}

Response 200: { microcycle: MicrocycleWithSlots }
```

Implementación: transacción que (1) upsert en `microcycles` por `client_program_id`, (2) `DELETE FROM microcycle_slots WHERE microcycle_id = ?`, (3) `INSERT` los nuevos. Más simple que diff incremental y suficiente para la frecuencia de cambios esperada.

**Validación:** rechazar slots con `day_index > duration_days` o duplicados.

**Auth:** todos estos endpoints son trainer-only. Wrap con la utilidad existente `withTenantProtection` y validar sesión de trainer (`getTrainerSession()` siguiendo el patrón de `lib/auth/session.ts`).

---

## 5. Cambios por archivo de código

> **Recordatorio de §0.1:** todo archivo nuevo o reescrito apunta a ≤ 300 líneas. Cuando aquí se diga "archivo X se reescribe", la reescritura va acompañada de **división en sub-archivos** según el desglose indicado.

### 5.1 Vista del cliente — pantalla principal de entrenamientos

**Archivo a refactorizar:** `components/client-dashboard/workouts-content.tsx` (1788 líneas → idealmente ≤ 250).

**División propuesta:**

```
components/client-dashboard/workouts/
├── workouts-content.tsx           # orquestador, layout, header, bottom nav (~200 líneas)
├── available-sessions-list.tsx    # lista "Escoge tu siguiente entrenamiento" (~150 líneas)
├── past-workouts-list.tsx         # historial reciente (~150 líneas)
├── session-card.tsx               # card reusable de sesión (con tag fuerza/cardio/descanso)
├── microcycle-reference-modal.tsx # modal "Tu plan semanal" (referencia visual)
├── hooks/
│   ├── use-available-sessions.ts  # GET /api/client/sessions
│   ├── use-microcycle.ts          # GET /api/client/microcycle
│   └── use-past-sessions.ts       # historial desde scheduled_sessions/exercise_logs
└── types.ts                       # tipos locales del módulo si hace falta
```

**Comportamiento:**

- Header: avatar, saludo, fecha (igual que hoy).
- Sección "Escoge tu siguiente entrenamiento" — `<AvailableSessionsList />`. Itera sobre `useAvailableSessions()`. Cada `<SessionCard>` con botón "Comenzar" que abre el flujo de la sesión existente (pasando `scheduledDate = getLocalTodayYmd()` por defecto, con opción de editar).
- Enlace "Ver mi plan semanal →" abajo de la lista, abre `<MicrocycleReferenceModal />`. Si `useMicrocycle()` devuelve `null`, el enlace se oculta.
- Sección "Entrenamientos pasados" — `<PastWorkoutsList />`. Igual que hoy, mostrando últimas N completadas.

**Lo que se elimina:**

- Lógica `getScheduledSessions()` con `dayOffset` de -14 a +21 (`workouts-content.tsx:464-545`).
- Secciones fijas Hoy / Mañana / Próximos.
- Cálculo de `dayLabel` derivado.

**Backward compat:**

- Si el programa activo del cliente no tiene microciclo configurado, la pantalla muestra **igual** las sesiones disponibles (vienen de `programs.sessions`, no del microciclo). El microciclo solo afecta la pantalla de "plan semanal" (referencia). Esto significa que clientes existentes con programas configurados siguen funcionando sin que el entrenador haga nada.

### 5.2 Vista del cliente — modal de referencia del microciclo

**Archivo nuevo:** `components/client-dashboard/workouts/microcycle-reference-modal.tsx` (~180 líneas).

- Modal HeroUI estándar.
- Header: "Tu plan semanal" + cerrar.
- Subtítulo en gris: "Esta es la guía que armó tu entrenador. Puedes hacerlo en el orden que quieras."
- Lista de slots ordenada por `day_index`: Día 1, Día 2, ... hasta `duration_days`. Cada fila: nombre de la sesión + tag (Fuerza / Cardio / Descanso).
- **Sin CTA "Comenzar"** desde aquí (decisión extra-1).
- Empty state: si `microcycle === null`, mensaje "Tu entrenador todavía no ha armado tu plan semanal".

### 5.3 Vista del cliente — modal de ejercicio

**Archivo a refactorizar:** `components/client-dashboard/exercise-log-modal.tsx` (860 líneas → ≤ 300).

**División propuesta:**

```
components/client-dashboard/exercise-log/
├── exercise-log-modal.tsx         # orquestador del modal (~200 líneas)
├── exercise-target-section.tsx    # objetivo (sets, reps, peso, video del entrenador)
├── exercise-history-section.tsx   # PR + últimas 3 sesiones (NUEVO)
├── exercise-log-form.tsx          # form de registro (sets/reps/peso, video del cliente)
└── hooks/
    └── use-exercise-history.ts    # GET /api/client/exercises/:id/history
```

**`<ExerciseHistorySection />` (nuevo):**

- Banda PR arriba (background ámbar suave): "Tu mejor marca: 75 kg × 8 (hace 2 sem)". Si no hay logs previos, oculta toda la sección.
- Tabla compacta debajo con las últimas 3 sesiones: fecha · `peso × reps_serie1, reps_serie2, ...` · estado.
- Si hay menos de 3 logs, muestra los que haya.

**Carga:** se dispara al abrir el modal. Suspense / skeleton mientras llega.

### 5.4 Vista del cliente — calendario

**Archivo a reescribir:** `components/client-dashboard/calendar-content.tsx` (553 líneas → ≤ 250).

**División propuesta:**

```
components/client-dashboard/calendar/
├── calendar-content.tsx           # orquestador (~150 líneas)
├── calendar-header.tsx            # toolbar: navegación de mes + selector de vista
├── calendar-month-grid.tsx        # vista mensual
├── calendar-fortnight-grid.tsx    # vista quincenal
├── calendar-week-grid.tsx         # vista semanal
├── calendar-day-detail.tsx        # detalle del día seleccionado (lista de sesiones del día)
└── hooks/
    └── use-calendar-entries.ts    # GET /api/client/calendar
```

**Cambios respecto al actual:**

- Eliminar `getMockCalendarEvents` (`calendar-content.tsx:72`). Reemplazo: `useCalendarEntries({ from, to })`.
- Selector de vista (Mes / Quincena / Semana) como pestañas en el header. Vista por defecto: Mes.
- Cada celda muestra solo entrenamientos completados (decisión j). Sin punto/marca para días futuros sin completar.
- Al tocar una celda con datos: se muestra `<CalendarDayDetail />` debajo (en mobile) o lateral (si en algún momento se hace tablet/desktop), con la lista de sesiones del día.
- **Sin** edición retroactiva (decisión extra-2).

**Sobre la importación de mock data:** el módulo `lib/mock-data/client-profile-mock.ts` puede contener mocks usados en otros lados — verificar antes de borrar. Si solo el calendar lo usa, eliminarlo. Si no, dejarlo y solo dejar de importarlo desde calendar.

### 5.5 Vista del entrenador — configuración del microciclo

**Archivo nuevo:** `components/trainer/microcycle/microcycle-config.tsx` (~250 líneas).

**División propuesta:**

```
components/trainer/microcycle/
├── microcycle-config.tsx          # orquestador, layout (~250 líneas)
├── microcycle-slot-row.tsx        # una fila Día N + dropdown de sesión + tag
├── microcycle-duration-selector.tsx # selector de N días
├── available-sessions-aside.tsx   # panel lateral con biblioteca de sesiones
└── hooks/
    ├── use-trainer-microcycle.ts  # GET /api/clients/[clientId]/microcycle
    └── use-save-microcycle.ts     # PUT /api/clients/[clientId]/microcycle
```

**Comportamiento:**

- Header: nombre del programa, nombre del cliente, fecha de inicio (info contextual).
- Selector "Duración del ciclo" (default 7, rango 1–28).
- Lista de filas Día 1 ... Día N. Cada fila tiene un `<select>` con las sesiones del programa + opción "— Descanso —" (= `session_id: null`). Si una opción no se selecciona, queda como descanso implícito al guardar.
- Panel lateral (en desktop) o sección debajo (en mobile) con la biblioteca de sesiones del programa: nombres, recuento de ejercicios, botón "+ Crear sesión" (link a la UI de creación de sesiones existente).
- Botón "Guardar" arriba a la derecha. Al guardar, llamada a `PUT /api/clients/[clientId]/microcycle`. Success → toast. Error → toast con el mensaje del servidor.
- Si no hay microciclo todavía, la UI arranca con 7 filas vacías ("— Descanso —" en todas) y el entrenador las llena.

**Dónde se accede a esta pantalla:**

- Dentro de `app/trainer/dashboard/clients/[clientId]/page.tsx`, agregar una nueva pestaña o sección "Plan semanal". Verificar la navegación existente del cliente para encajarlo sin romper UX previa.

---

## 6. Orden de implementación

Cada paso es relativamente cerrado y testeable solo. El orden minimiza dependencias.

**Fase 0 — Fundamentos**

1. Migración SQL: crear `microcycles`, `microcycle_slots`, índices, RLS. Verificar que la migración corre limpia en local.
2. Tipos TS en `/types/training.ts` (sección Microcycles + ExerciseHistory).

**Fase 1 — APIs (data layer primero, sin UI)**

3. `GET /api/client/sessions` + tests rápidos con curl o un cliente de Supabase.
4. `GET /api/clients/[clientId]/microcycle` + `PUT /api/clients/[clientId]/microcycle`.
5. `GET /api/client/microcycle` (con expansión de descansos implícitos).
6. `GET /api/client/exercises/:id/history` + cálculo de PR.
7. `GET /api/client/calendar`.
8. Modificar `POST /api/clients/[clientId]/exercise-logs` para aceptar `scheduledDate` opcional (ya lo acepta requerido — pasa a opcional con default calculado por el cliente con `getLocalTodayYmd()`) y marcar `status = 'completed'` cuando cubre todos los ejercicios.

**Fase 2 — UI entrenador (sin esto el cliente no tiene plan semanal)**

9. `microcycle-config.tsx` y módulo asociado en `components/trainer/microcycle/`.
10. Integrarlo en `app/trainer/dashboard/clients/[clientId]/page.tsx` (pestaña/sección).

**Fase 3 — UI cliente — pantalla principal**

11. Crear `components/client-dashboard/workouts/` con la división del §5.1.
12. Reemplazar `app/[slug]/ejercicio/page.tsx` para apuntar al nuevo `<WorkoutsContent />` modular. Borrar el viejo `workouts-content.tsx` solo cuando el nuevo esté funcionando completamente.
13. `<MicrocycleReferenceModal />` accesible desde el enlace "Ver mi plan semanal".

**Fase 4 — UI cliente — modal de ejercicio**

14. Crear `components/client-dashboard/exercise-log/` con la división del §5.3.
15. Wire-up del nuevo modal donde antes se usaba `exercise-log-modal.tsx`.

**Fase 5 — UI cliente — calendario**

16. Crear `components/client-dashboard/calendar/` con la división del §5.4.
17. Verificar que `lib/mock-data/client-profile-mock.ts` no es usado en otro lado antes de limpiarlo.

**Fase 6 — Cierre**

18. `npm run type-check`.
19. `npm run lint:check`.
20. Smoke test manual: crear microciclo desde trainer, verlo desde cliente, registrar un entrenamiento, ver historial en modal de ejercicio, ver calendario.

---

## 7. Riesgos y consideraciones

**7.1 RLS permisiva consistente con el repo**

Tras revisar las migraciones del repo (017, 074, 076, 083), el patrón consistente y deliberado es policies permisivas (`FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)`) con la autorización real en la capa API (`withTenantProtection` + `getTrainerSession` / `getClientSession`). La migración 083 lo documenta explícitamente como decisión de diseño.

La nueva migración (§3.1) sigue ese mismo patrón por **consistencia**. Razones:

- Trainers usan JWT custom (no Supabase auth): todas las queries de trainer entran como `anon`. Una policy "estricta" que filtrara por `tenant_host IN (SELECT slug FROM tenants WHERE status='active')` no usaría `auth.uid()` así que tampoco distingue trainers — solo bloquearía hosts inactivos, cosa que `withTenantProtection` ya hace devolviendo 503.
- Apretar una sola tabla mientras 8+ tablas relacionadas siguen permisivas no mueve el dial de seguridad y rompe el patrón.
- Si en algún momento se hace una pasada general apretando RLS, estas tablas entran con el resto.

Esto **NO** significa que la autorización sea opcional. Todos los endpoints de microciclo verifican tenant + ownership en la capa API, igual que `/api/charts/*`. Esa es la línea de defensa real.

**7.2 Backward compatibility con clientes existentes**

- Clientes con programa activo pero sin microciclo: la pantalla principal funciona (lista las sesiones del programa). El enlace "Ver mi plan semanal" se oculta o muestra empty state.
- Logs viejos en `exercise_logs`: siguen siendo válidos, no necesitan migración.
- Rows viejas en `scheduled_sessions` (con `status = 'rescheduled'` por ejemplo): se siguen leyendo bien; el cambio es de uso, no de schema.

**7.3 Time zones**

`POST /api/clients/[clientId]/exercise-logs` con `scheduledDate` opcional (camelCase, manteniendo el nombre actual del endpoint). El default "hoy" debe calcularse en la zona horaria del cliente, no del servidor. Patrón existente: `getLocalTodayYmd()` en `lib/forms/client-helpers.ts:19`. El cliente lo invoca antes de mandar la request y lo incluye en el body.

**7.4 Dualidad de tablas de cliente y trainer**

El repo tiene dos tablas para cada rol coexistiendo:

- **Cliente:** `clients` (BIGINT, legacy) + `client_profiles` (UUID, alineada con `auth.users`). Las tablas de training (`client_programs`, `scheduled_sessions`, `exercise_logs`) usan `client_id BIGINT REFERENCES clients(id)` — la legacy.
- **Trainer:** `trainers` (legacy) + `trainer_profiles`. Las tablas de training usan `trainer_id REFERENCES trainers(id)`.

`microcycles` apunta a `client_programs(id)` (UUID) y NO referencia clientes/trainers directamente, así que no introduce conflicto nuevo. Pero los endpoints de Fase 1 SÍ tienen que mapear correctamente: cuando un trainer hace login con `getTrainerSession()` y consulta el microciclo de un cliente, hay que ir desde la sesión del trainer (probablemente `trainer_profiles` o un id derivado) a `trainers(id)` (que es lo que está en `client_programs.trainer_id`). El mismo flujo aplica para cliente. El patrón ya existe en endpoints actuales de training — replicarlo, no reinventar.

**7.5 Performance del cálculo de PR**

`MAX(weight_kg)` sobre todos los sets de un cliente para un ejercicio se ejecuta cada vez que se abre el modal. Para clientes con mucho histórico esto puede ser caro. Si se nota lentitud:

- Cache en memoria por sesión cliente (TTL corto).
- O activar la tabla `personal_records` que ya existe en el schema (migración 016) pero está dormida (cero referencias en código). Materializar el PR ahí sería trabajo aparte de este bloque — solo lo dejo señalado por si en el futuro alguien la activa, hay que reconciliar con el cálculo al vuelo.

No optimizar prematuramente. Medir primero.

**7.6 Migración de datos: no hace falta**

Decisión de diseño: no migramos clientes viejos a microciclos retroactivamente. Cada entrenador arma el microciclo de cada cliente cuando le toque. Mientras tanto, la app funciona con el comportamiento de fallback descrito en §7.2.

**7.7 Compresión de videos pendiente**

Sigue siendo un pendiente del bloque anterior. No lo tocamos aquí. Si el storage de Supabase vuelve a llenarse durante este bloque, se atiende como ticket aparte.

---

## 8. Checklist de implementación

Cada item ≈ un commit lógico. Ayuda como guía visual de progreso.

- [ ] Migración SQL `0XX_create_microcycles.sql` corre limpia.
- [ ] Tipos TS extendidos en `types/training.ts`.
- [ ] `GET /api/client/sessions`.
- [ ] `GET /api/clients/[clientId]/microcycle`.
- [ ] `PUT /api/clients/[clientId]/microcycle`.
- [ ] `GET /api/client/microcycle` (con descansos implícitos completados).
- [ ] `GET /api/client/exercises/:id/history` (con PR).
- [ ] `GET /api/client/calendar`.
- [ ] `POST /api/clients/[clientId]/exercise-logs` acepta `scheduledDate` opcional y marca `status = 'completed'` cuando aplica.
- [ ] `components/trainer/microcycle/` modularizado.
- [ ] Integración en `app/trainer/dashboard/clients/[clientId]/page.tsx`.
- [ ] `components/client-dashboard/workouts/` modularizado.
- [ ] `components/client-dashboard/workouts/microcycle-reference-modal.tsx`.
- [ ] `app/[slug]/ejercicio/page.tsx` apunta al nuevo módulo.
- [ ] Borrar `components/client-dashboard/workouts-content.tsx` viejo.
- [ ] `components/client-dashboard/exercise-log/` modularizado.
- [ ] `components/client-dashboard/calendar/` modularizado.
- [ ] Verificar y, si aplica, limpiar `lib/mock-data/client-profile-mock.ts`.
- [ ] `npm run type-check` limpio.
- [ ] `npm run lint:check` limpio.
- [ ] Smoke test E2E manual del flujo completo.
