import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { clearTenantCache } from "@/lib/tenant/loader";
import { isHttpsUrl, resolveTenantLogoUrl } from "@/lib/tenant/logo";
import { healThemeJson } from "@/lib/theme/heal";
import { validateTheme } from "@/lib/theme/schema";

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
      .select("slug, host, theme_slug, theme_json, logo_url")
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
      logo_url: string | null;
    };

    // Same resolution the client app uses, so the trainer previews what
    // their clients actually see (and never a dead blob: preview).
    const logoUrl =
      resolveTenantLogoUrl(tenantData.logo_url, tenantData.theme_json) || null;

    return NextResponse.json({
      slug: tenantData.slug,
      logo_url: logoUrl,
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

    // Reject non-https logo URLs (e.g. browser blob: previews) before they
    // get persisted and break for every other viewer once the uploader
    // closes their tab.
    if (body.logo_url !== undefined && body.logo_url !== null) {
      if (!isHttpsUrl(body.logo_url)) {
        return NextResponse.json(
          {
            error:
              "logo_url must be an https:// URL. Wait for upload to complete before saving.",
          },
          { status: 400 }
        );
      }
    }

    if (
      body.assets?.logo !== undefined &&
      body.assets?.logo !== null &&
      !isHttpsUrl(body.assets.logo)
    ) {
      return NextResponse.json(
        {
          error:
            "assets.logo must be an https:// URL. Wait for upload to complete before saving.",
        },
        { status: 400 }
      );
    }

    // Get current tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("theme_json, host, slug")
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
      theme_json: Record<string, any>;
      host: string;
      slug: string;
    };

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

    // `brand_name` (pestaña Logo) es el nombre de la plataforma, no solo el
    // texto junto al logo: el wizard siembra meta.name, meta.logoText,
    // meta.description y logo.text desde ese mismo campo, así que aquí se
    // actualizan los cuatro. Antes la ruta lo ignoraba y el nombre solo se
    // podía cambiar pidiéndolo a soporte.
    const brandName =
      typeof body.brand_name === "string" ? body.brand_name.trim() : "";

    if (brandName) {
      const meta: Record<string, any> = currentTheme.meta || {};
      const oldName = typeof meta.name === "string" ? meta.name : "";
      const description =
        oldName && typeof meta.description === "string"
          ? meta.description.replace(oldName, brandName)
          : `${brandName} - Plataforma de Coaching`;

      updatedTheme.meta = {
        ...meta,
        name: brandName,
        logoText: brandName,
        description,
      };
      updatedTheme.logo = { ...(currentTheme.logo || {}), text: brandName };
    }

    // Sanea el theme resultante para que SIEMPRE pase la validación del
    // generador de CSS. Sin esto, un theme_json sembrado incompleto (p.ej.
    // por /api/auth/register) seguía inválido tras guardar colores y el
    // cliente veía silenciosamente el tema default — "guardé mis colores
    // y el fondo no cambia".
    const healedTheme = healThemeJson(updatedTheme);
    const validation = validateTheme(healedTheme, tenantData.slug);

    if (!validation.success) {
      // No debería ocurrir (heal garantiza forma válida), pero si pasa,
      // mejor un error explícito que persistir un theme que el generador
      // de CSS va a descartar en silencio.
      console.error(
        "[Brand Config] Healed theme still invalid:",
        validation.errors
      );

      return NextResponse.json(
        { error: "La configuración de tema resultante no es válida." },
        { status: 422 }
      );
    }

    // Build the update payload
    const updatePayload: Record<string, any> = {
      theme_json: healedTheme,
    };

    // Also update top-level logo_url if provided
    if (body.logo_url !== undefined) {
      updatePayload.logo_url = body.logo_url;
    }

    // Update tenant
    const { error: updateError } = await (supabase
      .from("tenants")
      .update(updatePayload)
      .eq("trainer_id", session.trainer_id) as any);

    if (updateError) {
      console.error("Error updating tenant:", updateError);

      return NextResponse.json(
        { error: "Failed to update configuration" },
        { status: 500 }
      );
    }

    // Clear server-side tenant metadata cache so next CSS request gets
    // fresh theme. The cache is keyed by whatever loadTenantContext()
    // received — today that's the SLUG (the `host` param name is legacy),
    // so clearing only by host left the stale entry alive. Clear both.
    clearTenantCache(tenantData.slug);
    if (tenantData.host && tenantData.host !== tenantData.slug) {
      clearTenantCache(tenantData.host);
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
