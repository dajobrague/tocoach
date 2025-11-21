import { redirect } from "next/navigation";

import { MoreContent } from "@/components/client-dashboard/more-content";
import { getClientSession } from "@/lib/auth/client-session";

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

  return <MoreContent />;
}
