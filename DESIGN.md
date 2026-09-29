# DESIGN.md — Portal de cliente (`app/[slug]/*`)

Sistema visual del portal que usan los clientes de cada entrenador. El
trainer app (`/trainer`) tiene su propio marco neutro y no se rige por este
documento salvo en las reglas de color.

## Principio

La app es del entrenador, no nuestra. Su marca saluda una vez, con fuerza,
en Inicio; en el resto se retira a un marco discreto y solo marca **acciones**
y **"hoy"**. Todo debe verse correcto con ~44 paletas arbitrarias (claras,
oscuras, pálidas, legacy rotas).

## Color

El tema llega por `lib/theme/render-css.ts` como variables HeroUI. Nunca
se escriben colores literales en el portal.

| Rol          | Token                                               | Uso                                                                                                             |
| ------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Lienzo       | `bg-background`                                     | Fondo de página                                                                                                 |
| Superficie   | `bg-content1`                                       | Cards, sheets                                                                                                   |
| Neutros      | `default-100…900`                                   | Rellenos sutiles, bordes (`default-200`), texto secundario (`default-500/600`), terciario (`default-400`, ≥3:1) |
| Texto        | `text-foreground`                                   | Texto principal                                                                                                 |
| Marca sólida | `bg-primary` + `text-primary-foreground`            | Banda de Inicio, botones primarios, marcador de hoy                                                             |
| Marca tinta  | `bg-primary/10` + `text-primary`                    | Seleccionado, icon tiles, chips de estado de marca                                                              |
| Estado       | `success` / `warning` / `danger` + su `-foreground` | Solo chips y avisos pequeños; nunca superficies grandes ni CTAs                                                 |

Garantías del pipeline (no reimplementar en componentes):

- **Escala neutra con contraste garantizado** (`lib/theme/client-surface.ts`):
  los valores del entrenador ganan si son legibles; si no, se derivan.
- **Foreground calculado** sobre marca y estados (`pickForegroundHSL`).
  Nunca `text-white` sobre una superficie de color: usar `*-foreground`.
- **Tinta de marca**: si la marca no llega a 4.5:1 sobre el lienzo,
  `.text-primary` usa una versión oscurecida/aclarada; `bg-primary` sigue
  siendo la marca exacta.
- Sin overrides por substring: `bg-primary/10`, hovers y variants
  `light`/`flat` de HeroUI funcionan como en la documentación de HeroUI.

Excepción legítima de `text-white`: texto sobre foto/vídeo con velo
`bg-black/…`.

## Tipografía

- Cuerpo: fuente de cuerpo del entrenador, aplicada al `body` (no forzar
  `font-body` salvo para cambiar de familia; ya no fuerza peso).
- Títulos: `font-heading` (familia y peso del entrenador).
- Escala: página `text-lg` (barra) / `text-3xl` (saludo de Inicio);
  sección `text-lg font-heading`; cuerpo `text-sm`/`text-base`; meta
  `text-xs`. Nada por debajo de 11px para texto que haya que leer.
- Sentence case siempre. Sin etiquetas en MAYÚSCULAS con tracking.

## Marco (`components/client-dashboard/client-page.tsx`)

Toda pestaña se envuelve en `ClientPage`:

```tsx
<ClientPage title="Nutrición">…</ClientPage>   // barra compacta fija
<ClientPage>…</ClientPage>                      // solo Inicio: banda de marca
```

- `ClientPage` fija ancho (`max-w-lg`), fondo y hueco inferior (`pb-28`)
  para la barra de navegación flotante. Las páginas no eligen los suyos.
- Contenido: `px-4`, `pt-4` bajo la barra, `space-y-4`/`space-y-6` entre
  bloques.
- La cabecera (`ClientHeader`) lee sus datos de `useClientData()`; las
  páginas solo pasan `title`.
- Barra de Inicio: misma barra de una fila (`h-16`), rellena con
  `bg-primary`; logo sobre chip `bg-content1` (el logo nunca va directo
  sobre la marca), "Hola, {nombre}" + fecha corta al lado, chat y campana
  en `primary-foreground`. Sin banda alta: la marca saluda sin robar
  pantalla.
- Barra del resto: logo, título de la pestaña, chat y campana; `sticky`, borde
  inferior `default-200`, respeta `safe-area-inset-top`.
- Carga: `ClientPageSkeleton` (misma anatomía que el marco).

## Componentes

- **Card**: elevación suave. HeroUI `Card` con `shadow="sm"` (sombra e1
  del entrenador), sin borde, radio `large` del tema. Sin cards anidadas.
- **SectionHeader** (`client-page.tsx`): título de sección + acción
  opcional a la derecha.
- **IconTile** (`components/shared/icon-tile.tsx`): `bg-primary/10
text-primary`. Sin paletas arcoíris por categoría.
- **Chips**: `OutlineChip` (`components/shared/`), un tono por estado.
- **Botones**: HeroUI `Button`. Primario `color="primary"` (una acción
  primaria por vista); secundario `variant="flat"`; terciario
  `variant="light"`. Sin `className` que pise el color.
- **Iconos**: Solar (`solar:*-linear` por defecto, `-bold` para estado
  activo). Sin mezclar sets.

## Pendiente (fases siguientes)

- Fase 2: aplicar Card/SectionHeader/IconTile página a página; hoja
  inferior (bottom sheet) única para overlays; borrar `/mas`,
  `/plan-de-comidas` y modales muertos.
- Fase 3: registro de series y cierre de sesión.
- Fase 4: semántica de color (gráficas, tipos de sesión, macros).
- Fase 5: accesibilidad (zoom, focus), iconos del nav, retirar nutrición v1.
