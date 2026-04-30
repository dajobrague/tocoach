/**
 * Loads (or lazily creates) the trainer's chart template.
 *
 * Migration 083 seeds a row for every trainer existing at apply time.
 * Trainers created AFTER the migration ran would have no row — so on
 * first GET we lazy-create the row with the starter shape (mirrors the
 * existing pattern in /api/forms/configs/[clientId]/route.ts).
 *
 * Returned `updated_at` is the ETag the route hands back as a header for
 * subsequent PUTs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChartsDocument } from "../types";

import { buildStarterDocument } from "../starter";

export interface TemplateRecord {
  id: string;
  charts: ChartsDocument;
  auto_apply_to_new_clients: boolean;
  updated_at: string;
}

/**
 * Read the trainer's template, lazy-creating the starter on first access.
 * Concurrent first-loads can race; the unique constraint
 * (tenant_host, trainer_id) makes the second insert fail with 23505 and
 * we just re-read.
 */
export async function loadOrCreateTrainerTemplate(
  supabase: SupabaseClient,
  args: { tenantHost: string; trainerId: string }
): Promise<TemplateRecord> {
  const { tenantHost, trainerId } = args;

  const existing = await supabase
    .from("trainer_chart_templates")
    .select("id, charts, auto_apply_to_new_clients, updated_at")
    .eq("tenant_host", tenantHost)
    .eq("trainer_id", trainerId)
    .maybeSingle();

  if (existing.data) {
    return existing.data as TemplateRecord;
  }

  // Lazy-create with the starter shape.
  const starter = buildStarterDocument();
  const insert = await supabase
    .from("trainer_chart_templates")
    .insert({
      tenant_host: tenantHost,
      trainer_id: trainerId,
      charts: starter,
      auto_apply_to_new_clients: true,
    })
    .select("id, charts, auto_apply_to_new_clients, updated_at")
    .single();

  if (insert.error) {
    // Probably 23505 (unique violation) — another request raced us.
    // Read and return whatever's there.
    const reread = await supabase
      .from("trainer_chart_templates")
      .select("id, charts, auto_apply_to_new_clients, updated_at")
      .eq("tenant_host", tenantHost)
      .eq("trainer_id", trainerId)
      .single();

    if (reread.error || !reread.data) {
      throw new Error(
        `Failed to lazy-create chart template: ${insert.error.message}`
      );
    }

    return reread.data as TemplateRecord;
  }

  return insert.data as TemplateRecord;
}

/**
 * Read the per-client config row, returning null when no override exists.
 * Routes that need the "effective config" (override OR template) call
 * `loadEffectiveClientCharts` below.
 */
export async function loadClientChartConfig(
  supabase: SupabaseClient,
  args: { tenantHost: string; clientIdBigint: number }
): Promise<{
  id: string;
  charts: ChartsDocument;
  updated_at: string;
} | null> {
  const { data, error } = await supabase
    .from("client_chart_configs")
    .select("id, charts, updated_at")
    .eq("tenant_host", args.tenantHost)
    .eq("client_id", args.clientIdBigint)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client chart config: ${error.message}`);
  }

  return data
    ? {
        id: data.id,
        charts: data.charts as ChartsDocument,
        updated_at: data.updated_at,
      }
    : null;
}

/**
 * Resolve the "effective" charts a client should see — their override if
 * present, else the trainer's template. Used by the snapshot endpoint and
 * by the per-client GET route.
 *
 * `clientTrainerId` is the trainer that owns this client (already resolved
 * by the caller via tenants.trainer_id).
 */
export async function loadEffectiveClientCharts(
  supabase: SupabaseClient,
  args: {
    tenantHost: string;
    clientIdBigint: number;
    clientTrainerId: string;
  }
): Promise<{
  source: "override" | "template";
  charts: ChartsDocument;
  /** updated_at of the row that supplied the charts (used for ETag). */
  updated_at: string;
}> {
  const override = await loadClientChartConfig(supabase, {
    tenantHost: args.tenantHost,
    clientIdBigint: args.clientIdBigint,
  });

  if (override) {
    return {
      source: "override",
      charts: override.charts,
      updated_at: override.updated_at,
    };
  }
  const template = await loadOrCreateTrainerTemplate(supabase, {
    tenantHost: args.tenantHost,
    trainerId: args.clientTrainerId,
  });

  return {
    source: "template",
    charts: template.charts,
    updated_at: template.updated_at,
  };
}
