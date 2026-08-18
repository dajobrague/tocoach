import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { CommunityRecipeService } from "@/lib/nutrition/community/community-recipe-service";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";

// GET /api/community-recipes?q=&tag= — the shared gallery (all tenants),
// newest first. Summaries only; the frozen payload never leaves the server
// until an import copies it.
export async function GET(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const params = new URL(request.url).searchParams;
    const service = new CommunityRecipeService(createSupabaseClient());
    const filter: { query?: string; tag?: string } = {};
    const q = params.get("q");
    const tag = params.get("tag");

    if (q !== null && q.trim().length > 0) filter.query = q;
    if (tag !== null && tag.length > 0) filter.tag = tag;

    const items = await service.list(guard.session.tenant_host, filter);

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("[CommunityRecipes] list error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
