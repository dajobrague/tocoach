/**
 * Audit-table writer.
 *
 * Best-effort, non-blocking by contract: the underlying save MUST have
 * already committed before we attempt the audit insert. A failed insert
 * here is logged but never propagates back to the caller.
 *
 * Schema is defined in supabase/migrations/083_create_chart_system.sql:
 *   chart_config_audit (
 *     tenant_host, actor_user_id, target_kind, target_id, action,
 *     before_charts, after_charts, metadata
 *   )
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The JSONB columns accept any chart document shape — we deliberately
 * type them as `unknown | null` so callers can pass either the strict
 * `ChartsDocument` from types.ts or the zod-inferred input type, without
 * an explicit cast under exactOptionalPropertyTypes.
 */
type ChartsJson = unknown | null;

export type AuditAction = "save" | "apply_to_all" | "reset_to_template";
export type AuditTargetKind = "template" | "client";

export interface ChartAuditEntry {
  tenantHost: string;
  actorUserId: string;
  targetKind: AuditTargetKind;
  /** template id (uuid) or client id (bigint cast to text). */
  targetId: string;
  action: AuditAction;
  before?: ChartsJson;
  after?: ChartsJson;
  metadata?: Record<string, unknown>;
}

export async function writeChartAudit(
  supabase: SupabaseClient,
  entry: ChartAuditEntry
): Promise<void> {
  try {
    const { error } = await supabase.from("chart_config_audit").insert({
      tenant_host: entry.tenantHost,
      actor_user_id: entry.actorUserId,
      target_kind: entry.targetKind,
      target_id: entry.targetId,
      action: entry.action,
      before_charts: entry.before ?? null,
      after_charts: entry.after ?? null,
      metadata: entry.metadata ?? {},
    });

    if (error) {
      console.warn("[charts/audit] insert failed:", {
        error: error.message,
        action: entry.action,
        target: `${entry.targetKind}:${entry.targetId}`,
      });
    }
  } catch (err) {
    console.warn("[charts/audit] insert threw:", {
      error: err instanceof Error ? err.message : String(err),
      action: entry.action,
    });
  }
}

/**
 * Bulk-write one audit row per affected client for apply-to-all. Inserts
 * are batched to a single SQL call.
 */
export async function writeApplyToAllAudit(
  supabase: SupabaseClient,
  base: Pick<ChartAuditEntry, "tenantHost" | "actorUserId">,
  affected: Array<{ clientIdBigint: number; before: ChartsJson }>
): Promise<void> {
  if (affected.length === 0) return;
  try {
    const rows = affected.map((a) => ({
      tenant_host: base.tenantHost,
      actor_user_id: base.actorUserId,
      target_kind: "client" as const,
      target_id: String(a.clientIdBigint),
      action: "apply_to_all" as const,
      before_charts: a.before,
      after_charts: null,
      metadata: { count: affected.length },
    }));
    const { error } = await supabase.from("chart_config_audit").insert(rows);

    if (error) {
      console.warn("[charts/audit] apply_to_all batch failed:", {
        error: error.message,
        affected: affected.length,
      });
    }
  } catch (err) {
    console.warn("[charts/audit] apply_to_all threw:", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
