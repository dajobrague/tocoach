import { MealCycleContent } from "@/components/client-dashboard/meal-cycle/meal-cycle-content";
import { resolveClientNutritionView } from "@/components/client-dashboard/nutricion-view";
import { NutritionContent } from "@/components/client-dashboard/nutrition-content";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { loadTenantContext } from "@/lib/tenant/loader";

// The client's "Nutrición" destination (the bottom-nav points here). Behind the
// nutrition_v2 flag: when enabled it renders the new meal-cycle plan view (same
// content as /plan-de-comidas), otherwise the unchanged legacy NutritionContent.
// The flag is resolved server-side from the tenant host (per-tenant gate),
// mirroring the rest of the nutrition-v2 server gating.
//
// Shared data (session, tenant, client profile) is fetched in the parent layout
// and provided via ClientDataProvider; both views read it with useClientData().
export default async function NutricionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await loadTenantContext(slug);
  const enabled = await isNutritionV2Enabled(tenant?.host ?? "");

  return resolveClientNutritionView(enabled) === "meal-cycle" ? (
    <MealCycleContent />
  ) : (
    <NutritionContent />
  );
}
