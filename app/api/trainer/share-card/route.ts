// GET/PUT /api/trainer/share-card — lo que firma el entrenador en las
// imágenes que comparten sus clientes (JC, 14 oct): activarlas, nombre,
// Instagram y el pie "topcoach.io". Se guardan en tenants.features.share_card
// sin tocar el resto de features. El GET devuelve además su marca (nombre,
// color y logo en data URI) para la vista previa.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { loadShareCardBranding } from "@/lib/share-card/branding";
import {
  shareCardSettingsFromFeatures,
  validateShareCardSettings,
} from "@/lib/share-card/settings";
import { clearTenantCache } from "@/lib/tenant/loader";

const LOG_PREFIX = "[Trainer Share Card API]";

export async function GET() {
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseClient();
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("features, logo_url, theme_json")
    .eq("trainer_id", session.trainer_id)
    .maybeSingle();

  if (error || !tenant) {
    return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });
  }

  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return NextResponse.json({
    settings: shareCardSettingsFromFeatures(tenant.features),
    branding: await loadShareCardBranding(tenant, correlationId),
  });
}

export async function PUT(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const settings = validateShareCardSettings(
    await request.json().catch(() => null)
  );

  if (settings === null) {
    return NextResponse.json({ error: "Ajustes no válidos" }, { status: 400 });
  }

  const supabase = createSupabaseClient();
  const { data: tenant, error: readError } = await supabase
    .from("tenants")
    .select("slug, features")
    .eq("trainer_id", session.trainer_id)
    .maybeSingle();

  if (readError || !tenant) {
    return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });
  }

  const features =
    tenant.features !== null && typeof tenant.features === "object"
      ? (tenant.features as Record<string, unknown>)
      : {};
  const { error: writeError } = await supabase
    .from("tenants")
    .update({ features: { ...features, share_card: settings } })
    .eq("trainer_id", session.trainer_id);

  if (writeError) {
    console.error(`${LOG_PREFIX} update failed:`, {
      correlationId,
      error: writeError.message,
    });

    return NextResponse.json(
      { error: "No se pudieron guardar los ajustes" },
      { status: 500 }
    );
  }

  // El portal del cliente lee features del loader (caché 60s).
  clearTenantCache(tenant.slug);

  return NextResponse.json({ settings });
}
