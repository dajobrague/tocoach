import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "NIVELES DE ENERGÍA" → "Niveles de energía". Solo toca etiquetas escritas
 *  enteras en mayúsculas; deja las siglas cortas ("RPE"). */
export function sentenceCaseIfShouting(label: string): string {
  const letters = label.replace(/[^\p{L}]/gu, "");

  // ≤4 letras suele ser una sigla (RPE, HRV): se deja.
  if (letters.length < 5 || letters !== letters.toLocaleUpperCase("es"))
    return label;
  const lower = label.toLocaleLowerCase("es");

  return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
}
