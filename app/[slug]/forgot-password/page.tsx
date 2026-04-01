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
    <div className="flex h-full w-full items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md">
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
            Recuperar contraseña
          </h1>
          <p className="text-default-500 font-body text-center text-sm sm:text-base max-w-sm mx-auto leading-relaxed">
            Te enviaremos un código de verificación a tu correo para que puedas
            crear una nueva contraseña de forma segura
          </p>
        </div>

        <ForgotPasswordForm tenantSlug={slug} />
      </div>
    </div>
  );
}
