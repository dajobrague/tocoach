import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch all exercises from trainer's library
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

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
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    console.log(
      "[Exercise Library API] Fetching exercises for trainer:",
      session.trainer_id
    );

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

    // Build query
    let query = supabase
      .from("exercises")
      .select("*", { count: "exact" })
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id)
      .order("created_at", { ascending: false });

    // Filter by category
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // Search by name
    if (search && search.trim() !== "") {
      query = query.ilike("name", `%${search}%`);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.range(from, to);

    const { data: exercises, error: exercisesError, count } = await query;

    if (exercisesError) {
      console.error(
        "[Exercise Library API] Error fetching exercises:",
        exercisesError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener ejercicios" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        exercises: exercises || [],
        total: count || 0,
        page,
        limit,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("[Exercise Library API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// POST - Create a new exercise in the library
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

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
      category,
      muscle_groups,
      equipment,
      movement_pattern,
      video_url,
      uploaded_video_url,
      image_url,
      instructions,
      tips,
      default_sets,
      default_reps,
      default_tempo,
      default_rest_seconds,
      default_training_system,
    } = body;

    console.log("[Exercise Library API] Creating exercise:", body);

    // Validate required fields
    if (!name || !category) {
      return NextResponse.json(
        { success: false, error: "Campos requeridos: name, category" },
        { status: 400 }
      );
    }

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

    // Create the exercise
    const { data: exercise, error: exerciseError } = await supabase
      .from("exercises")
      .insert({
        tenant_host: tenant.host,
        trainer_id: session.trainer_id,
        name,
        description: description || null,
        category,
        muscle_groups: muscle_groups || [],
        equipment: equipment || [],
        movement_pattern: movement_pattern || null,
        video_url: video_url || null,
        uploaded_video_url: uploaded_video_url || null,
        image_url: image_url || null,
        instructions: instructions || [],
        tips: tips || [],
        is_public: false,
        // Default training parameters
        default_sets: default_sets ? parseInt(default_sets, 10) : null,
        default_reps: default_reps || null,
        default_tempo: default_tempo || null,
        default_rest_seconds: default_rest_seconds
          ? parseInt(default_rest_seconds, 10)
          : null,
        default_training_system: default_training_system || null,
        metadata: {},
      })
      .select()
      .single();

    if (exerciseError) {
      console.error(
        "[Exercise Library API] Error creating exercise:",
        exerciseError
      );

      return NextResponse.json(
        { success: false, error: "Error al crear ejercicio" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      exercise,
    });
  } catch (error) {
    console.error("[Exercise Library API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
