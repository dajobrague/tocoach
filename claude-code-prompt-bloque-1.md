# Prompt para Claude Code — Implementación del Bloque 1

> Pegar todo lo que sigue (a partir del título de abajo) como primer mensaje en una sesión nueva de Claude Code dentro de este repositorio. El prompt es autocontenido — no asume que Claude Code haya visto la conversación de planeación.

---

# Implementación del Bloque 1 — Rediseño del flujo de entrenamiento del cliente

Estás trabajando en **TopCoach**, un SaaS multi-tenant en producción para entrenadores fitness (Next.js 15 App Router + Supabase). La consigna del proyecto es: **"tener mucho cuidado al modificar algo"**. Cualquier cambio puede afectar a clientes reales.

Tu tarea es implementar el **Bloque 1** del plan de rediseño: cambiar el flujo de entrenamiento del cliente de "fechas fijas calculadas por `day_of_week`" a "el cliente elige libremente qué sesión hacer", añadir vista de microciclo, históricos por ejercicio en el modal, y reescribir el calendario para que use datos reales.

## Lectura obligatoria antes de tocar código

Lee, en este orden, estos archivos. **No empieces a escribir código hasta haber leído los tres.**

1. `CLAUDE.md` — convenciones del proyecto, comandos, modelo de auth, RLS, advertencias.
2. `bloque-1-spec.md` — **la spec técnica completa de lo que vas a construir**. Es la fuente de verdad. Incluye decisiones, modelo de datos, APIs, división por archivo y orden de fases.
3. `requerimientos-llamada-2026-04-22.md` — contexto de la llamada con el cliente que originó el bloque.

Después de leerlos, **antes de tocar código**, confirma brevemente en tu respuesta que entendiste:

- El orden de las 6 fases del §6 de la spec.
- Las reglas de modularización del §0.1 (≤300 líneas objetivo, 500 tope).
- Las decisiones a–j + extra-1 y extra-2 del §1.
- Que **NO** debes migrar datos de clientes existentes (§7.6).
- Que **NO** debes editar `bloque-1-spec.md` sin permiso explícito.

Solo después de esa confirmación empieza la Fase 0.

## Reglas no negociables

### 0. Si algo no encaja, PREGUNTA antes de improvisar

Si encuentras código real que contradice la spec, código que no entiendes, o ambigüedades en lo que se pide, **detente y pregunta**. No "ajustes" la spec por tu cuenta. La spec puede estar mal — en ese caso, propón el cambio y espera confirmación. Nunca edites `bloque-1-spec.md` sin permiso explícito.

### 1. Modularización (§0.1 de la spec)

Tope: **≤300 líneas por archivo objetivo, 500 máximo absoluto**. Si un archivo va a cruzar 300, divide **antes** de seguir agregando. Un archivo = una responsabilidad. Hooks de fetching en archivos `use-*.ts` separados de los componentes.

El antipatrón explícito a evitar es lo que hace hoy `components/client-dashboard/workouts-content.tsx` (1788 líneas mezclando fetching, lógica y render). La spec ya da la división propuesta para los componentes grandes — síguela.

### 2. Verificación manual antes de declarar trabajo terminado

`next.config.js` ignora errores de TS y ESLint en build (deuda preexistente del proyecto). **No te cubre las espaldas.**

Después de cada fase corre:

```bash
npm run type-check
npm run lint:check
```

Si hay errores nuevos introducidos por tus cambios, arréglalos antes de avanzar a la siguiente fase. Errores preexistentes ajenos a tu cambio: anótalos pero **no los toques**.

### 3. Conventional Commits con scope

Ejemplos:

- `feat(microcycle): add microcycle_slots table`
- `refactor(workouts): split workouts-content into modular components`
- `feat(exercise-modal): show last 3 sessions and PR`

Subject ≤100 chars, sin punto final. Commitlint y Husky bloquean lo que no cumpla. ESLint corre con `--fix` en lint-staged — no pelees con el autofixer.

### 4. Migraciones numeradas, nunca editar viejas

Cualquier cambio de schema = migración nueva con el **siguiente número disponible** en `supabase/migrations/`. Confirma el número leyendo el directorio antes de crear el archivo. Hay duplicados históricos de `002_*` — ignóralos, sigue la secuencia más alta.

### 5. Backward compatibility con clientes existentes

Clientes que tienen programa activo pero no tienen microciclo configurado **deben seguir funcionando**:

