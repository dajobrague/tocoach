import type { QuestionConfig } from "./types";

/**
 * Respuestas de un formulario en CSV con el formato de las hojas de
 * respuestas de Google Forms (lo pidió Mario para su hoja de seguimiento):
 * «Timestamp» (hora de Madrid, 2026-10-27 15:21:03), «Email Address», una
 * columna por pregunta en el orden del formulario, y al final el id de la
 * respuesta para detectar duplicados. Varias opciones → «a, b» en una celda.
 *
 * ponytail: las columnas van por id de pregunta con su título ACTUAL. Las
 * respuestas no guardan el texto con el que se contestaron, así que renombrar
 * una pregunta no separa las respuestas antiguas en otra columna.
 */

export interface ExportResponse {
  id: string;
  client_id: number | string;
  submitted_at: string | null;
  created_at: string;
  answers: Record<string, unknown> | null;
}

const MADRID = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function cellValue(q: QuestionConfig | undefined, answer: unknown): string {
  if (answer === undefined || answer === null) return "";
  if (typeof answer === "boolean") return answer ? "Sí" : "No";
  const label = (id: unknown) =>
    q?.choices?.find((c) => c.id === id)?.label ?? String(id);

  if (Array.isArray(answer)) return answer.map(label).join(", ");
  if (q?.type === "choice") return label(answer);
  if (typeof answer === "object") return JSON.stringify(answer);

  return String(answer);
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * @param questions preguntas en orden del formulario (sin duplicar ids).
 *   Las claves de `answers` que no estén aquí salen al final con su id.
 */
export function buildResponsesCsv(
  questions: QuestionConfig[],
  responses: ExportResponse[],
  emailByClient: Map<string, string>
): string {
  const columns = questions.filter((q) => q.type !== "group");
  const known = new Set(columns.map((q) => q.id));
  const extra: string[] = [];

  for (const r of responses) {
    for (const key of Object.keys(r.answers ?? {})) {
      if (!known.has(key)) {
        known.add(key);
        extra.push(key);
      }
    }
  }

  const header = [
    "Timestamp",
    "Email Address",
    ...columns.map((q) => q.fullQuestion?.trim() || q.label),
    ...extra,
    "ID de respuesta",
  ];
  const rows = [...responses]
    .sort((a, b) =>
      (a.submitted_at ?? a.created_at).localeCompare(
        b.submitted_at ?? b.created_at
      )
    )
    .map((r) => {
      const answers = r.answers ?? {};

      return [
        MADRID.format(new Date(r.submitted_at ?? r.created_at)),
        emailByClient.get(String(r.client_id)) ?? "",
        ...columns.map((q) => cellValue(q, answers[q.id])),
        ...extra.map((key) => cellValue(undefined, answers[key])),
        r.id,
      ];
    });

  // BOM: Excel abre las tildes bien; Google Sheets lo ignora.
  return (
    "﻿" +
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
