import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckInSchedule } from "@/lib/forms/types";

import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  getScheduleOrDefault,
  getSpanishWeekdayLabelForInstant,
  getWallClockWeekdayInTimezone,
  isDueNow,
} from "@/lib/forms/schedule";

const ACTIVE_CLIENT_STATUSES = ["Activo", "Onboarding Completado"] as const;

const MS_23H = 23 * 60 * 60 * 1000;

type CheckinConfigRow = {
  client_id: number;
  tenant_host: string;
  schedule: unknown;
  clients: {
    id: number;
    status: string;
    name: string | null;
    email: string | null;
  };
};

type NotificationInsert = {
  tenant_slug: string;
  client_id: number;
  trainer_id?: string | undefined;
  type: "form_weekly_available" | "form_daily_available";
  title: string;
  message: string;
  icon: string;
  metadata: Record<string, unknown>;
};

async function fetchCheckinConfigsWithClients(
  supabase: SupabaseClient
): Promise<{ rows: CheckinConfigRow[]; error: Error | null }> {
  const embedded = await supabase
    .from("client_form_configs")
    .select(
      "client_id, tenant_host, schedule, clients!inner(id, status, name, email)"
    )
    .eq("form_type", "checkins")
    .or("status.eq.Activo,status.eq.Onboarding Completado", {
      foreignTable: "clients",
    });

  if (!embedded.error && Array.isArray(embedded.data)) {
    return {
      rows: embedded.data as unknown as CheckinConfigRow[],
      error: null,
    };
  }

  const { data: configs, error: cfgErr } = await supabase
    .from("client_form_configs")
    .select("client_id, tenant_host, schedule")
    .eq("form_type", "checkins");

  if (cfgErr) {
    return { rows: [], error: cfgErr };
  }

  if (!configs?.length) {
    return { rows: [], error: null };
  }

  const ids = [...new Set(configs.map((c) => c.client_id))];
  const { data: clients, error: clErr } = await supabase
    .from("clients")
    .select("id, status, name, email")
    .in("id", ids)
    .in("status", [...ACTIVE_CLIENT_STATUSES]);

  if (clErr || !clients) {
    return { rows: [], error: clErr ?? new Error("Failed to load clients") };
  }

  const byId = new Map(clients.map((c) => [c.id, c]));
  const rows: CheckinConfigRow[] = [];

  for (const c of configs) {
    const cl = byId.get(c.client_id);

    if (cl) {
      rows.push({
        client_id: c.client_id,
        tenant_host: c.tenant_host,
        schedule: c.schedule,
        clients: cl,
      });
    }
  }

  return { rows, error: null };
}

