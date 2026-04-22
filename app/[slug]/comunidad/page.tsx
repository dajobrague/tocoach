import { CommunityContent } from "@/components/client-dashboard/community-content";

export default function ComunidadPage() {
  // Shared data (session, tenant, client profile) is fetched once in the
  // parent layout and provided via ClientDataProvider context.
  // CommunityContent reads it with useClientData().
  return <CommunityContent />;
}
