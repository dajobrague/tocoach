// Save slug configuration API
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession, setSessionCookie } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { clearTenantCache } from "@/lib/tenant/loader";
import { renameTenant } from "@/lib/tenant/rename";

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

    // El tenant actual se lee de la DB, no de la sesión: la cookie puede
    // llevar un tenant_host obsoleto (pasó en prod con 6 trainers).
    const { data: existingTenant, error: findError } = await supabase
      .from("tenants")
      .select("host, slug")
      .eq("trainer_id", session.trainer_id)
      .maybeSingle();

    if (findError) {
      console.error("[Save Slug] Tenant lookup failed", {
        correlationId,
        trainer_id: session.trainer_id,
        error: findError,
      });

      return NextResponse.json(
        { error: "Error al buscar tu plataforma" },
        { status: 500 }
      );
    }

    // No-op: the trainer is "changing" to the slug they already own.
    if (existingTenant?.host === normalizedSlug) {
      return NextResponse.json({
        success: true,
        domain: normalizedSlug,
        message: "El dominio no ha cambiado",
      });
    }

    if (existingTenant) {
      // `tenants.host` es la PK y está copiada como FK en 40+ tablas hijas sin
      // ON UPDATE CASCADE: el rename lo hace la función SQL `rename_tenant`
      // en una sola transacción (antes esta ruta lo bloqueaba en cuanto el
      // trainer tenía datos y había que hacerlo a mano desde soporte).
      const renamed = await renameTenant(
        supabase,
        existingTenant.host,
        normalizedSlug
      );

      if (!renamed.ok) {
        console.error("[Save Slug] rename_tenant failed", {
          correlationId,
          trainer_id: session.trainer_id,
          from: existingTenant.host,
          to: normalizedSlug,
          error: renamed.cause,
        });

        return NextResponse.json(
          { error: renamed.error },
          { status: renamed.status }
        );
      }

      console.log("[Save Slug] Renamed tenant", {
        correlationId,
        trainer_id: session.trainer_id,
        from: existingTenant.host,
        to: normalizedSlug,
        repointed: renamed.repointed,
      });
    } else {
      // Create new tenant record
      const { error: insertError } = await supabase.from("tenants").insert({
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

      if (insertError) {
        console.error("[Save Slug] Tenant insert error", {
          correlationId,
          trainer_id: session.trainer_id,
          target_slug: normalizedSlug,
          error: insertError,
        });

        const errCode = (insertError as { code?: string }).code;

        if (errCode === "23505") {
          return NextResponse.json(
            { error: "Ese dominio ya está en uso por otro entrenador" },
            { status: 409 }
          );
        }

        return NextResponse.json(
          { error: "Error al crear el registro del tenant" },
          { status: 500 }
        );
      }

      // `trainers.tenant_host` se actualiza DESPUÉS del tenant: es un puntero a
      // `tenants.host` y si se escribiera antes y el insert fallara, quedaría
      // apuntando a un host inexistente y toda escritura del trainer rompería
      // con 23503. (En el rename lo hace la propia función SQL.)
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

      clearTenantCache(normalizedSlug);
      console.log(`[Save Slug] Created new tenant record: ${normalizedSlug}`);
    }

    console.log("[Save Slug] Successfully updated slug", {
      correlationId,
      trainer_id: session.trainer_id,
      target_slug: normalizedSlug,
    });

    // La cookie del trainer lleva `tenant_host` dentro: se reemite con el
    // nuevo para que no tenga que cerrar sesión (con la vieja, todo write
    // daría 23503 contra un host que ya no existe).
    const response = NextResponse.json({
      success: true,
      domain: normalizedSlug,
      message: "Slug guardado correctamente",
    });

    await setSessionCookie(
      response,
      session.trainer_id,
      normalizedSlug,
      session.email,
      session.full_name
    );

    return response;
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
