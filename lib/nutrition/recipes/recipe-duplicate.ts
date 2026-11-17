import type { RecipeRow } from "./recipe-service";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  RECIPE_MEDIA_BUCKET,
  copyRecipeMediaObject,
  storagePathFromUrl,
} from "./recipe-media-service";

/**
 * Copia una receta del mismo entrenador: fila (con carpeta, etiquetas y
 * totales), ingredientes (conservando `ingredient_id`, mismo tenant) y media.
 * Las fotos se copian como objetos nuevos: borrar una foto borra su fichero,
 * así que compartir la URL rompería la foto de la otra receta. Si algo falla,
 * se deshace la copia entera. Devuelve null si la receta no es del tenant.
 */
export async function duplicateRecipe(
  client: SupabaseClient,
  tenantHost: string,
  trainerId: string,
  recipeId: string
): Promise<RecipeRow | null> {
  const { data: source, error: sourceError } = await client
    .from("recipes")
    .select("*")
    .eq("tenant_host", tenantHost)
    .eq("id", recipeId)
    .maybeSingle();

  if (sourceError !== null) {
    throw new Error(`duplicateRecipe load failed: ${sourceError.message}`);
  }
  if (source === null) {
    return null;
  }

  const recipe = source as RecipeRow;
  const [ingredients, media] = await Promise.all([
    client
      .from("recipe_ingredients")
      .select(
        "ingredient_id, name_snapshot, brand, quantity, unit, grams_per_unit, nutrient_snapshot, image_url, sort_order"
      )
      .eq("recipe_id", recipeId)
      .order("sort_order", { ascending: true }),
    client
      .from("recipe_media")
      .select("type, url, orientation, sort_order")
      .eq("recipe_id", recipeId)
      .order("sort_order", { ascending: true }),
  ]);

  if (ingredients.error !== null || media.error !== null) {
    throw new Error(
      `duplicateRecipe children load failed: ${(ingredients.error ?? media.error)?.message}`
    );
  }

  // Todas las columnas de la fila (carpeta, etiquetas, totales…) menos las
  // que genera la base de datos.
  const fields: Record<string, unknown> = { ...recipe };

  delete fields.id;
  delete fields.created_at;
  delete fields.updated_at;
  const { data: created, error: createError } = await client
    .from("recipes")
    .insert({
      ...fields,
      trainer_id: trainerId,
      name: `${recipe.name} (copia)`,
    })
    .select()
    .single();

  if (createError !== null) {
    throw new Error(`duplicateRecipe create failed: ${createError.message}`);
  }

  const copy = created as RecipeRow;
  const prefix = `${tenantHost}/recipes/${copy.id}`;
  const copiedPaths: string[] = [];

  try {
    if (ingredients.data.length > 0) {
      const { error } = await client
        .from("recipe_ingredients")
        .insert(
          ingredients.data.map((line) => ({ ...line, recipe_id: copy.id }))
        );

      if (error !== null) {
        throw new Error(`ingredients: ${error.message}`);
      }
    }

    const mediaRows = [];

    for (const item of media.data) {
      const isBucketObject = storagePathFromUrl(item.url) !== null;
      const url = isBucketObject
        ? await copyRecipeMediaObject(client, item.url, prefix)
        : item.url; // URL externa: nunca se borra, se puede compartir.

      // Fichero del bucket que no se pudo copiar: mejor sin esa foto que
      // compartiendo un fichero que la otra receta puede borrar.
      if (url === null) continue;
      if (isBucketObject) {
        const path = storagePathFromUrl(url);

        if (path !== null) copiedPaths.push(path);
      }
      mediaRows.push({ ...item, url, recipe_id: copy.id });
    }

    if (mediaRows.length > 0) {
      const { error } = await client.from("recipe_media").insert(mediaRows);

      if (error !== null) {
        throw new Error(`media: ${error.message}`);
      }
    }
  } catch (error) {
    // Ingredientes y media caen por ON DELETE CASCADE.
    await client.from("recipes").delete().eq("id", copy.id);
    if (copiedPaths.length > 0) {
      await client.storage.from(RECIPE_MEDIA_BUCKET).remove(copiedPaths);
    }
    throw new Error(
      `duplicateRecipe failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return copy;
}
