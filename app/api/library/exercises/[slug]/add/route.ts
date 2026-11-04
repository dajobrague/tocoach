import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { trainerCategory } from "@/lib/library/catalog";

type Params = { params: Promise<{ slug: string }> };

// POST /api/library/exercises/[slug]/add
// Adds a catalog exercise to the trainer's own library. Idempotent:
//  - already added            -> returns it (created: false)
//  - same name already exists -> links that exercise to the catalog entry
//                                (linked: true), nothing else is changed
//  - otherwise                -> creates it (created: true)
export async function POST(_request: NextRequest, { params }: Params) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { slug } = await params;
    const supabase = createSupabaseClient();

    const { data: entry } = await supabase
      .from("library_exercises")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (!entry) {
      return NextResponse.json(
        { error: "Ejercicio no encontrado" },
        { status: 404 }
      );
    }

    const byLink = () =>
      supabase
        .from("exercises")
        .select("*")
        .eq("trainer_id", session.trainer_id)
        .eq("library_exercise_id", slug)
        .maybeSingle();

    const { data: already } = await byLink();

    if (already) {
      return NextResponse.json({
        exercise: already,
        created: false,
        linked: false,
      });
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // Same name (case-insensitive, wildcards escaped) -> link, don't duplicate.
    const exact = String(entry.name).replace(/[%_\\]/g, "\\$&");
    const { data: sameName } = await supabase
      .from("exercises")
      .select("*")
      .eq("trainer_id", session.trainer_id)
      .is("library_exercise_id", null)
      .ilike("name", exact)
      .limit(1);

    if (sameName && sameName[0]) {
      const { data: linked, error } = await supabase
        .from("exercises")
        .update({ library_exercise_id: slug })
        .eq("id", sameName[0].id)
        .eq("trainer_id", session.trainer_id)
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({
        exercise: linked,
        created: false,
        linked: true,
      });
    }

    const { data: created, error } = await supabase
      .from("exercises")
      .insert({
        tenant_host: tenant.host,
        trainer_id: session.trainer_id,
        name: entry.name,
        description: entry.description,
        category: trainerCategory(entry.category),
        instructions: entry.instructions,
        tips: entry.tips,
        equipment: entry.equipment ? [entry.equipment] : [],
        primary_muscles: entry.primary_muscles,
        secondary_muscles: entry.secondary_muscles,
        is_public: false,
        metadata: { source: "repdb" },
        library_exercise_id: slug,
      })
      .select("*")
      .single();

    if (error) {
      // Lost a race with a double click: the unique index says it exists now.
      if (error.code === "23505") {
        const { data: raced } = await byLink();

        if (raced) {
          return NextResponse.json({
            exercise: raced,
            created: false,
            linked: false,
          });
        }
      }
      throw error;
    }

    return NextResponse.json(
      { exercise: created, created: true, linked: false },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Library Catalog API] add failed", { correlationId, error });

    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