- La pantalla principal del cliente muestra las sesiones del programa (vienen de `programs.sessions`, no del microciclo).
- El enlace "Ver mi plan semanal" se oculta o muestra empty state cuando no hay microciclo.
- `exercise_logs` viejos siguen siendo legibles.

Verifica este caso explícitamente al probar.

### 6. Tipos

Todo tipo del dominio entrenamiento vive en `/types/training.ts`. Extender, no duplicar. **No usar `any`**. El proyecto tiene `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` activos: narrar tipos correctamente, no `!` ni casts perezosos.

### 7. Scope estrecho

Solo trabajo descrito en `bloque-1-spec.md`. **NO** toques en este bloque:

- Compresión de videos (pendiente del bloque anterior).
- Customización de dashboards del entrenador.
- CRM.
- RLS de tablas viejas más allá de lo necesario para tablas que crees.

Si ves bugs preexistentes ajenos al bloque, anótalos al final de tu reporte. **No los arregles.** Excepción: el calendario actualmente usa `getMockCalendarEvents` (mock data) — ese sí está en scope porque la spec del calendario lo cubre.

### 8. No introducir mocks en código de producción

Para datos de prueba durante desarrollo usa Supabase local (real DB), no mocks hardcodeados. La oportunidad de este bloque es **eliminar** el mock que ya existe (`lib/mock-data/client-profile-mock.ts` referenciado por `calendar-content.tsx:72`).

## Cómo trabajar — fase por fase

Sigue exactamente el orden del §6 de la spec:

- **Fase 0:** migración SQL + tipos TS.
- **Fase 1:** APIs (data layer primero, sin UI).
- **Fase 2:** UI entrenador (configuración del microciclo).
- **Fase 3:** UI cliente — pantalla principal.
- **Fase 4:** UI cliente — modal de ejercicio.
- **Fase 5:** UI cliente — calendario.
- **Fase 6:** verificación final.

Por cada fase:

1. **Anuncia el inicio**: qué fase, qué archivos vas a tocar/crear, qué endpoints o componentes.
2. **Implementa con commits lógicos**: un commit por pieza coherente. No commits gigantes que mezclen migración + API + UI.
3. **Cierra la fase**: corre type-check + lint. Marca los items del checklist (§8 de la spec) completados.
4. **Espera luz verde** del usuario antes de pasar a la siguiente fase, salvo instrucción explícita en contrario.

**No mezcles fases.** No empieces UI sin las APIs. No empieces APIs sin la migración. El orden está definido por dependencias reales.

## Qué hacer si...

- **Encuentras una contradicción spec ↔ código real:** detén el trabajo, descríbelo, propone una resolución, espera confirmación.
- **Una API existente no acepta lo que necesitas:** verifica primero si el cambio es realmente necesario o si hay otra vía. Si lo es, descríbelo y espera confirmación antes de modificarla. El endpoint `POST /api/clients/[clientId]/exercise-logs` ya está marcado como modificable en la spec — el resto requiere conversación.
- **Un archivo está creciendo más allá de 300 líneas:** detente, propón división (qué archivos y qué responsabilidad por cada uno), ejecuta la división, sigues.
- **Encuentras un bug preexistente fuera de scope:** apúntalo en una sección "Bugs encontrados, fuera de scope" al final de tu reporte. No lo arregles.
- **Una decisión de la spec no se sostiene en la práctica:** detente, descríbelo con detalle, propone alternativa, espera confirmación. Posiblemente la spec deba actualizarse — solo con permiso explícito.

## Cierre del bloque

Cuando completes la Fase 6:

1. **Smoke test manual** del flujo completo:
   - Crear microciclo desde trainer dashboard.
   - Verlo desde la app del cliente como referencia.
   - Registrar un entrenamiento desde la pantalla principal.
   - Ver el historial en el modal del ejercicio.
   - Ver el calendario rediseñado con datos reales.
2. **Reporta**:
   - Items del checklist (§8 de la spec) completados.
   - Archivos creados / modificados / eliminados (resumen, no diff completo).
   - Cualquier desviación respecto a la spec con la razón.
   - Bugs encontrados fuera de scope.
3. Espera visto bueno antes de cerrar branches o abrir PR.

---

**Acción inmediata:** lee los tres archivos listados arriba y confirma comprensión. No avances a Fase 0 hasta tener confirmación del usuario.
