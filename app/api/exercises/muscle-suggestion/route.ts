import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  normalizeExerciseName,
  pickMuscleSuggestion,
} from "@/lib/training/muscles";

// GET ?name=… — muscles most trainers gave an exercise with this exact name,
// for the editor to offer as a suggestion. Reads across tenants on purpose
// (names repeat per library: "Sentadilla hack" ×20) but returns only muscle
// ids, never the other exercises or who owns them.
export async function GET(request: NextRequest) {
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  const name = normalizeExerciseName(
    new URL(request.url).searchParams.get("name") ?? ""
  );

  if (name.length < 3 || name.length > 120) {
    return NextResponse.json({ success: true, data: null });
  }

  // ilike prefix narrows it down (stored names may carry trailing spaces);
  // the exact comparison happens after normalising.
  const pattern = `${name.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { data, error } = await createSupabaseClient()
    .from("exercises")
    .select("name, primary_muscles, secondary_muscles")
    .ilike("name", pattern)
    .neq("primary_muscles", "{}")
    .limit(200);

  if (error) {
    console.error("[Muscle suggestion] Query failed:", error);

    return NextResponse.json({ success: true, data: null });
  }

  const sameName = (data ?? []).filter(
    (row) => normalizeExerciseName(row.name) === name
  );

  return NextResponse.json({
    success: true,
    data: pickMuscleSuggestion(sameName),
  });
}
