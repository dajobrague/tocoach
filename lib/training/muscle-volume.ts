import type { MuscleId } from "./muscles";

import { MUSCLES } from "./muscles";

export type MuscleVolumeInput = {
  sets: number;
  primary?: readonly MuscleId[] | undefined;
  secondary?: readonly MuscleId[] | undefined;
};

export type MuscleVolume = { id: MuscleId; sets: number };

/**
 * Series por grupo muscular (Nov 2 call, JC): cada serie cuenta 1 para sus
 * músculos principales y 0,5 para los secundarios. Ordenado de más a menos
 * trabajado; los grupos sin series no aparecen.
 */
export function muscleVolume(
  exercises: readonly MuscleVolumeInput[]
): MuscleVolume[] {
  const totals = new Map<MuscleId, number>();

  for (const { sets, primary = [], secondary = [] } of exercises) {
    if (!(sets > 0)) continue;
    for (const id of primary) totals.set(id, (totals.get(id) ?? 0) + sets);
    for (const id of secondary)
      if (!primary.includes(id))
        totals.set(id, (totals.get(id) ?? 0) + sets / 2);
  }

  const order = new Map(MUSCLES.map((m, i) => [m.id, i]));

  return [...totals]
    .map(([id, sets]) => ({ id, sets }))
    .sort((a, b) => b.sets - a.sets || order.get(a.id)! - order.get(b.id)!);
}
