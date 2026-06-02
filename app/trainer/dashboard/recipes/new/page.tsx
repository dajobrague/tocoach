import { notFound } from "next/navigation";

import { getTrainerSession } from "@/lib/auth/session";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";

// Placeholder for the recipe create/edit form (lands in P1-T9). Same
// server-side flag gate as the library page.
export default async function NewRecipePage() {
  const session = await getTrainerSession();

  if (session === null) {
    notFound();
  }

  const enabled = await isNutritionV2Enabled(session.tenant_host);

  if (enabled === false) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <h1 className="text-xl font-bold text-gray-900">Nueva receta</h1>
      <p className="mt-2 text-sm text-default-500">
        El formulario de creación de recetas llega en la próxima entrega.
      </p>
    </div>
  );
}