async function insertNotificationsResilient(
  supabase: SupabaseClient,
  rows: NotificationInsert[],
  errors: string[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const { error } = await supabase.from("notifications").insert(rows);

  if (!error) return rows.length;

  let created = 0;

  for (const row of rows) {
    const { error: oneErr } = await supabase.from("notifications").insert(row);

    if (oneErr) {
      errors.push(`client ${row.client_id}: ${oneErr.message}`);
    } else {
      created++;
    }
  }

  return created;
}

/**
 * POST /api/forms/notifications/create
 * Create form reminder notifications for clients
 * Can be called manually or by cron job
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { client_id, notification_type, form_type } = body;

    if (!client_id || !notification_type || !form_type) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Parámetros requeridos: client_id, notification_type, form_type",
        },
        { status: 400 }
      );
    }

    // Get client details and tenant_host
    const { data: client } = await supabase
      .from("clients")
      .select("name, email, tenant")
      .eq("id", client_id)
      .single();

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // Resolve trainer by looking up the trainer whose tenant_host matches
    const { data: trainerRecord } = await supabase
      .from("trainers")
      .select("id, tenant_host")
      .eq("id", client.tenant)
      .single();

    if (!trainerRecord) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = trainerRecord.tenant_host;
    const resolvedTrainerId = trainerRecord.id;

    let checkinLabel = "Check-in";

    if (form_type === "checkins") {
      const { data: cfgRow } = await supabase
        .from("client_form_configs")
        .select("schedule")
        .eq("client_id", client_id)
        .eq("form_type", "checkins")
        .maybeSingle();

      checkinLabel = getScheduleOrDefault(
        cfgRow?.schedule as CheckInSchedule | null
      ).custom_name;
    }

    // Create notification title and message based on type
    let title = "";
    let message = "";
    let actionUrl = "";

    if (form_type === "checkins") {
      switch (notification_type) {
        case "form_weekly_available":
          title = `${checkinLabel} disponible`;
          message = `Tu ${checkinLabel} está listo. ¡Compártenos cómo va tu semana!`;
          break;
        case "form_weekly_reminder":
          title = `Recordatorio: ${checkinLabel}`;
          message = `No olvides completar tu ${checkinLabel}`;
          break;
        case "form_weekly_expiring":
          title = "Última Oportunidad";
          message = `Tu ${checkinLabel} vence esta noche. ¡Complétalo ahora!`;
          break;
        case "form_weekly_expired":
          title = `${checkinLabel} vencido`;
          message = `Tu ${checkinLabel} ha expirado. Volverá a estar disponible en la próxima ventana.`;
          break;
      }
    } else {
      switch (notification_type) {
        case "form_daily_available":
          title = "Registro Diario Disponible";
          message = "¡Buenos días! Registra tus hábitos de hoy";
          break;
        case "form_daily_reminder":
          title = "Recordatorio: Registro Diario";
          message = "Aún no has registrado tus hábitos de hoy";
          break;
      }
    }

    // Check if notification already exists today (for daily) or this week (for weekly)
    const today = new Date().toISOString().split("T")[0];

    let existingCheck = supabase
      .from("notifications")
      .select("id")
      .eq("client_id", client_id)
      .eq("type", notification_type);

    if (form_type === "habits") {
      // For daily: check if notification exists today
      existingCheck = existingCheck.gte("created_at", `${today}T00:00:00`);
    } else {
      // For weekly: check if notification exists this week
      const weekStart = new Date();
      const dayOfWeek = weekStart.getDay();
      const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);

      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);

      existingCheck = existingCheck.gte("created_at", weekStart.toISOString());
    }

    const { data: existing } = await existingCheck.limit(1).single();

    // If notification already exists, skip creation
    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Notification already exists",
        notification: existing,
      });
    }

    // Create notification
    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        tenant_slug: tenantHost,
        client_id: client_id,
        trainer_id: resolvedTrainerId,
        type: notification_type,
        title,
        message,
        icon:
          form_type === "checkins"
            ? "solar:clipboard-check-bold"
            : "solar:calendar-mark-bold",
        metadata: {
          form_type,
          action: "open_form",
          created_by: "system",
        },
      })
      .select()
      .single();

    if (error) {
      console.error(
        "[Forms Notifications] Error creating notification:",
        error
      );

      return NextResponse.json(
        { success: false, error: "Error al crear notificación" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("[Forms Notifications] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/forms/notifications/create (batch endpoint)
 * Generate notifications from per-client check-in schedules and daily habits.
 * Called every hour (e.g. pg_cron). `isDueNow` matches hour+minute in the client TZ;
 * hourly triggers only align when the schedule minute is :00.
 */
export async function PUT(_request: NextRequest) {
  const supabase = createSupabaseClient();
  const now = new Date();
  const errors: string[] = [];
  let skippedDuplicates = 0;
  let skippedNotDue = 0;

  try {
    console.log(
      `[FormNotifications:Cron] Evaluating schedules at ${now.toISOString()}`
    );

    const since23h = new Date(now.getTime() - MS_23H).toISOString();

    const { rows: checkinRows, error: checkinFetchErr } =
      await fetchCheckinConfigsWithClients(supabase);

    if (checkinFetchErr) {
      console.error(
        "[FormNotifications:Cron] Error fetching check-in configs:",
        checkinFetchErr
      );

      return NextResponse.json(
        {
          success: false,
          triggered: 0,
          skipped: 0,
          errors: [checkinFetchErr.message],
        },
        { status: 500 }
      );
    }

    type DueCheckin = {
      client_id: number;
      tenant_host: string;
      schedule: CheckInSchedule;
    };

    const dueByClient = new Map<number, DueCheckin>();

    for (const row of checkinRows) {
      try {
        if (row.schedule == null) {
          console.warn(
            `[FormNotifications:Cron] Client ${row.client_id} has no schedule, using defaults`
          );
        }

        const s = getScheduleOrDefault(row.schedule as CheckInSchedule | null);

        if (!s.enabled) {
          skippedNotDue++;
          continue;
        }

        if (!isDueNow(s, now)) {
          skippedNotDue++;
          continue;
        }

        if (!dueByClient.has(row.client_id)) {
          dueByClient.set(row.client_id, {
            client_id: row.client_id,
            tenant_host: row.tenant_host,
            schedule: s,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);

        errors.push(`client ${row.client_id}: ${msg}`);
      }
    }

    const dueCheckinList = [...dueByClient.values()];
    const dueCheckinIds = dueCheckinList.map((d) => d.client_id);

    // Resolve trainer_id from tenant_host for all due check-ins
    const tenantHosts = [...new Set(dueCheckinList.map((d) => d.tenant_host))];
    const trainerByHost = new Map<string, string>();

    if (tenantHosts.length > 0) {
      const { data: trainerRows } = await supabase
        .from("trainers")
        .select("id, tenant_host")
        .in("tenant_host", tenantHosts);

      for (const t of trainerRows ?? []) {
        trainerByHost.set(t.tenant_host, t.id);
      }
    }

    const dupWeeklyIds = new Set<number>();
    let weeklyDupCheckFailed = false;

    if (dueCheckinIds.length > 0) {
      const { data: existingWeekly, error: dupWErr } = await supabase
        .from("notifications")
        .select("client_id")
        .eq("type", "form_weekly_available")
        .gte("created_at", since23h)
        .in("client_id", dueCheckinIds);

      if (dupWErr) {
        errors.push(`duplicate check weekly: ${dupWErr.message}`);
        weeklyDupCheckFailed = true;
      } else if (existingWeekly) {
        for (const r of existingWeekly) {
          dupWeeklyIds.add(r.client_id as number);
        }
      }
    }

    const checkinInsertRows: NotificationInsert[] = [];

    if (!weeklyDupCheckFailed) {
      for (const d of dueCheckinList) {
        if (dupWeeklyIds.has(d.client_id)) {
          skippedDuplicates++;
          continue;
        }

        const s = d.schedule;
        const dayLabel = getSpanishWeekdayLabelForInstant(now, s.timezone);

        console.log(
          `[FormNotifications:Cron] Triggering for client ${d.client_id}, schedule: ${dayLabel} at ${s.time} ${s.timezone}`
        );

        checkinInsertRows.push({
          tenant_slug: d.tenant_host,
          client_id: d.client_id,
          trainer_id: trainerByHost.get(d.tenant_host),
          type: "form_weekly_available",
          title: s.custom_name,
          message: `¡Es hora de completar tu ${s.custom_name}!`,
          icon: "solar:clipboard-check-bold",
          metadata: {
            form_type: "checkins",
            schedule_trigger: true,
            scheduled_day: getWallClockWeekdayInTimezone(now, s.timezone),
            scheduled_time: s.time,
            action: "open_form",
            created_by: "system",
          },
        });
      }
    }

    let triggered = await insertNotificationsResilient(
      supabase,
      checkinInsertRows,
      errors
    );

    // Daily habits: 8:00 UTC, active clients only, tenant from trainers.tenant → tenants.host
    if (now.getUTCHours() === 8) {
      const { data: habitClients, error: hcErr } = await supabase
        .from("clients")
        .select("id, tenant")
        .in("status", [...ACTIVE_CLIENT_STATUSES]);

      if (hcErr) {
        errors.push(`habits clients fetch: ${hcErr.message}`);
      } else if (habitClients?.length) {
        const trainerIds = [
          ...new Set(
            habitClients.map((c) => c.tenant).filter(Boolean) as string[]
          ),
        ];

        const { data: tenantRows, error: tErr } = await supabase
          .from("tenants")
          .select("trainer_id, host")
          .in("trainer_id", trainerIds);

        if (tErr) {
          errors.push(`habits tenants fetch: ${tErr.message}`);
        } else {
          const hostByTrainer = new Map(
            (tenantRows ?? []).map((t) => [t.trainer_id, t.host] as const)
          );
          const trainerIdByHost = new Map(
            (tenantRows ?? []).map((t) => [t.host, t.trainer_id] as const)
          );

          const habitCandidates: { id: number; tenant_slug: string }[] = [];

          for (const c of habitClients) {
            const host = c.tenant ? hostByTrainer.get(c.tenant) : undefined;

            if (!host) {
              errors.push(`client ${c.id}: tenant host not found`);
              continue;
            }

            habitCandidates.push({ id: c.id, tenant_slug: host });
          }

          const habitIds = habitCandidates.map((h) => h.id);
          const dupDailyIds = new Set<number>();
          let dailyDupCheckFailed = false;

          if (habitIds.length > 0) {
            const { data: existingDaily, error: dupDErr } = await supabase
              .from("notifications")
              .select("client_id")
              .eq("type", "form_daily_available")
              .gte("created_at", since23h)
              .in("client_id", habitIds);

            if (dupDErr) {
              errors.push(`duplicate check daily: ${dupDErr.message}`);
              dailyDupCheckFailed = true;
            } else if (existingDaily) {
              for (const r of existingDaily) {
                dupDailyIds.add(r.client_id as number);
              }
            }
          }

          const habitInsertRows: NotificationInsert[] = [];

          if (!dailyDupCheckFailed) {
            for (const h of habitCandidates) {
              if (dupDailyIds.has(h.id)) {
                skippedDuplicates++;
                continue;
              }

              habitInsertRows.push({
                tenant_slug: h.tenant_slug,
                client_id: h.id,
                trainer_id: trainerIdByHost.get(h.tenant_slug),
                type: "form_daily_available",
                title: "Registro Diario Disponible",
                message: "¡Buenos días! Registra tus hábitos de hoy",
                icon: "solar:calendar-mark-bold",
                metadata: {
                  form_type: "habits",
                  action: "open_form",
                  created_by: "system",
                },
              });
            }
          }

          triggered += await insertNotificationsResilient(
            supabase,
            habitInsertRows,
            errors
          );
        }
      }
    }

    const skipped = skippedDuplicates + skippedNotDue;

    console.log(
      `[FormNotifications:Cron] Created ${triggered} notifications, skipped ${skippedDuplicates} (duplicates), skipped ${skippedNotDue} (not due)`
    );

    return NextResponse.json({
      success: true,
      triggered,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("[FormNotifications:Cron] Unexpected error:", error);
    const msg = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        success: false,
        triggered: 0,
        skipped: 0,
        errors: [msg],
      },
      { status: 500 }
    );
  }
}
