import { notFound } from "next/navigation";

import { getTrainerSession } from "@/lib/auth/session";
import { CycleBuilderContent } from "@/features/trainer/cycles/cycle-builder-content";
import { isNutritionV2TrainerEnabled } from "@/lib/nutrition/feature-flag";

interface PageProps {
  params: Promise<{ clientId: string }>;
}

// Server-side flag gate (mirrors the recipe pages): non-flagged tenants 404 even
// reaching the URL directly. The cycle builder is scoped to one client.
export default async function ClientNutritionPage({ params }: PageProps) {
  const session = await getTrainerSession();

  if (session === null) {
    notFound();
  }

  const enabled = await isNutritionV2TrainerEnabled(session.tenant_host);

  if (enabled === false) {
    notFound();
  }

  const { clientId } = await params;
  const numericId = Number(clientId);

  if (Number.isFinite(numericId) === false) {
    notFound();
  }

  return <CycleBuilderContent clientId={numericId} />;
}
