import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/clients/supabase-server";

// GET - Fetch all templates for the authenticated trainer
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category"); // 'cardio', 'strength', or null for all
    const typeFilter = searchParams.get("type"); // 'programs', 'nutrition', or null for all

    console.log(
      "[Templates API] Fetching templates, category:",
      category,
      "type:",
      typeFilter
    );

    // Fetch program templates
    let programTemplates: any[] = [];

    if (typeFilter === "programs") {
      let programsQuery = supabase
        .from("programs")
        .select("*")
        .eq("trainer_id", session.trainer_id)
        .eq("is_template", true)
        .order("updated_at", { ascending: false });

      // Filter by category if provided
      if (category && (category === "cardio" || category === "strength")) {
        programsQuery = programsQuery.filter(
          "metadata->>category",
          "eq",
          category
        );
      }

      const { data: programs, error: programsError } = await programsQuery;

      if (programsError) {
        console.error(
          "[Templates API] Error fetching program templates:",
          programsError
        );
      } else if (programs) {
        programTemplates = programs;
      }
    }

    // Fetch nutrition templates
    let nutritionTemplates: any[] = [];

    if (typeFilter === "nutrition") {
      const { data: nutrition, error: nutritionError } = await supabase
        .from("nutrition_plans")
        .select("*")
        .eq("trainer_id", session.trainer_id)
        .eq("is_template", true)
        .order("updated_at", { ascending: false });

      if (nutritionError) {
        console.error(
          "[Templates API] Error fetching nutrition templates:",
          nutritionError
        );
      } else if (nutrition) {
        nutritionTemplates = nutrition;
      }
    }

    // Process program templates with counts — 2 batched queries for ALL
    // templates instead of 3 per template (the session ids double as the
    // session count).
    const countByKey = (rows: any[], key: string) =>
      rows.reduce((acc: Map<any, number>, row: any) => {
        acc.set(row[key], (acc.get(row[key]) ?? 0) + 1);

        return acc;
      }, new Map<any, number>());

    let sessionCountByProgram = new Map<any, number>();
    let exerciseCountByProgram = new Map<any, number>();

    if (programTemplates.length > 0) {
      const templateIds = programTemplates.map((t: any) => t.id);
      const { data: sessionRows } = await supabase
        .from("sessions")
        .select("id, program_id")
        .in("program_id", templateIds);

      sessionCountByProgram = countByKey(sessionRows || [], "program_id");

      const sessionIds = (sessionRows || []).map((s: any) => s.id);

      if (sessionIds.length > 0) {
        const { data: exerciseRows } = await supabase
          .from("session_exercises")
          .select("session_id")
          .in("session_id", sessionIds);

        const programBySession = new Map(
          (sessionRows || []).map((s: any) => [s.id, s.program_id])
        );

        exerciseCountByProgram = (exerciseRows || []).reduce(
          (acc: Map<any, number>, row: any) => {
            const programId = programBySession.get(row.session_id);

            if (programId !== undefined) {
              acc.set(programId, (acc.get(programId) ?? 0) + 1);
            }

            return acc;
          },
          new Map<any, number>()
        );
      }
    }

    const programTemplatesWithCounts = programTemplates.map(
      (template: any) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        templateType: "program", // Distinguish from nutrition
        type: template.metadata?.type || "Strength",
        category: template.metadata?.category || "strength",
        division: template.metadata?.division,
        goal: template.metadata?.goal,
        sessionsPerWeek: template.metadata?.sessions_per_week,
        sessionCount: sessionCountByProgram.get(template.id) ?? 0,
        exerciseCount: exerciseCountByProgram.get(template.id) ?? 0,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
      })
    );

    // Process nutrition templates with counts — same batching.
    let dayCountByPlan = new Map<any, number>();
    let mealCountByPlan = new Map<any, number>();

    if (nutritionTemplates.length > 0) {
      const planIds = nutritionTemplates.map((t: any) => t.id);
      const { data: dayRows } = await supabase
        .from("nutrition_days")
        .select("id, nutrition_plan_id")
        .in("nutrition_plan_id", planIds);

      dayCountByPlan = countByKey(dayRows || [], "nutrition_plan_id");

      const dayIds = (dayRows || []).map((d: any) => d.id);

      if (dayIds.length > 0) {
        const { data: mealRows } = await supabase
          .from("nutrition_meals")
          .select("nutrition_day_id")
          .in("nutrition_day_id", dayIds);

        const planByDay = new Map(
          (dayRows || []).map((d: any) => [d.id, d.nutrition_plan_id])
        );

        mealCountByPlan = (mealRows || []).reduce(
          (acc: Map<any, number>, row: any) => {
            const planId = planByDay.get(row.nutrition_day_id);

            if (planId !== undefined) {
              acc.set(planId, (acc.get(planId) ?? 0) + 1);
            }

            return acc;
          },
          new Map<any, number>()
        );
      }
    }

    const nutritionTemplatesWithCounts = nutritionTemplates.map(
      (template: any) => ({
        id: template.id,
        name: template.name,
        description: template.notes,
        templateType: "nutrition", // Distinguish from program
        category: "nutrition",
        dayCount: dayCountByPlan.get(template.id) ?? 0,
        mealCount: mealCountByPlan.get(template.id) ?? 0,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
      })
    );

    // Return only the requested type, sorted by updated_at
    let allTemplates: any[] = [];

    if (typeFilter === "programs") {
      allTemplates = programTemplatesWithCounts;
    } else if (typeFilter === "nutrition") {
      allTemplates = nutritionTemplatesWithCounts;
    } else {
      // If no type specified, return both
      allTemplates = [
        ...programTemplatesWithCounts,
        ...nutritionTemplatesWithCounts,
      ];
    }

    allTemplates.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json({
      success: true,
      templates: allTemplates,
    });
  } catch (error) {
    console.error("[Templates API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST - Create new template from scratch
export async function POST(request: NextRequest) {
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

    console.log("[Templates API] Creating new template:", body);

    // Get tenant_host for the trainer
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // Create metadata object
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

    // Create the template
    const { data: template, error: templateError } = await supabase
      .from("programs")
      .insert({
        tenant_host: (tenant as any).host,
        trainer_id: session.trainer_id,
        name,
        description: description || null,
        is_template: true,
        is_published: false,
        metadata,
      } as any)
      .select()
      .single();

    if (templateError || !template) {
      console.error("[Templates API] Error creating template:", templateError);

      return NextResponse.json(
        { success: false, error: "Error al crear plantilla" },
        { status: 500 }
      );
    }

    console.log("[Templates API] Template created:", (template as any).id);

    return NextResponse.json({
      success: true,
      template: {
        id: (template as any).id,
        name: (template as any).name,
        description: (template as any).description,
        type: (template as any).metadata?.type,
        category: (template as any).metadata?.category,
        division: (template as any).metadata?.division,
        goal: (template as any).metadata?.goal,
        sessionsPerWeek: (template as any).metadata?.sessions_per_week,
      },
    });
  } catch (error) {
    console.error("[Templates API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
