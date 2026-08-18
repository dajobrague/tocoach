export type ClientSex = "male" | "female";

export interface BmrInput {
  sex: ClientSex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}

/**
 * Basal metabolic rate via Mifflin-St Jeor (the formula the trainers quoted on
 * the Jul 28 call): 10·kg + 6.25·cm − 5·years, +5 for men / −161 for women.
 * Deliberately NO activity factor or deficit/surplus — each trainer applies
 * their own method on top. Integer kcal, no decimals.
 */
export function basalMetabolicRate(input: BmrInput): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;

  return Math.round(base + (input.sex === "male" ? 5 : -161));
}

/** Valid ranges so a typo (peso 800) doesn't render a nonsense estimate. */
export function isValidBmrInput(input: {
  sex: ClientSex | null;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): input is BmrInput {
  return (
    input.sex !== null &&
    Number.isFinite(input.weightKg) &&
    input.weightKg >= 25 &&
    input.weightKg <= 400 &&
    Number.isFinite(input.heightCm) &&
    input.heightCm > 50 &&
    input.heightCm < 275 &&
    Number.isFinite(input.ageYears) &&
    input.ageYears >= 10 &&
    input.ageYears <= 120
  );
}
