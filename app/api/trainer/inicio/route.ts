import type { InicioData, PendingItem } from "@/lib/trainer-inicio/types";

import { NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { loadCheckInContext } from "@/lib/forms/checkin-context";
import {
  formatCheckInInstant,
  getCheckInDeadline,
  getCheckInPeriodStart,
  getCheckInStatus,
} from "@/lib/forms/schedule";
import {
  addDays,
  mondayOf,
  pct,
  rosterGrowth,
  sessionsByDay,
  weeklyCheckIns,
  ymdInAppZone,
} from "@/lib/trainer-inicio/stats";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECKIN_WEEKS = 8;
const ROSTER_WEEKS = 12;
/** Un check-in sin revisar deja de pedirse pasado este plazo. */
const REVIEW_WINDOW_DAYS = 14;

const WEEKDAY = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  timeZone: "UTC",
});

/**
 * GET /api/trainer/inicio
 * Todo lo que pinta Inicio salvo la actividad reciente y los vídeos (que ya
 * tienen su endpoint): quién espera algo del entrenador y las cifras de la
 * semana con su histórico.
 */
export async function GET() {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = createSupabaseClient();
    const trainerId = session.trainer_id;
    const now = new Date();
    const today = ymdInAppZone(now);
    const monday = mondayOf(today);
    const lastMonday = addDays(monday, -7);

    const { data: trainer } = await supabase
      .from("trainers")
      .select("tenant_host")
      .eq("id", trainerId)
      .single();
    const tenantHost = (trainer?.tenant_host as string | undefined) ?? "";

    const { data: clientRows, error: clientsError } = await supabase
      .from("clients")
      .select("id, name, last_name, sign_up_date, last_login_at")
      .eq("tenant", trainerId)
      .eq("status", "Activo");

    if (clientsError) throw clientsError;

    const clients = (clientRows ?? []) as {
      id: number;
      name: string | null;
      last_name: string | null;
      sign_up_date: string | null;
      last_login_at: string | null;
    }[];
    const clientIds = clients.map((c) => c.id);
    const nameOf = new Map(
      clients.map((c) => [
        c.id,
        [c.name, c.last_name].filter(Boolean).join(" ") || `Cliente #${c.id}`,
      ])
    );
    const profile = (id: number, query: string) =>
      `/trainer/dashboard/clients/${id}?${query}`;

    const [checkIns, sessionsResult, messagesResult] = await Promise.all([
      tenantHost
        ? loadCheckInContext(
            supabase,
            tenantHost,
            clientIds,
            new Date(
              now.getTime() - (CHECKIN_WEEKS + 3) * 7 * DAY_MS
            ).toISOString()
          )
        : Promise.resolve(new Map()),
      supabase
        .from("scheduled_sessions")
        .select("id, client_id, status, scheduled_date, session_id")
        .eq("trainer_id", trainerId)
        .gte("scheduled_date", lastMonday)
        .lte("scheduled_date", addDays(monday, 6)),
      tenantHost
        ? supabase
            .from("messages")
            .select("id, client_id, message, created_at")
            .eq("tenant_slug", tenantHost)
            .eq("sender_type", "client")
            .is("read_at", null)
            .order("created_at", { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [], error: null }),
    ]);

    // ── Check-ins: por revisar, sin enviar y tendencia ───────────────────
    const review: PendingItem[] = [];
    const expired: PendingItem[] = [];
    const weekly = Array.from({ length: CHECKIN_WEEKS }, () => ({
      due: 0,
      received: 0,
    }));
    const reviewSince = now.getTime() - REVIEW_WINDOW_DAYS * DAY_MS;

    for (const client of clients) {
      const ctx = checkIns.get(client.id);

      if (!ctx || !ctx.schedule.enabled) continue;
      const signUpMs = client.sign_up_date
        ? new Date(client.sign_up_date).getTime()
        : 0;
      const name = nameOf.get(client.id) ?? "";

      for (const r of ctx.responses) {
        const sentMs = new Date(r.submitted_at).getTime();

        if (r.reviewed_at || sentMs < reviewSince) continue;
        review.push({
          id: `review-${r.id}`,
          clientId: client.id,
          client: name,
          detail: `${ctx.schedule.custom_name} del ${formatCheckInInstant(r.submitted_at, ctx.schedule.timezone, false)}`,
          at: r.submitted_at,
          href: profile(client.id, `tab=forms&response=${r.id}`),
        });
      }

      if (
        getCheckInStatus(
          ctx.schedule,
          ctx.responses,
          now,
          signUpMs ? new Date(signUpMs) : undefined
        ) === "expired"
      ) {
        const closed = getCheckInDeadline(
          ctx.schedule,
          getCheckInPeriodStart(ctx.schedule, now)
        );

        expired.push({
          id: `expired-${client.id}`,
          clientId: client.id,
          client: name,
          detail: `${ctx.schedule.custom_name}: cerró el ${formatCheckInInstant(closed, ctx.schedule.timezone, false)} sin respuesta`,
          at: closed.toISOString(),
          href: `/trainer/dashboard/messaging?client=${client.id}`,
        });
      }

      weeklyCheckIns(
        ctx.schedule,
        ctx.responses,
        now,
        CHECKIN_WEEKS,
        signUpMs
      ).forEach((w, i) => {
        const slot = weekly[i];

        if (!slot) return;
        slot.due += w.due;
        slot.received += w.received;
      });
    }

    // ── Mensajes sin leer, agrupados por cliente ─────────────────────────
    const byClient = new Map<
      number,
      { id: string; message: string; at: string; count: number }
    >();

    for (const m of (messagesResult.data ?? []) as {
      id: string;
      client_id: number;
      message: string | null;
      created_at: string;
    }[]) {
      const seen = byClient.get(m.client_id);

      if (seen) seen.count += 1;
      else if (nameOf.has(m.client_id)) {
        byClient.set(m.client_id, {
          id: String(m.id),
          message: m.message ?? "",
          at: m.created_at,
          count: 1,
        });
      }
    }
    const message: PendingItem[] = [...byClient].map(([clientId, m]) => {
      const text = m.message.replace(/\s+/g, " ").trim();
      const preview = text.length > 90 ? `${text.slice(0, 90)}…` : text;

      return {
        id: `message-${m.id}`,
        clientId,
        client: nameOf.get(clientId) ?? "",
        detail:
          (preview ? `«${preview}»` : "Mensaje nuevo") +
          (m.count > 1 ? ` · ${m.count} mensajes` : ""),
        at: m.at,
        href: `/trainer/dashboard/messaging?client=${clientId}`,
      };
    });

    // ── Sesiones: semana actual, comparación y las que siguen abiertas ───
    const sessionRows = (sessionsResult.data ?? []) as {
      id: string;
      client_id: number;
      status: string;
      scheduled_date: string;
      session_id: string | null;
    }[];
    const days = sessionsByDay(sessionRows, monday);
    const todayIndex = Math.round(
      (Date.parse(today) - Date.parse(monday)) / DAY_MS
    );
    const lastWeekToDate = sessionsByDay(sessionRows, lastMonday).slice(
      0,
      todayIndex + 1
    );
    const sum = (list: { done: number; planned: number }[]) =>
      list.reduce(
        (acc, d) => ({
          done: acc.done + d.done,
          planned: acc.planned + d.planned,
        }),
        { done: 0, planned: 0 }
      );
    const thisWeek = sum(days);
    const lastWeek = sum(lastWeekToDate);

    const open = sessionRows
      .filter(
        (s) =>
          s.status !== "completed" &&
          s.scheduled_date.slice(0, 10) < today &&
          s.scheduled_date.slice(0, 10) >= addDays(today, -7) &&
          nameOf.has(s.client_id)
      )
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
    const sessionIds = [
      ...new Set(
        open.map((s) => s.session_id).filter((id): id is string => Boolean(id))
      ),
    ];
    const sessionNames = new Map<string, string>();

    if (sessionIds.length > 0) {
      const { data } = await supabase
        .from("sessions")
        .select("id, name")
        .in("id", sessionIds);

      for (const s of data ?? []) {
        sessionNames.set(String(s.id), (s.name as string | null) ?? "");
      }
    }
    const unfinished: PendingItem[] = open.map((s) => {
      const ymd = s.scheduled_date.slice(0, 10);
      const title =
        (s.session_id && sessionNames.get(s.session_id)) || "Sesión";

      return {
        id: `session-${s.id}`,
        clientId: s.client_id,
        client: nameOf.get(s.client_id) ?? "",
        detail: `${title} · prevista el ${WEEKDAY.format(new Date(`${ymd}T12:00:00Z`))}`,
        // Fin del día previsto: desde ahí cuenta como pendiente.
        at: new Date(Date.parse(ymd) + DAY_MS).toISOString(),
        href: profile(s.client_id, "tab=training&sub=seguimiento"),
      };
    });

    // ── Clientes ────────────────────────────────────────────────────────
    const monthAgo = addDays(today, -30);
    const current = weekly[weekly.length - 1] ?? { due: 0, received: 0 };
    const oldestFirst = (a: PendingItem, b: PendingItem) =>
      a.at.localeCompare(b.at);

    const body: InicioData = {
      pending: {
        review: review.sort(oldestFirst),
        expired: expired.sort(oldestFirst),
        message: message.sort(oldestFirst),
        unfinished,
      },
      sessions: {
        days,
        done: thisWeek.done,
        planned: thisWeek.planned,
        lastWeekPct: pct(lastWeek.done, lastWeek.planned),
        todayIndex,
      },
      checkins: {
        received: current.received,
        due: current.due,
        trend: weekly.map((w) => pct(w.received, w.due) ?? 0),
      },
      clients: {
        active: clients.length,
        activeToday: clients.filter(
          (c) =>
            c.last_login_at && ymdInAppZone(new Date(c.last_login_at)) === today
        ).length,
        joinedLastMonth: clients.filter(
          (c) => c.sign_up_date && c.sign_up_date.slice(0, 10) >= monthAgo
        ).length,
        trend: rosterGrowth(
          clients.map((c) => c.sign_up_date),
          monday,
          ROSTER_WEEKS
        ),
      },
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[Trainer Inicio] Error:", { correlationId, error });

    return NextResponse.json(
      { error: "Error al cargar Inicio" },
      { status: 500 }
    );
  }
}
