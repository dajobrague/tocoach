import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { CalendarContent } from "@/components/client-dashboard/calendar-content";
import { getClientSession } from "@/lib/auth/client-session";
import { loadTenantContext } from "@/lib/tenant/loader";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function CalendarPage({
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
    <CalendarContent
      clientId={session.client_id}
      clientProfilePicture={clientProfilePicture}
      firstName={firstName}
      logoUrl={logoUrl}
      tenantSlug={slug}
      trainerName={trainerName}
    />
  );
}
