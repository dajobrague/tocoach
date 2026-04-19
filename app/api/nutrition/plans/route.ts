/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { NUTRITION_TREE_SELECT } from "@/lib/utils/nutrition-tree";
import { startPerfTimer } from "@/lib/utils/perf-logger";

// ---------------------------------------------------------------------------
// Types for the template tree we read with NUTRITION_TREE_SELECT. Kept
// permissive on purpose: these rows come straight from PostgREST and we don't
// want to force Supabase's generated types on them.
// ---------------------------------------------------------------------------

type TemplateIngredient = {
  id: string;
  option_id?: string | null;
  name: string;
  quantity: string;
  unit: string;
  ingredient_order: number;
  protein: number | string | null;
  carbs: number | string | null;
  fats: number | string | null;
  calories: number | string | null;
};

type TemplateOption = {
  id: string;
  name: string;
  option_order: number;
  protein: number | string | null;
  carbs: number | string | null;
  fats: number | string | null;
  calories: number | string | null;
  image_url: string | null;
  // Item 2.4: recipe fields. All optional; older templates have them NULL.
  instructions: string | null;
  prep_time_minutes: number | null;
  cooking_time_minutes: number | null;
  servings: number | null;
  recipe_notes: string | null;
  nutrition_ingredients?: TemplateIngredient[] | null;
};

type TemplateMeal = {
  id: string;
  label: string;
  meal_order: number;
  notes: string | null;
  protein: number | string | null;
  carbs: number | string | null;
  fats: number | string | null;
  calories: number | string | null;
  image_url: string | null;
  has_alternatives: boolean | null;
  // Item 2.3: tri-state calorie visibility override. null = inherit from plan.
  show_calories: boolean | null;
  nutrition_meal_options?: TemplateOption[] | null;
};

type TemplateDay = {
  id: string;
  day_label: string;
  day_order: number;
  protein: number | string | null;
  carbs: number | string | null;
  fats: number | string | null;
  calories: number | string | null;
  weekdays: unknown[] | null;
  nutrition_meals?: TemplateMeal[] | null;
};

type TemplateTree = {
  id: string;
  notes: string | null;
  show_meal_images: boolean | null;
  // Item 2.3: plan-level calorie visibility (boolean, defaults to true in DB).
  show_calories: boolean | null;
  nutrition_days?: TemplateDay[] | null;
  [key: string]: unknown;
};

/**
 * Clone the full subtree (days → meals → options → ingredients) of a template
 * into a freshly-created plan. Runs as a sequence of 4 batch INSERTs instead
 * of the O(days × meals × options) sequential inserts the route had before
 * Fase 3.
 *
 * Ordering contract: Postgres guarantees that a single INSERT ... VALUES ...
 * RETURNING returns rows in VALUES order. Supabase-js passes this through
 * unchanged. We rely on that to map `templateX[i] → newX[i]` via array index.
 * A strict length check on every batch catches any unexpected divergence.
 *
 * Failure semantics: any batch failure throws. The caller is responsible for
 * deleting the newly created plan so the cascade cleans up whatever got
 * inserted before the failure. This is a stronger guarantee than the
 * pre-Fase-3 code, which silently skipped failed rows.
 */
