import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { ProfileContent } from "@/components/client-dashboard/profile-content";
import { getClientSession } from "@/lib/auth/client-session";
import { loadTenantContext } from "@/lib/tenant/loader";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getClientSession();

  if (!session) {
    redirect(`/${slug}/login`);
  }

  // Load tenant context for branding using slug
  const tenantContext = await loadTenantContext(slug);

  // Load client profile
  const { data: clientProfile } = await supabase
    .from("clients")
    .select("*")
    .eq("id", session.client_id)
    .single();

  const logoUrl = tenantContext?.logo_url || "";
  const trainerName = tenantContext?.theme_json?.meta?.name || "Your Trainer";

  return (
    <ProfileContent
      clientProfile={clientProfile}
      logoUrl={logoUrl}
      trainerName={trainerName}
    />
  );
}
