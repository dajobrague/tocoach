import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { CommunityRecipeService } from "@/lib/nutrition/community/community-recipe-service";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";

interface RouteContext {
  params: Promise<{ communityId: string }>;
}

// POST /api/community-recipes/[communityId]/import — copy-install the frozen
// recipe into the caller's own library ("Comunidad" tag added). The copy is
// standalone: later changes or unsharing at the source never touch it.
export async function POST(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { communityId } = await context.params;
    const service = new CommunityRecipeService(createSupabaseClient());
    const recipe = await service.importToLibrary(
      communityId,
      guard.session.tenant_host,
      guard.session.trainer_id
    );

    if (recipe === null) {
      return NextResponse.json(
        { success: false, error: "Receta no encontrada en la comunidad" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: recipe }, { status: 201 });
  } catch (error) {
    console.error("[CommunityRecipes] import error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
