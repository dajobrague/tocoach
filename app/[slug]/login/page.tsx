import { redirect } from "next/navigation";

import { TenantLogo } from "@/components/tenant-logo";
import { ClientLoginForm } from "@/components/client-login-form";
import { getClientSession } from "@/lib/auth/client-session";
import { loadTenantContext } from "@/lib/tenant/loader";

export default async function ClientLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Check if already logged in
  const session = await getClientSession();

  if (session) {
    redirect(`/${slug}/dashboard`);
  }

  // Load tenant for branding using slug
  const tenantContext = await loadTenantContext(slug);

  if (!tenantContext || tenantContext.status !== "active") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 font-heading">
            Site Unavailable
          </h1>
          <p className="font-body text-default-600">
            This training site is currently unavailable.
          </p>
        </div>
      </div>
    );
  }

  const trainerName = tenantContext.theme_json?.meta?.name || "TopCoach";
  const logoUrl = tenantContext.logo_url || "";

  return (
    <div className="flex h-full w-full items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md">
        {/* Branded Header */}
        <div className="flex flex-col items-center pb-8">
          {logoUrl && (
            <TenantLogo
              alt={trainerName}
              className="h-16 w-auto mb-4 object-contain"
              height={64}
              src={logoUrl}
              width={128}
            />
          )}
          <h1 className="text-3xl font-heading font-bold mb-4">
            {trainerName}
          </h1>
          <h2 className="text-xl font-medium font-heading mb-2">
            Portal de Clientes
          </h2>
          <p className="text-default-500 font-body text-center">
            Inicia sesión para acceder a tus programas de entrenamiento
          </p>
        </div>

        <ClientLoginForm tenantSlug={slug} />
      </div>
    </div>
  );
}
