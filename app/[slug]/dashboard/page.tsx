import { DashboardContent } from "@/components/client-dashboard/dashboard-content";

export default function ClientDashboardPage() {
  // Shared data (session, tenant, client profile) is fetched once in the
  // parent layout and provided via ClientDataProvider context.
  // DashboardContent reads it with useClientData().
  return <DashboardContent />;
}
