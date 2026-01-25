import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET: Fetch current brand configuration
export async function GET(request: NextRequest) {
  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseClient();

    // Get current tenant info - use trainer_id instead of tenant_id
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("slug, host, theme_slug, theme_json")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (tenantError || !tenant) {
      console.error("Error fetching tenant:", tenantError);

      return NextResponse.json(
        { error: "Failed to fetch tenant" },
        { status: 500 }
      );
    }

    const tenantData = tenant as {
      slug: string;
      host: string;
      theme_slug: string;
      theme_json: Record<string, any>;
    };

    return NextResponse.json({
      slug: tenantData.slug,
      logo_url: null, // Not stored in tenants table
      brand_name: tenantData.slug,
      theme_json: tenantData.theme_json || {},
      theme_slug: tenantData.theme_slug,
    });
  } catch (error) {
    console.error("Error in GET /api/brand/config:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Update brand configuration
export async function PATCH(request: NextRequest) {
  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const supabase = createSupabaseClient();

    // Get current tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("theme_json")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (tenantError || !tenant) {
      console.error("Error fetching tenant:", tenantError);

      return NextResponse.json(
        { error: "Failed to fetch tenant" },
        { status: 500 }
      );
    }

    const tenantData = tenant as { theme_json: Record<string, any> };

    // Merge the new configuration with existing theme_json
    const currentTheme: Record<string, any> = tenantData.theme_json || {};
    const updatedTheme = {
      ...currentTheme,
      ...(body.colors && {
        colors: { ...(currentTheme.colors || {}), ...body.colors },
      }),
      ...(body.fonts && {
        fonts: { ...(currentTheme.fonts || {}), ...body.fonts },
      }),
      ...(body.radius && {
        radius: { ...(currentTheme.radius || {}), ...body.radius },
      }),
      ...(body.shadow && {
        shadow: { ...(currentTheme.shadow || {}), ...body.shadow },
      }),
      ...(body.assets && {
        assets: { ...(currentTheme.assets || {}), ...body.assets },
      }),
    };

    // Update tenant
    const { error: updateError } = await (supabase
      .from("tenants")
      .update({
        theme_json: updatedTheme,
      })
      .eq("trainer_id", session.trainer_id) as any);

    if (updateError) {
      console.error("Error updating tenant:", updateError);

      return NextResponse.json(
        { error: "Failed to update configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PATCH /api/brand/config:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
