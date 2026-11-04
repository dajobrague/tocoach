import { MuscleBody } from "./muscle-body";

import {
  muscleVolume,
  type MuscleVolumeInput,
} from "@/lib/training/muscle-volume";
import { muscleLabel } from "@/lib/training/muscles";

const fmt = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

/** Series por grupo muscular con barra relativa; `map` añade el cuerpo. */
export function MuscleVolume({
  exercises,
  map = false,
  client = false,
  title = "Series por músculo",
  className = "",
}: {
  exercises: readonly MuscleVolumeInput[];
  map?: boolean;
  /** Client portal: figure of the client's own sex (shaded body). */
  client?: boolean;
  title?: string;
  className?: string;
}) {
  const volume = muscleVolume(exercises);

  if (volume.length === 0) return null;

  const max = volume[0]!.sets;
  // El cuerpo marca en sólido lo más trabajado y en claro el resto.
  const top = volume.filter((v) => v.sets >= max / 2).map((v) => v.id);
  const rest = volume.filter((v) => v.sets < max / 2).map((v) => v.id);

  return (
    <section className={`flex flex-col gap-2 ${className}`}>
      <h4 className="text-xs font-semibold text-default-500">{title}</h4>
      <div className="flex items-start gap-4">
        {map && (
          <MuscleBody
            className="w-[104px] shrink-0"
            client={client}
            primary={top}
            secondary={rest}
          />
        )}
        <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-1.5 p-0">
          {volume.map(({ id, sets }) => (
            <li key={id} className="flex items-center gap-2 text-xs">
              <span className="w-32 shrink-0 truncate text-foreground">
                {muscleLabel(id)}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-default-100">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(sets / max) * 100}%` }}
                />
              </span>
              <span className="w-14 shrink-0 text-right tabular-nums text-default-500">
                {fmt.format(sets)} {sets === 1 ? "serie" : "series"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
