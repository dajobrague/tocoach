/**
 * Resolvers heurísticos de answers para los campos "conocidos" del formulario
 * de hábitos que los charts de analytics consumen (pasos, sueño, macros).
 *
 * ¿Por qué existe este módulo?
 *   Los charts del dashboard del cliente y del panel del trainer dependen
 *   de leer `answers.steps`, `answers.calories`, etc., con ids hardcoded.
 *   Cuando un trainer crea una plantilla con ids distintos (p.ej.
 *   `daily_steps`, `kcal`, `prot_total`), los charts muestran 0 silenciosamente
 *   porque el lookup por id no encuentra match. Estos helpers centralizan
 *   el match por heurística (ids canónicos + substring del id + unit) para
 *   atrapar renames razonables sin falsos positivos evidentes.
 *
 * ¿Por qué `number | null` y no `number`?
 *   Los filtros de chart que descartan "días sin dato" deben poder distinguir
 *   "el cliente no respondió" de "el cliente respondió 0". Con `0`-por-defecto
 *   más un filtro `> 0`, se pierden puntos legítimos (día de descanso con 0
 *   pasos, día sin registro de macros con 0 proteína). Devolvemos `null`
 *   cuando no hay match, y el caller decide el comportamiento (`?? 0`,
 *   filtrar, etc.).
 *
 * IMPORTANTE:
 *   Los ids canónicos se prueban PRIMERO (exact match) para preservar el
 *   comportamiento histórico de clientes en plantillas default. Sólo si
 *   ninguno aparece como key, se recurre al match por heurística.
 */

type AnswerMap = Record<string, unknown> | null | undefined;

interface FieldSpec {
  /** Ids exactos que se prueban primero, en orden de preferencia. */
  canonicalIds: string[];
  /** Substrings (lowercase) que, si están en el id de la pregunta, matchean. */
  idIncludes: string[];
  /** Values de `unit` que matchean (lowercase, exact). Opcional. */
  units?: string[];
}

const STEPS_SPEC: FieldSpec = {
  canonicalIds: ["steps", "pasos"],
  idIncludes: ["step", "paso"],
  units: ["pasos", "steps"],
};

const SLEEP_HOURS_SPEC: FieldSpec = {
  canonicalIds: ["sleep_hours", "sleep", "sueno", "horas_sueno"],
  idIncludes: ["sleep", "sueno", "sueño", "dormir"],
};

const CALORIES_SPEC: FieldSpec = {
  canonicalIds: ["calories", "calorias"],
  idIncludes: ["calor", "kcal"],
  units: ["kcal", "cal"],
};

const PROTEIN_SPEC: FieldSpec = {
  canonicalIds: ["protein", "proteina"],
  idIncludes: ["protein", "proteina", "proteína"],
};

const CARBS_SPEC: FieldSpec = {
  canonicalIds: ["carbs", "carbohidratos"],
  idIncludes: ["carb", "hidrat"],
};

const FATS_SPEC: FieldSpec = {
  canonicalIds: ["fats", "grasas"],
  idIncludes: ["fat", "grasa", "lipid"],
};

function toFiniteNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);

  return Number.isFinite(n) ? n : null;
}

function resolveFieldNumber(
  answers: AnswerMap,
  spec: FieldSpec
): number | null {
  if (!answers || typeof answers !== "object") return null;

  // Priority 1: canonical ids (exact match, compat histórica).
  for (const canonical of spec.canonicalIds) {
    if (canonical in answers) {
      const value = toFiniteNumber(answers[canonical]);

      if (value !== null) return value;
    }
  }

  // Priority 2: heurística por substring del id. Saltamos los canónicos ya
  // probados para no doblar trabajo.
  const canonicalSet = new Set(spec.canonicalIds);

  for (const key of Object.keys(answers)) {
    if (canonicalSet.has(key)) continue;
    const lower = key.toLowerCase();
    const matches = spec.idIncludes.some((part) => lower.includes(part));

    if (!matches) continue;
    const value = toFiniteNumber(answers[key]);

    if (value !== null) return value;
  }

  return null;
}

export function resolveStepsAnswer(answers: AnswerMap): number | null {
  return resolveFieldNumber(answers, STEPS_SPEC);
}

export function resolveSleepHoursAnswer(answers: AnswerMap): number | null {
  return resolveFieldNumber(answers, SLEEP_HOURS_SPEC);
}

export function resolveCaloriesAnswer(answers: AnswerMap): number | null {
  return resolveFieldNumber(answers, CALORIES_SPEC);
}

export function resolveProteinAnswer(answers: AnswerMap): number | null {
  return resolveFieldNumber(answers, PROTEIN_SPEC);
}

export function resolveCarbsAnswer(answers: AnswerMap): number | null {
  return resolveFieldNumber(answers, CARBS_SPEC);
}

export function resolveFatsAnswer(answers: AnswerMap): number | null {
  return resolveFieldNumber(answers, FATS_SPEC);
}
