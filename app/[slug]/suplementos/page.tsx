import { SupplementsContent } from "@/components/client-dashboard/supplements-content";

export default function SupplementosPage() {
  // Shared data (session, tenant, client profile) is fetched once in the
  // parent layout and provided via ClientDataProvider context.
  // SupplementsContent reads it with useClientData().
  return <SupplementsContent />;
}
