import { notFound } from "next/navigation";

import { getTrainerSession } from "@/lib/auth/session";
import { RecipeImportContent } from "@/features/trainer/recipes/import/import-content";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";

// Server-side flag gate, mirroring the recipe library page: non-flagged tenants
// get a 404 even reaching the URL directly (the entry button is hidden too).
export default async function RecipeImportPage() {
  const session = await getTrainerSession();

  if (session === null) {
    notFound();
  }

  const enabled = await isNutritionV2Enabled(session.tenant_host);

  if (enabled === false) {
    notFound();
  }

  return <RecipeImportContent />;
}
