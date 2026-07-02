import type { MealSlotOptionRow } from "./meal-slot-option-service";
import type { SnapshotMedia } from "./option-snapshot";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MealSlotOptionService } from "./meal-slot-option-service";
import { overlayLiveMedia } from "./option-snapshot";

import { RecipeMediaService } from "@/lib/nutrition/recipes/recipe-media-service";

const CYCLES_TABLE = "meal_cycles";
const SLOTS_TABLE = "meal_slots";
const OPTIONS_TABLE = "meal_slot_options";

export type CycleStatus = "draft" | "active" | "archived";

/** A row of `meal_cycles` (see migration 20260603052805). */
export interface MealCycleRow {
  id: string;
  tenant_host: string;
  trainer_id: string;
  client_id: number;
  name: string;
  duration_days: number;
  start_date: string;
  status: CycleStatus;
  created_at: string;
  updated_at: string;
}

/** A row of `meal_slots`. */
export interface MealSlotRow {
  id: string;
  cycle_id: string;
  tenant_host: string;
  day_index: number;
  label: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCycleInput {
  trainerId: string;
  clientId: number;
  name: string;
  durationDays: number;
  startDate?: string;
  status?: CycleStatus;
}

export interface AddSlotInput {
  dayIndex: number;
  label?: string;
  position?: number;
}

export interface UpdateCycleInput {
  name?: string;
  durationDays?: number;
  startDate?: string;
  status?: CycleStatus;
}

export interface UpdateSlotInput {
  dayIndex?: number;
  label?: string;
  position?: number;
}

export interface CycleListFilter {
  clientId?: number;
}

/** A slot with its (ordered) options, used in the cycle tree response. */
export interface MealSlotWithOptions extends MealSlotRow {
  options: MealSlotOptionRow[];
}

/** A cycle with its full slots → options tree. */
export interface MealCycleTree extends MealCycleRow {
  slots: MealSlotWithOptions[];
}

/** Thrown for invalid cycle/slot input (e.g. empty name, out-of-range day). */
export class MealCycleValidationError extends Error {}

/**
 * Thrown when activating a cycle would give a client a second active cycle.
 * The DB partial-unique index `meal_cycles_one_active_per_client_idx` is the
 * backstop; this app-layer check produces a clean 409 before hitting it.
 */
export class ActiveCycleConflictError extends Error {}

/**
 * Minimal tenant-scoped CRUD for cycles and their slots. Every query filters on
 * `tenant_host`, so one tenant can never read or mutate another's. The Supabase
 * client is injected for testability. (Meal options live in
 * MealSlotOptionService, which freezes a snapshot on create — see §4.1.)
 */
export class MealCycleService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async create(
    tenantHost: string,
    input: CreateCycleInput
  ): Promise<MealCycleRow> {
    const name = input.name.trim();

    if (name.length === 0) {
      throw new MealCycleValidationError("Cycle name is required");
    }

    if (
      Number.isInteger(input.durationDays) === false ||
      input.durationDays < 1
    ) {
      throw new MealCycleValidationError(
        "durationDays must be a positive integer"
      );
    }

    const payload: Record<string, unknown> = {
      tenant_host: tenantHost,
      trainer_id: input.trainerId,
      client_id: input.clientId,
      name,
      duration_days: input.durationDays,
      status: input.status ?? "draft",
    };

    if (input.startDate !== undefined) payload.start_date = input.startDate;

    const { data, error } = await this.client
      .from(CYCLES_TABLE)
      .insert(payload)
      .select()
      .single();

    if (error !== null) {
      throw new Error(`MealCycleService.create failed: ${error.message}`);
    }

    return data as MealCycleRow;
  }

  async getById(tenantHost: string, id: string): Promise<MealCycleRow | null> {
    const { data, error } = await this.client
      .from(CYCLES_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("id", id)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`MealCycleService.getById failed: ${error.message}`);
    }

