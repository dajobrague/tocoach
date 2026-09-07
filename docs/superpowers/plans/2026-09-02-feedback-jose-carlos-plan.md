# Feedback Jose Carlos — Reunión 2026-09-02 · Plan de trabajo

> **Qué es este documento:** backlog priorizado y acotado a partir de la llamada con Jose Carlos (JC) y Adrián del 2 de septiembre de 2026. **NO es un plan de implementación task-by-task.** Cada fase genera su propio plan detallado (formato `superpowers:writing-plans`) cuando se arranque. Aquí se fija el QUÉ, el POR QUÉ y las decisiones pendientes.

**Prioridad declarada por JC:** *"Dale prioridad a lo que te decía de las gráficas, que eso sí que es algo más del día a día."*

**Estado del contexto:** JC confirmó en llamada que el toggle Media/Último (PR #33) ya está en producción y lo ve. También confirmó que los vídeos con nombre de ejercicio + fecha le están ahorrando "un ahorro de tiempo enorme" en revisiones. El rediseño (colores del tenant) está en curso y JC lo vio en vivo.

---

## Índice de fases

| Fase | Bloque | Prioridad | Bloqueada por |
|---|---|---|---|
| A | Gráficas — toggle, unidades, rango 14d | **P0** | ✅ implementada · `feat/charts-media-units-calendar` · pendiente test local |
| B | Gráficas — modo calendario de entrenamiento | **P0** | ✅ implementada · `feat/charts-media-units-calendar` · pendiente test local |
| C | Etiquetas — predictivo + desacoplar de carpetas + visibilidad | **P1** | C1 ✅ · **C2–C4 sustituidas** por `2026-09-07-library-tags-folders-split.md` (`feat/library-tags-folders-split`) |
| D | Etiquetas y carpetas en entrenamiento (plantillas + ejercicios) | **P1** | D1 ✅ · **D2–D3 sustituidas** por `2026-09-07-library-tags-folders-split.md` · 4 migraciones pendientes en prod |
| E | Sidebar: partir Programas en Entrenamiento / Nutrición | **P1** | ✅ implementada · `feat/nav-split-and-weight-access` · pendiente test local |
| F | Nutrición: acceso a evolución del peso | **P1** | ✅ implementada · `feat/nav-split-and-weight-access` · pendiente test local |
| G | Página de clientes (fichas + orden + limpiar estado) | **P2** | ⏸ se absorbe en el rediseño |
| H | Comunidad: subir programas de entrenamiento | **P3** | Aplazada por JC |

---

# FASE A — Gráficas: toggle, unidades y rango (P0)

Contexto: JC hizo una revisión real con un cliente el mismo día de la llamada y detectó estas fricciones. Es la superficie que más usa a diario.

### A1 · Invertir el orden del toggle

- `Media` a la **izquierda**, `Último` a la **derecha**.
- Razón de JC: *"va a ser la que más se va a utilizar... la última va a ser para consultas puntuales."*
- **Aceptación:** en vista entrenador y vista cliente, el primer segmento del toggle es Media.

### A2 · Default = Media

- Hoy el default es `Último`. Debe pasar a `Media` en **ambas** vistas (entrenador y cliente).
- **Aceptación:** un usuario sin preferencia guardada ve Media en todas las gráficas.

### A3 · Preferencia por gráfica, no global

- **Bug de UX reportado en vivo:** *"si modifico uno, se me modifican todos."* En la vista entrenador el toggle es global.
- Comportamiento pedido: todas arrancan en Media; si el usuario pone `Último` en una gráfica concreta, **solo cambia esa**.
- Afecta al hook de preferencia introducido en PR #33 (`useHeaderStatPref`), que hoy guarda una única clave global en localStorage. Pasa a clave por gráfica.
- **Aceptación:** cambiar el toggle de la gráfica X no altera la gráfica Y, ni en trainer ni en cliente; la preferencia por gráfica sobrevive a recarga.

### A4 · Unidades de medida en la gráfica

- Mostrar la unidad junto al valor: calorías → `kcal`, peso → `kg`, sueño → `horas`, etc.
- Caso especial: métricas de valoración 1–5 → representación con **estrellas o emoji** en lugar de número pelado. JC no cerró el formato exacto (*"un emoji o algo así con estrellas o algo parecido, no lo sé"*).
- **Bloqueado por decisión D1.**
- **Aceptación:** cada gráfica muestra su unidad; las métricas de escala 1–5 no muestran un número desnudo.

### A5 · Rango de 14 días

- Añadir `14 días` al selector de rango (queda 7 / 14 / 30 / …).
- Razón: *"es un plazo de tiempo con el que la mayoría de los alumnos hacen las revisiones."*
- **Aceptación:** el selector ofrece 14 días y la gráfica y el conteo respetan ese rango.

---

# FASE B — Gráfica de entrenamiento: modo calendario (P0)

Petición vieja de JC que seguía pendiente: *"la gráfica de entrenamientos, ¿habría manera de verla de otra manera?"* Hoy sólo hay anillo y apilados; ambos son personalizables por el trainer, así que esto entra como **un tipo de visualización más**, no como reemplazo.

### B1 · Nuevo tipo de visualización "calendario"

- Filas = semanas, con un punto por día.
- La densidad se adapta al rango elegido: a 7 días una fila; a 3 meses, filas *"muy pequeñitas... una semana con los puntitos."*
- **No** hace falta navegación mes a mes. JC lo descartó explícitamente cuando lo propuse: *"No, o que simplemente aparezcan las filas de las semanas."* Se rige sólo por el selector de rango (7/14/30).

### B2 · Codificación de días

Tres estados por día, con leyenda:
- **Fuerza** — día con entrenamiento de fuerza registrado.
- **Cardio** — día con cardio registrado.
- **Descanso** — día sin ningún registro.

### B3 · Conteo total bajo la gráfica

- Totales del rango seleccionado: nº de sesiones de fuerza, nº de cardio, nº de días de descanso.
- Opcional (JC lo mencionó como "puede ser interesante"): porcentaje de días.
- Razón de negocio, en sus palabras: *"al cliente le puedes hacer ver que aunque no haya tenido una semana demasiado buena, en el cómputo global..."*
- **Aceptación:** cambiar el rango recalcula los tres conteos.

**Nota de alcance:** un día puede tener fuerza y cardio a la vez. El plan de implementación debe definir cómo se pinta ese día (¿punto partido? ¿prioridad fuerza?) — no se habló en la llamada.

---

# FASE C — Etiquetas: predictivo, desacople de carpetas, visibilidad (P1)

### C1 · Input de etiquetas predictivo

- Al escribir, filtrar y sugerir etiquetas existentes que contengan el texto. Referencia explícita de JC: software de email marketing — *"tú pones 'lead YouTube' y en el momento en que pones 'lead' te sale ya todas las etiquetas que tienen la palabra 'lead'."*
- Si no hay coincidencia, ofrecer **`Crear etiqueta nueva`** como acción del propio dropdown.
- Aplica a los tres dominios: recetas, ejercicios y plantillas de entrenamiento (ver Fase D).
- **Trampa conocida:** `HeroUI Autocomplete` con `selectedKey` + items async entra en bucle infinito si el `inputValue` no está controlado. Ver memoria `feedback-heroui-autocomplete-controlled-loop`.

### C2 · Las etiquetas dejan de crear carpetas — **SUSTITUIDA (2026-09-07)** por `2026-09-07-library-tags-folders-split.md`: carpetas por `folder_id`, etiquetas en registro `library_tags`; una etiqueta nunca crea ni implica una carpeta.

- Comportamiento actual: crear una etiqueta genera automáticamente una carpeta con el mismo nombre → duplicados visibles en pantalla durante la llamada ("cenas" y "cenas").
- JC: *"Yo quizás esta opción la quitaría."*
- **Bloqueado por decisión D2** (qué hacer con las carpetas ya auto-creadas en producción).

### C3 · Filtrar por etiqueta dentro de la vista de carpeta — **SUSTITUIDA (2026-09-07)**: sigue vigente como comportamiento (carpeta AND etiquetas), implementado sobre `folder_id` en el plan del 7 de septiembre.

- Contrapartida obligatoria de C2. Estando dentro de "Desayunos", poder filtrar por "vegano" sin que "vegano" sea una carpeta.
- Caso de JC: *"si tú pones la etiqueta de 'vegano', a lo mejor te metes en 'desayunos' y quieres ver qué desayunos veganos tienes. Pero a lo mejor no te interesa tener una carpeta que sea 'vegano'."*
- **Aceptación:** el filtro por etiquetas está disponible dentro de la vista de carpeta y compone con ella (carpeta AND etiquetas).

### C4 · Etiquetas visibles en la tarjeta de receta — **SUSTITUIDA (2026-09-07)**: los chips de la tarjeta son siempre etiquetas (ya no se oculta la "etiqueta de carpeta" porque no existe); ver plan del 7 de septiembre.

- Mostrar las etiquetas bajo el título en la previsualización/tarjeta (ej. bajo "pan con tomate, huevo y jamón" → `vegano`, `sin gluten`, `sin lactosa`).
- Razón: *"de un golpe de vista, cuando se mete en la carpeta de 'almuerzos', puede ver perfectamente cuáles cumplen las condiciones que está buscando, sin necesidad de tener que acudir al filtro."*
- **Aceptación:** la tarjeta muestra las etiquetas sin romper el layout de la grilla (definir truncado / máximo visible en el plan de implementación).

---

# FASE D — Etiquetas y carpetas en entrenamiento (P1)

JC: *"Ahí te van a aplaudir, ya te lo adelanto."* Argumento: los entrenadores hoy organizan sus plantillas en Google Drive por carpetas y quieren replicarlo dentro de la app.

### D1 · Etiquetas en ejercicios

- El caso de uso más fuerte de todo el bloque. Etiquetas tipo `pectoral`, `mancuernas`, `barra`, `empuje`.
- Flujo objetivo, en sus palabras: *"un cliente que solo entrena en casa y tiene barra y mancuernas, quiero meterle algún ejercicio de pectoral, ¿cuál selecciono? → filtrar por."*
- **Carpetas NO** para ejercicios: *"Para los ejercicios no haría falta."* Sólo etiquetado + filtro.
- **Aceptación:** desde el selector de ejercicios de una sesión se puede filtrar la biblioteca por etiquetas combinadas (músculo + material).

### D2 · Etiquetas en plantillas de programas de entrenamiento — **SUSTITUIDA (2026-09-07)**: registro `library_tags` kind `program`, mismo `TagsField`/`TagManagerPanel` que recetas y ejercicios.

- Mismo sistema de etiquetas que recetas.

### D3 · Carpetas en plantillas de programas de entrenamiento — **SUSTITUIDA (2026-09-07)**: `program_folders` + `programs.folder_id`; el `FolderBrowser` compartido ya no depende de etiquetas.

- Mismo sistema de carpetas que recetas. Ejemplos que dio: `hombre`, `mujer`, `tres días`, `cuatro días`, `full body`, `torso`, `pierna`.
- JC reconoce el coste: *"sé que te puede llevar bastante tiempo, pero es que incluso usar el mismo sistema de carpetas para los programas de entrenamiento puede estar muy, muy bien."*
- **Depende de Fase C**: el sistema de carpetas de recetas debe estar ya desacoplado de las etiquetas antes de reutilizarlo aquí, o se propaga el bug de duplicados.

---

# FASE E — Sidebar: partir "Programas" (P1)

### E1 · Dos entradas en la barra lateral

- `Programas` desaparece como entrada única. Pasa a:
  - **Entrenamiento**
  - **Nutrición** (debajo)
- Razón: *"puede dar lugar a confusión. La gente cuando vea 'programas' enseguida piensa en 'programa de entrenamiento', pero no en 'programa nutricional'."*

### E2 · Encabezados internos

- El encabezado `Plantillas` dentro de la sección pasa a `Programas de entrenamiento`.
- Los sub-encabezados actuales *"pueden desaparecer"* — quedan redundantes una vez la navegación está partida.

**Rutas — resuelto sin romper nada:** `/trainer/dashboard/templates` sigue sirviendo entrenamiento (su default previo) y nutrición vive en la subruta nueva `/templates/nutrition`. Se descartó el query param porque `useActiveKey` resalta el item activo por prefijo de pathname más largo. Sin redirects.

### E3 · La entrada `Nutrición` debe apuntar a la biblioteca v2 — **hallazgo, no estaba en la llamada**

Al dar entrada permanente a Nutrición salió a la luz que hay **dos almacenes de plantillas nutricionales distintos**:

| | Fuente | Cómo se llega |
|---|---|---|
| **v1** | `nutrition_plans` con `is_template=true` → `/api/templates?type=nutrition` (`app/api/templates/route.ts:69`) | la entrada `Nutrición` del sidebar |
| **v2** | `/api/meal-cycle-templates` (`features/trainer/cycles/cycle-api.ts:325`) | solo desde "Desde plantilla" en el modal de crear plan |

El "Guardar plantilla" del plan de comidas (`cycle-summary-card.tsx:230`) — el que David demostró en la llamada — escribe en **v2**. Así que un trainer en v2 guarda su plantilla, pulsa `Nutrición` y no la encuentra. Estaba oculto mientras la sección vivía en un tab; la entrada nueva lo vuelve evidente.

**Decidido por David (2026-09-02):** la página muestra **v2 si el tenant está en nutrition v2, v1 en caso contrario**, reutilizando el flag que ya gatea la UI v2 (sin flag nuevo ni migración). Es un puente hasta que v1 muera por rollout — ver el proyecto del wizard v1→v2.

**Copy:** el H1 de nutrición es **"Planes nutricionales"** (vocabulario que David usa con el cliente), no "Programas nutricionales".

---

# FASE F — Nutrición: acceso a la evolución del peso (P1)

### F1 · Botón "Ver evolución del peso" en la cabecera del plan de comidas

- Ubicación pedida: junto a `Plan actual` / a la izquierda de `Ver calendario`.
- Problema actual: la gráfica de peso existe pero *"aparece ahí como muy pequeñito, como muy escondido."*
- Flujo objetivo: *"cuando te metas en el plan de comidas y digas 'venga, le voy a reajustar la nutrición', para que directamente ahí lo puedas ver rápidamente... 'Ah, vale, mira, el peso se ha estancado, vamos a subir, vamos a bajar'."*
- **Alcance acotado deliberadamente:** la gráfica de peso **no se vincula** con la calculadora calórica ni con las metas. Confirmado en llamada: es una ventana de consulta aparte. No inventar acoplamiento.
- **Aceptación:** un botón visible en la cabecera abre la evolución de peso del cliente sin salir de nutrición.

---

# FASE G — Página de clientes (P2)

Encaja con el rediseño ya en curso — esta página es la siguiente en la cola de rediseño, así que estos puntos se absorben ahí en vez de hacerse por separado.

### G1 · Quitar el estado "Onboarding pendiente"

- Confirmado en llamada que no se usa. JC: *"Lo puedes quitar, no se usa."*

### G2 · Vista de fichas

- Tarjetas tipo Airtable / como las recetas: rectángulo con foto arriba, nombre, check-in.
- Más pequeñas que las tarjetas de receta: *"a lo mejor un poco más pequeño."*

### G3 · Ordenación

- Poder ordenar por: `último check-in`, `vídeos pendientes`.

---

# FASE H — Comunidad: subir programas de entrenamiento (P3, aplazada)

**JC lo aplazó explícitamente:** *"Esto de todas maneras, David, lo dejamos más a largo plazo, si te parece. O sea, no es prioritario."* Y después: *"Una vez que tengas ya resuelto lo más prioritario, sí que sería muy conveniente hacerlo, porque va a ser un salto de calidad de la aplicación tremendo."*

No se arranca hasta cerrar A–F. Se documenta ahora sólo para no perder la decisión de diseño que sí se tomó en la llamada.

### H1 · Publicar rutinas/programas en la comunidad

- Igual que ya se hace con recetas.
- Valor: sensación de comunidad + ahorro de trabajo para trainers nuevos (*"ya tengo aquí de mis compañeros el trabajo hecho, tengo recetas, tengo programas"*).

### H2 · Resolver la duplicidad de ejercicios al importar — **decisión ya tomada**

Problema detectado en la llamada: si al publicar un programa se publican también sus ejercicios, se generan duplicados en la biblioteca de quien lo importa.

Dirección acordada (propuesta de Adrián, refinada y aceptada por JC):
- La rutina se importa **como estructura**.
- Cada ejercicio llega como **texto de sugerencia / etiqueta con el nombre original**, NO como registro insertado en la biblioteca del importador.
- El trainer mapea cada sugerencia a un ejercicio de **su propia** base de datos.
- JC: *"que no sea como un elemento que está guardado en tu base de datos, sino que aparezca como una especie de texto de sugerencia o algo similar, pero que no se te incorpore a tu base de datos."*

---

# ⚠️ HALLAZGO FUERA DE ALCANCE — 2026-09-07 — bloquea por prioridad, no por dependencia

Al implementar D3 salió a la luz que **el aislamiento entre tenants NO está en RLS**, al contrario de lo que afirma `CLAUDE.md`: todas las políticas son `USING (true)`, el rol `anon` tiene DML completo, y la anon key viaja al navegador. Detalle, evidencia y opciones en `docs/development/jc-feedback-review-2026-09-02.md` y en la memoria `project-rls-is-not-enforced`. **Decisión pendiente de David.** Recomendación: cerrar la puerta externa (revocar `anon`, servidor a service role) antes de seguir con el backlog de JC.

# Decisiones — CERRADAS 2026-09-02 por David

### D1 · Unidad de cada métrica — **RESUELTA: mapa fijo por tipo**

**Decidido:** hardcodear la unidad por tipo de métrica conocida (peso→kg, calorías→kcal, sueño→horas). Cero migración, cero UI nueva. Las métricas custom del trainer se quedan sin unidad. **Escala 1–5 → estrellas** (★★★☆☆), no número pelado.

<details><summary>Opciones descartadas</summary>


Hoy no hay (o no está confirmado que haya) un campo de unidad por métrica en la configuración. Opciones:
- (a) Campo `unit` por métrica en la config del trainer → requiere migración + UI de edición.
- (b) Mapa fijo por tipo de métrica conocida (peso/kcal/sueño/…) → cero migración, no cubre métricas custom.
- (c) Inferir de la pregunta del formulario que alimenta la métrica.

Además falta cerrar el **formato de las métricas 1–5** (estrellas vs emoji). JC no lo decidió.

</details>

### D2 · Carpetas auto-creadas en producción — **RESUELTA: dejarlas**

**Decidido:** no se escribe ninguna migración ni se borran datos de trainers reales. Las carpetas huérfanas se quedan; el trainer borra a mano las que no quiera. Único requisito: que se puedan borrar desde la UI.

<details><summary>Opciones descartadas</summary>


Al dejar de auto-crear carpetas desde etiquetas, quedan en producción carpetas huérfanas (el caso "cenas"/"cenas" visible en la llamada). Opciones:
- (a) Dejarlas — el trainer las borra a mano si quiere.
- (b) Fusionar carpeta+etiqueta homónimas y borrar la carpeta.
- (c) Migración que borre sólo las carpetas vacías cuyo nombre coincide con una etiqueta.

No se habló en la llamada; es decisión nuestra y tiene impacto en datos de trainers reales.

</details>

### D3 · Día con fuerza **y** cardio — **RESUELTA: punto partido**

**Decidido:** medio punto de cada color, y el día cuenta en AMBOS totales. Consecuencia aceptada: la suma de los tres conteos puede superar el número de días del rango. Es esperado, no es un bug.

<details><summary>Nota original</summary>


No se habló en la llamada. Definir si se pinta partido, si fuerza tiene prioridad, o si se cuenta en ambos conteos.
</details>

---

# Fuera de alcance de desarrollo

- **Cristian García (vía Adrián):** no necesita cuenta nueva ni migrar biblioteca de ejercicios. Cambia su enlace él mismo en `Configuración → Marca → Dominio`. Ya respondido en la llamada; sólo queda confirmar que lo hizo.
- **Capturas para redes:** JC pidió pantallazos en vivo durante la llamada para sus stories. Resuelto en el momento.
- **Toggle Media/Último:** JC creía que no estaba publicado; lo verificó en vivo y sí está. Sin acción.

---

# Registro de la llamada

**Fecha:** 2026-09-02 · **Asistentes:** Jose Carlos de Francisco, Adrián, David Bracho.

Feedback positivo recogido (contexto, no accionable):
- Vídeos con nombre de ejercicio + fecha del entrenamiento: *"el ahorro de tiempo que me está suponiendo es enorme."*
- Carpetas de recetas: *"me parece brutal, me encanta."*
- Lista de la compra en la app del cliente: *"chulísimo."*
- Duplicar sesiones de entrenamiento (ya entregado en rondas anteriores): citado como ejemplo de mejora operativa real.
