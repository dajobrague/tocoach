// Save slug configuration API
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// Tables that hold a trainer's data and cascade off `tenants.host`. If
// the trainer already has rows in any of these, changing `tenants.host`
// hits the 27 incoming FK constraints (none of which declare ON UPDATE
// CASCADE) and Postgres rejects the UPDATE with code 23503. We use this
// list for a pre-flight check that returns a clear error to the trainer
// instead of the previous opaque "Error al actualizar el registro del
// tenant" — which is what Rodrigo Alderete was hitting.
const TENANT_DATA_TABLES = ["clients", "exercises", "programs"] as const;

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    // Check authentication
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { domain: slug } = body; // Keep parameter name for backward compatibility

    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "Slug requerido" }, { status: 400 });
    }

    const normalizedSlug = slug.toLowerCase().trim();

    // No-op: the trainer is "changing" to the slug they already own.
    if (normalizedSlug === session.tenant_host) {
      return NextResponse.json({
        success: true,
        domain: normalizedSlug,
        message: "El dominio no ha cambiado",
      });
    }

    // Pre-flight collision check. `tenants.host` is the primary key, so
    // an UPDATE to a value already taken by another trainer would error
    // with code 23505 (unique violation). Detect it up front so we can
    // surface a clean "ya está en uso" message instead of a generic
    // 500.
    const { data: collision, error: collisionError } = await supabase
      .from("tenants")
      .select("host, trainer_id")
      .eq("host", normalizedSlug)
      .maybeSingle();

    if (collisionError) {
      console.error("[Save Slug] Collision check failed", {
        correlationId,
        trainer_id: session.trainer_id,
        target_slug: normalizedSlug,
        error: collisionError,
      });

      return NextResponse.json(
        { error: "Error al verificar disponibilidad del dominio" },
        { status: 500 }
      );
    }

    if (collision && collision.trainer_id !== session.trainer_id) {
      return NextResponse.json(
        { error: "Ese dominio ya está en uso por otro entrenador" },
        { status: 409 }
      );
    }

    // Pre-flight cascade check. The 27 FKs to `tenants(host)` are
    // declared `ON DELETE CASCADE` but not `ON UPDATE CASCADE`, so any
    // row in a child table that already references this trainer's
    // current host will block the rename with Postgres error 23503. We
    // probe the most-populated child tables for the trainer's own data
    // and return a clear error rather than letting the UPDATE blow up
    // with an opaque message. Long-term fix is a migration that adds
    // ON UPDATE CASCADE everywhere; until then, host changes only work
    // for trainers who haven't started populating their tenant.
    if (session.tenant_host) {
      for (const table of TENANT_DATA_TABLES) {
        const { count, error: probeError } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("tenant_host", session.tenant_host);

        if (probeError) {
          console.warn("[Save Slug] Cascade probe failed", {
            correlationId,
            trainer_id: session.trainer_id,
            table,
            error: probeError,
          });
          continue;
        }

        if ((count ?? 0) > 0) {
          console.warn("[Save Slug] Blocked rename, trainer has data", {
            correlationId,
            trainer_id: session.trainer_id,
            current_host: session.tenant_host,
            target_slug: normalizedSlug,
            blocking_table: table,
            row_count: count,
          });

          return NextResponse.json(
            {
              error:
                "No se puede cambiar el dominio porque ya tienes datos en tu plataforma (clientes, ejercicios o programas). Contacta a soporte para hacer la migración.",
              code: "tenant_has_data",
            },
            { status: 409 }
          );
        }
      }
    }

    // Update trainer's tenant_host (now stores slug)
    const { error: trainerError } = await supabase
      .from("trainers")
      .update({
        tenant_host: normalizedSlug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.trainer_id);

    if (trainerError) {
      console.error("[Save Slug] Trainer update error", {
        correlationId,
        trainer_id: session.trainer_id,
        target_slug: normalizedSlug,
        error: trainerError,
      });

      return NextResponse.json(
        { error: "Error al actualizar el perfil del entrenador" },
        { status: 500 }
      );
    }

    // First, find existing tenant for this trainer
    const { data: existingTenant, error: findError } = await supabase
      .from("tenants")
      .select("slug, theme_json")
      .eq("trainer_id", session.trainer_id)
      .single();

    let tenantError;

    if (existingTenant) {
      // Update existing tenant record
      const updateData = {
        slug: normalizedSlug,
        host: normalizedSlug, // Keep host in sync with slug for now
        status: "active" as const,
      };

      const { error } = await supabase
        .from("tenants")
        .update(updateData)
        .eq("trainer_id", session.trainer_id);

      tenantError = error;
      console.log(
        `[Save Slug] Updated existing tenant from ${existingTenant.slug} to ${normalizedSlug}`,
        { correlationId, findError: findError ?? null }
      );
    } else {
      // Create new tenant record
      const { error } = await supabase.from("tenants").insert({
        slug: normalizedSlug,
        host: normalizedSlug, // Keep host in sync with slug for now
        theme_slug: "default",
        trainer_id: session.trainer_id,
        status: "active",
        theme_json: {
          meta: {
            name: session.full_name || "Mi Plataforma",
            description: `${session.full_name || "Mi Plataforma"} - Plataforma de Coaching`,
          },
          colors: {
            brand: "#3b82f6",
            surface: {
              "1": "#ffffff",
              "2": "#f8fafc",
            },
          },
          fonts: {
            heading: "Poppins",
            body: "Poppins",
          },
          shadow: {
            sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            md: "0 2px 4px -1px rgb(0 0 0 / 0.1)",
          },
        },
      });

      tenantError = error;
      console.log(`[Save Slug] Created new tenant record: ${normalizedSlug}`);
    }

    if (tenantError) {
      console.error("[Save Slug] Tenant operation error", {
        correlationId,
        trainer_id: session.trainer_id,
        target_slug: normalizedSlug,
        error: tenantError,
      });

      // Postgres error codes Supabase typically surfaces here:
      //   23505 = unique_violation (slug already taken by another trainer)
      //   23503 = foreign_key_violation (cascade probe missed something)
      // The pre-flight checks above should normally short-circuit these,
      // but if they slip through we still want a discriminated response
      // instead of a generic 500.
      const errCode = (tenantError as { code?: string }).code;

      if (errCode === "23505") {
        return NextResponse.json(
          { error: "Ese dominio ya está en uso por otro entrenador" },
          { status: 409 }
        );
      }

      if (errCode === "23503") {
        return NextResponse.json(
          {
            error:
              "No se puede cambiar el dominio porque ya tienes datos en tu plataforma. Contacta a soporte.",
            code: "tenant_has_data",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Error al actualizar el registro del tenant" },
        { status: 500 }
      );
    }

    console.log("[Save Slug] Successfully updated slug", {
      correlationId,
      trainer_id: session.trainer_id,
      target_slug: normalizedSlug,
    });

    return NextResponse.json({
      success: true,
      domain: normalizedSlug,
      message: "Slug guardado correctamente",
    });
  } catch (error) {
    console.error("[Save Slug] Unexpected error", {
      correlationId,
      error,
    });

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