    return (data as MealCycleRow | null) ?? null;
  }

  /** Add a slot to a cycle owned by the tenant. Returns null if not owned. */
  async addSlot(
    tenantHost: string,
    cycleId: string,
    input: AddSlotInput
  ): Promise<MealSlotRow | null> {
    const cycle = await this.getById(tenantHost, cycleId);

    if (cycle === null) {
      return null;
    }

    if (
      Number.isInteger(input.dayIndex) === false ||
      input.dayIndex < 0 ||
      input.dayIndex >= cycle.duration_days
    ) {
      throw new MealCycleValidationError(
        `dayIndex must be within 0..${cycle.duration_days - 1}`
      );
    }

    const { data, error } = await this.client
      .from(SLOTS_TABLE)
      .insert({
        cycle_id: cycleId,
        tenant_host: tenantHost,
        day_index: input.dayIndex,
        label: input.label ?? "",
        position: input.position ?? 0,
      })
      .select()
      .single();

    if (error !== null) {
      throw new Error(`MealCycleService.addSlot failed: ${error.message}`);
    }

    return data as MealSlotRow;
  }

  /**
   * Replace `targetDayIndex` with a copy of `sourceDayIndex`: delete the target
   * day's slots (cascading their options), then recreate each source slot on the
   * target day and copy its options verbatim — the frozen snapshots (and their
   * exact per-client portions) are preserved. Powers both "Duplicar día"
   * (target picked) and "Copiar desde otro día" (source picked). Tenant-scoped.
   * Returns null when the cycle isn't the tenant's; throws
   * {@link MealCycleValidationError} for out-of-range or equal day indices.
   */
  async copyDay(
    tenantHost: string,
    cycleId: string,
    sourceDayIndex: number,
    targetDayIndex: number
  ): Promise<boolean | null> {
    const cycle = await this.getById(tenantHost, cycleId);

    if (cycle === null) {
      return null;
    }

    for (const dayIndex of [sourceDayIndex, targetDayIndex]) {
      if (
        Number.isInteger(dayIndex) === false ||
        dayIndex < 0 ||
        dayIndex >= cycle.duration_days
      ) {
        throw new MealCycleValidationError(
          `dayIndex must be within 0..${cycle.duration_days - 1}`
        );
      }
    }

    if (sourceDayIndex === targetDayIndex) {
      throw new MealCycleValidationError(
        "source and target day must be different"
      );
    }

    const { data, error } = await this.client
      .from(SLOTS_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("cycle_id", cycleId)
      .order("position", { ascending: true });

    if (error !== null) {
      throw new Error(`MealCycleService.copyDay slots: ${error.message}`);
    }

    const slots = (data ?? []) as MealSlotRow[];
    const source = slots.filter((slot) => slot.day_index === sourceDayIndex);
    const target = slots.filter((slot) => slot.day_index === targetDayIndex);

    // Replace: remove the target day's slots (options cascade-delete).
    for (const slot of target) {
      await this.deleteSlot(tenantHost, slot.id);
    }

    // Recreate source slots on the target day, copying options verbatim.
    const options = new MealSlotOptionService(this.client);
    let position = 0;

    for (const slot of source) {
      const created = await this.addSlot(tenantHost, cycleId, {
        dayIndex: targetDayIndex,
        label: slot.label,
        position,
      });

      position += 1;

      if (created !== null) {
        await options.copyOptionsToSlot(tenantHost, slot.id, created.id);
      }
    }

    return true;
  }

  /**
   * Remove a day and renumber the later days down (no gaps): delete every slot
   * on `dayIndex` (options cascade), decrement `day_index` for every slot on a
   * later day, then shrink `duration_days` by 1. Refuses to remove the last
   * remaining day (a cycle keeps at least one). Tenant-scoped: returns null when
   * the cycle isn't the tenant's; throws {@link MealCycleValidationError} for an
   * out-of-range index or a one-day cycle.
   */
  async removeDay(
    tenantHost: string,
    cycleId: string,
    dayIndex: number
  ): Promise<boolean | null> {
    const cycle = await this.getById(tenantHost, cycleId);

    if (cycle === null) {
      return null;
    }

    if (
      Number.isInteger(dayIndex) === false ||
      dayIndex < 0 ||
      dayIndex >= cycle.duration_days
    ) {
      throw new MealCycleValidationError(
        `dayIndex must be within 0..${cycle.duration_days - 1}`
      );
    }

    if (cycle.duration_days <= 1) {
      throw new MealCycleValidationError("A cycle must keep at least one day");
    }

    const { data, error } = await this.client
      .from(SLOTS_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("cycle_id", cycleId);

    if (error !== null) {
      throw new Error(`MealCycleService.removeDay slots: ${error.message}`);
    }

    const slots = (data ?? []) as MealSlotRow[];

    // Drop the removed day's slots (their options cascade-delete).
    for (const slot of slots.filter((s) => s.day_index === dayIndex)) {
      await this.deleteSlot(tenantHost, slot.id);
    }

    // Renumber every later day down by one so there are no gaps.
    for (const slot of slots.filter((s) => s.day_index > dayIndex)) {
      await this.updateSlot(tenantHost, slot.id, {
        dayIndex: slot.day_index - 1,
      });
    }

    await this.update(tenantHost, cycleId, {
      durationDays: cycle.duration_days - 1,
    });

    return true;
  }

  /**
   * Append a new day at the end. With `copyFromDayIndex`, the new day is seeded
   * from a verbatim copy of that day (frozen snapshots preserved via
   * {@link copyDay}); omit it for a blank day. Tenant-scoped: returns null when
   * the cycle isn't the tenant's; throws {@link MealCycleValidationError} for an
   * out-of-range copy source.
   */
  async addDay(
    tenantHost: string,
    cycleId: string,
    copyFromDayIndex?: number
  ): Promise<boolean | null> {
    const cycle = await this.getById(tenantHost, cycleId);

    if (cycle === null) {
      return null;
    }

    const newDayIndex = cycle.duration_days;

    if (copyFromDayIndex !== undefined) {
      if (
        Number.isInteger(copyFromDayIndex) === false ||
        copyFromDayIndex < 0 ||
        copyFromDayIndex >= cycle.duration_days
      ) {
        throw new MealCycleValidationError(
          `copyFromDayIndex must be within 0..${cycle.duration_days - 1}`
        );
      }
    }

    await this.update(tenantHost, cycleId, {
      durationDays: cycle.duration_days + 1,
    });

    if (copyFromDayIndex !== undefined) {
      await this.copyDay(tenantHost, cycleId, copyFromDayIndex, newDayIndex);
    }

    return true;
  }

  /**
   * Move the day at `fromIndex` to `toIndex`, renumbering every day in between
   * (a drag-reorder). Rewrites each slot's `day_index` to its new position;
   * `duration_days` is unchanged. Tenant-scoped: returns null when the cycle
   * isn't the tenant's; throws {@link MealCycleValidationError} for an
   * out-of-range index. Equal indices are a no-op.
   */
  async reorderDay(
    tenantHost: string,
    cycleId: string,
    fromIndex: number,
    toIndex: number
  ): Promise<boolean | null> {
    const cycle = await this.getById(tenantHost, cycleId);

    if (cycle === null) {
      return null;
    }

    for (const dayIndex of [fromIndex, toIndex]) {
      if (
        Number.isInteger(dayIndex) === false ||
        dayIndex < 0 ||
        dayIndex >= cycle.duration_days
      ) {
        throw new MealCycleValidationError(
          `dayIndex must be within 0..${cycle.duration_days - 1}`
        );
      }
    }

    if (fromIndex === toIndex) {
      return true;
    }

    // Permutation: pull the moved day out of the 0..n-1 order and reinsert it at
    // the target, then map each old day index to its new position.
    const order = Array.from({ length: cycle.duration_days }, (_, i) => i);

    order.splice(fromIndex, 1);
    order.splice(toIndex, 0, fromIndex);

    const newIndexByOld = new Map<number, number>();

    order.forEach((oldIndex, newIndex) =>
      newIndexByOld.set(oldIndex, newIndex)
    );

    const { data, error } = await this.client
      .from(SLOTS_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("cycle_id", cycleId);

    if (error !== null) {
      throw new Error(`MealCycleService.reorderDay slots: ${error.message}`);
    }

    // Slots keep their day_index if the day didn't move; multiple slots share a
    // day and all remap together (no unique constraint on day_index).
    for (const slot of (data ?? []) as MealSlotRow[]) {
      const nextDay = newIndexByOld.get(slot.day_index);

      if (nextDay !== undefined && nextDay !== slot.day_index) {
        await this.updateSlot(tenantHost, slot.id, { dayIndex: nextDay });
      }
    }

    return true;
  }

  /** List the tenant's cycles, newest first, optionally filtered by client. */
  async list(
    tenantHost: string,
    filter: CycleListFilter = {}
  ): Promise<MealCycleRow[]> {
    let query = this.client
      .from(CYCLES_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost);

    if (filter.clientId !== undefined) {
      query = query.eq("client_id", filter.clientId);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error !== null) {
      throw new Error(`MealCycleService.list failed: ${error.message}`);
    }

    return (data ?? []) as MealCycleRow[];
  }

  /** A cycle plus its slots (by day_index, position) and each slot's options. */
  async getByIdWithTree(
    tenantHost: string,
    id: string
  ): Promise<MealCycleTree | null> {
    const cycle = await this.getById(tenantHost, id);

    if (cycle === null) {
      return null;
    }

    const { data: slotData, error: slotError } = await this.client
      .from(SLOTS_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("cycle_id", id)
      .order("day_index", { ascending: true })
      .order("position", { ascending: true });

    if (slotError !== null) {
      throw new Error(
        `MealCycleService.getByIdWithTree slots: ${slotError.message}`
      );
    }

    const slots = (slotData ?? []) as MealSlotRow[];
    const optionsBySlot = await this.optionsBySlot(
      tenantHost,
      slots.map((slot) => slot.id)
    );

    return {
      ...cycle,
      slots: slots.map((slot) => ({
        ...slot,
        options: optionsBySlot.get(slot.id) ?? [],
      })),
    };
  }

  /**
   * Update a cycle's duration/start_date/status (tenant-scoped). Activating
   * enforces one active cycle per client: throws {@link ActiveCycleConflictError}
   * if another active cycle exists, and also if the DB unique index trips
   * (the backstop). Returns null when the cycle is not found for the tenant.
   */
  async update(
    tenantHost: string,
    id: string,
    patch: UpdateCycleInput
  ): Promise<MealCycleRow | null> {
    const cycle = await this.getById(tenantHost, id);

    if (cycle === null) {
      return null;
    }

    const updates: Record<string, unknown> = {};

    if (patch.name !== undefined) {
      const name = patch.name.trim();

      if (name.length === 0) {
        throw new MealCycleValidationError("Cycle name is required");
      }

      updates.name = name;
    }

    if (patch.durationDays !== undefined) {
      if (
        Number.isInteger(patch.durationDays) === false ||
        patch.durationDays < 1
      ) {
        throw new MealCycleValidationError(
          "durationDays must be a positive integer"
        );
      }

      updates.duration_days = patch.durationDays;
    }

    if (patch.startDate !== undefined) updates.start_date = patch.startDate;
    if (patch.status !== undefined) updates.status = patch.status;

    if (Object.keys(updates).length === 0) {
      return cycle;
    }

    if (patch.status === "active" && cycle.status !== "active") {
      await this.assertNoOtherActiveCycle(tenantHost, cycle.client_id, id);
    }

    const { data, error } = await this.client
      .from(CYCLES_TABLE)
      .update(updates)
      .eq("tenant_host", tenantHost)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error !== null) {
      if (error.code === "23505") {
        throw new ActiveCycleConflictError(
          "Client already has an active cycle"
        );
      }

      throw new Error(`MealCycleService.update failed: ${error.message}`);
    }

    return (data as MealCycleRow | null) ?? null;
  }

  /** Update a slot (reorder/relabel/move day). dayIndex is range-checked. */
  async updateSlot(
    tenantHost: string,
    slotId: string,
    patch: UpdateSlotInput
  ): Promise<MealSlotRow | null> {
    const slot = await this.getSlot(tenantHost, slotId);

    if (slot === null) {
      return null;
    }

    const updates: Record<string, unknown> = {};

    if (patch.dayIndex !== undefined) {
      const cycle = await this.getById(tenantHost, slot.cycle_id);

      if (
        cycle === null ||
        Number.isInteger(patch.dayIndex) === false ||
        patch.dayIndex < 0 ||
        patch.dayIndex >= cycle.duration_days
      ) {
        throw new MealCycleValidationError(
          `dayIndex must be within 0..${(cycle?.duration_days ?? 1) - 1}`
        );
      }

      updates.day_index = patch.dayIndex;
    }

    if (patch.label !== undefined) updates.label = patch.label;
    if (patch.position !== undefined) updates.position = patch.position;

    if (Object.keys(updates).length === 0) {
      return slot;
    }

    const { data, error } = await this.client
      .from(SLOTS_TABLE)
      .update(updates)
      .eq("tenant_host", tenantHost)
      .eq("id", slotId)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new Error(`MealCycleService.updateSlot failed: ${error.message}`);
    }

    return (data as MealSlotRow | null) ?? null;
  }

  /** Delete a slot (tenant-scoped); its options cascade. Null if not found. */
  async deleteSlot(
    tenantHost: string,
    slotId: string
  ): Promise<MealSlotRow | null> {
    const { data, error } = await this.client
      .from(SLOTS_TABLE)
      .delete()
      .eq("tenant_host", tenantHost)
      .eq("id", slotId)
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new Error(`MealCycleService.deleteSlot failed: ${error.message}`);
    }

    return (data as MealSlotRow | null) ?? null;
  }

  private async getSlot(
    tenantHost: string,
    slotId: string
  ): Promise<MealSlotRow | null> {
    const { data, error } = await this.client
      .from(SLOTS_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .eq("id", slotId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`MealCycleService.getSlot failed: ${error.message}`);
    }

    return (data as MealSlotRow | null) ?? null;
  }

  private async assertNoOtherActiveCycle(
    tenantHost: string,
    clientId: number,
    excludeCycleId: string
  ): Promise<void> {
    const { data, error } = await this.client
      .from(CYCLES_TABLE)
      .select("id")
      .eq("tenant_host", tenantHost)
      .eq("client_id", clientId)
      .eq("status", "active")
      .neq("id", excludeCycleId);

    if (error !== null) {
      throw new Error(
        `MealCycleService.assertNoOtherActiveCycle failed: ${error.message}`
      );
    }

    if ((data ?? []).length > 0) {
      throw new ActiveCycleConflictError("Client already has an active cycle");
    }
  }

  private async optionsBySlot(
    tenantHost: string,
    slotIds: string[]
  ): Promise<Map<string, MealSlotOptionRow[]>> {
    const bySlot = new Map<string, MealSlotOptionRow[]>();

    if (slotIds.length === 0) {
      return bySlot;
    }

    const { data, error } = await this.client
      .from(OPTIONS_TABLE)
      .select("*")
      .eq("tenant_host", tenantHost)
      .in("slot_id", slotIds)
      .order("position", { ascending: true });

    if (error !== null) {
      throw new Error(
        `MealCycleService.optionsBySlot failed: ${error.message}`
      );
    }

    const rows = (data ?? []) as MealSlotOptionRow[];
    // Recipe photos are cosmetic and tracked live: overlay each recipe option's
    // frozen media with the recipe's *current* library media, so a later image
    // edit shows up here (nutrition/ingredients stay frozen). `source_ref_id`s
    // come from these tenant-scoped rows, so the batched lookup is safe.
    const mediaByRecipe = await new RecipeMediaService(
      this.client
    ).listByRecipeIds(
      rows
        .filter((option) => option.source_type === "recipe")
        .map((option) => option.source_ref_id)
    );

    for (const option of rows) {
      const liveMedia = mediaByRecipe.get(option.source_ref_id);
      const enriched: MealSlotOptionRow =
        liveMedia !== undefined
          ? {
              ...option,
              item_snapshot: overlayLiveMedia(
                option.item_snapshot,
                liveMedia.map(
                  (row): SnapshotMedia => ({
                    type: row.type,
                    url: row.url,
                    orientation: row.orientation,
                  })
                )
              ),
            }
          : option;
      const list = bySlot.get(option.slot_id) ?? [];

      list.push(enriched);
      bySlot.set(option.slot_id, list);
    }

    return bySlot;
  }
}
