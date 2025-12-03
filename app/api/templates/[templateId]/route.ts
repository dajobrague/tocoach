import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/clients/supabase-server";

// GET - Fetch single template with full structure (sessions + exercises)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const supabase = createServerSupabaseClient();

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { templateId } = await params;

    console.log("[Template Detail API] Fetching template:", templateId);

    // Try to fetch as a program template first
    const { data: programTemplate, error: programError } = await supabase
      .from("programs")
      .select("*")
      .eq("id", templateId)
      .eq("trainer_id", session.trainer_id)
      .eq("is_template", true)
      .maybeSingle();

    if (programTemplate) {
      // It's a program template - fetch sessions and exercises
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("*")
        .eq("program_id", templateId)
        .order("session_order", { ascending: true });

      if (sessionsError) {
        console.error(
          "[Template Detail API] Error fetching sessions:",
          sessionsError
        );

        return NextResponse.json(
          { success: false, error: "Error al obtener sesiones" },
          { status: 500 }
        );
      }

      // For each session, fetch exercises
      const sessionsWithExercises = await Promise.all(
        (sessions || []).map(async (session: any) => {
          const { data: sessionExercises } = await supabase
            .from("session_exercises")
            .select("*, exercises(*)")
            .eq("session_id", session.id)
            .order("exercise_order", { ascending: true });

          return {
            ...session,
            exercises: sessionExercises || [],
          };
        })
      );

      return NextResponse.json({
        success: true,
        template: {
          id: (programTemplate as any).id,
          name: (programTemplate as any).name,
          description: (programTemplate as any).description,
          templateType: "program",
          type: (programTemplate as any).metadata?.type,
          category: (programTemplate as any).metadata?.category,
          division: (programTemplate as any).metadata?.division,
          goal: (programTemplate as any).metadata?.goal,
          sessionsPerWeek: (programTemplate as any).metadata?.sessions_per_week,
          sessions: sessionsWithExercises,
          createdAt: (programTemplate as any).created_at,
          updatedAt: (programTemplate as any).updated_at,
        },
      });
    }

    // Try to fetch as a nutrition template
    const { data: nutritionTemplate, error: nutritionError } = await supabase
      .from("nutrition_plans")
      .select("*")
      .eq("id", templateId)
      .eq("trainer_id", session.trainer_id)
      .eq("is_template", true)
      .maybeSingle();

    if (nutritionTemplate) {
      // It's a nutrition template - fetch days, meals, and ingredients
      const { data: days, error: daysError } = await supabase
        .from("nutrition_days")
        .select("*")
        .eq("nutrition_plan_id", templateId)
        .order("day_order", { ascending: true });

      if (daysError) {
        console.error("[Template Detail API] Error fetching days:", daysError);

        return NextResponse.json(
          { success: false, error: "Error al obtener días" },
          { status: 500 }
        );
      }

      // For each day, fetch meals and ingredients
      const daysWithMeals = await Promise.all(
        (days || []).map(async (day: any) => {
          const { data: meals } = await supabase
            .from("nutrition_meals")
            .select("*")
            .eq("nutrition_day_id", day.id)
            .order("meal_order", { ascending: true });

          const mealsWithIngredients = await Promise.all(
            (meals || []).map(async (meal: any) => {
              const { data: ingredients } = await supabase
                .from("nutrition_ingredients")
                .select("*")
                .eq("nutrition_meal_id", meal.id)
                .order("ingredient_order", { ascending: true });

              return {
                ...meal,
                ingredients: ingredients || [],
              };
            })
          );

          return {
            ...day,
            meals: mealsWithIngredients,
          };
        })
      );

      return NextResponse.json({
        success: true,
        template: {
          id: (nutritionTemplate as any).id,
          name: (nutritionTemplate as any).name,
          description: (nutritionTemplate as any).notes,
          templateType: "nutrition",
          category: "nutrition",
          days: daysWithMeals,
          createdAt: (nutritionTemplate as any).created_at,
          updatedAt: (nutritionTemplate as any).updated_at,
        },
      });
    }

    // Not found in either table
    console.error("[Template Detail API] Template not found in either table");

    return NextResponse.json(
      { success: false, error: "Plantilla no encontrada" },
      { status: 404 }
    );
  } catch (error) {
    console.error("[Template Detail API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const supabase = createServerSupabaseClient();

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { templateId } = await params;
    const body = await request.json();
    const {
      name,
      description,
      type,
      category,
      division,
      goal,
      sessionsPerWeek,
    } = body;

    console.log("[Template Detail API] Updating template:", templateId, body);

    // Verify template belongs to trainer
    const { data: existingTemplate } = await supabase
      .from("programs")
      .select("id")
      .eq("id", templateId)
      .eq("trainer_id", session.trainer_id)
      .eq("is_template", true)
      .single();

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: "Plantilla no encontrada" },
        { status: 404 }
      );
    }

    // Update metadata
    const metadata: any = {
      type: type || "Strength",
      sessions_per_week: sessionsPerWeek ? parseInt(sessionsPerWeek) : 3,
    };

    if (category) {
      metadata.category = category;
    }

    if (category === "cardio" && goal) {
      metadata.goal = goal;
    } else if (division) {
      metadata.division = division;
    }

    // Update template
    const { data: updatedTemplate, error: updateError } = await (
      supabase.from("programs") as any
    )
      .update({
        name,
        description: description || null,
        metadata,
      })
      .eq("id", templateId)
      .select()
      .single();

    if (updateError) {
      console.error(
        "[Template Detail API] Error updating template:",
        updateError
      );

      return NextResponse.json(
        { success: false, error: "Error al actualizar plantilla" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
    });
  } catch (error) {
    console.error("[Template Detail API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const supabase = createServerSupabaseClient();

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { templateId } = await params;

    console.log("[Template Detail API] Deleting template:", templateId);

    // Verify template belongs to trainer
    const { data: existingTemplate } = await supabase
      .from("programs")
      .select("id")
      .eq("id", templateId)
      .eq("trainer_id", session.trainer_id)
      .eq("is_template", true)
      .single();

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: "Plantilla no encontrada" },
        { status: 404 }
      );
    }

    // Delete template (cascade will delete sessions and exercises)
    const { error: deleteError } = await supabase
      .from("programs")
      .delete()
      .eq("id", templateId);

    if (deleteError) {
      console.error(
        "[Template Detail API] Error deleting template:",
        deleteError
      );

      return NextResponse.json(
        { success: false, error: "Error al eliminar plantilla" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Plantilla eliminada exitosamente",
    });
  } catch (error) {
    console.error("[Template Detail API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
