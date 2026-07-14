import type { NutritionGoals } from "./client-goals-service";
import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "client_goal_presets";
const COLUMNS = "id, name, kcal, protein_g, carbs_g, fat_g";

/** A named daily objective for one client (e.g. "Día de entrenamiento"). */
export interface GoalPreset extends NutritionGoals {
  id: string;
  name: string;
}

export interface GoalPresetInput extends NutritionGoals {
  name: string;
}

/** Thrown for invalid preset values (empty name, bad numbers, duplicate name). */
export class GoalPresetValidationError extends Error {}

function validate(input: GoalPresetInput): GoalPresetInput {
  const name = input.name.trim();

  if (name.length === 0) {
    throw new GoalPresetValidationError("El nombre es obligatorio");
  }

  for (const field of ["kcal", "protein_g", "carbs_g", "fat_g"] as const) {
    const value = input[field];

    if (Number.isInteger(value) === false || value < 0) {
      throw new GoalPresetValidationError(
        `${field} debe ser un entero no negativo`
      );
    }
  }

  if (input.kcal < 1) {
    throw new GoalPresetValidationError("kcal debe ser un entero positivo");
  }

  return { ...input, name };
}

/**
 * Tenant-scoped CRUD for a client's named goal presets. Presets are assigned
 * to plan days via `meal_cycles.day_targets`; deleting one is allowed — the
 * day simply falls back to the client's default goals at read time. Every
 * query filters on `tenant_host`. The Supabase client is injected for
 * testability.
 */
export class GoalPresetsService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async list(tenantHost: string, clientId: number): Promise<GoalPreset[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_host", tenantHost)
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error !== null) {
      throw new Error(`GoalPresetsService.list failed: ${error.message}`);
    }

    return (data ?? []) as GoalPreset[];
  }

  async create(
    tenantHost: string,
    clientId: number,
    input: GoalPresetInput
  ): Promise<GoalPreset> {
    const valid = validate(input);

    const { data, error } = await this.client
      .from(TABLE)
      .insert({
        tenant_host: tenantHost,
        client_id: clientId,
        name: valid.name,
        kcal: valid.kcal,
        protein_g: valid.protein_g,
        carbs_g: valid.carbs_g,
        fat_g: valid.fat_g,
      })
      .select(COLUMNS)
      .single();

    if (error !== null) {
      if (error.code === "23505") {
        throw new GoalPresetValidationError(
          "Ya existe un objetivo con ese nombre"
        );
      }

      throw new Error(`GoalPresetsService.create failed: ${error.message}`);
    }

    return data as GoalPreset;
  }

  /** Replace a preset's name and targets. Null when not the tenant's. */
  async update(
    tenantHost: string,
    presetId: string,
    input: GoalPresetInput
  ): Promise<GoalPreset | null> {
    const valid = validate(input);

    const { data, error } = await this.client
      .from(TABLE)
      .update({
        name: valid.name,
        kcal: valid.kcal,
        protein_g: valid.protein_g,
        carbs_g: valid.carbs_g,
        fat_g: valid.fat_g,
      })
      .eq("tenant_host", tenantHost)
      .eq("id", presetId)
      .select(COLUMNS)
      .maybeSingle();

    if (error !== null) {
      if (error.code === "23505") {
        throw new GoalPresetValidationError(
          "Ya existe un objetivo con ese nombre"
        );
      }

      throw new Error(`GoalPresetsService.update failed: ${error.message}`);
    }

    return (data as GoalPreset | null) ?? null;
  }

  /** Delete a preset. Days assigned to it fall back to the default goals. */
  async delete(tenantHost: string, presetId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(TABLE)
      .delete()
      .eq("tenant_host", tenantHost)
      .eq("id", presetId)
      .select("id")
      .maybeSingle();

    if (error !== null) {
      throw new Error(`GoalPresetsService.delete failed: ${error.message}`);
    }

    return data !== null;
  }

  /** id → goals for a client's presets (for resolving day targets). */
  async mapByIdForClient(
    tenantHost: string,
    clientId: number
  ): Promise<Map<string, GoalPreset>> {
    const presets = await this.list(tenantHost, clientId);

    return new Map(presets.map((preset) => [preset.id, preset]));
  }
}
