import "server-only";

import { createSupabaseAdminClient } from "@/lib/clients/supabase-admin";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { BODY_FILES } from "@/lib/training/body-overlays";

export type LibrarySex = "male" | "female";
export type LibraryMedia = { video?: string; poster?: string };

const BUCKET = "library-media";
const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

/** Licence: no bulk access to the catalog — a handful of slugs per call. */
export const MAX_SLUGS = 40;
const TTL_SECONDS = 60 * 60;

/**
 * Validate the query; null = reject (bad sex, bad slug, empty or too many).
 * A missing sex means male: the catalog's default figure when the client
 * has no sex on their profile.
 */
export function parseMediaQuery(
  sex: string | null,
  slugs: string | null
): { sex: LibrarySex; slugs: string[] } | null {
  if (sex !== null && sex !== "male" && sex !== "female") return null;
  const list = [...new Set((slugs ?? "").split(",").filter(Boolean))];

  if (list.length === 0 || list.length > MAX_SLUGS) return null;
  if (!list.every((s) => SLUG.test(s))) return null;

  return { sex: sex ?? "male", slugs: list };
}

/** Signed URLs (1 h) for each slug's clip and poster; missing files are omitted. */
export async function signLibraryMedia(
  sex: LibrarySex,
  slugs: string[]
): Promise<Record<string, LibraryMedia>> {
  const paths = slugs.flatMap((s) => [`${sex}/${s}.mp4`, `${sex}/${s}.webp`]);
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .createSignedUrls(paths, TTL_SECONDS);

  if (error) throw error;

  const out: Record<string, LibraryMedia> = {};

  for (const row of data ?? []) {
    if (!row.signedUrl || !row.path) continue;
    const [, file = ""] = row.path.split("/");
    const slug = file.replace(/\.(mp4|webp)$/, "");
    const entry = (out[slug] ??= {});

    if (file.endsWith(".mp4")) entry.video = row.signedUrl;
    else entry.poster = row.signedUrl;
  }

  return out;
}

/**
 * Which figure to serve. A client always gets their own profile's sex (male
 * when unset), whatever the query says; trainers use the requested sex.
 */
export async function figureSex(
  isTrainer: boolean,
  clientId: string | null,
  requested: LibrarySex
): Promise<LibrarySex> {
  if (isTrainer || !clientId) return requested;

  const { data } = await createSupabaseClient()
    .from("clients")
    .select("sex")
    .eq("id", clientId)
    .maybeSingle();

  return data?.sex === "female" ? "female" : "male";
}

/** Signed URLs (1 h) for the muscle-body kit: file name -> URL. */
export async function signBodyMedia(
  sex: LibrarySex
): Promise<Record<string, string>> {
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .createSignedUrls(
      BODY_FILES.map((f) => `${sex}/body/${f}`),
      TTL_SECONDS
    );

  if (error) throw error;

  const out: Record<string, string> = {};

  for (const row of data ?? []) {
    if (row.signedUrl && row.path)
      out[row.path.split("/").pop()!] = row.signedUrl;
  }

  return out;
}
