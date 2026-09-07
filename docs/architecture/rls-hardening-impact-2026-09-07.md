# Cierre de RLS — Análisis de impacto · 2026-09-07

> **Decisión que responde:** cómo cerrar la exposición cross-tenant descubierta el 2026-09-07 con el **menor impacto** sobre registro, login y recuperación de contraseña, y si hace falta el rediseño de auth para hacerlo bien.
> Evidencia verificada en producción (`pg_policies`, `role_table_grants`, `pg_proc`) y en código (`grep` de cada `createClient`). Nada de esto es suposición.

---

## 1. Situación verificada

| Métrica (prod, schema `public`) | Valor |
|---|---|
| Tablas | 62 |
| Tablas donde el rol `anon` puede **leer** | **62** |
| Tablas donde el rol `anon` puede **escribir/borrar/truncar** | **62** |
| Tablas con RLS desactivado del todo | 5 (`client_checkins`, `client_goals`, `client_water_intake`, `client_step_tracking`, `tenant_events`) |
| Tablas con RLS "activado" pero política `USING (true)` para `anon` | 52 |
| Tablas con aislamiento real | **0** (`trainers`/`admin_users`/`tenants` tienen políticas restrictivas por `auth.uid()`, pero conviven con una permisiva `anon → true`; permisivas se combinan con OR) |
| Funciones `SECURITY DEFINER` ejecutables por `anon` vía `/rest/v1/rpc/…` | 7, incluida `delete_auth_user_on_admin_delete` y `get_trainer_deletion_impact` |

La anon key es `NEXT_PUBLIC_SUPABASE_ANON_KEY`: está en el bundle del navegador. El aislamiento entre trainers vive **exclusivamente** en el `.eq("tenant_host", …)` de cada servicio del servidor.

`CLAUDE.md` ("Tenant isolation is enforced by RLS policies") y `docs/architecture/security-baseline.md:293` describen un sistema que no existe.

---

## 2. Lo que NO se ve afectado por cerrar la puerta — y por qué

Esto es lo que te preocupa, así que va primero. Tracé **cada** `createClient` del repo (14 sitios) y **cada** uso de la anon key en el navegador.

### 2.1 El navegador nunca consulta tablas

Los únicos usos de la anon key en código `"use client"`:

| Fichero | Qué hace | ¿Toca tablas? |
|---|---|---|
| `app/trainer/login/page.tsx:98-160` | `auth.signInWithPassword`, `auth.updateUser`, `auth.signOut` | No — habla con GoTrue (`/auth/v1`) |
| `app/admin/login/page.tsx:62-122` | Ídem | No |
| `components/admin/edit-profile-modal.tsx:103-154` | `signInWithPassword` + `updateUser` (cambio de email/contraseña) | No |
| `lib/clients/supabase-browser.ts` → `lib/hooks/use-realtime-messages.ts`, `use-realtime-notifications.ts` | `channel().on("postgres_changes", …)` | **Sí: es lo único que se rompe** (ver §3) |

Los tres primeros crean el cliente con `persistSession: false` (`login/page.tsx:100`), así que **no queda una sesión de Supabase Auth en localStorage** que alguien pudiera reutilizar contra PostgREST como `authenticated`.

**Conclusión:** revocar los grants de tablas a `anon`/`authenticated` **no cambia nada** en login, cambio de contraseña ni edición de perfil, porque GoTrue no depende de grants sobre `public.*`.

### 2.2 Registro, OTP y recuperación de contraseña van por el servidor

| Flujo | Ruta | Cliente que usa | Tablas | Qué le pasa al cambiar |
|---|---|---|---|---|
| Registro de trainer | `app/api/auth/register` | `supabase-server` (anon) + `auth.*` | 2 `.from()` | El `.from()` pasa a service role → mismas filas. `auth.*` no cambia. |
| Olvido/reset trainer | `trainer-forgot-password`, `trainer-reset-password` | `supabase-server` + `auth.admin` (ya usa `supabase-admin` = service role) | `otp_codes`, `trainers`, log | Ídem. `auth.admin` ya es service role hoy. |
| Olvido/reset cliente | `client-forgot-password`, `client-reset-password` | `supabase-server` | `otp_codes`, `clients`, log | Ídem. |
| Verificar OTP | `trainer-verify-otp`, `client-verify-otp` → `lib/security/otp.ts` | `supabase-server` | `otp_codes` ×8 | Ídem. |
| Cambio de contraseña trainer | `app/api/trainer/change-password` | `supabase-server` + `auth.*` ×2 | 0 | Sin `.from()`; `auth.*` no cambia. |
| Invitación | `lib/auth/invitation.ts` | anon | `invitation_codes` | Pasa a service role → sigue leyendo. |
| Triggers `auto_confirm_trainer_email`, `auto_confirm_admin_email` | DB | — | — | Son triggers: no dependen de grants del rol que llama. |

