import { notFound } from "next/navigation";

import { getTrainerSession } from "@/lib/auth/session";
import { isNutritionV2TrainerEnabled } from "@/lib/nutrition/feature-flag";
import { RecipeForm } from "@/features/trainer/recipes/recipe-form";

// Create flow. Same server-side flag gate as the library page.
export default async function NewRecipePage() {
  const session = await getTrainerSession();

  if (session === null) {
    notFound();
  }

  const enabled = await isNutritionV2TrainerEnabled(session.tenant_host);

  if (enabled === false) {
    notFound();
  }

  return <RecipeForm mode="create" />;
}
