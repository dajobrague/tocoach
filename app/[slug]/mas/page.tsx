import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { MoreContent } from "@/components/client-dashboard/more-content";
import { getClientSession } from "@/lib/auth/client-session";
import { loadTenantContext } from "@/lib/tenant/loader";

export default async function MasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Check client session
  const session = await getClientSession();

  if (!session) {
    redirect(`/${slug}/login`);
  }

  // Get tenant context using slug
  const tenantContext = await loadTenantContext(slug);

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Fetch client profile
  const { data: clientProfile } = await supabase
    .from("clients")
    .select(
      "id, email, name, last_name, phone, profile_picture_url, sign_up_date"
    )
    .eq("id", session.client_id)
    .single();

  const fullName = clientProfile
    ? `${clientProfile.name} ${clientProfile.last_name || ""}`.trim()
    : session.full_name || "Client";
  const firstName = clientProfile?.name || fullName.split(" ")[0];
  const logoUrl = tenantContext?.logo_url || "";
  const trainerName = tenantContext?.theme_json?.meta?.name || "Your Trainer";
  const clientProfilePicture = clientProfile?.profile_picture_url || "";

  return (
    <MoreContent
      clientId={session.client_id.toString()}
      clientProfilePicture={clientProfilePicture}
      firstName={firstName}
      logoUrl={logoUrl}
      tenantSlug={slug}
      trainerName={trainerName}
    />
  );
}
