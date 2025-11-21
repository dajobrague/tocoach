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
            <img alt={trainerName} className="h-16 w-auto mb-4" src={logoUrl} />
          )}
          <h1 className="text-3xl font-heading font-bold mb-4">
            Reset Password
          </h1>
          <p className="text-default-500 font-body text-center">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        <ForgotPasswordForm tenantSlug={slug} />
      </div>
    </div>
  );
}
