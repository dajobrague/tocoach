"use client";

import type { ChoiceOption } from "@/lib/forms/types";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Piezas visuales del formulario del cliente (check-in / registro diario).
 * Solo presentación: el estado, la validación y la subida viven en
 * DynamicFormModal.
 */

const PRESS =
  "transition-[transform,background-color,box-shadow,color] duration-150 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";

/** Estado seleccionado tranquilo: tinte de marca + borde interior, sin
 *  rellenos verde/rojo ni bloques de color de marca. */
const tileClass = (selected: boolean) =>
  `${PRESS} rounded-xl disabled:cursor-default ${
    selected
      ? "bg-primary/10 text-primary shadow-[inset_0_0_0_2px_hsl(var(--heroui-primary))]"
      : "bg-default-100 text-foreground [@media(hover:hover)]:hover:bg-default-200"
  }`;

/** Marca de las inputs que recorre Enter (ver onKeyDown del modal). */
export const FIELD_ATTR = "data-form-field";

export function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] tabular-nums text-default-500">{children}</p>
  );
}

export function FieldError({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {messages.map((m) => (
        <p
          key={m}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-danger"
        >
          <Icon
            className="shrink-0"
            icon="solar:danger-triangle-linear"
            width={16}
          />
          {m}
        </p>
      ))}
    </div>
  );
}

// ── Rating ──────────────────────────────────────────────────────────
// Misma estrella que chart-card (`solar:star-bold`, warning = llena,
// default-300 = vacía): las gráficas copian este look.
export function RatingInput({
  compact = false,
  disabled,
  label,
  showHint,
  value,
  onChange,
}: {
  compact?: boolean;
  disabled: boolean;
  label: string;
  showHint: boolean;
  value: unknown;
  onChange: (v: number) => void;
}) {
  const current = typeof value === "number" ? value : 0;

  return (
    <div className="space-y-1">
      <div aria-label={label} className="-ml-1.5 flex gap-1" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-checked={current === n}
            aria-label={`${n} de 5`}
            className={`grid place-items-center rounded-xl ${PRESS} disabled:cursor-default ${
              compact ? "h-11 w-11" : "h-[52px] w-[52px]"
            }`}
            disabled={disabled}
            role="radio"
            type="button"
            onClick={() => onChange(n)}
          >
            <Icon
              className={`transition-colors ${
                current >= n ? "text-warning" : "text-default-300"
              }`}
              icon="solar:star-bold"
              width={compact ? 30 : 38}
            />
          </button>
        ))}
      </div>
      {(showHint || current > 0) && (
        <FieldHint>
          {current > 0 ? `${current} de 5 estrellas` : "Califica del 1 al 5"}
        </FieldHint>
      )}
    </div>
  );
}

// ── Number ──────────────────────────────────────────────────────────
// Input de texto con teclado numérico (inputMode) en vez de type="number":
// acepta coma decimal ("61,8") y guarda un número, que es lo que exige la
// validación del server. Lo escrito se mantiene en un buffer local para que
// "61," no se convierta en "61" a mitad de escribir.
const parseNumber = (text: string): number | string => {
  const t = text.trim().replace(",", ".");

  if (t === "") return "";
  const n = Number(t);

  return Number.isFinite(n) ? n : text;
};

const toText = (v: unknown) =>
  typeof v === "number" ? String(v) : typeof v === "string" ? v : "";

function useNumberText(value: unknown, onChange: (v: number | string) => void) {
  const [text, setText] = useState(() => toText(value));
  const emitted = useRef<unknown>(value);

  // Re-sincroniza cuando el valor cambia desde fuera (borrador restaurado,
  // respuesta del server cargada después de montar).
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setText(toText(value));
    }
  }, [value]);

  return [
    text,
    (t: string) => {
      const v = parseNumber(t);

      setText(t);
      emitted.current = v;
      onChange(v);
    },
  ] as const;
}

type NumberProps = {
  integer: boolean;
  invalid: boolean;
  label: string;
  readOnly: boolean;
  unit: string | undefined;
  /** Rango configurado por el entrenador (se valida al avanzar/enviar). */
  min?: number | undefined;
  max?: number | undefined;
  value: unknown;
  onChange: (v: number | string) => void;
};

function rangeHint(min: number | undefined, max: number | undefined) {
  if (min !== undefined && max !== undefined) return `entre ${min} y ${max}`;
  if (min !== undefined) return `de ${min} o más`;
  if (max !== undefined) return `de ${max} o menos`;

  return null;
}

