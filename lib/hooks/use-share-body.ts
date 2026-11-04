"use client";

import type { MuscleId } from "@/lib/training/muscles";

import { useQuery } from "@tanstack/react-query";

import { useBodyMedia } from "@/lib/hooks/use-library-media";
import { BODY_OVERLAYS, bodyFile } from "@/lib/training/body-overlays";

/** Cuerpo sombreado para el sticker: archivos del kit en data URI. */
export type ShareBody = {
  sex: "male" | "female";
  files: Record<string, string>;
};

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * El sticker se exporta pintando su SVG en un <img>/canvas, que no carga
 * URLs externas: las imágenes del cuerpo tienen que ir dentro como data URI.
 * Solo se bajan las bases y los overlays de los músculos trabajados.
 * null mientras carga o si el kit no está: el sticker usa el mapa plano.
 */
export function useShareBody(
  muscles: readonly MuscleId[],
  { client = false }: { client?: boolean } = {}
): ShareBody | null {
  const { sex, files } = useBodyMedia({ client });
  const wanted = [
    ...new Set([
      "front_base.webp",
      "back_base.webp",
      ...muscles.flatMap((id) =>
        (["front", "back"] as const).flatMap((view) =>
          (BODY_OVERLAYS[id][view] ?? []).map((name) => bodyFile(view, name))
        )
      ),
    ]),
  ]
    .filter((file) => files[file])
    .sort();
  const ready = Boolean(
    sex && files["front_base.webp"] && files["back_base.webp"]
  );

  const { data } = useQuery({
    queryKey: ["share-body", sex, wanted.join(",")],
    enabled: ready,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const entries = await Promise.all(
        wanted.map(async (file) => {
          const res = await fetch(files[file]!);

          if (!res.ok) throw new Error(`body ${file} ${res.status}`);

          return [file, await toDataUrl(await res.blob())] as const;
        })
      );

      return { sex: sex!, files: Object.fromEntries(entries) } as ShareBody;
    },
  });

  return data ?? null;
}

/** Músculos (principales y secundarios) de una lista de ejercicios. */
export function sessionMuscles(
  exercises: readonly {
    primary: readonly MuscleId[];
    secondary: readonly MuscleId[];
  }[]
): MuscleId[] {
  return [...new Set(exercises.flatMap((e) => [...e.primary, ...e.secondary]))];
}
