# Nuevos requerimientos — Llamada 22/4/2026

**Fecha:** 22 de abril de 2026, 11:04
**Duración:** 40 min
**Participantes:** Jose Carlos de Francisco, Adrián, David Bracho
**Origen del feedback:** mayoría reportada por Isaac (usuario con alto volumen de clientes, reuniones quincenales con Jose Carlos)
**Grain:** https://grain.com/share/recording/f061c8e0-0869-4fe6-a189-1628ed955952/tWAx1SwT3JrLHPX5Aw90y5NjYLNLEBu2K6HnMQgC

---

## Resumen ejecutivo

Los 12 nuevos requerimientos se agrupan en **4 bloques de implementación**:

1. **Bloque 1 — Rediseño del flujo de entrenamiento del cliente** _(PRIORITARIO)_
2. **Bloque 2 — Sistema de check-ins (programación + comportamiento)**
3. **Bloque 3 — Visualización y analytics (Progreso)**
4. **Bloque 4 — Quick win independiente** (multi-video por ejercicio)

**Orden sugerido de ejecución:** 1 → 2 → 3 → 4. El Bloque 4 se puede colar entre bloques como respiro.

---

## Bloque 1 — Rediseño del flujo de entrenamiento del cliente

> **Prioridad: ALTA.** David ya lo marcó como prioritario porque es feedback recurrente de muchos usuarios. Todos los puntos de este bloque tocan la misma vista del cliente y comparten el mismo cambio de modelo de datos (sesiones desacopladas de fechas fijas). Hacerlos por separado obligaría a tocar la misma estructura varias veces.
>
> **Acción previa acordada:** David presentará el diseño por adelantado usando Claude Design antes de implementar. Conviene que ese diseño cubra los 4 puntos juntos.

### 1.1 Selección flexible del próximo entrenamiento _(cambio grande)_

**Problema actual:**
La app muestra "próximo entrenamiento" con fecha prefijada. Esto genera fricción cuando:

- El cliente quiere saltarse un entrenamiento.
- El cliente quiere reprogramar (lesión, cansancio, ruta en bici el día anterior, etc.).
- El cliente quiere cambiar el orden de las sesiones de la semana.

**Solución propuesta:**

- Eliminar la noción de "próximo entrenamiento" con fecha fija.
- Arriba en la vista del cliente: título tipo **"Escoge tu siguiente entrenamiento"** + listado/cuadrícula con TODAS las sesiones programadas (fuerza y cardio).
- El cliente decide qué hacer hoy.
- Al abrir la sesión elegida escoge la fecha y registra.
- Al terminar, esa sesión pasa a "Entrenamientos pasados" (que se conserva abajo, igual que ahora).

**Decisión de UX en móvil:**

- Layout **arriba/abajo** (NO izquierda/derecha) por tamaño de pantalla. Inicialmente Jose Carlos planteó cuadrícula de 2 columnas (fuerza a la izquierda, cardio a la derecha) pero David señaló que en móvil no funciona.

**Decisión sobre auto-reorganización (descartada):**

- Adrián propuso que si el cliente cambia un día (ej. no entrena martes y entrena miércoles), la app reorganice automáticamente todo lo que viene después.
- Jose Carlos descartó esta vía porque genera rigidez. Caso de ejemplo: cliente con hombro lesionado se salta torso → con auto-reorganización se cargaría el orden preestablecido.
- Decisión final: **flexibilidad total**. El cliente elige libremente; la plantilla del microciclo (ver 1.2) queda solo como referencia.

### 1.2 Visualización del microciclo / plantilla del entrenador

**Complemento del 1.1.** Aunque el cliente elija libremente, debe poder ver la estructura original que le armó el entrenador como referencia visual.

**Lado cliente:**

- Vista tipo "foto" de la planificación: ej. _torso A → pierna A → descanso → cardio → full body B → cardio_.
- Funciona como referencia, no como obligación.

**Lado entrenador:**

- Nueva pantalla de **configuración del microciclo** donde el entrenador mete:
  - Sesiones (las que ya define hoy).
  - Días de descanso.
  - Días de cardio.
- Esa misma estructura es la que ve el cliente como referencia.

**Contexto terminológico:**

- _Microciclo_ = una vuelta entera a todos los entrenamientos del cliente (incluye días de entrenamiento, descanso y cardio).
- _Mesociclo_ = bloque mayor (mencionado por Adrián, no aplicable a este sprint).

### 1.3 Datos del entrenamiento previo dentro del ejercicio

