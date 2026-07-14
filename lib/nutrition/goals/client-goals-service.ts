import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "client_nutrition_goals";

/** A client's daily nutrition targets (kcal + macros, in grams). */
export interface NutritionGoals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const FIELDS: (keyof NutritionGoals)[] = [
  "kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
];

/** Thrown for invalid goal values (non-integer, negative, or zero kcal). */
export class ClientGoalsValidationError extends Error {}

/**
 * Tenant-scoped read/write of a client's daily nutrition goals. One row per
 * (tenant_host, client_id); absent until a trainer saves one, in which case the
 * app falls back to its built-in defaults. The Supabase client is injected for
 * testability. Every query filters on `tenant_host`.
 */
export class ClientGoalsService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** The client's saved goals, or null when none exist yet. */
  async get(
    tenantHost: string,
    clientId: number
  ): Promise<NutritionGoals | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("tenant_host", tenantHost)
      .eq("client_id", clientId)
      .maybeSingle();

    if (error !== null) {
      throw new Error(`ClientGoalsService.get failed: ${error.message}`);
    }

    return (data as NutritionGoals | null) ?? null;
  }

  /** Create or replace the client's goals (validated). Returns the saved row. */
  async upsert(
    tenantHost: string,
    clientId: number,
    goals: NutritionGoals
  ): Promise<NutritionGoals> {
    for (const field of FIELDS) {
      const value = goals[field];

      if (Number.isInteger(value) === false || value < 0) {
        throw new ClientGoalsValidationError(
          `${field} must be a non-negative integer`
        );
      }
    }

    if (goals.kcal < 1) {
      throw new ClientGoalsValidationError("kcal must be a positive integer");
    }

    const { data, error } = await this.client
      .from(TABLE)
      .upsert(
        {
          tenant_host: tenantHost,
          client_id: clientId,
          kcal: goals.kcal,
          protein_g: goals.protein_g,
          carbs_g: goals.carbs_g,
          fat_g: goals.fat_g,
        },
        { onConflict: "tenant_host,client_id" }
      )
      .select("kcal, protein_g, carbs_g, fat_g")
      .single();

    if (error !== null) {
      throw new Error(`ClientGoalsService.upsert failed: ${error.message}`);
    }

    return data as NutritionGoals;
  }
}
