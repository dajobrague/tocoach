// Slug availability checking API
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

function validateSlugFormat(slug: string): boolean {
  // Slug validation: lowercase letters, numbers, hyphens only
  // Must start and end with alphanumeric, 3-30 characters
  const pattern = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

  return pattern.test(slug.toLowerCase().trim());
}

function generateSlugSuggestions(baseSlug: string): string[] {
  const sanitized = baseSlug
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 15);

  return [
    `${sanitized}-coach`,
    `${sanitized}-fitness`,
    `coach-${sanitized}`,
    `${sanitized}-training`,
    `${sanitized}123`,
  ].filter((suggestion) => suggestion !== baseSlug);
}

// Support both GET (?desired=...) and POST ({ domain: ... })
export async function GET(request: NextRequest) {
  const desired = request.nextUrl.searchParams.get("desired");

  if (!desired) {
    return NextResponse.json({ error: "Slug requerido" }, { status: 400 });
  }

  return handleCheck(desired);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const slug = body.domain || body.desired;

  if (!slug) {
    return NextResponse.json({ error: "Slug requerido" }, { status: 400 });
  }

  return handleCheck(slug);
}

async function handleCheck(rawSlug: string) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const normalizedSlug = rawSlug.toLowerCase().trim();

    // Validate slug format
    if (!validateSlugFormat(normalizedSlug)) {
      return NextResponse.json({
        isAvailable: false,
        error:
          "Formato de slug no válido. Usa solo letras, números y guiones (3-30 caracteres)",
        suggestions: generateSlugSuggestions(normalizedSlug),
      });
    }

    // Check if slug is already taken in tenants table
    const { data: existingTenant } = await supabase
      .from("tenants")
      .select("slug, trainer_id")
      .eq("slug", normalizedSlug)
      .single();

    // If slug exists and belongs to current trainer, it's available for them
    if (existingTenant && existingTenant.trainer_id === session.trainer_id) {
      return NextResponse.json({
        isAvailable: true,
        message: "Este es tu slug actual",
        suggestions: [],
      });
    }

    // If slug exists and belongs to someone else, it's not available
    if (existingTenant) {
      return NextResponse.json({
        isAvailable: false,
        error: "Este slug ya está en uso",
        suggestions: generateSlugSuggestions(normalizedSlug),
      });
    }

    // Slug is available
    return NextResponse.json({
      isAvailable: true,
      message: "Slug disponible",
      suggestions: [],
    });
  } catch (error) {
    console.error("[Slug Check] Error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
