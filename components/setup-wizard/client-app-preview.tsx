"use client";

// Vista previa del asistente de alta: una réplica estática de la app que
// verán los clientes del entrenador (mismo lenguaje visual que
// components/client-dashboard), pintada con la marca que está eligiendo. Las
// tres pestañas de la barra inferior enseñan las tres cosas que hace la app:
// seguimiento, entreno y nutrición. Solo datos de ejemplo; no carga nada.

import { Icon } from "@iconify/react";
import React from "react";

import { PreviewThemeProvider } from "./preview-theme-provider";

import { useSetupWizard } from "@/lib/setup-wizard/context";

const SCREENS = [
  {
    key: "inicio",
    label: "Inicio",
    icon: "solar:home-2-linear",
    caption: "Check-ins, registro diario y progreso de cada cliente.",
  },
  {
    key: "entrenar",
    label: "Entrenar",
    icon: "solar:dumbbell-linear",
    caption: "Tus sesiones con vídeo, series y músculos trabajados.",
  },
  {
    key: "nutricion",
    label: "Nutrición",
    icon: "fluent:food-20-regular",
    caption: "Objetivos del día y comidas con alternativas.",
  },
] as const;

type ScreenKey = (typeof SCREENS)[number]["key"];

const card = "rounded-large bg-content1 shadow-small";

