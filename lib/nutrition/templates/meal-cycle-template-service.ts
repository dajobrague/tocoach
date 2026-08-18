import type { OptionSnapshot } from "@/lib/nutrition/cycles/option-snapshot";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MealCycleService,
  MealCycleValidationError,
  type MealCycleRow,
  type MealCycleTree,
} from "@/lib/nutrition/cycles/meal-cycle-service";

const TEMPLATES_TABLE = "meal_cycle_templates";
const CYCLES_TABLE = "meal_cycles";
const SLOTS_TABLE = "meal_slots";
const OPTIONS_TABLE = "meal_slot_options";

/** One option inside a template document — the portable subset of a
 *  meal_slot_options row (frozen snapshot included). */
interface TemplateOption {
  source_type: "recipe" | "food";
  source_ref_id: string;
  position: number;
  group_index: number;
  item_snapshot: OptionSnapshot;
}

interface TemplateSlot {
  day_index: number;
  label: string;
  position: number;
  options: TemplateOption[];
}

/** Self-contained template payload. day_targets are NOT captured: they
 *  reference per-client goal presets that don't exist on other clients. */
export interface TemplateDocument {
  version: 1;
  duration_days: number;
  day_names: Record<string, string>;
  slots: TemplateSlot[];
}

export interface MealCycleTemplateRow {
  id: string;
  tenant_host: string;
  trainer_id: string | null;
  name: string;
  duration_days: number;
  document: TemplateDocument;
  created_at: string;
  updated_at: string;
}

/** What the list UI needs — no document payload. */
export interface TemplateSummary {
  id: string;
  name: string;
  duration_days: number;
  meals: number;
  created_at: string;
}

function toSummary(row: MealCycleTemplateRow): TemplateSummary {
  return {
    id: row.id,
    name: row.name,
    duration_days: row.duration_days,
    meals: row.document.slots.length,
    created_at: row.created_at,
  };
}

/** The portable subset of a cycle tree — pure so it's unit-testable. */
export function buildTemplateDocument(tree: MealCycleTree): TemplateDocument {
  return {
    version: 1,
    duration_days: tree.duration_days,
    day_names: tree.day_names ?? {},
    slots: tree.slots.map((slot) => ({
      day_index: slot.day_index,
      label: slot.label,
      position: slot.position,
      options: slot.options.map((option) => ({
        source_type: option.source_type,
        source_ref_id: option.source_ref_id,
        position: option.position,
        group_index: option.group_index ?? 0,
        item_snapshot: option.item_snapshot,
      })),
    })),
  };
}

export class MealCycleTemplateService {
  constructor(private readonly client: SupabaseClient) {}

  /** Freeze a cycle's full tree into a reusable tenant template. */
  async saveFromCycle(
    tenantHost: string,
    trainerId: string,
    cycleId: string,
    name: string
  ): Promise<TemplateSummary | null> {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      throw new MealCycleValidationError("Template name is required");
    }

    const cycles = new MealCycleService(this.client);
    const tree = await cycles.getByIdWithTree(tenantHost, cycleId);

    if (tree === null) {
      return null;
    }

    const document = buildTemplateDocument(tree);

    const { data, error } = await this.client
      .from(TEMPLATES_TABLE)
      .insert({
        tenant_host: tenantHost,
        trainer_id: trainerId,
        name: trimmed,
        duration_days: tree.duration_days,
        document,
      })
      .select()
      .single();

    if (error !== null) {
      throw new Error(
        `MealCycleTemplateService.saveFromCycle failed: ${error.message}`
      );
    }

    return toSummary(data as MealCycleTemplateRow);
  }

  async list(tenantHost: string): Promise<TemplateSummary[]> {
    const { data, error } = await this.client
      .from(TEMPLATES_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .order("created_at", { ascending: false });

    if (error !== null) {
      throw new Error(`MealCycleTemplateService.list failed: ${error.message}`);
    }

    return ((data ?? []) as MealCycleTemplateRow[]).map(toSummary);
  }

  /** Delete a template (tenant-scoped). Returns false when not found. */
  async remove(tenantHost: string, templateId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(TEMPLATES_TABLE)
      .delete()
      .eq("tenant_host", tenantHost)
      .eq("id", templateId)
      .select("id");

    if (error !== null) {
      throw new Error(
        `MealCycleTemplateService.remove failed: ${error.message}`
      );
    }

    return (data ?? []).length > 0;
  }

  /**
   * Create a draft cycle for `clientId` from a template: cycle row first,
   * then slots day by day, then options with their frozen snapshots verbatim
   * (mirrors copyOptionsToSlot semantics — no re-freeze). Sequential inserts
   * without a transaction, like the cycle copy-day flow; a mid-flight failure
   * leaves a partial draft the trainer can see and delete.
   */
  async instantiate(
    tenantHost: string,
    templateId: string,
    input: {
      trainerId: string;
      clientId: number;
      name?: string;
      startDate?: string;
    }
  ): Promise<MealCycleRow | null> {
    const { data: templateRow, error } = await this.client
      .from(TEMPLATES_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("id", templateId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(
        `MealCycleTemplateService.instantiate load failed: ${error.message}`
      );
    }

    if (templateRow === null) {
      return null;
    }

    const template = templateRow as MealCycleTemplateRow;
    const cycles = new MealCycleService(this.client);
    const cycle = await cycles.create(tenantHost, {
      trainerId: input.trainerId,
      clientId: input.clientId,
      name: (input.name ?? template.name).trim() || template.name,
      durationDays: template.duration_days,
      status: "draft",
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    });

    const dayNames = template.document.day_names ?? {};

    if (Object.keys(dayNames).length > 0) {
      const { error: namesError } = await this.client
        .from(CYCLES_TABLE)
        .update({ day_names: dayNames })
        .eq("tenant_host", tenantHost)
        .eq("id", cycle.id);

      if (namesError !== null) {
        throw new Error(
          `MealCycleTemplateService.instantiate day_names failed: ${namesError.message}`
        );
      }
    }

    for (const slot of template.document.slots) {
      const { data: slotRow, error: slotError } = await this.client
        .from(SLOTS_TABLE)
        .insert({
          cycle_id: cycle.id,
          tenant_host: tenantHost,
          day_index: slot.day_index,
          label: slot.label,
          position: slot.position,
        })
        .select()
        .single();

      if (slotError !== null) {
        throw new Error(
          `MealCycleTemplateService.instantiate slot failed: ${slotError.message}`
        );
      }

      for (const option of slot.options) {
        const { error: optionError } = await this.client
          .from(OPTIONS_TABLE)
          .insert({
            slot_id: (slotRow as { id: string }).id,
            tenant_host: tenantHost,
            source_type: option.source_type,
            source_ref_id: option.source_ref_id,
            item_snapshot: option.item_snapshot,
            position: option.position,
            group_index: option.group_index,
          });

        if (optionError !== null) {
          throw new Error(
            `MealCycleTemplateService.instantiate option failed: ${optionError.message}`
          );
        }
      }
    }

    return cycle;
  }
}
