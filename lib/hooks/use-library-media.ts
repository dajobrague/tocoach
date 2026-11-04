"use client";

import { useQuery } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";
import { useFigureSex } from "@/lib/hooks/use-figure-sex";

export type LibraryMedia = { video?: string; poster?: string };
export type LibraryMediaMap = Record<string, LibraryMedia>;

const EMPTY: LibraryMediaMap = {};
const CHUNK = 40; // server cap per request (licence: no bulk access)

/**
 * Signed poster/clip URLs for catalog exercises (library_exercise_id slugs),
 * batched and cached for 25 min (URLs live 1 h). `client: true` is the
 * client portal: the server picks the figure of the client's own sex and the
 * request carries the client auth (cookie or Bearer). Trainers get male
 * unless `sex` is given.
 */
export function useLibraryMedia(
  slugs: readonly (string | null | undefined)[],
  { client = false, sex }: { client?: boolean; sex?: "male" | "female" } = {}
): LibraryMediaMap {
  // Trainers follow their own male/female switch; clients are decided server-side.
  const chosen = useFigureSex();
  const figure = sex ?? chosen;
  const unique = [
    ...new Set(slugs.filter((s): s is string => Boolean(s))),
  ].sort();
  const { data } = useQuery({
    queryKey: ["library-media", client ? "client" : figure, unique.join(",")],
    enabled: unique.length > 0,
    staleTime: 25 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // Loading more cards changes the key: keep what we have meanwhile.
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const out: LibraryMediaMap = {};

      for (let i = 0; i < unique.length; i += CHUNK) {
        const params = new URLSearchParams({
          slugs: unique.slice(i, i + CHUNK).join(","),
        });

        if (!client) params.set("sex", figure);
        const res = await (client ? clientFetch : fetch)(
          `/api/library/media?${params}`
        );

        if (!res.ok) throw new Error(`library media ${res.status}`);
        Object.assign(
          out,
          ((await res.json()) as { media: LibraryMediaMap }).media
        );
      }

      return out;
    },
  });

  return data ?? EMPTY;
}

/**
 * Signed URLs of the shaded muscle-body kit (file name -> URL) plus the sex of
 * the figure the server chose, cached like the clips. Empty until loaded (or if the kit isn't uploaded): callers fall
 * back to the flat SVG map.
 */
export function useBodyMedia({
  client = false,
  sex,
}: { client?: boolean; sex?: "male" | "female" } = {}): {
  sex: "male" | "female" | null;
  files: Record<string, string>;
} {
  const chosen = useFigureSex();
  const figure = sex ?? chosen;
  const { data } = useQuery({
    queryKey: ["body-media", client ? "client" : figure],
    staleTime: 25 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const params = client ? "" : `?sex=${figure}`;
      const res = await (client ? clientFetch : fetch)(
        `/api/library/body${params}`
      );

      if (!res.ok) throw new Error(`body media ${res.status}`);

      return (await res.json()) as {
        sex: "male" | "female";
        files: Record<string, string>;
      };
    },
  });

  return data ?? { sex: null, files: {} };
}
