import { notFound } from "next/navigation";

import { NutritionUpdateContent } from "@/features/trainer/nutrition-update/nutrition-update-content";
import { getTrainerSession } from "@/lib/auth/session";

// The V1 → V2 rollout wizard. Deliberately NOT flag-gated: this page is the
// entry into nutrition-v2 (visiting it enables the trainer's prepare mode);
// only a trainer session is required.
export default async function NutritionUpdatePage() {
  const session = await getTrainerSession();

  if (session === null) {
    notFound();
  }

  return <NutritionUpdateContent />;
}