**Caso de uso:** el cliente llega al gimnasio, abre Press de banca en la app, y necesita saber qué movió la última vez para progresar.

**Solución propuesta:**

- Dentro de la card del ejercicio, junto a la info que ya hay (foto, video, series objetivo, etc.), agregar un **botón desplegable** que muestre series, reps y peso de la sesión inmediatamente anterior de ese mismo ejercicio.
- Sin tener que salir del entrenamiento actual ni navegar al historial.

**Prioridad:** no urgente, pero queda en la lista. David ya lo tenía en su lista interna.

### 1.4 Calendario de entrenamientos del cliente

Mencionado como complemento de 1.3. Poder acceder a un calendario de los entrenamientos del cliente (vista histórica + posiblemente vista futura una vez se registren fechas elegidas).

---

## Bloque 2 — Sistema de check-ins (programación + comportamiento)

> Los puntos 2.1, 2.2 y 2.3 son el mismo refactor del módulo de scheduling de check-ins — tiene sentido hacerlos como una sola pieza. El 2.4 es una verificación rápida que conviene cerrar en el mismo bloque por compartir módulo.

### 2.1 Fecha del primer check-in + recurrencia tipo Google Calendar

**Problema actual:**
El entrenador define "frecuencia cada 2 semanas" pero no sabe en qué lunes/miércoles/jueves caerá. No hay forma de fijar la fecha de inicio.

**Solución propuesta:**

- Al dar de alta un cliente, poder definir la **fecha exacta del primer check-in**.
- Lógica estilo Google Calendar al crear un evento recurrente:
  - Fecha de inicio (ej. miércoles 22 de abril).
  - Cada cuántas semanas se repite (ej. cada 2 semanas).
  - Qué día de la semana.
- Ejemplos de configuración: "primero de cada mes", "5 de cada mes", "todos los lunes", etc.

### 2.2 Calendario de check-ins futuros con edición de instancias individuales

**Caso de uso:** un cliente avisa que se va de vacaciones; el entrenador no estará disponible en una fecha concreta; etc.

**Solución propuesta:**

- Vista de calendario de check-ins programados a futuro de un cliente.
- Para cada fecha individual del calendario recurrente, poder:
  - **Quitar** ese check-in puntual (cliente de vacaciones).
  - **Adelantar** o **mover** a otra fecha (entrenador no disponible).
- Misma lógica que Google Calendar al editar **una instancia** de un evento recurrente sin afectar al resto de la serie.

**Estimación de David:** factible, pero debe evaluar la complejidad. Podría ser de un día a dos semanas, no lo sabe sin sentarse a verlo.

### 2.3 Inversión de la lógica de hora del check-in

**Problema actual:**
El entrenador define **hora de apertura + duración de la ventana** y la app calcula la hora de cierre.

- Ej. lunes 12:00 + 48h → cierra miércoles 12:00.
- El entrenador tiene que hacer cálculos manuales para saber a qué hora queda cerrado.

**Solución propuesta — invertir la lógica:**

- El entrenador define la **hora límite de cierre** (ej. lunes 8:00 AM, que es cuando se sienta a revisar).
- El entrenador configura cuántas horas / días antes se abre la ventana para que el cliente pueda cargar (ej. 72h antes, 5 días antes, 48h antes).
- A la hora límite la ventana queda cerrada y nadie más puede subir nada.

**Razón:** desde la práctica del entrenador es más útil pensar en términos de "cuándo está cerrado" (porque a esa hora hace la revisión) que en términos de "cuándo se abre".

### 2.4 Verificación del bug de medias semanales

**Reporte:**
Las medias semanales aparentemente se calculan dividiendo siempre **entre 7**, ignorando los días en que el cliente no hizo registro. Esto descuadra los promedios cuando hay días sin datos.

**Comportamiento esperado:**
Dividir entre el **número de formularios efectivamente completados** en la semana.

**Estado:**
David cree que ya funciona así pero queda en **verificarlo** antes de descartar.

---

## Bloque 3 — Visualización y analytics (Progreso)

> Los tres puntos viven en el área de "progreso/dashboards". Conviene que el 3.1 vaya primero — al reordenar la pestaña, las gráficas nuevas (3.2, 3.3) entran en el sitio correcto desde el principio en lugar de moverlas después.

### 3.1 Reorganización de la pestaña "Progreso"

**Problema actual:**
La pestaña "Progreso" contiene casi todos datos relativos al entrenamiento (carga, repeticiones, ejercicios), cuando conceptualmente esos datos pertenecen a la pestaña "Entrenamiento".

