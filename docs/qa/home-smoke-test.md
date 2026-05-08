# Home cliente — Smoke test manual

Checklist para validar que la página `/[slug]/` (home del cliente) no falla. Toma ~30 min en dev server.

**Setup:**

1. `npm run dev`
2. Login como cliente de prueba en un tenant.
3. DevTools abierto (F12). Tab "Network" y "Console" visibles.

Si CUALQUIER paso muestra un error en consola o un comportamiento distinto al esperado, anótalo y avisá.

---

## 1. Carga inicial (5 min)

- [ ] Hard refresh (Ctrl+Shift+R / Cmd+Shift+R). **Esperado:** ves 3 skeletons grises pulsando en "Registro Diario", luego se reemplazan por las cards reales sin salto visual brusco. **Mal:** las cards aparecen "de golpe" empujando el contenido de abajo.
- [ ] Console limpia. **Mal:** errores rojos, warnings de React keys, "Cannot read property...".
- [ ] Network tab: ves requests a `/api/forms/configs/...`, `/api/forms/responses/...`, `/api/charts/clients/.../snapshot?range=7d`, `/api/client/neat`. Todas con status 200.

## 2. Registro Diario — 3 cards (3 min)

- [ ] Card de hoy tiene **borde primary 2px** + chip sólido **"Hoy"** al lado del nombre del día. Texto legible.
- [ ] Las otras 2 cards tienen borde gris fino. Mismo tamaño.
- [ ] Pildora "Enviado" verde / "Pendiente" naranja se lee bien en las 3 cards.
- [ ] Tap en cada card abre el modal con la fecha correcta en el título.

## 3. Submit del modal diario (3 min)

- [ ] Abre el modal del día de HOY (que esté pendiente).
- [ ] Llena al menos un campo. Click "Guardar".
- [ ] **Esperado:** modal cierra solo, la card de hoy cambia de "Pendiente" a "Enviado" en ~1 segundo SIN recargar la página.
- [ ] **Mal:** queda en "Pendiente", o tienes que recargar manualmente, o se queda colgado.

## 4. Banner semanal (2 min) — solo si tu tenant tiene check-in configurado

- [ ] Si está vencido, ves la barra naranja arriba con "Completa tu [nombre]". Texto blanco legible sobre naranja.
- [ ] Click → abre modal weekly. Submit funciona igual que el diario.
- [ ] Si NO está configurado o ya está enviado, la barra no aparece.

## 5. Selector de período (3 min)

- [ ] Ves los 5 tabs: **7 Días / 30 Días / 3 Meses / 6 Meses / 12 Meses**, activo "7 Días".
- [ ] Click en cada uno → la pastilla activa se mueve, los charts re-renderean con nuevos datos.
- [ ] **Mal:** la pastilla activa no se mueve, los charts no cambian, o tira error en consola.

## 6. Charts y "Aún sin registrar" (4 min)

- [ ] Si tienes datos en algún chart, lo ves arriba como tarjeta grande con la gráfica.
- [ ] Los charts SIN datos están agrupados al final en una sola tarjeta titulada **"Aún sin registrar"**, con un row por métrica (icono + label + "Sin datos · 7d").
- [ ] **Mal:** ves 4-5 tarjetas grandes vacías apiladas (es la versión vieja).

## 7. NEAT — Actividad diaria (3 min) — solo si tu tenant tiene NEAT cards configuradas para hoy

- [ ] Ves la tarjeta "Actividad diaria" con un ring radial verde y número de pasos en el centro.
- [ ] Debajo del ring, una línea "Meta X · Faltan Y" (si meta no cumplida).
- [ ] Más abajo, tira de los últimos 7 días con barra de hoy resaltada en verde.
- [ ] Si meta cumplida, ves banner "✓ ¡Objetivo cumplido!" verde.
- [ ] **Mal:** ring rojo (color invertido — bug del diseño viejo), número repetido arriba y en el centro, o la card no aparece cuando debería.

## 8. Error de red (3 min) — _te necesito 30 segundos atento_

- [ ] DevTools → tab "Network" → dropdown "No throttling" → cambiar a **"Offline"**.
- [ ] Recarga la página (F5).
- [ ] **Esperado:** banner rojo arriba: "No pudimos cargar tus registros. Recarga la página o vuelve a intentarlo en un momento."
- [ ] El banner NO debe tumbar la página. El resto del layout sigue visible.
- [ ] Volver Network a "No throttling" + recargar → todo carga normal otra vez.

## 9. Mobile / scroll (3 min) — DevTools toggle device toolbar (Cmd+Shift+M)

- [ ] Set "iPhone 14 Pro" o similar.
- [ ] Scroll hasta el FONDO de la página.
- [ ] **Esperado:** ningún contenido queda tapado por el bottom nav. Hay buffer visible entre la última tarjeta y la nav.
- [ ] **Mal:** la última card o el último row queda parcialmente debajo de la nav.

## 10. Reabrir la app (2 min) — simulación de "PWA en background"

- [ ] Cambiar de tab del browser por 1-2 minutos.
- [ ] Volver al tab de la home.
- [ ] **Esperado:** ves un refetch en Network tab (las queries se invalidan en window focus). Si pasaste un día (improbable en este test), "Hoy" debería actualizarse.
- [ ] **Mal:** errores en consola al volver al tab.

---

## Bugs conocidos / no críticos (NO son fallos)

- El warning sobre `husky DEPRECATED` en cada commit es del setup del proyecto, no relacionado.
- Si recién creaste un cliente sin formularios configurados, la home muestra cards vacías + "Aún sin registrar" — eso es intencional.

## Si encuentras algo raro

Anota:

1. Qué hiciste (paso del checklist).
2. Qué viste vs. qué esperabas.
3. Screenshot del error en consola si lo hay.
