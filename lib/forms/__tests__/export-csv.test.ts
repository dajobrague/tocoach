import type { QuestionConfig } from "../types";

import { describe, expect, it } from "vitest";

import { buildResponsesCsv } from "../export-csv";

const q = (over: Partial<QuestionConfig>): QuestionConfig =>
  ({
    icon: "x",
    enabled: true,
    required: false,
    type: "text",
    ...over,
  }) as QuestionConfig;

describe("buildResponsesCsv", () => {
  it("sigue el formato de Google Forms", () => {
    const csv = buildResponsesCsv(
      [
        q({ id: "trained", label: "¿Entrenaste?", type: "boolean" }),
        q({
          id: "areas",
          label: "Zonas",
          fullQuestion: "¿Dónde te duele?",
          type: "multi_choice",
          choices: [
            { id: "knee", label: "Rodilla" },
            { id: "back", label: "Espalda" },
          ],
        }),
        q({ id: "notes", label: "Notas" }),
      ],
      [
        {
          id: "r2",
          client_id: 7,
          submitted_at: "2026-10-27T14:21:03Z", // 15:21:03 en Madrid (CET)
          created_at: "2026-10-27T14:21:03Z",
          answers: {
            trained: true,
            areas: ["knee", "back"],
            notes: 'dijo "ok", bien',
            old_q: 4,
          },
        },
        {
          id: "r1",
          client_id: 8,
          submitted_at: null,
          created_at: "2026-07-01T08:00:00Z", // 10:00 en Madrid (CEST)
          answers: { trained: false },
        },
      ],
      new Map([["7", "a@x.com"]])
    );

    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Timestamp,Email Address,¿Entrenaste?,¿Dónde te duele?,Notas,old_q,ID de respuesta",
      "2026-07-01 10:00:00,,No,,,,r1",
      '2026-10-27 15:21:03,a@x.com,Sí,"Rodilla, Espalda","dijo ""ok"", bien",4,r2',
      "",
    ]);
  });
});
