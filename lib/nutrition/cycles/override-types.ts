import type { OptionSnapshot } from "./option-snapshot";

/** A trainer override is either free-text guidance or a slot swap. */
export type OverrideType = "note" | "swap";

/**
 * How far an override reaches:
 *   * single_day  — only on `anchor_date`
 *   * day_forward — on `anchor_date` and every date after it
 *   * every_cycle — on every rotation day whose index equals `day_index`
 */
export type OverrideScope = "single_day" | "day_forward" | "every_cycle";

/** A row of `meal_cycle_overrides` (see migration 20260604074500). */
export interface OverrideRow {
  id: string;
  tenant_host: string;
  cycle_id: string;
  client_id: number;
  override_type: OverrideType;
  scope: OverrideScope;
  anchor_date: string;
  day_index: number | null;
  slot_id: string | null;
  note_text: string | null;
  swap_source_type: "recipe" | "food" | null;
  swap_source_ref_id: string | null;
  swap_snapshot: OptionSnapshot | null;
  /** Multi-item swap: ordered frozen snapshots. Null for legacy single swaps. */
  swap_snapshots: OptionSnapshot[] | null;
  created_at: string;
  updated_at: string;
}