async function cloneTemplateSubtree(params: {
  supabase: ReturnType<typeof createSupabaseClient>;
  tenantHost: string;
  newPlanId: string;
  templateDays: TemplateDay[];
}): Promise<void> {
  const { supabase, tenantHost, newPlanId, templateDays } = params;

  if (templateDays.length === 0) {
    return; // Nothing to clone.
  }

  // -----------------------------------------------------------------------
  // 1) DAYS — one INSERT for all days of the plan.
  // -----------------------------------------------------------------------
  const dayRows = templateDays.map((td) => ({
    tenant_host: tenantHost,
    nutrition_plan_id: newPlanId,
    day_label: td.day_label,
    day_order: td.day_order,
    protein: td.protein || 0,
    carbs: td.carbs || 0,
    fats: td.fats || 0,
    calories: td.calories || 0,
    weekdays: td.weekdays || [],
  }));

  const { data: newDays, error: daysError } = await supabase
    .from("nutrition_days")
    .insert(dayRows)
    .select("id");

  if (daysError || !newDays || newDays.length !== templateDays.length) {
    throw new Error(
      `clone_days_failed: ${daysError?.message ?? "unexpected length mismatch"}`
    );
  }

  // template_day_id → new_day_id
  const dayIdByTemplateId = new Map<string, string>();

  // Safe index access: length check above guarantees newDays[i] exists.
  templateDays.forEach((td, i) => dayIdByTemplateId.set(td.id, newDays[i]!.id));

  // -----------------------------------------------------------------------
  // 2) MEALS — one INSERT for all meals across every day.
  //    We keep a parallel array of template meals so we can build the
  //    template_meal_id → new_meal_id map once the insert returns.
  // -----------------------------------------------------------------------
  const mealPlanned: {
    row: Record<string, unknown>;
    template: TemplateMeal;
  }[] = [];

  for (const td of templateDays) {
    const newDayId = dayIdByTemplateId.get(td.id)!;

    for (const tm of td.nutrition_meals ?? []) {
      mealPlanned.push({
        template: tm,
        row: {
          tenant_host: tenantHost,
          nutrition_day_id: newDayId,
          label: tm.label,
          meal_order: tm.meal_order,
          notes: tm.notes,
          protein: tm.protein || 0,
          carbs: tm.carbs || 0,
          fats: tm.fats || 0,
          calories: tm.calories || 0,
          image_url: tm.image_url ?? null,
          has_alternatives: tm.has_alternatives ?? false,
          // Item 2.3: preserve meal-level calorie visibility (tri-state).
          show_calories: tm.show_calories ?? null,
        },
      });
    }
  }

  const mealIdByTemplateId = new Map<string, string>();

  if (mealPlanned.length > 0) {
    const { data: newMeals, error: mealsError } = await supabase
      .from("nutrition_meals")
      .insert(mealPlanned.map((m) => m.row))
      .select("id");

    if (mealsError || !newMeals || newMeals.length !== mealPlanned.length) {
      throw new Error(
        `clone_meals_failed: ${mealsError?.message ?? "unexpected length mismatch"}`
      );
    }

    // Safe index access: length check above guarantees newMeals[i] exists.
    mealPlanned.forEach((m, i) =>
      mealIdByTemplateId.set(m.template.id, newMeals[i]!.id)
    );
  }

  // -----------------------------------------------------------------------
  // 3) OPTIONS — one INSERT for all options.
  //    Each template meal contributes either its template options, or (if
  //    it had none) a single fallback "Opción 1" derived from the meal's
  //    macros. This matches the pre-Fase-3 fallback branch.
  //
  //    We track a couple of maps:
  //     - optionIdByTemplateId: template_option_id → new_option_id (only for
  //       rows that correspond to a real template option).
  //     - defaultOptionIdByNewMealId: new_meal_id → id of its first option,
  //       used to route any ingredient whose template option_id doesn't map
  //       cleanly (defensive; should never happen after migration 073).
  // -----------------------------------------------------------------------
  type PlannedOption =
    | {
        kind: "template";
        row: Record<string, unknown>;
        template: TemplateOption;
        newMealId: string;
      }
    | {
        kind: "fallback";
        row: Record<string, unknown>;
        newMealId: string;
      };

  const optionPlanned: PlannedOption[] = [];

  for (const m of mealPlanned) {
    const newMealId = mealIdByTemplateId.get(m.template.id)!;
    const templateOptions = m.template.nutrition_meal_options ?? [];

    if (templateOptions.length > 0) {
      for (const to of templateOptions) {
        optionPlanned.push({
          kind: "template",
          template: to,
          newMealId,
          row: {
            meal_id: newMealId,
            name: to.name,
            option_order: to.option_order,
            protein: to.protein,
            carbs: to.carbs,
            fats: to.fats,
            calories: to.calories,
            image_url: to.image_url ?? null,
            // Item 2.4: preserve recipe fields when cloning from template.
            instructions: to.instructions ?? null,
            prep_time_minutes: to.prep_time_minutes ?? null,
            cooking_time_minutes: to.cooking_time_minutes ?? null,
            servings: to.servings ?? null,
            recipe_notes: to.recipe_notes ?? null,
          },
        });
      }
    } else {
      // Fallback: promote meal-level macros into a default "Opción 1".
      optionPlanned.push({
        kind: "fallback",
        newMealId,
        row: {
          meal_id: newMealId,
          name: "Opción 1",
          option_order: 1,
          protein: m.template.protein ?? null,
          carbs: m.template.carbs ?? null,
          fats: m.template.fats ?? null,
          calories: m.template.calories ?? null,
          image_url: m.template.image_url ?? null,
        },
      });
    }
  }

  const optionIdByTemplateId = new Map<string, string>();
  const defaultOptionIdByNewMealId = new Map<string, string>();

  if (optionPlanned.length > 0) {
    const { data: newOptions, error: optionsError } = await supabase
      .from("nutrition_meal_options")
      .insert(optionPlanned.map((o) => o.row))
      .select("id");

    if (
      optionsError ||
      !newOptions ||
      newOptions.length !== optionPlanned.length
    ) {
      throw new Error(
        `clone_options_failed: ${optionsError?.message ?? "unexpected length mismatch"}`
      );
    }

    // Safe index access: length check above guarantees newOptions[i] exists.
    optionPlanned.forEach((op, i) => {
      const newOptId = newOptions[i]!.id;

      if (op.kind === "template") {
        optionIdByTemplateId.set(op.template.id, newOptId);
      }
      // First option we see for a given new meal becomes its default
      // fallback target for ingredients.
      if (!defaultOptionIdByNewMealId.has(op.newMealId)) {
        defaultOptionIdByNewMealId.set(op.newMealId, newOptId);
      }
    });
  }

  // -----------------------------------------------------------------------
  // 4) INGREDIENTS — one INSERT for all ingredients across every option.
  //    In the pre-Fase-3 code, ingredients were fetched by nutrition_meal_id
  //    (a legacy FK) and routed either through optionIdMap or to the
  //    default option. We now traverse ingredients through each template
  //    option, so the routing is always direct; the defaultOption fallback
  //    remains as a defensive path for any ingredient whose template
  //    option_id happens to be missing from the map.
  // -----------------------------------------------------------------------
  const ingredientRows: Record<string, unknown>[] = [];

  for (const m of mealPlanned) {
    const newMealId = mealIdByTemplateId.get(m.template.id)!;
    const defaultNewOptionId = defaultOptionIdByNewMealId.get(newMealId);

    for (const to of m.template.nutrition_meal_options ?? []) {
      const mappedOptId = optionIdByTemplateId.get(to.id);

      for (const ti of to.nutrition_ingredients ?? []) {
        const routedOptId =
          (ti.option_id && optionIdByTemplateId.get(ti.option_id)) ||
          mappedOptId ||
          defaultNewOptionId;

        if (!routedOptId) {
          // Shouldn't happen: every meal has at least one option by now.
          throw new Error(
            `clone_ingredients_failed: no target option for ingredient ${ti.id}`
          );
        }

        ingredientRows.push({
          tenant_host: tenantHost,
          nutrition_meal_id: newMealId,
          option_id: routedOptId,
          name: ti.name,
          quantity: ti.quantity,
          unit: ti.unit,
          ingredient_order: ti.ingredient_order,
          protein: ti.protein,
          carbs: ti.carbs,
          fats: ti.fats,
          calories: ti.calories,
        });
      }
    }
  }

  if (ingredientRows.length > 0) {
    const { error: ingredientsError } = await supabase
      .from("nutrition_ingredients")
      .insert(ingredientRows);

    if (ingredientsError) {
      throw new Error(`clone_ingredients_failed: ${ingredientsError.message}`);
    }
  }
}

