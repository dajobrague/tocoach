import { MoreContent } from "@/components/client-dashboard/more-content";

export default function MasPage() {
  // Shared data (session, tenant, client profile) is fetched once in the
  // parent layout and provided via ClientDataProvider context.
  // MoreContent reads it with useClientData().
  return <MoreContent />;
}
