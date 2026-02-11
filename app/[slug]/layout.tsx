import { ClientDataProvider } from "@/components/client-dashboard/client-data-provider";

/**
 * Lightweight layout for the client app.
 *
 * All data fetching (client profile, tenant context) happens client-side
 * via the ClientDataProvider which calls /api/client/bootstrap and caches
 * the result with TanStack Query.
 *
 * Authentication is enforced by the middleware — no server-side DB calls
 * are needed here, which makes page transitions instant.
 */
export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ClientDataProvider tenantSlug={slug}>{children}</ClientDataProvider>;
}
