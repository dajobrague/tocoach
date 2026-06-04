import type {
  OverrideRow,
  OverrideScope,
  OverrideType,
} from "./override-types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MealSlotOptionService } from "./meal-slot-option-service";

const TABLE = "meal_cycle_overrides";
const CYCLES_TABLE = "meal_cycles";
const SLOTS_TABLE = "meal_slots";

export interface CreateOverrideInput {
  cycleId: string;
  overrideType: OverrideType;
  scope: OverrideScope;
  anchorDate: string;
  dayIndex?: number | null;
  slotId?: string | null;
  noteText?: string | null;
  swapSourceType?: "recipe" | "food" | null;
  swapSourceRefId?: string | null;
  /** Grams for a food swap source (ignored for recipes). */
  swapQuantity?: number;
}

export interface UpdateOverrideInput {
  scope?: OverrideScope;
  anchorDate?: string;
  dayIndex?: number | null;
  slotId?: string | null;
  noteText?: string | null;
  swapSourceType?: "recipe" | "food" | null;
  swapSourceRefId?: string | null;
  swapQuantity?: number;
}

/**
 * Trainer-authored cycle overrides (P7-T2).
 *
 * Every method is scoped by `tenant_host`, so one tenant can never read or
 * mutate another's overrides; the route additionally enforces that the trainer
 * owns the cycle's client (clients.tenant = trainer id). A swap freezes its
 * `swap_snapshot` via {@link MealSlotOptionService.freezeSource} at write time
 * (§4.1) — a later edit of the swapped-in recipe never alters the override.
 *
 * Returns `null` when the cycle/slot/source isn't found for the tenant (the
 * route maps that to 404, and no row is written).
 */
export class OverrideService {
  private readonly client: SupabaseClient;
  private readonly options: MealSlotOptionService;

  constructor(client: SupabaseClient) {
    this.client = client;
    this.options = new MealSlotOptionService(client);
  }

  async create(
    tenantHost: string,
    input: CreateOverrideInput
  ): Promise<OverrideRow | null> {
    const clientId = await this.cycleClientId(tenantHost, input.cycleId);

    if (clientId === null) {
      return null;
    }

    if (input.slotId !== undefined && input.slotId !== null) {
      const ok = await this.slotInCycle(
        tenantHost,
        input.cycleId,
        input.slotId
      );

      if (ok === false) {
        return null;
      }
    }

    let snapshot = null;

    if (input.overrideType === "swap") {
      snapshot = await this.options.freezeSource(
        tenantHost,
        input.swapSourceType!,
        input.swapSourceRefId!,
        input.swapQuantity ?? 0
      );

      if (snapshot === null) {
        return null;
      }
    }

    const isSwap = input.overrideType === "swap";
    const { data, error } = await this.client
      .from(TABLE)
      .insert({
        tenant_host: tenantHost,
        cycle_id: input.cycleId,
        client_id: clientId,
        override_type: input.overrideType,
        scope: input.scope,
        anchor_date: input.anchorDate,
        day_index: input.dayIndex ?? null,
        slot_id: input.slotId ?? null,
        note_text: input.noteText ?? null,
        swap_source_type: isSwap ? input.swapSourceType : null,
        swap_source_ref_id: isSwap ? input.swapSourceRefId : null,
        swap_snapshot: snapshot,
      })
      .select()
      .single();

    if (error !== null) {
      throw new Error(`OverrideService.create failed: ${error.message}`);
    }

    return data as OverrideRow;
  }

  async update(
    tenantHost: string,
    overrideId: string,
    patch: UpdateOverrideInput
  ): Promise<OverrideRow | null> {
    const existing = await this.getById(tenantHost, overrideId);

    if (existing === null) {
      return null;
    }

    const updates: Record<string, unknown> = {};

    if (patch.scope !== undefined) updates.scope = patch.scope;
    if (patch.anchorDate !== undefined) updates.anchor_date = patch.anchorDate;
    if (patch.dayIndex !== undefined) updates.day_index = patch.dayIndex;
    if (patch.noteText !== undefined) updates.note_text = patch.noteText;

    if (patch.slotId !== undefined) {
      if (
        patch.slotId !== null &&
        (await this.slotInCycle(
          tenantHost,
          existing.cycle_id,
          patch.slotId
        )) === false
      ) {
        return null;
      }
      updates.slot_id = patch.slotId;
    }

    // Re-freeze the swap when its source changes (keeps §4.1 on edit).
    if (
      patch.swapSourceType !== undefined ||
      patch.swapSourceRefId !== undefined
    ) {
      const sourceType = patch.swapSourceType ?? existing.swap_source_type;
      const sourceRef = patch.swapSourceRefId ?? existing.swap_source_ref_id;

      if (sourceType === null || sourceRef === null) {
        return null;
      }

      const snapshot = await this.options.freezeSource(
        tenantHost,
        sourceType,
        sourceRef,
        patch.swapQuantity ?? 0
      );

      if (snapshot === null) {
        return null;
      }

      updates.swap_source_type = sourceType;
      updates.swap_source_ref_id = sourceRef;
      updates.swap_snapshot = snapshot;
    }

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    const { data, error } = await this.client
      .from(TABLE)
      .update(updates)
      .eq("tenant_host", tenantHost)
      .eq("id", overrideId)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new Error(`OverrideService.update failed: ${error.message}`);
    }

    return (data as OverrideRow | null) ?? null;
  }

  async delete(
    tenantHost: string,
    overrideId: string
  ): Promise<OverrideRow | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .delete()
      .eq("tenant_host", tenantHost)
      .eq("id", overrideId)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new Error(`OverrideService.delete failed: ${error.message}`);
    }

    return (data as OverrideRow | null) ?? null;
  }

  async getById(
    tenantHost: string,
    overrideId: string
  ): Promise<OverrideRow | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("id", overrideId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`OverrideService.getById failed: ${error.message}`);
    }

    return (data as OverrideRow | null) ?? null;
  }

  async listForCycle(
    tenantHost: string,
    cycleId: string
  ): Promise<OverrideRow[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("cycle_id", cycleId)
      .order("created_at", { ascending: true });

    if (error !== null) {
      throw new Error(`OverrideService.listForCycle failed: ${error.message}`);
    }

    return (data ?? []) as OverrideRow[];
  }

  /** The cycle's authoritative `client_id`, or `null` if not in the tenant. */
  private async cycleClientId(
    tenantHost: string,
    cycleId: string
  ): Promise<number | null> {
    const { data, error } = await this.client
      .from(CYCLES_TABLE)
      .select("client_id")
      .eq("tenant_host", tenantHost)
      .eq("id", cycleId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`OverrideService.cycleClientId failed: ${error.message}`);
    }

    return data === null ? null : (data as { client_id: number }).client_id;
  }

  /** Whether `slotId` belongs to `cycleId` within the tenant. */
  private async slotInCycle(
    tenantHost: string,
    cycleId: string,
    slotId: string
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from(SLOTS_TABLE)
      .select("id")
      .eq("tenant_host", tenantHost)
      .eq("cycle_id", cycleId)
      .eq("id", slotId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`OverrideService.slotInCycle failed: ${error.message}`);
    }

    return data !== null;
  }
}
