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

export interface FieldSpec {
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

// El template default usa `*_levels` para mood/energy/stress (rating
// 1-10). Antes los adapters de catalog hacían resolveByKey con solo
// `mood/animo/energy/...`, que NO matchea con `mood_levels`, y los
// charts iban siempre vacíos para todo tenant en template default.
const MOOD_SPEC: FieldSpec = {
  canonicalIds: ["mood", "mood_levels", "animo", "ánimo"],
  idIncludes: ["mood", "animo", "ánimo"],
};

const ENERGY_SPEC: FieldSpec = {
  canonicalIds: ["energy", "energy_levels", "energia", "energía"],
  idIncludes: ["energy", "energia", "energía"],
};

const STRESS_SPEC: FieldSpec = {
  canonicalIds: ["stress", "stress_levels", "estres", "estrés"],
  idIncludes: ["stress", "estres", "estrés"],
};

const WATER_SPEC: FieldSpec = {
  canonicalIds: [
    "water",
    "water_liters",
    "agua",
    "litros_agua",
    "hydration",
    "hidratacion",
    "hidratación",
  ],
  idIncludes: ["water", "agua", "hydrat", "hidrat"],
  units: ["l", "litros", "liters", "ml"],
};

const BODY_FAT_SPEC: FieldSpec = {
  canonicalIds: ["body_fat", "body_fat_pct", "bf_pct", "grasa_corporal"],
  idIncludes: ["body_fat", "bodyfat", "grasa_corp", "grasacorp", "bf_"],
  units: ["%"],
};

const BODY_WEIGHT_SPEC: FieldSpec = {
  canonicalIds: ["body_weight", "weight", "peso", "peso_corporal"],
  idIncludes: ["body_weight", "bodyweight", "weight", "peso"],
  units: ["kg"],
};

// Mapa exportado: para cada catalog id que depende de form responses,
// el spec que define qué pregunta puede alimentarlo. Adapters cuyo
// catalog id no dependa de form_responses (training_breakdown lee
// exercise_logs) NO aparecen aquí — la auditoría de "chart sin feed"
// los skipea.
//
// macros_breakdown se cubre con un OR de protein||carbs||fats en el
// caller (filterCatalogChartsWithoutFeed) — declarar acá solo los
// componentes simplifica la generalización.
export const CATALOG_DATA_FEED: Readonly<Record<string, FieldSpec>> = {
  body_fat: BODY_FAT_SPEC,
  sleep_hours: SLEEP_HOURS_SPEC,
  steps: STEPS_SPEC,
  calories: CALORIES_SPEC,
  protein: PROTEIN_SPEC,
  carbs: CARBS_SPEC,
  fats: FATS_SPEC,
  water: WATER_SPEC,
  mood: MOOD_SPEC,
  energy: ENERGY_SPEC,
  stress: STRESS_SPEC,
  // Legacy "weight" catalog id: no longer in CATALOG_ADAPTERS (movido a
  // form_question post-migration 096) pero los specs sirven para el
  // shim 100 cuando intenta auto-descubrir alternativas.
  weight: BODY_WEIGHT_SPEC,
};

/**
 * Chequea si una pregunta concreta matchea un spec. Reusa la misma
 * priorización que resolveFieldNumber: canonical → substring → unit.
 */
export function questionMatchesSpec(
  question: { id?: string | null; unit?: string | null },
  spec: FieldSpec
): boolean {
  const id = question.id?.toLowerCase();
  const unit = question.unit?.toLowerCase();

  if (id) {
    for (const c of spec.canonicalIds) {
      if (c.toLowerCase() === id) return true;
    }
    for (const sub of spec.idIncludes) {
      if (id.includes(sub.toLowerCase())) return true;
    }
  }

  if (unit && spec.units) {
    for (const u of spec.units) {
      if (u.toLowerCase() === unit) return true;
    }
  }

  return false;
}

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

// Los resolvers mood/energy/stress/water/body_fat/body_weight se
// retiraron post-migration 102 — los charts catalog que los usaban se
// reescribieron a form_question puro y leen `answers[question_id]`
// directo. Las FieldSpec siguen vivas porque CATALOG_DATA_FEED las
// usa para el picker filter, el resolvability check y el starter
// template-aware.
