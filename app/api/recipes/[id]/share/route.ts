import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { CommunityRecipeService } from "@/lib/nutrition/community/community-recipe-service";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET — whether this recipe is currently shared with the community.
export async function GET(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
    const service = new CommunityRecipeService(createSupabaseClient());
    const status = await service.statusFor(guard.session.tenant_host, id);

    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error("[CommunityRecipes] status error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST — share this recipe (or refresh the frozen payload of a prior share).
export async function POST(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
    const service = new CommunityRecipeService(createSupabaseClient());
    const shared = await service.share(guard.session.tenant_host, id);

    if (shared === false) {
      return NextResponse.json(
        { success: false, error: "Receta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CommunityRecipes] share error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE — stop sharing. Copies already imported elsewhere are untouched.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await context.params;
    const service = new CommunityRecipeService(createSupabaseClient());
    const removed = await service.unshare(guard.session.tenant_host, id);

    if (removed === false) {
      return NextResponse.json(
        { success: false, error: "Esta receta no estaba compartida" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CommunityRecipes] unshare error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