function Inicio() {
  return (
    <div className="space-y-5 px-4 pb-4">
      <div>
        <p className="text-[13px] text-default-500">Martes, 10 nov</p>
        <h2 className="font-heading text-[26px] leading-tight text-foreground">
          Hola, Laura
        </h2>
      </div>

      <div className="flex items-center gap-3 rounded-large bg-primary p-3.5 text-primary-foreground">
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap text-[14px] font-semibold">
            Completa tu check-in
          </p>
          <p className="text-[12px] opacity-85">Abierto hasta el jueves</p>
        </div>
        <span className="rounded-full bg-primary-foreground px-3 py-1.5 text-[12px] font-semibold text-primary">
          Empezar
        </span>
      </div>

      <div>
        <h3 className="mb-2 font-heading text-[17px] text-foreground">
          Registro diario
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Hoy", "Pendiente", false],
            ["Ayer", "Enviado", true],
            ["Domingo", "Enviado", true],
          ].map(([day, status, done]) => (
            <div
              key={String(day)}
              className={`${card} flex flex-col items-center gap-1.5 p-3`}
            >
              <p className="text-[13px] font-semibold text-foreground">{day}</p>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  done
                    ? "bg-success text-success-foreground"
                    : "border-[1.5px] border-dashed border-primary text-primary"
                }`}
              >
                <Icon
                  aria-hidden
                  icon={done ? "solar:check-read-linear" : "solar:pen-linear"}
                  width={16}
                />
              </span>
              <p className="text-[11px] text-default-500">{status}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-heading text-[17px] text-foreground">
          Progreso
        </h3>
        <div className={`${card} divide-y divide-default-100`}>
          {[
            ["Peso", "74,0 kg", "−1,0 kg"],
            ["Sueño", "7,5 h", "media 7 días"],
            ["Pasos", "9.240", "media 7 días"],
          ].map(([name, value, note]) => (
            <div key={name} className="flex items-center gap-3 px-3.5 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-medium bg-primary/15 text-primary">
                <Icon aria-hidden icon="solar:chart-2-linear" width={16} />
              </span>
              <p className="flex-1 text-[14px] font-medium text-foreground">
                {name}
              </p>
              <div className="text-right">
                <p className="text-[14px] font-semibold tabular-nums text-foreground">
                  {value}
                </p>
                <p className="text-[11px] text-default-500">{note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Entrenar() {
  const exercises = [
    ["Press de banca", "4 × 8 · 2 min descanso", "done"],
    ["Press inclinado con mancuernas", "3 × 10 · 90 s descanso", "done"],
    ["Fondos en paralelas", "3 × 12 · 90 s descanso", "todo"],
    ["Elevaciones laterales", "3 × 15 · 60 s descanso", "todo"],
  ] as const;

  return (
    <div className="space-y-5 px-4 pb-4">
      <div className={`${card} space-y-3.5 p-4`}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-medium bg-primary/15 text-primary">
            <Icon aria-hidden icon="solar:dumbbell-linear" width={22} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-default-500">
              Fuerza · 4 ejercicios
            </p>
            <h2 className="font-heading text-[22px] leading-tight text-foreground">
              Tren superior
            </h2>
          </div>
        </div>
        <div className="rounded-medium bg-default-100 px-3 py-2">
          <p className="text-[13px] font-semibold text-foreground">
            Músculos de hoy
          </p>
          <p className="text-[12px] text-default-500">
            Pectoral, tríceps, deltoides
          </p>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-[13px] font-semibold">
            <span className="text-foreground">2 de 4 hechos</span>
            <span className="text-default-500">50%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-default-200">
            <div className="h-full w-1/2 rounded-full bg-primary" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-heading text-[17px] text-foreground">
          Ejercicios
        </h3>
        <ul className={`${card} divide-y divide-default-100`}>
          {exercises.map(([name, stats, status]) => (
            <li key={name} className="flex items-center gap-3 px-3.5 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-default-100 text-default-400">
                <Icon aria-hidden icon="solar:play-circle-linear" width={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-foreground">
                  {name}
                </p>
                <p className="text-[12px] text-default-500">{stats}</p>
              </div>
              <Icon
                aria-hidden
                className={
                  status === "done" ? "text-success" : "text-default-300"
                }
                icon={
                  status === "done"
                    ? "solar:check-circle-bold"
                    : "mdi:circle-outline"
                }
                width={22}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Nutricion() {
  const macros = [
    ["Proteína", "120 / 150 g", "80%"],
    ["Carbohidratos", "160 / 220 g", "73%"],
    ["Grasas", "48 / 65 g", "74%"],
  ] as const;
  const meals = [
    ["Desayuno", "Avena con fruta y yogur", "420 kcal"],
    ["Comida", "Pollo, arroz y verduras", "640 kcal"],
    ["Cena", "Salmón con patata asada", "560 kcal"],
  ] as const;

  return (
    <div className="space-y-5 px-4 pb-4">
      <div>
        <p className="text-[13px] text-default-500">Hoy</p>
        <h2 className="font-heading text-[26px] leading-tight text-foreground">
          Nutrición
        </h2>
      </div>

      <div className={`${card} space-y-3 p-4`}>
        <div className="flex items-baseline justify-between">
          <p className="font-heading text-[24px] tabular-nums text-foreground">
            1.620
          </p>
          <p className="text-[13px] text-default-500">de 2.100 kcal</p>
        </div>
        {macros.map(([name, value, width]) => (
          <div key={name}>
            <div className="flex justify-between text-[12px]">
              <span className="font-medium text-foreground">{name}</span>
              <span className="tabular-nums text-default-500">{value}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-default-200">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width }}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-2 font-heading text-[17px] text-foreground">
          Comidas
        </h3>
        <ul className={`${card} divide-y divide-default-100`}>
          {meals.map(([slot, dish, kcal]) => (
            <li key={slot} className="flex items-center gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-primary">{slot}</p>
                <p className="truncate text-[14px] font-semibold text-foreground">
                  {dish}
                </p>
              </div>
              <p className="text-[12px] tabular-nums text-default-500">
                {kcal}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ClientAppPreview() {
  const { state } = useSetupWizard();
  const [screen, setScreen] = React.useState<ScreenKey>("inicio");
  const current = SCREENS.find((s) => s.key === screen) ?? SCREENS[0];

  return (
    <div className="flex h-full flex-col items-center gap-4 overflow-y-auto bg-gray-100 px-4 py-6">
      {/* Marco de teléfono: 320 px de ancho, como un móvil pequeño. */}
      <div className="w-[320px] shrink-0 overflow-hidden rounded-[36px] border-[10px] border-gray-900 bg-gray-900 shadow-xl">
        <PreviewThemeProvider state={state}>
          <div className="font-body flex h-[600px] flex-col bg-background">
            <div className="flex h-14 shrink-0 items-center justify-between px-4">
              {state.logo?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={state.logo.text || "Logo"}
                  className="h-9 w-auto max-w-[140px] object-contain"
                  src={state.logo.url}
                />
              ) : (
                <span className="font-heading text-[17px] text-foreground">
                  {state.logo?.text || "Tu marca"}
                </span>
              )}
              <div className="flex gap-3 text-foreground">
                <Icon
                  aria-hidden
                  icon="solar:chat-round-dots-linear"
                  width={22}
                />
                <Icon aria-hidden icon="solar:bell-linear" width={22} />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-1">
              {screen === "inicio" ? <Inicio /> : null}
              {screen === "entrenar" ? <Entrenar /> : null}
              {screen === "nutricion" ? <Nutricion /> : null}
            </div>

            <div
              aria-label="Pantallas de la vista previa"
              className="mx-3 mb-3 flex shrink-0 rounded-full bg-content1 p-1.5 shadow-medium"
              role="tablist"
            >
              {SCREENS.map((s) => {
                const active = s.key === screen;

                return (
                  <button
                    key={s.key}
                    aria-selected={active}
                    className={`flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium transition-colors ${
                      active ? "bg-primary/15 text-primary" : "text-default-500"
                    }`}
                    role="tab"
                    type="button"
                    onClick={() => setScreen(s.key)}
                  >
                    <Icon aria-hidden icon={s.icon} width={20} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </PreviewThemeProvider>
      </div>

      <p className="max-w-[320px] text-center text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{current.label}.</span>{" "}
        {current.caption}
      </p>
    </div>
  );
}
