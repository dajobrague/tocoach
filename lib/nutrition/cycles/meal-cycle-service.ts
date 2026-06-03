import type { MealSlotOptionRow } from "./meal-slot-option-service";
import type { SupabaseClient } from "@supabase/supabase-js";

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

    for (const option of (data ?? []) as MealSlotOptionRow[]) {
      const list = bySlot.get(option.slot_id) ?? [];

      list.push(option);
      bySlot.set(option.slot_id, list);
    }

    return bySlot;
  }
}