const numberInputProps = (p: NumberProps) => ({
  [FIELD_ATTR]: "",
  "aria-invalid": p.invalid || undefined,
  "aria-label": p.unit ? `${p.label}, en ${p.unit}` : p.label,
  autoComplete: "off",
  enterKeyHint: "next" as const,
  inputMode: p.integer ? ("numeric" as const) : ("decimal" as const),
  readOnly: p.readOnly,
  type: "text",
});

export function BigNumberInput(p: NumberProps) {
  const [text, setText] = useNumberText(p.value, p.onChange);

  return (
    <div className="space-y-1.5">
      <label
        className={`flex h-[68px] cursor-text items-center gap-2 rounded-xl bg-default-100 px-[18px] transition-shadow focus-within:shadow-[0_0_0_2px_hsl(var(--heroui-primary))] ${
          p.invalid ? "shadow-[0_0_0_2px_hsl(var(--heroui-danger))]" : ""
        }`}
      >
        <input
          {...numberInputProps(p)}
          className="h-full min-w-0 flex-1 bg-transparent p-0 font-heading text-[34px] font-bold tabular-nums tracking-tight text-foreground caret-primary outline-none placeholder:font-body placeholder:text-[17px] placeholder:font-normal placeholder:tracking-normal placeholder:text-default-400"
          placeholder="Ingresa el valor"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {p.unit && (
          <span className="pt-2 text-[17px] font-semibold text-default-500">
            {p.unit}
          </span>
        )}
      </label>
      {!p.readOnly && (
        <FieldHint>
          {rangeHint(p.min, p.max)
            ? `Ingresa un valor ${rangeHint(p.min, p.max)}`
            : `Ingresa el valor${p.unit ? ` en ${p.unit}` : ""}`}
        </FieldHint>
      )}
    </div>
  );
}

/** Fila compacta para números dentro de un grupo ("Medidas"). */
export function NumberRow(
  p: NumberProps & { required: boolean; sublabel?: string | undefined }
) {
  const [text, setText] = useNumberText(p.value, p.onChange);

  return (
    <label className="flex min-h-[52px] cursor-text items-center gap-2 px-4 focus-within:bg-default-200/60">
      <span className="min-w-0 flex-1 py-2">
        <span
          className={`block text-base ${p.invalid ? "text-danger" : "text-foreground"}`}
        >
          {p.label}
          {p.required && !p.readOnly && <span className="text-danger"> *</span>}
        </span>
        {p.sublabel && (
          <span className="block text-[13px] text-default-500">
            {p.sublabel}
          </span>
        )}
      </span>
      <input
        {...numberInputProps(p)}
        className="h-11 w-24 bg-transparent p-0 text-right text-[17px] font-semibold tabular-nums text-foreground caret-primary outline-none placeholder:font-normal placeholder:text-default-400"
        placeholder="0"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {p.unit && (
        <span className="min-w-[26px] text-[15px] text-default-500">
          {p.unit}
        </span>
      )}
    </label>
  );
}

