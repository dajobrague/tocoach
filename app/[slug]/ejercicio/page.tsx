import { WorkoutsContent } from "@/components/client-dashboard/workouts-content";

export default function EjercicioPage() {
  // Shared data (session, tenant, client profile) is fetched once in the
  // parent layout and provided via ClientDataProvider context.
  // WorkoutsContent reads it with useClientData().
  return <WorkoutsContent />;
}
