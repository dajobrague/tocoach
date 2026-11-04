import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { searchKey } from "@/lib/library/catalog";
import { isMuscleId } from "@/lib/training/muscles";

const PAGE_SIZE = 30;

// GET /api/library/exercises?q=&category=&muscle=&secondary=1&page=
// Paginated search of the licensed catalog (never a bulk dump: PAGE_SIZE rows
// per call). `added` marks entries the trainer already has in their library.
// `muscle` matches the primary muscles; `secondary=1` also matches the
// secondary ones. Page 1 also returns `categoryCounts`: how many results each
// type would give with the current search and muscle (the type itself ignored),
// so the filter can say what it will show before you click it.
export async function GET(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const category = params.get("category");
    const muscle = params.get("muscle");
    const withSecondary = params.get("secondary") === "1";
    // Strip ilike wildcards so the query is always a plain substring.
    const q = searchKey(params.get("q") ?? "").replace(/[%_\\,()]/g, " ");
    const supabase = createSupabaseClient();

    // Search text + muscle: shared by the results and the per-type counts.
    const narrow = <T extends { ilike: any; or: any; contains: any }>(
      builder: T
    ): T => {
      let next = builder;

      if (q) next = next.ilike("search", `%${q}%`);
      if (muscle && isMuscleId(muscle)) {
        next = withSecondary
          ? next.or(
              `primary_muscles.cs.{${muscle}},secondary_muscles.cs.{${muscle}}`
            )
          : next.contains("primary_muscles", [muscle]);
      }

      return next;
    };

    let query = narrow(
      supabase
        .from("library_exercises")
        .select(
          "slug, name, category, primary_muscles, secondary_muscles, equipment, has_animation",
          { count: "exact" }
        )
    )
      .order("name")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (category && category !== "all") query = query.eq("category", category);

    const { data, count, error } = await query;

    if (error) throw error;

    let categoryCounts: Record<string, number> | undefined;

    if (page === 1) {
      const { data: cats, error: catError } = await narrow(
        supabase.from("library_exercises").select("category")
      ).limit(1000);

      if (catError) throw catError;
      categoryCounts = {};
      for (const row of cats ?? []) {
        categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1;
      }
    }

    const slugs = (data ?? []).map((row) => row.slug);
    const { data: mine } = slugs.length
      ? await supabase
          .from("exercises")
          .select("library_exercise_id")
          .eq("trainer_id", session.trainer_id)
          .in("library_exercise_id", slugs)
      : { data: [] };
    const added = new Set((mine ?? []).map((r) => r.library_exercise_id));

    return NextResponse.json({
      items: (data ?? []).map((row) => ({
        ...row,
        added: added.has(row.slug),
      })),
      total: count ?? 0,
      ...(categoryCounts ? { categoryCounts } : {}),
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    console.error("[Library Catalog API] search failed", {
      correlationId,
      error,
    });

    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
