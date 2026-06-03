import type { SupabaseClient } from "@supabase/supabase-js";

const CYCLES_TABLE = "meal_cycles";
const SLOTS_TABLE = "meal_slots";

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

/** Thrown for invalid cycle/slot input (e.g. empty name, out-of-range day). */
export class MealCycleValidationError extends Error {}

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
}
