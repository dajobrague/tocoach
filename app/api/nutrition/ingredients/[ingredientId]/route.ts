import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { startPerfTimer } from "@/lib/utils/perf-logger";

// PATCH - Update a nutrition ingredient
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ingredientId: string }> }
) {
  const supabase = createSupabaseClient();
  const timer = startPerfTimer("PATCH /api/nutrition/ingredients/[id]");

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

    const { ingredientId } = await params;
    const body = await request.json();
    const {
      name,
      quantity,
      unit,
      ingredient_order,
      protein,
      carbs,
      fats,
      calories,
    } = body;

    console.log(
      "[Nutrition Ingredients API] Updating ingredient:",
      ingredientId,
      body
    );

    // Single-query ownership check via `tenant_host`. The previous
    // ingredient → meal → day → plan → trainer chain was 4 sequential
    // round-trips and dominated edit latency in the trainer UI for any
    // ingredient field change (Carlos Torres, "tarda muchísimo en
    // modificar cantidades"). Every nutrition_* table carries
    // `tenant_host` as a denormalized scope key (verified populated
    // across all rows), so a single equality on the trainer's session
    // tenant is sufficient and equivalent to the prior chain. The
    // subsequent UPDATE re-applies the same `tenant_host` filter as a
    // belt-and-braces guard against a stale `existingIngredient`.
    const { data: existingIngredient, error: checkError } = await supabase
      .from("nutrition_ingredients")
      .select("id")
      .eq("id", ingredientId)
      .eq("tenant_host", session.tenant_host)
      .maybeSingle();

    if (checkError) {
      console.error(
        "[Nutrition Ingredients API] Ownership check failed:",
        checkError
      );
      timer.end({ ingredient_id: ingredientId, status: 500 });

      return NextResponse.json(
        { success: false, error: "Error al verificar ingrediente" },
        { status: 500 }
      );
    }

    if (!existingIngredient) {
      timer.end({ ingredient_id: ingredientId, status: 404 });

      return NextResponse.json(
        { success: false, error: "Ingrediente no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // Update the ingredient
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (unit !== undefined) updateData.unit = unit;
    if (ingredient_order !== undefined)
      updateData.ingredient_order = ingredient_order;
    if (protein !== undefined) updateData.protein = protein;
    if (carbs !== undefined) updateData.carbs = carbs;
    if (fats !== undefined) updateData.fats = fats;
    if (calories !== undefined) updateData.calories = calories;

    const { data: ingredient, error: updateError } = await supabase
      .from("nutrition_ingredients")
      .update(updateData)
      .eq("id", ingredientId)
      .eq("tenant_host", session.tenant_host)
      .select()
      .single();

    if (updateError) {
      console.error(
        "[Nutrition Ingredients API] Error updating ingredient:",
        updateError
      );
      timer.end({ ingredient_id: ingredientId, status: 500 });

      return NextResponse.json(
        { success: false, error: "Error al actualizar ingrediente" },
        { status: 500 }
      );
    }

    timer.end({
      ingredient_id: ingredientId,
      fields_updated: Object.keys(updateData).length,
      status: 200,
    });

    return NextResponse.json({
      success: true,
      data: ingredient,
    });
  } catch (error) {
    console.error("[Nutrition Ingredients API] Unexpected error:", error);
    timer.end({ status: 500, unexpected_error: true });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a nutrition ingredient
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ingredientId: string }> }
) {
  const supabase = createSupabaseClient();
  const timer = startPerfTimer("DELETE /api/nutrition/ingredients/[id]");

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

    const { ingredientId } = await params;

    console.log(
      "[Nutrition Ingredients API] Deleting ingredient:",
      ingredientId
    );

    // Single-query ownership check via `tenant_host` — see PATCH above
    // for full rationale. The DELETE itself re-applies `tenant_host` so
    // a stale ownership lookup can never delete cross-tenant.
    const { data: existingIngredient, error: checkError } = await supabase
      .from("nutrition_ingredients")
      .select("id")
      .eq("id", ingredientId)
      .eq("tenant_host", session.tenant_host)
      .maybeSingle();

    if (checkError) {
      console.error(
        "[Nutrition Ingredients API] Ownership check failed:",
        checkError
      );
      timer.end({ ingredient_id: ingredientId, status: 500 });

      return NextResponse.json(
        { success: false, error: "Error al verificar ingrediente" },
        { status: 500 }
      );
    }

    if (!existingIngredient) {
      timer.end({ ingredient_id: ingredientId, status: 404 });

      return NextResponse.json(
        { success: false, error: "Ingrediente no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    // Delete the ingredient
    const { error: deleteError } = await supabase
      .from("nutrition_ingredients")
      .delete()
      .eq("id", ingredientId)
      .eq("tenant_host", session.tenant_host);

    if (deleteError) {
      console.error(
        "[Nutrition Ingredients API] Error deleting ingredient:",
        deleteError
      );
      timer.end({ ingredient_id: ingredientId, status: 500 });

      return NextResponse.json(
        { success: false, error: "Error al eliminar ingrediente" },
        { status: 500 }
      );
    }

    timer.end({ ingredient_id: ingredientId, status: 200 });

    return NextResponse.json({
      success: true,
      message: "Ingrediente eliminado exitosamente",
    });
  } catch (error) {
    console.error("[Nutrition Ingredients API] Unexpected error:", error);
    timer.end({ status: 500, unexpected_error: true });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