**Ningún flujo de auth ejecuta `.from()` desde el navegador.** Todos pasan por `lib/clients/supabase-server.ts` (o `supabase-api.ts`, `loader.ts`, `invitation.ts`, `session.ts:228`, `client-session.ts:184`). Cambiar **esa factoría** a service role es un cambio de configuración: el código de cada ruta no se toca y sigue filtrando por `tenant_host` exactamente igual.

### 2.3 Lo demás

- **Middleware** (`middleware.ts:102`): lee `tenants.slug` con `status='active'`. Pasa a service role (variable server-only; Next middleware corre en servidor). Sin cambio funcional.
- **Storage** (fotos, vídeos, PDFs): **todas** las subidas son rutas de servidor (`upload-photo`, `upload-video`, `profile-picture`, `diet-pdf`, `meal-photo-service`). Con service role, las policies de `storage.objects` se bypassean → sigue igual. Los buckets públicos se sirven por URL, no por grants.
- **Panel admin**: hoy funciona gracias a la política permisiva `anon → true` sobre `trainers` (la restrictiva por `auth.uid()` devolvería nada porque no hay sesión de Supabase Auth). Con service role sigue funcionando.
- **Cron**: `cron-service` pega a endpoints HTTP con `CRON_SECRET` (CLAUDE.md); no toca la base directamente.
- **Tests e2e**: `lib/test/supabase-test-client.ts` ya usa service role.

---

## 3. Lo ÚNICO que se rompe: Realtime del navegador

`use-realtime-messages.ts` y `use-realtime-notifications.ts` se suscriben a `postgres_changes` sobre `messages` y `notifications` con el token anon (no llaman a `realtime.setAuth`). Realtime aplica RLS con el rol del token: al quitarle `SELECT` a `anon`, **deja de llegar ningún evento**. Hoy, por cierto, un suscriptor puede escuchar `messages` de **cualquier** tenant cambiando el `filter` — es otra cara de la misma exposición.

**Solución con la doc oficial de Supabase** (guía *Realtime → Postgres Changes → Custom tokens*): firmar en el servidor un JWT corto con el **JWT secret del proyecto Supabase** (Dashboard → Settings → API), con `role: "authenticated"` y claims propios (`tenant_host`, `user_id`, `kind`), entregarlo al navegador, y el hook hace `supabase.realtime.setAuth(token)` antes de suscribirse. Entonces:

- `messages` y `notifications` conservan `SELECT` **solo** para `authenticated`, con una política **real**:
  `tenant_host = auth.jwt()->>'tenant_host' AND (…destinatario = auth.jwt()->>'user_id'…)`.
- Todo lo demás sigue sin grants para `anon`/`authenticated`.

Coste: un endpoint `GET /api/realtime-token` (firma con `jose`, que ya está en el proyecto), un env var server-only nuevo (`SUPABASE_JWT_SECRET`), dos hooks que piden el token y llaman a `setAuth`, dos políticas. Es la misma técnica que usaría la Opción B, aplicada quirúrgicamente a dos tablas.

> Ojo: **no** basta con reutilizar el `JWT_SECRET` actual de la app. Aunque coincidiera con el de Supabase (no lo sé — no puedo leer `.env.local`), el JWT de sesión (`session.ts:93-98`) no lleva el claim `role`, y sin `role` PostgREST/Realtime lo tratan como `anon`. Hace falta un token dedicado.

Alternativa sin tocar auth de Realtime: relay por el servidor (SSE) o volver a polling. Polling ya se descartó por rendimiento (era lo que hacía lenta la app); SSE es más trabajo que el token.

---

## 4. Opción A — Cerrar la puerta externa (recomendada, ahora)

**Qué cambia**

*Código (~10 ficheros, mecánico):*
1. `lib/clients/supabase-server.ts`, `supabase-api.ts`, `lib/tenant/loader.ts`, `lib/auth/invitation.ts`, `lib/auth/session.ts:228`, `lib/auth/client-session.ts:184`, `app/api/messages/route.ts`, `app/api/messages/trainer/route.ts`, `app/api/notifications/route.ts`, `middleware.ts` → clave `SUPABASE_SERVICE_ROLE_KEY`. Mejor aún: que todos importen **una** factoría (`supabase-admin.ts` ya existe) y morir la duplicación.
2. Guard `import "server-only"` en esa factoría: hoy `supabase-server.ts` no lo tiene; con service role dentro, un import accidental desde un `"use client"` sería catastrófico. El guard lo convierte en error de build.
3. Endpoint `/api/realtime-token` + `setAuth` en los dos hooks (§3).

