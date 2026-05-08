import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Create a new client
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();

    console.log(
      "[Create Client API] Creating client for trainer:",
      session.trainer_id
    );
    console.log("[Create Client API] Client data:", body);

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.email || !body.dob) {
      return NextResponse.json(
        { success: false, error: "Campos requeridos faltantes" },
        { status: 400 }
      );
    }

    const normalizedEmail = body.email.toLowerCase().trim();

    // Prepare client data for insertion into clients table
    const clientData = {
      tenant: session.trainer_id, // clients.tenant contains the trainer UUID
      name: body.firstName,
      last_name: body.lastName,
      nick_name: body.nickName || null,
      email: normalizedEmail,
      phone: body.phone || null,
      occupation: body.occupation || null,
      dob: body.dob,
      city: body.city || null,
      state: body.state || null,
      country: body.country || null,
      zip: body.zip || null,
      national_id: body.nationalId || null,
      status: "Onboarding Completado", // Default status for new clients
      sign_up_date: new Date().toISOString(),
      profile_picture_url: null,
    };

    console.log("[Create Client API] Inserting client data:", clientData);

    // Insert the client
    const { data: newClient, error: insertError } = await supabase
      .from("clients")
      .insert(clientData)
      .select()
      .single();

    if (insertError) {
      console.error("[Create Client API] Error inserting client:", insertError);

      return NextResponse.json(
        {
          success: false,
          error: "Error al crear cliente",
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    console.log(
      "[Create Client API] Client created successfully:",
      newClient.id
    );

    // Auto-seed form configs from every active template the tenant has.
    // Non-blocking: errors here should never break client creation — if seeding
    // fails or the tenant has no template, the client gets configs lazily on
    // first access to `/api/forms/configs/[clientId]` (which auto-creates a
    // template from `DEFAULT_*_CONFIG` defaults).
    try {
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("host")
        .eq("trainer_id", session.trainer_id)
        .single();

      if (tenantRow?.host) {
        const { data: activeTemplates, error: tplError } = await supabase
          .from("form_templates")
          .select("id, form_type, questions_config, default_schedule")
          .eq("tenant_host", tenantRow.host)
          .eq("is_active", true);

        if (tplError) {
          console.warn(
            "[Create Client API] auto-seed: error fetching templates",
            tplError
          );
        } else if (activeTemplates && activeTemplates.length > 0) {
          const rows = activeTemplates.map((tpl) => {
            const row: Record<string, unknown> = {
              tenant_host: tenantRow.host,
              client_id: newClient.id,
              form_type: tpl.form_type,
              questions_config: tpl.questions_config,
              uses_template: true,
              template_id: tpl.id,
            };

            if (tpl.form_type === "checkins") {
              row.schedule = tpl.default_schedule ?? null;
            }

            return row;
          });

          const { error: seedError } = await supabase
            .from("client_form_configs")
            .upsert(rows, { onConflict: "client_id,form_type" });

          if (seedError) {
            console.warn(
              "[Create Client API] auto-seed: error inserting configs",
              seedError
            );
          } else {
            console.log(
              "[Create Client API] auto-seed: applied",
              activeTemplates.length,
              "template(s) to client",
              newClient.id
            );
          }
        }
      }
    } catch (seedEx) {
      console.warn("[Create Client API] auto-seed: unexpected error", seedEx);
    }

    return NextResponse.json({
      success: true,
      client: {
        id: newClient.id,
        name: `${newClient.name} ${newClient.last_name}`,
        firstName: newClient.name,
        lastName: newClient.last_name,
        nickName: newClient.nick_name,
        email: newClient.email,
        phone: newClient.phone,
        status: newClient.status,
        profileImage: newClient.profile_picture_url,
        joinedDate: newClient.sign_up_date,
        occupation: newClient.occupation,
        dob: newClient.dob,
        location: {
          city: newClient.city,
          state: newClient.state,
          country: newClient.country,
          zip: newClient.zip,
        },
        nationalId: newClient.national_id,
      },
    });
  } catch (error) {
    console.error("[Create Client API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