// ── Sí / No ─────────────────────────────────────────────────────────
export function BooleanInput({
  compact = false,
  disabled,
  value,
  onChange,
}: {
  compact?: boolean;
  disabled: boolean;
  value: unknown;
  onChange: (v: boolean) => void;
}) {
  const options: Array<[boolean, string]> = [
    [true, "Sí"],
    [false, "No"],
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map(([b, label]) => {
        const selected = value === b;

        return (
          <button
            key={label}
            aria-pressed={selected}
            className={`${tileClass(selected)} flex items-center justify-center gap-2.5 px-3.5 font-semibold ${
              compact ? "min-h-11 text-base" : "min-h-[52px] text-[17px]"
            }`}
            disabled={disabled}
            type="button"
            onClick={() => onChange(b)}
          >
            <span
              className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition-colors ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : "shadow-[inset_0_0_0_1.5px_hsl(var(--heroui-default-400))]"
              }`}
            >
              {selected && <Icon icon="solar:unread-linear" width={14} />}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Texto ───────────────────────────────────────────────────────────
export function TextInput({
  compact = false,
  invalid,
  label,
  placeholder,
  readOnly,
  value,
  onChange,
}: {
  compact?: boolean;
  invalid: boolean;
  label: string;
  placeholder: string;
  readOnly: boolean;
  value: unknown;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      {...{ [FIELD_ATTR]: "" }}
      aria-invalid={invalid || undefined}
      aria-label={label}
      className={`block w-full resize-none rounded-xl bg-default-100 px-4 py-3 text-base text-foreground caret-primary outline-none transition-shadow [field-sizing:content] placeholder:text-default-400 focus:shadow-[0_0_0_2px_hsl(var(--heroui-primary))] ${
        compact ? "min-h-[76px]" : "min-h-[104px]"
      } ${invalid ? "shadow-[0_0_0_2px_hsl(var(--heroui-danger))]" : ""}`}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={compact ? 2 : 3}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ── Opciones (choice / multi_choice) ────────────────────────────────
export function ChoiceTiles({
  choices,
  disabled,
  multi,
  isSelected,
  onToggle,
}: {
  choices: ChoiceOption[];
  disabled: boolean;
  multi: boolean;
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const hasIcons = choices.some((c) => c.icon);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {choices.map((choice) => {
        const selected = isSelected(choice.id);

        return (
          <button
            key={choice.id}
            aria-pressed={selected}
            className={`${tileClass(selected)} relative flex gap-2.5 px-3.5 py-3 text-left text-[15px] font-semibold leading-tight ${
              hasIcons
                ? "min-h-[88px] flex-col items-start justify-between"
                : "min-h-[52px] items-center"
            } ${multi ? "pr-11" : ""}`}
            disabled={disabled}
            type="button"
            onClick={() => onToggle(choice.id)}
          >
            {choice.icon && (
              <Icon
                className={`shrink-0 transition-colors ${selected ? "text-primary" : "text-default-500"}`}
                icon={choice.icon}
                width={28}
              />
            )}
            <span className="min-w-0 break-words">{choice.label}</span>
            {multi && (
              <span
                className={`absolute right-3 top-3 grid h-[22px] w-[22px] place-items-center rounded-[7px] transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "shadow-[inset_0_0_0_1.5px_hsl(var(--heroui-default-400))]"
                }`}
              >
                {selected && <Icon icon="solar:unread-linear" width={14} />}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Foto ────────────────────────────────────────────────────────────
// "Cambiar foto" SIEMPRE visible sobre la foto: antes salía solo con
// hover y en móvil (sin hover) no había forma de reemplazarla.
export function PhotoTile({
  aspect,
  compact = false,
  disabled,
  invalid,
  label,
  uploading,
  url,
  onPick,
}: {
  aspect: string;
  compact?: boolean;
  disabled: boolean;
  invalid: boolean;
  label: string;
  uploading: boolean;
  url: string | undefined;
  onPick: () => void;
}) {
  if (url) {
    return (
      <div
        className={`relative w-full overflow-hidden rounded-xl bg-default-100 ${aspect}`}
      >
        <Image
          fill
          alt={label}
          className="object-cover"
          sizes="(min-width: 640px) 320px, 50vw"
          src={url}
        />
        {uploading ? (
          <div className="absolute inset-0 grid place-items-center bg-black/45 text-white">
            <Icon
              className="animate-spin motion-reduce:animate-none"
              icon="solar:refresh-linear"
              width={28}
            />
          </div>
        ) : (
          !disabled && (
            <button
              className={`${PRESS} absolute bottom-2.5 left-1/2 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/55 px-3 text-[13px] font-semibold text-white`}
              type="button"
              onClick={onPick}
            >
              <Icon icon="solar:camera-linear" width={16} />
              Cambiar foto
            </button>
          )
        )}
      </div>
    );
  }

  return (
    <button
      aria-busy={uploading || undefined}
      className={`${PRESS} flex w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-[1.5px] border-dashed bg-default-100 p-3 text-center text-default-500 disabled:cursor-default ${aspect} ${
        invalid
          ? "border-danger"
          : "border-default-300 [@media(hover:hover)]:hover:border-default-400"
      }`}
      disabled={disabled || uploading}
      type="button"
      onClick={onPick}
    >
      {uploading ? (
        <>
          <Icon
            className="animate-spin text-primary motion-reduce:animate-none"
            icon="solar:refresh-linear"
            width={28}
          />
          <span className="text-[13px] font-semibold">Subiendo foto...</span>
        </>
      ) : (
        <>
          <Icon
            className="mb-1 text-primary"
            icon="solar:camera-linear"
            width={30}
          />
          <span
            className={`font-semibold leading-snug text-foreground ${compact ? "text-[13px]" : "text-sm"}`}
          >
            {compact
              ? "Tomar o subir foto"
              : "Toca para tomar o subir una foto"}
          </span>
          {!compact && (
            <span className="text-[11px] leading-snug">
              PNG, JPG, WebP, HEIC o HEIF · Máx. 10MB
            </span>
          )}
        </>
      )}
    </button>
  );
}
