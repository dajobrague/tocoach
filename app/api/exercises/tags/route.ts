import { NextResponse } from "next/server";

import { distinctTags } from "@/features/trainer/library/tags";
import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET /api/exercises/tags — every distinct tag across the trainer's
// library, sorted. Feeds the predictive tag input and the tag filters (the
// library list is paginated, so clients can't derive this themselves).
export async function GET() {
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  const { data, error } = await createSupabaseClient()
    .from("exercises")
    .select("tags")
    .eq("trainer_id", session.trainer_id);

  if (error) {
    console.error("[Exercise Library API] Error fetching tags:", error);

    return NextResponse.json(
      { success: false, error: "Error al obtener etiquetas" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as Array<{ tags: string[] | null }>;

  return NextResponse.json({
    success: true,
    tags: distinctTags(rows, (row) => row.tags ?? []),
  });
}
