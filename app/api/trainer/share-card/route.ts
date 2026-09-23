// GET/PUT /api/trainer/share-card — ajustes de la tarjeta "Comparte tu
// sesión" del entrenador (Fase 2, JC 23 sep): activarla, estilo y qué datos
// se ven. Se guardan en tenants.features.share_card sin tocar el resto de
// features (food_market, etc.).

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
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
    .select("features")
    .eq("trainer_id", session.trainer_id)
    .maybeSingle();

  if (error || !tenant) {
    return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    settings: shareCardSettingsFromFeatures(tenant.features),
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