**Solución propuesta:**

- **Mover** todos los datos relativos al entrenamiento desde "Progreso" a la pestaña **"Entrenamiento"**.
- Dejar **"Progreso"** como vista global con métricas tipo:
  - Peso corporal (gráfica de evolución).
  - Evolución del sueño.
  - Pasos diarios (ya existe).
  - Otros datos generales que va registrando el cliente.
- A futuro: los **dashboards customizables del entrenador** vivirán aquí (pendiente fuera de este sprint).

**Nota positiva:** Isaac mencionó que la pestaña "Progreso" dentro de **Nutrición** le encantó. Esa visualización (evolución del planning nutricional) se queda como está, dentro de Nutrición.

### 3.2 Gráfica de perímetros corporales

**Origen del dato:**
En cada check-in el cliente registra medidas corporales (pecho, hombro, etc.).

**Solución propuesta:**

- Construir una gráfica de evolución a partir de esas medidas.
- **UI con botones por zona corporal**: al clicar "pecho" se ve la evolución de pecho; al clicar "hombro" se ve la de hombro; etc.
- Una gráfica por contorno, navegable con esos botones.
- Aplica tanto en la **vista del cliente** como en la **vista del entrenador**.

### 3.3 Gráfica de progresión de carga: peso + repeticiones

**Problema actual:**
La gráfica de evolución del peso en un ejercicio solo refleja **peso**, no repeticiones. Esto da falsa sensación de estancamiento si el cliente sube reps al mismo peso.

**Solución propuesta:**

- Mantener el **eje X = fecha**.
- **Eje Y izquierdo = peso** (línea actual).
- Agregar **eje Y derecho = repeticiones** (línea adicional, posiblemente punteada o fragmentada para diferenciarla visualmente).
- La gráfica debe mostrar el **mejor registro** del ejercicio.

**Pendiente antes de implementar:**
Isaac mandará una **captura de pantalla** de otra aplicación como referencia. David esperará esa captura antes de cerrar el diseño.

---

## Bloque 4 — Quick win independiente

### 4.1 Múltiples videos de técnica por ejercicio

**Estado actual:**
El cliente ya puede subir **un** video por ejercicio (David lo verificó en vivo durante la llamada).

**Cambio pedido:**
Permitir subir **varios** videos por ejercicio.

**Caso de uso:**
El entrenador pide al cliente grabar la misma serie desde **distintos ángulos**:

- Una serie de perfil.
- Otra serie de espaldas.
- Una grabación que enfoque los pies.
- Otra que enfoque la cadera.

Esto permite revisar técnica desde múltiples planos en lugar de obligar al cliente a elegir un solo ángulo.

**Estimación David:** factible.

**Por qué va solo:** no comparte código con los otros bloques y es contenido. Se puede meter en cualquier momento, idealmente como respiro entre bloques grandes.

---

## Pendientes externos a estos bloques

Cosas habladas en la llamada que no son nuevos requerimientos pero conviene tenerlas a la vista:

- **Compresión de videos** — ya estaba pendiente del sprint anterior, no se llegó esta semana.
- **Customización de dashboards del entrenador** — fuera de scope por tiempo. Cuando se haga, vivirá dentro del Bloque 3 (pestaña "Progreso" reorganizada).
- **CRM** — Jose Carlos lo retoma después del viaje. No urgente; primero se atienden estos 4 bloques porque ya están afectando a usuarios reales.
- **Tickets de soporte** — David debe seguir priorizando especialmente los que limiten funcionalidad.
- **Política de canales de soporte** — Jose Carlos sigue redirigiendo a clientes que le escriben directo para que abran ticket; pide que no etiqueten a David en la comunidad para temas de soporte.

---

## Temas administrativos / facturación

Resueltos en la llamada (no son requerimientos de producto pero quedan registrados):

- **Supabase**: David tuvo que pagar el plan porque se llegó al límite de Storage para videos. Acción acordada: cambiar el método de pago al de Jose Carlos (David ya está como miembro pero pagó con su tarjeta).
- **Airtable**: $25/mes (un solo asiento, solo David). Se evaluó cambiar a HubSpot u otra herramienta — descartado por costo. Acción acordada: cambiar método de pago al de Jose Carlos. Plazo: la otra semana / dentro del mes.
- **Reembolso**: $45 (Supabase + Airtable adelantados por David) → se anexan a la próxima factura.
