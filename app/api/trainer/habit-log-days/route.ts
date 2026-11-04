// GET/PUT /api/trainer/habit-log-days — cuántos días (incluido hoy) puede
// rellenar el cliente su Registro diario. tenants.features.habit_log_days.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  habitLogDaysFromFeatures,
  parseHabitLogDays,
} from "@/lib/forms/habit-log-days";
import { clearTenantCache } from "@/lib/tenant/loader";

const LOG_PREFIX = "[Trainer Habit Log Days API]";

async function loadTenant(trainerId: string) {
  return createSupabaseClient()
    .from("tenants")
    .select("slug, features")
    .eq("trainer_id", trainerId)
    .maybeSingle();
}

export async function GET() {
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: tenant, error } = await loadTenant(session.trainer_id);

  if (error || !tenant) {
    return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ days: habitLogDaysFromFeatures(tenant.features) });
}

export async function PUT(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    days?: unknown;
  } | null;
  const days = parseHabitLogDays(body?.days);

  if (days === null) {
    return NextResponse.json({ error: "Valor no válido" }, { status: 400 });
  }

  const { data: tenant, error: readError } = await loadTenant(
    session.trainer_id
  );

  if (readError || !tenant) {
    return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });
  }

  const features =
    tenant.features !== null && typeof tenant.features === "object"
      ? (tenant.features as Record<string, unknown>)
      : {};
  const { error: writeError } = await createSupabaseClient()
    .from("tenants")
    .update({ features: { ...features, habit_log_days: days } })
    .eq("trainer_id", session.trainer_id);

  if (writeError) {
    console.error(`${LOG_PREFIX} update failed:`, {
      correlationId,
      error: writeError.message,
    });

    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }

  clearTenantCache(tenant.slug);

  return NextResponse.json({ success: true, days });
}