// POST - Create a new nutrition plan
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();
  const timer = startPerfTimer("POST /api/nutrition/plans");

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      timer.end({ status: 401 });

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      client_id,
      name,
      start_date,
      status,
      notes,
      templateId,
      is_template,
    } = body;

    console.log("[Nutrition Plans API] Creating plan:", body);

    // Get tenant_host for the trainer
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!tenant) {
      timer.end({ status: 404, reason: "tenant_not_found" });

      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    let plan: { id: string; [key: string]: unknown } | null = null;

    // If templateId is provided, clone from template
    if (templateId) {
      console.log("[Nutrition Plans API] Creating from template:", templateId);

      // Fetch the full template tree in a single query (Fase 3). Orders the
      // nested collections so the traversal below preserves the original
      // plan's sequence (day_order, meal_order, option_order,
      // ingredient_order).
      const { data: template, error: templateError } = await supabase
        .from("nutrition_plans")
        .select(NUTRITION_TREE_SELECT)
        .eq("id", templateId)
        .eq("trainer_id", session.trainer_id)
        .eq("is_template", true)
        .order("day_order", {
          referencedTable: "nutrition_days",
          ascending: true,
        })
        .order("meal_order", {
          referencedTable: "nutrition_days.nutrition_meals",
          ascending: true,
        })
        .order("option_order", {
          referencedTable:
            "nutrition_days.nutrition_meals.nutrition_meal_options",
          ascending: true,
        })
        .order("ingredient_order", {
          referencedTable:
            "nutrition_days.nutrition_meals.nutrition_meal_options.nutrition_ingredients",
          ascending: true,
        })
        .single();

      if (templateError || !template) {
        console.error(
          "[Nutrition Plans API] Template not found:",
          templateError
        );
        timer.end({ status: 404, reason: "template_not_found", templateId });

        return NextResponse.json(
          { success: false, error: "Plantilla no encontrada" },
          { status: 404 }
        );
      }

      const templateTree = template as unknown as TemplateTree;

      // Create the plan from template
      const { data: newPlan, error: planError } = await supabase
        .from("nutrition_plans")
        .insert({
          tenant_host: tenant.host,
          client_id,
          trainer_id: session.trainer_id,
          name,
          start_date: start_date || new Date().toISOString().split("T")[0],
          status: status || "active",
          notes: notes || templateTree.notes,
          is_template: false,
          show_meal_images:
            templateTree.show_meal_images !== undefined
              ? Boolean(templateTree.show_meal_images)
              : true,
          // Item 2.3: copy plan-level calorie visibility from template. Default
          // true if the template doesn't have the column populated (older
          // templates created before migration 079).
          show_calories:
            templateTree.show_calories === null ||
            templateTree.show_calories === undefined
              ? true
              : Boolean(templateTree.show_calories),
        })
        .select()
        .single();

      if (planError || !newPlan) {
        console.error(
          "[Nutrition Plans API] Error creating plan from template:",
          planError
        );
        timer.end({ status: 500, reason: "clone_failed", templateId });

        return NextResponse.json(
          { success: false, error: "Error al crear plan desde plantilla" },
          { status: 500 }
        );
      }

      plan = newPlan;

      // Clone the subtree. If anything goes wrong, remove the plan we just
      // created; ON DELETE CASCADE on days/meals/options/ingredients cleans
      // up whatever the batches managed to insert.
      try {
        await cloneTemplateSubtree({
          supabase,
          tenantHost: tenant.host,
          newPlanId: newPlan.id,
          templateDays: templateTree.nutrition_days ?? [],
        });
      } catch (cloneError) {
        console.error(
          "[Nutrition Plans API] Clone subtree failed, rolling back plan:",
          cloneError
        );

        const { error: rollbackError } = await supabase
          .from("nutrition_plans")
          .delete()
          .eq("id", newPlan.id);

        if (rollbackError) {
          console.error(
            "[Nutrition Plans API] Rollback delete failed:",
            rollbackError
          );
        }

        timer.end({
          status: 500,
          reason: "clone_subtree_failed",
          templateId,
          rolled_back: !rollbackError,
        });

        return NextResponse.json(
          { success: false, error: "Error al clonar plantilla" },
          { status: 500 }
        );
      }
    } else {
      // Create a blank nutrition plan
      const { data: newPlan, error: planError } = await supabase
        .from("nutrition_plans")
        .insert({
          tenant_host: tenant.host,
          client_id: is_template ? null : client_id, // Templates don't have client_id
          trainer_id: session.trainer_id,
          name,
          start_date: start_date || new Date().toISOString().split("T")[0],
          status: is_template ? "active" : status || "active",
          notes,
          is_template: is_template || false,
        })
        .select()
        .single();

      if (planError) {
        console.error("[Nutrition Plans API] Error creating plan:", planError);
        timer.end({ status: 500, reason: "blank_create_failed" });

        return NextResponse.json(
          { success: false, error: "Error al crear plan nutricional" },
          { status: 500 }
        );
      }

      plan = newPlan;
    }

    timer.end({
      status: 200,
      plan_id: plan?.id,
      cloned_from_template: Boolean(templateId),
      is_template: Boolean(is_template),
    });

    return NextResponse.json({
      success: true,
      data: { ...plan, days: [] },
    });
  } catch (error) {
    console.error("[Nutrition Plans API] Unexpected error:", error);
    timer.end({ status: 500, unexpected_error: true });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
