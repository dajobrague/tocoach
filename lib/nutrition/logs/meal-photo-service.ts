import type { SupabaseClient } from "@supabase/supabase-js";

import { randomUUID } from "node:crypto";

const BUCKET = "meal-photos";

export interface MealPhotoFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");

  return dot >= 0 ? filename.slice(dot) : ".jpg";
}

/**
 * The in-bucket object path for a client's meal-log photo. ALWAYS namespaced
 * under the client's own id, so a client can only ever write to their own path
 * (the route derives `clientId` from the verified session, never the request).
 */
export function mealPhotoObjectPath(
  clientId: number,
  uuid: string,
  filename: string
): string {
  return `${clientId}/${uuid}${extensionOf(filename)}`;
}

/**
 * Upload a meal-log photo for `clientId` and return its public URL. Stored at
 * `meal-photos/[clientId]/[uuid]`, reusing the recipe-media upload approach
 * (buffer → storage.upload → public URL). The client id is the caller's own
 * (from the session), so the own-path-only invariant holds by construction.
 */
export async function uploadMealPhoto(
  client: SupabaseClient,
  clientId: number,
  file: MealPhotoFile
): Promise<string> {
  const objectPath = mealPhotoObjectPath(clientId, randomUUID(), file.filename);

  const upload = await client.storage
    .from(BUCKET)
    .upload(objectPath, file.buffer, {
      contentType: file.contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (upload.error !== null) {
    throw new Error(`uploadMealPhoto failed: ${upload.error.message}`);
  }

  const {
    data: { publicUrl },
  } = client.storage.from(BUCKET).getPublicUrl(objectPath);

  return publicUrl;
}