*Base de datos (una migración):*
```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
-- las 7 SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.delete_auth_user_on_admin_delete() FROM anon, authenticated;
-- … (auto_confirm_*, cleanup_expired_otps, get_client_checkin_streak, get_tenant_host_for_client, get_trainer_deletion_impact)
-- Realtime: solo estas dos, solo authenticated, política real
GRANT SELECT ON public.messages, public.notifications TO authenticated;
-- + CREATE POLICY … USING (tenant_host = auth.jwt()->>'tenant_host' AND …)
```

**Impacto en auth:** ninguno (§2). **Impacto en usuarios:** ninguno visible si Realtime se migra en el mismo deploy.

**Riesgo residual:** el aislamiento interno sigue dependiendo del filtro en código — igual que hoy. La Opción A no lo empeora; quita la puerta externa.

**Reversibilidad:** total. Un `GRANT` devuelve el estado anterior; el cambio de clave es una variable de entorno.

**Orden de despliegue seguro:** (1) código a service role + token de Realtime, deploy, verificar; (2) migración de REVOKE. Así nunca hay una ventana con el código en anon y los grants revocados.

---

## 5. Opción B — RLS real por tenant (defensa en profundidad, después)

**Qué es realmente.** No es reemplazar tu auth por Supabase Auth. La doc confirma que un JWT firmado con el secret del proyecto, con `role: "authenticated"` y claims propios, es un token válido para PostgREST, y que las políticas pueden leer `auth.jwt()->>'tenant_host'`. Es decir: **tu modelo de sesión se queda**; lo que cambia es que el servidor, en cada petición, habla con Postgres con un token que lleva el tenant, y Postgres lo comprueba.

**Coste real:**
- Políticas para ~57 tablas. Muchas tienen `tenant_host`; otras solo `client_id` (join) — hay que auditar una a una.
- **`tenant_host ≠ tenant_slug`** y las tablas no son consistentes (memoria del proyecto: `notifications.tenant_slug` vs `messages.tenant_host`). Cada política es una oportunidad de equivocarse de columna.
- Registro y admin (cross-tenant) siguen necesitando service role; hay que separar explícitamente "rutas con tenant" de "rutas sin tenant".
- Una política mal escrita **no da error: devuelve cero filas**. Este repo ya tiene historial de "fallbacks silenciosos" que blanquearon pantallas (theme, food search, form config). Requiere tests por tabla.

**Cuándo.** Después de la A, tabla a tabla, empezando por las de mayor sensibilidad (`form_responses`, `clients`, `messages`, `exercise_logs`), reutilizando el token de §3. Cada tabla migrada es una menos que depende de la disciplina del filtro.

**¿Es necesario el rediseño para estar seguros?** No para cerrar el acceso externo (eso lo hace la A). Sí para protegerse de un `.eq("tenant_host")` olvidado en una ruta futura. Es la diferencia entre "nadie de fuera puede entrar" y "aunque un bug abra una ventana, no ve otro tenant".

---

## 6. Recomendación

1. **Opción A completa, incluyendo el token de Realtime, en una sola PR.** Impacto cero en registro/login/reset. Reversible. Cierra el agujero real.
2. Corregir `CLAUDE.md` y `security-baseline.md` en esa misma PR para que digan la verdad.
3. **Opción B incremental**, empezando por las 4 tablas sensibles, como proyecto aparte con su propio plan y tests por tabla.
4. Activar *Leaked password protection* en Auth (el advisor lo marca; es un toggle).

---

## 7. Antes de empezar — comprobaciones que solo puedes hacer tú

- [ ] Tener el **JWT secret del proyecto Supabase** disponible como variable server-only en Railway (`SUPABASE_JWT_SECRET`). Dashboard → Settings → API.
- [ ] Confirmar que `SUPABASE_SERVICE_ROLE_KEY` está en Railway (ya lo usa `supabase-admin.ts`, así que debería).
- [ ] Decidir si `middleware.ts` corre en runtime Node (sí en este repo: no hay `runtime: "edge"`) — service role en middleware es aceptable solo si es server-side, y lo es.

## 8. Checklist de verificación tras el cambio (flujos a probar en local)

- [ ] Login trainer / admin / cliente (cookie propia)
- [ ] Registro de trainer nuevo + `auto_confirm` + primer login
- [ ] Olvidé contraseña trainer → OTP → reset → login
- [ ] Olvidé contraseña cliente → OTP → reset → login
- [ ] Cambio de contraseña desde perfil (trainer) y desde `edit-profile-modal` (admin)
- [ ] Invitación de cliente
- [ ] Chat en tiempo real (trainer↔cliente) y campana de notificaciones — **con el token nuevo**
- [ ] Un cliente del tenant A **no** recibe eventos de `messages` del tenant B aunque manipule el `filter` del canal
- [ ] Subida de foto de check-in, vídeo de ejercicio, PDF de dieta
- [ ] Middleware: slug válido → portal; slug inválido → 404; tenant inactivo → 503
- [ ] Con la anon key del bundle: `GET /rest/v1/clients?select=id` debe devolver **401/permission denied**
