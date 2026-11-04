import "server-only";

// Asistente de músculos (David, 28 oct): Claude propone los músculos de un
// ejercicio a partir de su nombre, instrucciones y equipamiento. Nunca se
// guarda solo: el entrenador acepta o corrige la sugerencia.
//
// Haiku basta para clasificar; la salida está restringida a los 16 grupos de
// lib/training/muscles.ts con structured outputs y además se valida con
// parseMuscles. El prompt fijo va primero y cacheado.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import {
  MUSCLES,
  type MuscleId,
  type MuscleSelection,
  parseMuscles,
} from "./muscles";

const MODEL = "claude-haiku-5-5";

/** Ejercicios por llamada: respuestas cortas y un fallo no tumba el lote. */
export const ASSISTANT_BATCH = 10;

export interface AssistantExercise {
  key: string;
  name: string;
  category?: string | null;
  description?: string | null;
  instructions?: string[] | null;
  equipment?: string[] | null;
  movementPattern?: string | null;
  /** Texto libre antiguo del entrenador: pista, no verdad. */
  legacyMuscles?: string[] | null;
}

const ids = MUSCLES.map((m) => m.id) as [MuscleId, ...MuscleId[]];

const ResultSchema = z.object({
  results: z.array(
    z.object({
      key: z.string(),
      primary: z.array(z.enum(ids)),
      secondary: z.array(z.enum(ids)),
    })
  ),
});

const HINTS: Partial<Record<MuscleId, string>> = {
  pectoral:
    "whole chest incl. upper chest and serratus; presses (flat, incline, decline), flyes, dips, push-ups",
  deltoides_anterior: "overhead and front pressing, front raises",
  deltoides_lateral: "lateral raises, upright rows",
  deltoides_posterior: "rear-delt flyes, face pulls, wide rows",
  biceps:
    "biceps and brachialis; all curls (hammer, reverse too); pull-ups as secondary",
  triceps: "extensions, close-grip pressing, dips, pushdowns",
  antebrazo: "wrist curls, grip work, farmer carries, brachioradialis",
  trapecio:
    "whole trapezius plus rhomboids; shrugs, upright rows, face pulls; rows as secondary",
  dorsal:
    "latissimus dorsi plus teres major; pull-ups, pulldowns, rows, pullovers",
  erectores:
    "erector spinae / lower back; deadlifts, hyperextensions, good mornings",
  abdomen:
    "rectus abdominis, obliques and deep core; crunches, planks, rotations, leg raises, anti-extension work",
  gluteo:
    "gluteus maximus and medius (abduction); hip thrusts, squats, deadlifts, lunges, band walks, abductor machine",
  aductores: "adductor machine, sumo stance, Copenhagen plank",
  cuadriceps: "squats, leg press, leg extensions, lunges",
  isquiotibiales: "hamstrings; leg curls, Romanian deadlifts",
  gemelos: "gastrocnemius and soleus; standing and seated calf raises",
};

const TAXONOMY = MUSCLES.map(
  (m) =>
    `- ${m.id}: ${m.label} (${m.region})${HINTS[m.id] ? ` — ${HINTS[m.id]}` : ""}`
).join("\n");

const SYSTEM = `You tag gym exercises with the muscles they train, for a Spanish-language fitness coaching app. Trainers will review every suggestion before saving it, so precision matters more than coverage: a wrong muscle is worse than a missing one.

For each exercise return:
- primary: the 1–2 muscles doing most of the work (the target). Use 3 only for big compound lifts where three muscles clearly share the load.
- secondary: up to 4 muscles that clearly assist. Leave out muscles that only stabilise, unless stabilisation is the point of the exercise (a plank works the core).
- A muscle is never both primary and secondary. Use only the ids listed below.

The muscle list is deliberately coarse (16 groups), so do not look for sub-portions: every chest press → pectoral; curls → biceps; rows and pulldowns → dorsal (rows add trapecio as secondary); any ab or core work → abdomen; any glute work including abduction → glúteo; any calf raise → gemelos. Pick the deltoid head the exercise trains: overhead press → deltoides_anterior; lateral raise → deltoides_lateral; rear-delt fly → deltoides_posterior. Hip flexors, neck, rotator cuff and shins are not in the list: leave them out.

Cardio and conditioning: return the muscles that clearly drive the movement (running → cuadriceps, gemelos, gluteo), or empty arrays for general work with no clear focus (burpees, jumping jacks).

Use the description, instructions, equipment and movement pattern when the name alone is not enough. The trainer's old free-text notes (legacy_muscles) are a hint, not the truth. If you still cannot tell what the exercise is, return empty arrays instead of guessing. Exercise names are usually in Spanish.

Muscles:
${TAXONOMY}

Examples:
- "Press banca plano con barra" → primary [pectoral], secondary [deltoides_anterior, triceps]
- "Press inclinado con mancuernas" → primary [pectoral], secondary [deltoides_anterior, triceps]
- "Remo con barra" → primary [dorsal], secondary [trapecio, deltoides_posterior, biceps]
- "Sentadilla trasera" → primary [cuadriceps, gluteo], secondary [aductores, isquiotibiales, erectores]
- "Peso muerto rumano" → primary [isquiotibiales, gluteo], secondary [erectores]
- "Hip thrust" → primary [gluteo], secondary [isquiotibiales]
- "Face pull" → primary [deltoides_posterior], secondary [trapecio]
- "Elevaciones laterales" → primary [deltoides_lateral], secondary [trapecio]
- "Plancha frontal" → primary [abdomen], secondary [deltoides_anterior]
- "Gemelo sentado en máquina" → primary [gemelos], secondary []

Return one result per exercise, echoing its key.`;

export class AssistantUnavailableError extends Error {}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AssistantUnavailableError("ANTHROPIC_API_KEY is not set");
  }
  client ??= new Anthropic();

  return client;
}

const clip = (text: string | null | undefined, max: number) =>
  text ? text.slice(0, max) : undefined;

/**
 * Sugerencias para hasta ASSISTANT_BATCH ejercicios en una llamada.
 * Devuelve key → selección (null si el modelo no supo qué es).
 */
export async function suggestMuscles(
  exercises: AssistantExercise[]
): Promise<Map<string, MuscleSelection | null>> {
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    output_config: {
      effort: "low",
      format: zodOutputFormat(ResultSchema),
    },
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          exercises: exercises.map((e) => ({
            key: e.key,
            name: e.name,
            category: e.category ?? undefined,
            movement_pattern: e.movementPattern || undefined,
            equipment: e.equipment?.length ? e.equipment : undefined,
            description: clip(e.description, 1200),
            instructions: e.instructions?.length
              ? e.instructions.slice(0, 10).map((step) => step.slice(0, 300))
              : undefined,
            legacy_muscles: e.legacyMuscles?.length
              ? e.legacyMuscles
              : undefined,
          })),
        }),
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Assistant returned no result (${response.stop_reason})`);
  }

  const out = new Map<string, MuscleSelection | null>();

  for (const result of response.parsed_output.results) {
    const parsed = parseMuscles(result.primary, result.secondary);

    out.set(
      result.key,
      parsed?.ok === true &&
        parsed.muscles.primary.length + parsed.muscles.secondary.length > 0
        ? // El prompt pide 1–2 principales y hasta 4 secundarios; a veces se
          // pasa: se recorta aquí (el modelo los da en orden de importancia).
          {
            primary: parsed.muscles.primary.slice(0, 3),
            secondary: parsed.muscles.secondary.slice(0, 4),
          }
        : null
    );
  }

  return out;
}
