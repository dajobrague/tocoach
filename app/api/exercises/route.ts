import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { parseTagParams, parseTags } from "@/lib/library/parse-tags";

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
    // Repeatable ?tag=a&tag=b: the exercise must carry both.
    const tags = parseTagParams(searchParams);
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

    // Case-sensitive on purpose: options come from the tag registry, whose
    // spelling the arrays follow, so exact match is the right match.
    if (tags.length > 0) {
      query = query.contains("tags", tags);
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
      cardio_type,
      tags,
    } = body;

    const parsedTags = parseTags(tags);

    if (parsedTags !== undefined && parsedTags.ok === false) {
      return NextResponse.json(
        { success: false, error: parsedTags.error },
        { status: 400 }
      );
    }

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

    // Reject duplicate names (case-insensitive) for this trainer.
    // No DB unique constraint exists, so this is the only guard.
    const { data: existing } = await supabase
      .from("exercises")
      .select("id")
      .eq("trainer_id", session.trainer_id)
      .ilike("name", name.trim())
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ya existe un ejercicio con ese nombre en tu biblioteca. Usa un nombre diferente o edita el existente.",
        },
        { status: 409 }
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
        metadata: category === "cardio" && cardio_type ? { cardio_type } : {},
        // Only when sent: keeps inserts working before the tags migration.
        ...(parsedTags?.ok === true ? { tags: parsedTags.tags } : {}),
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
