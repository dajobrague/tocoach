import { TenantLogo } from "@/components/tenant-logo";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { loadTenantContext } from "@/lib/tenant/loader";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenantContext = await loadTenantContext(slug);
  const trainerName = tenantContext?.theme_json?.meta?.name || "TopCoach";
  const logoUrl = tenantContext?.logo_url || "";

  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-background px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="flex w-full max-w-sm flex-col">
        {/* Marca compacta: en el login el logo saluda grande; aquí se retira. */}
        <div className="mb-9 flex items-center gap-3">
          <div className="flex h-11 min-w-11 items-center justify-center rounded-xl bg-content1 px-2 shadow-small ring-1 ring-default-200">
            {logoUrl ? (
              <TenantLogo
                alt={trainerName}
                className="h-7 w-auto max-w-[96px] object-contain"
                height={28}
                src={logoUrl}
                width={96}
              />
            ) : (
              <span className="font-heading text-base text-foreground">
                {trainerName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-heading text-base text-foreground">
              {trainerName}
            </p>
            <p className="text-[13px] text-default-500">
              Tu espacio de entrenamiento
            </p>
          </div>
        </div>

        <ForgotPasswordForm tenantSlug={slug} />
      </div>
    </div>
  );
}
