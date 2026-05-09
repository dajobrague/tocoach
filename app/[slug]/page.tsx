import { redirect } from "next/navigation";

import { getClientSession } from "@/lib/auth/client-session";

export default async function ClientRootPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Only treat the session as "authenticated for this tenant" when it
  // matches — see the matching note in `app/[slug]/login/page.tsx`.
  const session = await getClientSession();

  if (session && session.tenant_slug === slug) {
    redirect(`/${slug}/dashboard`);
  } else {
    redirect(`/${slug}/login`);
  }
}
