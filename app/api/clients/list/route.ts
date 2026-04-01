import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  fetchCheckinsTemplateDefaultSchedule,
  resolveCheckInScheduleForApi,
} from "@/lib/forms/schedule-validation";
import {
  formatScheduleDescription,
  getCheckInStatus,
} from "@/lib/forms/schedule";

// API endpoint to list clients filtered by trainer's tenant
export async function GET(request: NextRequest) {
  console.log("[Clients List API] Route handler called!");

  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    console.log("[Clients List API] Session:", session ? "found" : "not found");

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all"; // all, active, checkins, plans
    const search = searchParams.get("search") || "";

    console.log(
      "[Clients List API] Fetching clients for trainer:",
      session.trainer_id
    );

    // Get clients directly by trainer_id (clients.tenant contains the trainer UUID)
    let query = supabase
      .from("clients")
      .select("*")
      .eq("tenant", session.trainer_id);

    // Apply filters
    if (filter === "active") {
      query = query.eq("status", "Activo");
    }

    const { data: clients, error } = await query.order("sign_up_date", {
      ascending: false,
    });

    console.log("[Clients List API] Query result:", {
      clientsCount: clients?.length,
      error,
    });

    if (error) {
      console.error("[Clients List] Error fetching clients:", error);

      return NextResponse.json(
        { success: false, error: "Error al obtener clientes" },
        { status: 500 }
      );
    }

    const clientRows = clients ?? [];
    const clientIds = clientRows.map((c: { id: number }) => c.id);

    let checkInByClientId = new Map<
      number,
      {
        status: ReturnType<typeof getCheckInStatus>;
        customName: string;
        scheduleDescription: string;
      }
    >();

    if (clientIds.length > 0) {
      const { data: tenantRow, error: tenantError } = await supabase
        .from("tenants")
        .select("host")
        .eq("trainer_id", session.trainer_id)
        .maybeSingle();

      if (!tenantError && tenantRow?.host) {
        const tenantHost = tenantRow.host as string;
        const sinceIso = new Date(
          Date.now() - 120 * 24 * 60 * 60 * 1000
        ).toISOString();

        const [tenantTemplateDefault, configsResult, responsesResult] =
          await Promise.all([
            fetchCheckinsTemplateDefaultSchedule(supabase, tenantHost, null),
            supabase
              .from("client_form_configs")
              .select("client_id, schedule, template_id")
              .eq("tenant_host", tenantHost)
              .eq("form_type", "checkins")
              .in("client_id", clientIds),
            supabase
              .from("form_responses")
              .select("client_id, submitted_at")
              .eq("tenant_host", tenantHost)
              .eq("form_type", "checkins")
              .in("client_id", clientIds)
              .gte("submitted_at", sinceIso)
              .not("submitted_at", "is", null),
          ]);

        const configByClientId = new Map<
          number,
          { schedule: unknown; template_id: string | null }
        >();

        for (const row of configsResult.data ?? []) {
          const cid = row.client_id as number;

          configByClientId.set(cid, {
            schedule: row.schedule,
            template_id: (row.template_id as string | null) ?? null,
          });
        }

        const templateIds = [
          ...new Set(
            [...configByClientId.values()]
              .map((c) => c.template_id)
              .filter((id): id is string => Boolean(id))
          ),
        ];

        const templateDefaultById = new Map<string, unknown>();

        if (templateIds.length > 0) {
          const { data: tmplRows } = await supabase
            .from("form_templates")
            .select("id, default_schedule")
            .eq("tenant_host", tenantHost)
            .eq("form_type", "checkins")
            .in("id", templateIds);

          for (const t of tmplRows ?? []) {
            if (t.id) templateDefaultById.set(String(t.id), t.default_schedule);
          }
        }

        const responsesByClient = new Map<number, { submitted_at: string }[]>();

        for (const r of responsesResult.data ?? []) {
          const cid = r.client_id as number;
          const submitted = r.submitted_at as string | null;

          if (!submitted) continue;

          const list = responsesByClient.get(cid) ?? [];

          list.push({ submitted_at: submitted });
          responsesByClient.set(cid, list);
        }

        const templateDefaultForClient = (
          config: { template_id: string | null } | undefined
        ): unknown | null => {
          if (config?.template_id) {
            return (
              templateDefaultById.get(config.template_id) ??
              tenantTemplateDefault
            );
          }

          return tenantTemplateDefault;
        };

        checkInByClientId = new Map();

        for (const id of clientIds) {
          const config = configByClientId.get(id);
          const { schedule } = resolveCheckInScheduleForApi(
            config?.schedule ?? null,
            templateDefaultForClient(config)
          );
          const responses = responsesByClient.get(id) ?? [];
          const status = getCheckInStatus(schedule, responses);

          checkInByClientId.set(id, {
            status,
            customName: schedule.custom_name,
            scheduleDescription: formatScheduleDescription(schedule),
          });
        }
      }
    }

    // Transform data for frontend
    const transformedClients =
      clientRows.map((client: any) => {
        const checkIn = checkInByClientId.get(client.id);

        return {
          id: client.id,
          name: `${client.name} ${client.last_name}`,
          firstName: client.name,
          lastName: client.last_name,
          nickName: client.nick_name,
          email: client.email,
          phone: client.phone,
          status: client.status,
          profileImage: client.profile_picture_url,
          joinedDate: client.sign_up_date,
          occupation: client.occupation,
          dob: client.dob,
          location: {
            city: client.city,
            state: client.state,
            country: client.country,
            zip: client.zip,
          },
          nationalId: client.national_id,
          currentProgram: null,
          totalPrograms: 0,
          lastLogin: client.last_login_at || null,
          checkIn: checkIn
            ? {
                status: checkIn.status,
                customName: checkIn.customName,
                scheduleDescription: checkIn.scheduleDescription,
              }
            : null,
        };
      }) || [];

    // Apply search filter
    let filteredClients = transformedClients;

    if (search) {
      const searchLower = search.toLowerCase();

      filteredClients = transformedClients.filter(
        (client: any) =>
          client.name.toLowerCase().includes(searchLower) ||
          client.email.toLowerCase().includes(searchLower) ||
          client.nickName?.toLowerCase().includes(searchLower)
      );
    }

    console.log(
      "[Clients List API] Returning",
      filteredClients.length,
      "clients"
    );

    return NextResponse.json({
      success: true,
      clients: filteredClients,
      total: filteredClients.length,
    });
  } catch (error) {
    console.error("[Clients List] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
