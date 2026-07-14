import { MealCycleContent } from "@/components/client-dashboard/meal-cycle/meal-cycle-content";

// Client "today" view of their assigned meal cycle (nutrition-v2, P4-T2).
//
// Session, tenant and client profile come from the parent layout's
// ClientDataProvider; MealCycleContent fetches the cycle itself via
// /api/client/meal-cycle, which is gated by the nutrition_v2 flag (404 when
// off → rendered as an empty state).
export default function PlanDeComidasPage() {
  return <MealCycleContent />;
}
