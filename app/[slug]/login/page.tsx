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

  // Check if already logged in. The `client-session` cookie is scoped to the
  // app domain and not the tenant, so a session from another trainer can be
  // present here — only honor it if it belongs to *this* tenant. Otherwise
  // fall through and render the login form, allowing the user to sign in
  // (which will overwrite the cross-tenant cookie). Without this guard the
  // server bounces to /dashboard, the middleware bounces back to /login,
  // and the browser ends up in an infinite redirect loop ("white screen").
  const session = await getClientSession();

  if (session && session.tenant_slug === slug) {
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
    <div className="flex min-h-[100dvh] w-full justify-center bg-background px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+3rem)]">
      <div className="flex w-full max-w-sm flex-col">
        {/* Marca del entrenador: grande y centrada. El logo va siempre sobre
            una superficie neutra (nunca directo sobre el color de marca). */}
        <div className="mb-10 flex flex-col items-center gap-3.5 text-center">
          <div className="flex h-28 min-w-28 items-center justify-center rounded-3xl bg-content1 px-6 shadow-small ring-1 ring-default-200">
            {logoUrl ? (
              <TenantLogo
                alt={trainerName}
                className="h-16 w-auto max-w-[200px] object-contain"
                height={64}
                src={logoUrl}
                width={200}
              />
            ) : (
              <span className="font-heading text-4xl text-foreground">
                {trainerName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="font-heading text-xl text-foreground">
              {trainerName}
            </p>
            <p className="mt-0.5 text-sm text-default-500">
              Tu espacio de entrenamiento
            </p>
          </div>
        </div>

        <ClientLoginForm tenantSlug={slug} trainerName={trainerName} />

        <p className="mt-auto pt-7 text-center text-[13px] leading-normal text-default-500">
          ¿No tienes cuenta? Tu entrenador te la crea.
        </p>
      </div>
    </div>
  );
}
