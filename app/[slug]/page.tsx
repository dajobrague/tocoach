import { redirect } from "next/navigation";

import { getClientSession } from "@/lib/auth/client-session";

export default async function ClientRootPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Check client session
  const session = await getClientSession();

  if (session) {
    // Authenticated - redirect to dashboard
    redirect(`/${slug}/dashboard`);
  } else {
    // Not authenticated - redirect to login
    redirect(`/${slug}/login`);
  }
}
