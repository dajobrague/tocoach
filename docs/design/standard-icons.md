# Iconos Estándar de la Aplicación

Este documento define los iconos estándar que deben usarse en toda la aplicación para mantener consistencia visual.

## Iconos de Métricas de Salud

Estos iconos se usan en el dashboard del cliente y en cualquier lugar donde se muestren métricas de salud.

### Peso Corporal
- **Icono**: `solar:body-bold`
- **Color**: `warning` (amarillo/naranja)
- **Uso**: Gráficas de peso, seguimiento corporal
- **Ejemplo**: 
  ```tsx
  <Icon icon="solar:body-bold" className="text-warning" />
  ```

### Agua / Hidratación
- **Icono**: `solar:bottle-bold`
- **Color**: `primary` con fondo sólido (icono en blanco)
- **Uso**: Contador de agua, hidratación
- **Ejemplo**: 
  ```tsx
  <div className="bg-primary p-1.5 rounded-full">
    <Icon icon="solar:bottle-bold" className="text-white" />
  </div>
  ```

### Sueño
- **Icono**: `solar:moon-sleep-bold`
- **Color**: `secondary` (color secundario del tema)
- **Uso**: Horas de sueño, descanso
- **Ejemplo**: 
  ```tsx
  <Icon icon="solar:moon-sleep-bold" className="text-secondary" />
  ```

### Calorías
- **Icono**: `solar:fire-bold`
- **Color**: `danger` (rojo)
- **Uso**: Consumo calórico, gasto energético
- **Ejemplo**: 
  ```tsx
  <Icon icon="solar:fire-bold" className="text-danger" />
  ```

### Pasos / Actividad
- **Icono**: `solar:walking-bold`
- **Color**: `success` (verde)
- **Uso**: Contador de pasos, actividad física
- **Ejemplo**: 
  ```tsx
  <Icon icon="solar:walking-bold" className="text-success" />
  ```

## Iconos de Navegación

### Inicio / Dashboard
- **Icono**: `solar:home-2-bold`
- **Uso**: Navegación al dashboard principal

### Ejercicio / Entrenamiento
- **Icono**: `solar:dumbbell-bold`
- **Uso**: Sección de ejercicios, programas de entrenamiento

### Nutrición
- **Icono**: `solar:apple-bold`
- **Uso**: Sección de nutrición, planes alimenticios

### Calendario
- **Icono**: `solar:calendar-bold`
- **Uso**: Vista de calendario, agenda

### Más / Menú
- **Icono**: `solar:menu-dots-bold`
- **Uso**: Menú adicional, opciones

## Iconos de Acciones

### Reproducir Video
- **Icono**: `solar:play-circle-bold`
- **Uso**: Botones de reproducción de videos de ejercicios

### Check-in / Completado
- **Icono**: `solar:check-circle-bold`
- **Uso**: Tareas completadas, check-ins

### Agregar / Incrementar
- **Icono**: `solar:add-circle-bold`
- **Uso**: Botones de agregar, incrementar valores

### Disminuir
- **Icono**: `solar:minus-circle-bold`
- **Uso**: Botones de disminuir valores

### Notificaciones
- **Icono**: `solar:bell-bold`
- **Uso**: Icono de notificaciones

### Mensajes
- **Icono**: `solar:chat-round-dots-bold`
- **Uso**: Mensajes, chat

### Flechas de Navegación
- **Icono**: `solar:alt-arrow-right-bold`, `solar:alt-arrow-left-bold`, `solar:alt-arrow-up-linear`, `solar:alt-arrow-down-linear`
- **Uso**: Navegación, expandir/contraer

## Iconos de Estado

### En Progreso
- **Icono**: `solar:clock-circle-bold`
- **Uso**: Actividades en progreso

### Racha / Streak
- **Icono**: `solar:fire-bold`
- **Color**: `warning`
- **Uso**: Indicador de racha de días consecutivos

## Convenciones de Uso

### Tamaños
- **Small**: `text-sm` o `width={16}`
- **Base**: `text-base` o `width={20}`
- **Large**: `text-lg` o `width={24}`
- **XL**: `text-xl` o `width={28}`
- **2XL**: `text-2xl` o `width={32}`
- **3XL**: `text-3xl` o `width={36}`

### Colores con Fondo
Cuando se usa un icono con fondo circular:
```tsx
<div className="bg-primary/10 p-1.5 rounded-full">
  <Icon icon="solar:drop-bold" className="text-primary text-base" />
</div>
```

### Consistencia de Colores
**IMPORTANTE**: Los colores de las gráficas deben coincidir con los colores de los iconos:
- Peso: `bg-warning` coincide con icono `text-warning`
- Agua: `bg-primary` coincide con icono `text-primary`
- Sueño: `bg-secondary` coincide con icono `text-secondary`
- Calorías: `bg-danger` coincide con icono `text-danger`
- Pasos: `bg-success` coincide con icono `text-success`

## Librería de Iconos

Todos los iconos provienen de la colección **Solar Icons** disponibles a través de Iconify:
- Paquete: `@iconify/react`
- Set de iconos: Solar (Bold style)
- Documentación: https://icon-sets.iconify.design/solar/

## Agregar Nuevos Iconos

Cuando necesites agregar un nuevo icono estándar:
1. Busca en la colección Solar Icons (bold style)
2. Asigna un color semántico apropiado
3. Documenta su uso en este archivo
4. Usa el icono consistentemente en toda la app

