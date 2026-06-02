import { notFound } from "next/navigation";

import { getTrainerSession } from "@/lib/auth/session";
import { RecipeLibraryContent } from "@/features/trainer/recipes/recipe-library-content";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";

// Server-side flag gate: non-flagged tenants get a 404 even if they reach the
// URL directly (the nav entry is hidden separately for flagged-off trainers).
export default async function RecipesPage() {
  const session = await getTrainerSession();

  if (session === null) {
    notFound();
  }

  const enabled = await isNutritionV2Enabled(session.tenant_host);

  if (enabled === false) {
    notFound();
  }

  return <RecipeLibraryContent />;
}
