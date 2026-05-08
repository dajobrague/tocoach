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
import { chartConfigSchema } from "../validation";

export interface TemplateRecord {
  id: string;
  charts: ChartsDocument;
  auto_apply_to_new_clients: boolean;
  updated_at: string;
}

/**
 * Filter out invalid charts from a ChartsDocument so a single corrupted
 * entry doesn't lock the trainer out of the editor. Logs each dropped
 * chart's issues to the server console for diagnosis.
 *
 * Why this is necessary:
 *   - The PUT endpoint validates strictly (returns 422 on any bad chart).
 *   - GET historically returned whatever was in the DB.
 *   - If a corrupt save happened in the past (unknown chart_type, missing
 *     `color`, etc.), GET hands the bad data back to the client; subsequent
 *     PUTs fail forever because the local doc still contains the bad chart.
 *   - Stripping bad charts on read lets the editor recover automatically;
 *     the trainer just sees fewer charts and can re-add what they want.
 */
export function sanitizeChartsDocument(raw: unknown): ChartsDocument {
  if (!raw || typeof raw !== "object") {
    return { version: 1, charts: [] };
  }
  const doc = raw as Record<string, unknown>;
  const rawCharts = Array.isArray(doc.charts) ? doc.charts : [];
  const cleaned: unknown[] = [];
  let dropped = 0;

  for (const c of rawCharts) {
    const r = chartConfigSchema.safeParse(c);

    if (r.success) {
      cleaned.push(r.data);
    } else {
      dropped += 1;
      console.warn(
        "[charts] dropping invalid chart from stored doc:",
        JSON.stringify(c),
        "issues:",
        JSON.stringify(r.error.issues)
      );
    }
  }
  if (dropped > 0) {
    console.warn(
      `[charts] sanitizeChartsDocument: dropped ${dropped} invalid chart(s)`
    );
  }
  // Renumber positions to match new array order.
  const charts = cleaned.map((c, i) => ({
    ...(c as Record<string, unknown>),
    position: i,
  }));

  return { version: 1, charts: charts as ChartsDocument["charts"] };
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
    return {
      ...(existing.data as TemplateRecord),
      charts: sanitizeChartsDocument(existing.data.charts),
    };
  }

  // Lazy-create can fail with a FK violation when the trainer's session
  // `tenant_host` doesn't exist in the `tenants` table (orphan trainer —
  // observed for ~2/33 trainers in production). Verify the tenant row
  // exists first; if not, return a safe in-memory template rather than
  // 500ing every chart fetch for that trainer. The trainer simply sees
  // an empty starter and won't be able to save until the tenant row is
  // restored — but reads (snapshot, client view) keep working.
  const tenantCheck = await supabase
    .from("tenants")
    .select("host")
    .eq("host", tenantHost)
    .maybeSingle();

  if (!tenantCheck.data) {
    console.warn(
      `[charts] orphan trainer tenant_host="${tenantHost}" trainer_id="${trainerId}" — returning ephemeral starter template (DB write skipped).`
    );

    return {
      id: "ephemeral",
      charts: buildStarterDocument(),
      auto_apply_to_new_clients: true,
      updated_at: new Date(0).toISOString(),
    };
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
      console.warn(
        `[charts] lazy-create failed and re-read empty for tenant_host="${tenantHost}" trainer_id="${trainerId}": ${insert.error.message}. Falling back to ephemeral starter.`
      );

      return {
        id: "ephemeral",
        charts: buildStarterDocument(),
        auto_apply_to_new_clients: true,
        updated_at: new Date(0).toISOString(),
      };
    }

    return {
      ...(reread.data as TemplateRecord),
      charts: sanitizeChartsDocument(reread.data.charts),
    };
  }

  return {
    ...(insert.data as TemplateRecord),
    charts: sanitizeChartsDocument(insert.data.charts),
  };
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
        charts: sanitizeChartsDocument(data.charts),
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
