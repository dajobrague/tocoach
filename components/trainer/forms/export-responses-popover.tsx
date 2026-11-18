"use client";

// "Descargar respuestas": botón secundario con un panel anclado (rango de
// fechas + descarga). Vive en la cabecera de cada formulario (todos los
// clientes) y en Respuestas del perfil (solo ese cliente).

import type { FormType } from "@/lib/forms/types";

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Radio,
  RadioGroup,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

type Range = "all" | "30" | "90" | "custom";

const ymd = (d: Date) => d.toLocaleDateString("sv-SE");

function daysAgo(days: number): string {
  const d = new Date();

  d.setDate(d.getDate() - days);

  return ymd(d);
}

const DATE_INPUT =
  "h-9 w-full rounded-medium border border-default-200 bg-white px-2.5 text-sm text-foreground";

export function ExportResponsesPopover({
  formType,
  clientId,
}: {
  formType: FormType;
  /** Solo las respuestas de este cliente. */
  clientId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams({ form_type: formType });

  if (clientId) params.set("client_id", clientId);
  if (range === "30" || range === "90") {
    params.set("from", daysAgo(Number(range)));
  } else if (range === "custom") {
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  }
  const invalid =
    range === "custom" && ((!from && !to) || (!!from && !!to && from > to));

  return (
    <Popover
      isOpen={open}
      offset={8}
      placement="bottom-end"
      onOpenChange={setOpen}
    >
      <PopoverTrigger>
        <Button
          size={clientId ? "sm" : "md"}
          startContent={
            <Icon icon="solar:download-minimalistic-linear" width={18} />
          }
          variant="bordered"
        >
          {clientId ? "Descargar" : "Descargar respuestas"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex w-full flex-col gap-4 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Descargar respuestas
            </p>
            <p className="mt-0.5 text-xs leading-snug text-default-500">
              {clientId
                ? "De este cliente, en un archivo CSV que abre Excel o Google Sheets."
                : "De todos tus clientes, en un archivo CSV que abre Excel o Google Sheets."}
            </p>
          </div>

          <RadioGroup
            aria-label="Qué respuestas"
            size="sm"
            value={range}
            onValueChange={(v) => setRange(v as Range)}
          >
            <Radio value="all">Todas</Radio>
            <Radio value="30">Últimos 30 días</Radio>
            <Radio value="90">Últimos 3 meses</Radio>
            <Radio value="custom">Elegir fechas…</Radio>
          </RadioGroup>

          {range === "custom" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-default-500">
                Desde
                <input
                  className={DATE_INPUT}
                  max={to || undefined}
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-default-500">
                Hasta
                <input
                  className={DATE_INPUT}
                  min={from || undefined}
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
          ) : null}

          <Button
            className="bg-gray-900 font-semibold text-white"
            isDisabled={invalid}
            startContent={
              <Icon icon="solar:download-minimalistic-linear" width={18} />
            }
            onPress={() => {
              // attachment: el navegador descarga sin salir de la página.
              window.location.assign(`/api/forms/export?${params.toString()}`);
              setOpen(false);
            }}
          >
            Descargar CSV
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
