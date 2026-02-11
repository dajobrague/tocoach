import { NutritionContent } from "@/components/client-dashboard/nutrition-content";

export default function NutricionPage() {
  // Shared data (session, tenant, client profile) is fetched once in the
  // parent layout and provided via ClientDataProvider context.
  // NutritionContent reads it with useClientData().
  return <NutritionContent />;
}
