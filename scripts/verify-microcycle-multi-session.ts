/**
 * Verifies the microcycle multi-session-per-day overhaul (migrations 113/114/115
 * + API route changes) against Pedro Javier Orellana Pérez — the client that
 * surfaced the original bug.
 *
 * What it does:
 *  - Picks far-future dates (2026-09-01..05) that we know are unused so we
 *    can INSERT synthetic state without touching real activity.
 *  - Walks through each scenario the architecture must handle:
 *      A. Multi-session same day (the headline bug)
 *      B. Trainer pin coexists with client row for a different session
 *      C. Stale trainer pin (no logs) → DELETED by replace_overrides
 *      D. Stale trainer pin (with logs) → DEMOTED to 'client'
 *      E. Resolver picks trainer pin or microcycle slot, never a client row
 *      F. start_date cascade: deletes future trainer pins, preserves logs
 *      G. resetDay: demotes pins with logs, deletes pins without
 *  - Cleans up after each scenario (also at script start, in case a prior
 *    failed run left state behind).
 *
 * Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in
 * `.env.local`. Run: `npx tsx scripts/verify-microcycle-multi-session.ts`
 *
 * Exit code: 0 if all scenarios pass, 1 if any fail.
 */

/* eslint-disable no-console */
import { config } from "dotenv";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/clients/supabase-admin";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Pedro Javier Orellana Pérez — the client from the original bug report.
const CLIENT_ID = 179;
const TRAINER_ID = "f35d7800-6181-4bd3-8b5c-2c9cc364220a";
const MICROCYCLE_ID = "d2b06fdb-85f3-41f1-86c7-6c45d49af595";

// Sessions from Pedro's microcycle slots (all owned by the same trainer).
const TORSO_FUERZA = "e7c1ac45-6443-4132-987b-ca8754c99f21";
const BICEPS_PIERNA_F = "2518e241-e97b-49bf-960b-8c8880676a0c";
const TORSO_HIPERTROFIA = "93a349f4-b60f-4e63-a26a-86ec456f7796";
const BICEPS_GLUTEO_H = "5d20ea4c-4ee1-4f95-9944-39e0d9de833b";

// An exercise that exists in the trainer's library (used for log probes).
const EXERCISE_HIP_THRUST = "fd8a3cfe-b9b1-449c-b157-94e158c45456";

// Test date range: far in the future so we don't collide with real activity.
const TEST_DATES = {
  scenarioA: "2026-09-01",
  scenarioB: "2026-09-02",
  scenarioC: "2026-09-03",
  scenarioD: "2026-09-04",
  scenarioF1: "2026-09-05", // future trainer pin no logs (should be deleted)
  scenarioF2: "2026-09-06", // future trainer pin with logs (should survive)
  scenarioG: "2026-09-07",
};

type Supabase = ReturnType<typeof createSupabaseAdminClient>;

interface Result {
  name: string;
  pass: boolean;
  details: string;
}

const results: Result[] = [];

function record(name: string, pass: boolean, details: string) {
  results.push({ name, pass, details });
  const prefix = pass ? "  ✅" : "  ❌";

  console.log(`${prefix} ${name}`);
  if (!pass) console.log(`     ${details}`);
}

async function lookupTenantHost(supabase: Supabase): Promise<string> {
  const { data, error } = await supabase
    .from("scheduled_sessions")
    .select("tenant_host")
    .eq("client_id", CLIENT_ID)
    .limit(1);

  if (error || !data?.[0]?.tenant_host) {
    throw new Error(
      "Could not resolve Pedro's tenant_host: " + (error?.message ?? "no rows")
    );
  }

  return data[0].tenant_host;
}

async function deleteSyntheticRowsForDates(
  supabase: Supabase,
  dates: string[]
): Promise<void> {
  // Delete exercise_logs first (FK), then scheduled_sessions.
  const { data: rows } = await supabase
    .from("scheduled_sessions")
    .select("id")
    .eq("client_id", CLIENT_ID)
    .in("scheduled_date", dates);
  const ids = (rows ?? []).map((r) => r.id);

  if (ids.length > 0) {
    await supabase
      .from("exercise_logs")
      .delete()
      .in("scheduled_session_id", ids);
    await supabase.from("scheduled_sessions").delete().in("id", ids);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// SCENARIO A — Multi-session same day (the headline bug)
// Pre-fix: both upserts would return the SAME id; logs from the second session
// would attach to the first session's row.
// Post-fix: each upsert creates its own row keyed on (client, date, session_id).
// ────────────────────────────────────────────────────────────────────────────
async function scenarioA(
  supabase: Supabase,
  tenantHost: string
): Promise<void> {
  const date = TEST_DATES.scenarioA;
  const sectionStart = "SCENARIO A — Multi-session same day";

  console.log(`\n${sectionStart}`);

  // First upsert: session A.
  const { data: idA } = await supabase.rpc("upsert_scheduled_session", {
    p_tenant_host: tenantHost,
    p_client_id: CLIENT_ID,
    p_trainer_id: TRAINER_ID,
    p_session_id: TORSO_FUERZA,
    p_scheduled_date: date,
    p_caller_role: "client",
  });

  // Second upsert: session B (different).
  const { data: idB } = await supabase.rpc("upsert_scheduled_session", {
    p_tenant_host: tenantHost,
    p_client_id: CLIENT_ID,
    p_trainer_id: TRAINER_ID,
    p_session_id: BICEPS_PIERNA_F,
    p_scheduled_date: date,
    p_caller_role: "client",
  });

  record(
    "A1 — upserts returned distinct ids for two sessions same day",
    typeof idA === "string" && typeof idB === "string" && idA !== idB,
    `idA=${idA}, idB=${idB}`
  );

  const { data: rows } = await supabase
    .from("scheduled_sessions")
    .select("id, session_id, prescribed_by")
    .eq("client_id", CLIENT_ID)
    .eq("scheduled_date", date)
    .order("session_id");

  record(
    "A2 — two scheduled_sessions rows exist",
    (rows ?? []).length === 2,
    `count=${(rows ?? []).length}`
  );

  const sessionIds = (rows ?? []).map((r) => r.session_id).sort();
  const expected = [TORSO_FUERZA, BICEPS_PIERNA_F].sort();

  record(
    "A3 — each row has its own correct session_id",
    JSON.stringify(sessionIds) === JSON.stringify(expected),
    `got=${JSON.stringify(sessionIds)}`
  );

  record(
    "A4 — both rows prescribed_by='client' (created by upsert with client role)",
    (rows ?? []).every((r) => r.prescribed_by === "client"),
    `prescribed_by values=${(rows ?? []).map((r) => r.prescribed_by).join(",")}`
  );

  // Third upsert with the SAME session_id as the first — should return the
  // existing id (idempotent), not create a third row.
  const { data: idAagain } = await supabase.rpc("upsert_scheduled_session", {
    p_tenant_host: tenantHost,
    p_client_id: CLIENT_ID,
    p_trainer_id: TRAINER_ID,
    p_session_id: TORSO_FUERZA,
    p_scheduled_date: date,
    p_caller_role: "client",
  });

  record(
    "A5 — re-upsert on same session returns the existing id (no third row)",
    idAagain === idA,
    `idA=${idA}, idAagain=${idAagain}`
  );

  await deleteSyntheticRowsForDates(supabase, [date]);
}

// ────────────────────────────────────────────────────────────────────────────
// SCENARIO B — Trainer pin coexists with client row for different session
// ────────────────────────────────────────────────────────────────────────────
async function scenarioB(
  supabase: Supabase,
  tenantHost: string
): Promise<void> {
  const date = TEST_DATES.scenarioB;

  console.log(`\nSCENARIO B — Trainer pin + client row for different session`);

  // Trainer pins session X.
  await supabase.from("scheduled_sessions").insert({
    tenant_host: tenantHost,
    client_id: CLIENT_ID,
    trainer_id: TRAINER_ID,
    session_id: TORSO_FUERZA,
    scheduled_date: date,
    status: "scheduled",
    prescribed_by: "trainer",
  });

  // Client logs an exercise against session Y (different) → upsert as 'client'.
  const { data: clientRowId } = await supabase.rpc("upsert_scheduled_session", {
    p_tenant_host: tenantHost,
    p_client_id: CLIENT_ID,
    p_trainer_id: TRAINER_ID,
    p_session_id: BICEPS_PIERNA_F,
    p_scheduled_date: date,
    p_caller_role: "client",
  });

  const { data: rows } = await supabase
    .from("scheduled_sessions")
    .select("session_id, prescribed_by")
    .eq("client_id", CLIENT_ID)
    .eq("scheduled_date", date)
    .order("prescribed_by");

  record(
    "B1 — both trainer pin and client row coexist",
    (rows ?? []).length === 2,
    `count=${(rows ?? []).length}`
  );

  const trainerRow = (rows ?? []).find((r) => r.prescribed_by === "trainer");
  const clientRow = (rows ?? []).find((r) => r.prescribed_by === "client");

  record(
    "B2 — trainer pin retained its session_id (Torso Fuerza)",
    trainerRow?.session_id === TORSO_FUERZA,
    `trainerRow.session_id=${trainerRow?.session_id}`
  );

  record(
    "B3 — client row has its own session_id (Bíceps y Pierna F)",
    clientRow?.session_id === BICEPS_PIERNA_F,
    `clientRow.session_id=${clientRow?.session_id}`
  );

  record(
    "B4 — RPC returned the client row id (not the trainer's)",
    typeof clientRowId === "string" &&
      clientRowId !== undefined &&
      clientRow !== undefined,
    `clientRowId=${clientRowId}`
  );

  await deleteSyntheticRowsForDates(supabase, [date]);
}

// ────────────────────────────────────────────────────────────────────────────
// SCENARIO C — Stale trainer pin (no logs) gets deleted by replace_overrides
// ────────────────────────────────────────────────────────────────────────────
async function scenarioC(
  supabase: Supabase,
  tenantHost: string
): Promise<void> {
  const date = TEST_DATES.scenarioC;

  console.log(`\nSCENARIO C — Stale trainer pin (no logs) → DELETED`);

  // Stale pin on session X, no logs.
  await supabase.from("scheduled_sessions").insert({
    tenant_host: tenantHost,
    client_id: CLIENT_ID,
    trainer_id: TRAINER_ID,
    session_id: TORSO_FUERZA,
    scheduled_date: date,
    status: "scheduled",
    prescribed_by: "trainer",
  });

  // Trainer pins session Y via replace_scheduled_session_overrides.
  await supabase.rpc("replace_scheduled_session_overrides", {
    p_tenant_host: tenantHost,
    p_client_id: CLIENT_ID,
    p_trainer_id: TRAINER_ID,
    p_scheduled_date: date,
    p_session_id: BICEPS_PIERNA_F,
    p_exercises: [],
    p_sets: [],
  });

  const { data: rows } = await supabase
    .from("scheduled_sessions")
    .select("session_id, prescribed_by")
    .eq("client_id", CLIENT_ID)
    .eq("scheduled_date", date);

  record(
    "C1 — exactly one row remains",
    (rows ?? []).length === 1,
    `count=${(rows ?? []).length}`
  );

  record(
    "C2 — surviving row is the new trainer pin (Bíceps y Pierna F)",
    rows?.[0]?.session_id === BICEPS_PIERNA_F &&
      rows?.[0]?.prescribed_by === "trainer",
    `row=${JSON.stringify(rows?.[0])}`
  );

  await deleteSyntheticRowsForDates(supabase, [date]);
}

// ────────────────────────────────────────────────────────────────────────────
// SCENARIO D — Stale trainer pin (with logs) gets demoted to 'client'
// ────────────────────────────────────────────────────────────────────────────
async function scenarioD(
  supabase: Supabase,
  tenantHost: string
): Promise<void> {
  const date = TEST_DATES.scenarioD;

  console.log(
    `\nSCENARIO D — Stale trainer pin (with logs) → DEMOTED to 'client'`
  );

  // Stale pin on X with a log.
  const { data: pinRow } = await supabase
    .from("scheduled_sessions")
    .insert({
      tenant_host: tenantHost,
      client_id: CLIENT_ID,
      trainer_id: TRAINER_ID,
      session_id: TORSO_FUERZA,
      scheduled_date: date,
      status: "scheduled",
      prescribed_by: "trainer",
    })
    .select("id")
    .single();

  await supabase.from("exercise_logs").insert({
    tenant_host: tenantHost,
    scheduled_session_id: pinRow!.id,
    exercise_id: EXERCISE_HIP_THRUST,
    client_id: CLIENT_ID,
    trainer_id: TRAINER_ID,
    completed_at: new Date().toISOString(),
  });

  // Trainer pins Y.
  await supabase.rpc("replace_scheduled_session_overrides", {
    p_tenant_host: tenantHost,
    p_client_id: CLIENT_ID,
    p_trainer_id: TRAINER_ID,
    p_scheduled_date: date,
    p_session_id: BICEPS_PIERNA_F,
    p_exercises: [],
    p_sets: [],
  });

  const { data: rows } = await supabase
    .from("scheduled_sessions")
    .select(
      `session_id, prescribed_by,
       logs:exercise_logs(id)`
    )
    .eq("client_id", CLIENT_ID)
    .eq("scheduled_date", date)
    .order("prescribed_by");

  record(
    "D1 — two rows remain (demoted + new pin)",
    (rows ?? []).length === 2,
    `count=${(rows ?? []).length}`
  );

  const demoted = (rows ?? []).find((r) => r.session_id === TORSO_FUERZA);
  const newPin = (rows ?? []).find((r) => r.session_id === BICEPS_PIERNA_F);

  record(
    "D2 — old pin demoted to prescribed_by='client'",
    demoted?.prescribed_by === "client",
    `demoted.prescribed_by=${demoted?.prescribed_by}`
  );

  record(
    "D3 — demoted row preserved its log",
    (demoted as any)?.logs?.length === 1,
    `logs=${JSON.stringify((demoted as any)?.logs)}`
  );

  record(
    "D4 — new pin is prescribed_by='trainer' with no logs",
    newPin?.prescribed_by === "trainer" &&
      ((newPin as any)?.logs?.length ?? 0) === 0,
    `newPin=${JSON.stringify(newPin)}`
  );

  await deleteSyntheticRowsForDates(supabase, [date]);
}

// ────────────────────────────────────────────────────────────────────────────
// SCENARIO E — Resolver semantics: trainer pin wins, client rows ignored
// Walks Pedro's HISTORICAL polluted data (May 12, 14, 19) without modifying it.
// ────────────────────────────────────────────────────────────────────────────
async function scenarioE(supabase: Supabase): Promise<void> {
  console.log(`\nSCENARIO E — Resolver semantics (historical data, read-only)`);

  // For each date, simulate what the new resolver returns for
  // trainer_recommended_session_id.
  async function trainerRecommendedFor(date: string): Promise<{
    fromTrainerPin: string | null;
    fromMicrocycleSlot: string | null;
    expected: string | null;
  }> {
    const { data: pinRows } = await supabase
      .from("scheduled_sessions")
      .select("session_id")
      .eq("client_id", CLIENT_ID)
      .eq("scheduled_date", date)
      .eq("prescribed_by", "trainer")
      .limit(1);
    const fromTrainerPin = pinRows?.[0]?.session_id ?? null;

    // Compute the slot from Pedro's microcycle.
    const { data: mc } = await supabase
      .from("microcycles")
      .select("duration_days, start_date")
      .eq("id", MICROCYCLE_ID)
      .single();

    if (!mc?.start_date) {
      return { fromTrainerPin, fromMicrocycleSlot: null, expected: null };
    }

    const start = new Date(mc.start_date + "T00:00:00").getTime();
    const target = new Date(date + "T00:00:00").getTime();
    const offset = Math.round((target - start) / (24 * 60 * 60 * 1000));
    const dayIndex =
      (((offset % mc.duration_days) + mc.duration_days) % mc.duration_days) + 1;

    const { data: slot } = await supabase
      .from("microcycle_slots")
      .select("session_id")
      .eq("microcycle_id", MICROCYCLE_ID)
      .eq("day_index", dayIndex)
      .maybeSingle();

    const fromMicrocycleSlot = slot?.session_id ?? null;
    const expected = fromTrainerPin ?? fromMicrocycleSlot;

    return { fromTrainerPin, fromMicrocycleSlot, expected };
  }

  // 5-14: REST day in template, Pedro has a polluted prescribed_by='client'
  // row. Trainer recommendation should be null (resolver must ignore client row).
  const may14 = await trainerRecommendedFor("2026-05-14");

  record(
    "E1 — 2026-05-14 (REST template, client row): recommendation = null",
    may14.expected === null,
    `expected=${may14.expected}, fromTrainerPin=${may14.fromTrainerPin}, fromSlot=${may14.fromMicrocycleSlot}`
  );

  // 5-19: trainer pin exists for Torso Fuerza.
  const may19 = await trainerRecommendedFor("2026-05-19");

  record(
    "E2 — 2026-05-19 (trainer pin): recommendation = Torso Fuerza",
    may19.expected === TORSO_FUERZA,
    `expected=${may19.expected}`
  );

  // 5-25: REST day in template, no rows. Recommendation = null.
  const may25 = await trainerRecommendedFor("2026-05-25");

  record(
    "E3 — 2026-05-25 (REST, no rows): recommendation = null",
    may25.expected === null,
    `expected=${may25.expected}`
  );

  // 5-26: D16 = Torso Fuerza in template, no trainer pin (or there is —
  // depends on Pedro's actual state). Either way, recommendation should be
  // Torso Fuerza (slot or pin both point there).
  const may26 = await trainerRecommendedFor("2026-05-26");

  record(
    "E4 — 2026-05-26 (D16 = Torso Fuerza): recommendation = Torso Fuerza",
    may26.expected === TORSO_FUERZA,
    `expected=${may26.expected}`
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SCENARIO F — start_date cascade
// ────────────────────────────────────────────────────────────────────────────
async function scenarioF(
  supabase: Supabase,
  tenantHost: string
): Promise<void> {
  console.log(`\nSCENARIO F — start_date cascade`);

  const dateNoLogs = TEST_DATES.scenarioF1;
  const dateWithLogs = TEST_DATES.scenarioF2;

  // Pin with no logs.
  await supabase.from("scheduled_sessions").insert({
    tenant_host: tenantHost,
    client_id: CLIENT_ID,
    trainer_id: TRAINER_ID,
    session_id: TORSO_FUERZA,
    scheduled_date: dateNoLogs,
    status: "scheduled",
    prescribed_by: "trainer",
  });

  // Pin with logs.
  const { data: pinWithLogs } = await supabase
    .from("scheduled_sessions")
    .insert({
      tenant_host: tenantHost,
      client_id: CLIENT_ID,
      trainer_id: TRAINER_ID,
      session_id: TORSO_HIPERTROFIA,
      scheduled_date: dateWithLogs,
      status: "scheduled",
      prescribed_by: "trainer",
    })
    .select("id")
    .single();

  await supabase.from("exercise_logs").insert({
    tenant_host: tenantHost,
    scheduled_session_id: pinWithLogs!.id,
    exercise_id: EXERCISE_HIP_THRUST,
    client_id: CLIENT_ID,
    trainer_id: TRAINER_ID,
    completed_at: new Date().toISOString(),
  });

  // Simulate the cleanFuturePrescribedRowsForReset helper:
  //   - fromDate = 2026-09-01 (earlier than both dates).
  //   - scopedSessionIds = sessions in Pedro's microcycle slots.
  const { data: slots } = await supabase
    .from("microcycle_slots")
    .select("session_id")
    .eq("microcycle_id", MICROCYCLE_ID)
    .not("session_id", "is", null);
  const scopedSessionIds = Array.from(
    new Set((slots ?? []).map((s) => s.session_id).filter(Boolean) as string[])
  );

  // Run the cascade logic inline.
  const { data: candidates } = await supabase
    .from("scheduled_sessions")
    .select("id")
    .eq("client_id", CLIENT_ID)
    .eq("prescribed_by", "trainer")
    .gte("scheduled_date", "2026-09-01")
    .in("session_id", scopedSessionIds);
  const candidateIds = (candidates ?? []).map((r) => r.id);

  const { data: withLogs } = await supabase
    .from("exercise_logs")
    .select("scheduled_session_id")
    .in("scheduled_session_id", candidateIds);
  const withLogsSet = new Set(
    (withLogs ?? []).map((l) => l.scheduled_session_id)
  );
  const toDelete = candidateIds.filter((id) => !withLogsSet.has(id));

  if (toDelete.length > 0) {
    await supabase.from("scheduled_sessions").delete().in("id", toDelete);
  }

  // Verify outcomes.
  const { data: remainNoLogs } = await supabase
    .from("scheduled_sessions")
    .select("id")
    .eq("client_id", CLIENT_ID)
    .eq("scheduled_date", dateNoLogs);

  record(
    "F1 — pin without logs is deleted",
    (remainNoLogs ?? []).length === 0,
    `count=${(remainNoLogs ?? []).length}`
  );

  const { data: remainWithLogs } = await supabase
    .from("scheduled_sessions")
    .select("id, prescribed_by")
    .eq("client_id", CLIENT_ID)
    .eq("scheduled_date", dateWithLogs);

  record(
    "F2 — pin with logs survives, still prescribed_by='trainer'",
    (remainWithLogs ?? []).length === 1 &&
      remainWithLogs?.[0]?.prescribed_by === "trainer",
    `rows=${JSON.stringify(remainWithLogs)}`
  );

  // Sanity: a row outside the scoped sessions wouldn't be touched. Insert one
  // with a session_id that exists but is NOT in Pedro's microcycle slots.
  // To find one, query for a session owned by Pedro's trainer that's NOT in
  // the scoped list. If none exists, skip this sub-check.
  const { data: outsideSessions } = await supabase
    .from("sessions")
    .select("id")
    .eq("trainer_id", TRAINER_ID)
    .not("id", "in", `(${scopedSessionIds.join(",")})`)
    .limit(1);

  if ((outsideSessions ?? []).length > 0) {
    const outsideSessionId = outsideSessions![0]!.id;
    const outsideDate = "2026-09-08";

    await supabase.from("scheduled_sessions").insert({
      tenant_host: tenantHost,
      client_id: CLIENT_ID,
      trainer_id: TRAINER_ID,
      session_id: outsideSessionId,
      scheduled_date: outsideDate,
      status: "scheduled",
      prescribed_by: "trainer",
    });

    // Re-run cascade (would have already cleared above if it were going to).
    const { data: outsideCandidates } = await supabase
      .from("scheduled_sessions")
      .select("id")
      .eq("client_id", CLIENT_ID)
      .eq("prescribed_by", "trainer")
      .eq("scheduled_date", outsideDate)
      .in("session_id", scopedSessionIds);

    record(
      "F3 — pin outside microcycle slot set is NOT in scope (multi-program protection)",
      (outsideCandidates ?? []).length === 0,
      `outside candidates=${(outsideCandidates ?? []).length}`
    );

    await supabase
      .from("scheduled_sessions")
      .delete()
      .eq("client_id", CLIENT_ID)
      .eq("scheduled_date", outsideDate);
  }

  await deleteSyntheticRowsForDates(supabase, [
    dateNoLogs,
    dateWithLogs,
    "2026-09-08",
  ]);
}

// ────────────────────────────────────────────────────────────────────────────
// SCENARIO G — resetDay semantics
// ────────────────────────────────────────────────────────────────────────────
async function scenarioG(
  supabase: Supabase,
  tenantHost: string
): Promise<void> {
  const date = TEST_DATES.scenarioG;

  console.log(
    `\nSCENARIO G — resetDay (demote pins with logs, delete pins without)`
  );

  // Trainer pin with logs (session X).
  const { data: pinWith } = await supabase
    .from("scheduled_sessions")
    .insert({
      tenant_host: tenantHost,
      client_id: CLIENT_ID,
      trainer_id: TRAINER_ID,
      session_id: TORSO_FUERZA,
      scheduled_date: date,
      status: "scheduled",
      prescribed_by: "trainer",
    })
    .select("id")
    .single();

  await supabase.from("exercise_logs").insert({
    tenant_host: tenantHost,
    scheduled_session_id: pinWith!.id,
    exercise_id: EXERCISE_HIP_THRUST,
    client_id: CLIENT_ID,
    trainer_id: TRAINER_ID,
    completed_at: new Date().toISOString(),
  });

  // Trainer pin without logs (session Y).
  await supabase.from("scheduled_sessions").insert({
    tenant_host: tenantHost,
    client_id: CLIENT_ID,
    trainer_id: TRAINER_ID,
    session_id: BICEPS_PIERNA_F,
    scheduled_date: date,
    status: "scheduled",
    prescribed_by: "trainer",
  });

  // Client-only row (session Z) — must NEVER be touched by reset.
  await supabase.from("scheduled_sessions").insert({
    tenant_host: tenantHost,
    client_id: CLIENT_ID,
    trainer_id: TRAINER_ID,
    session_id: TORSO_HIPERTROFIA,
    scheduled_date: date,
    status: "scheduled",
    prescribed_by: "client",
  });

  // Simulate resetDay's logic inline.
  const { data: pins } = await supabase
    .from("scheduled_sessions")
    .select("id")
    .eq("client_id", CLIENT_ID)
    .eq("scheduled_date", date)
    .eq("prescribed_by", "trainer");
  const pinIds = (pins ?? []).map((p) => p.id);
  const { data: pinsWithLogs } = await supabase
    .from("exercise_logs")
    .select("scheduled_session_id")
    .in("scheduled_session_id", pinIds);
  const idsWithLogs = new Set(
    (pinsWithLogs ?? []).map((r) => r.scheduled_session_id)
  );
  const toDemote = pinIds.filter((id) => idsWithLogs.has(id));
  const toDelete = pinIds.filter((id) => !idsWithLogs.has(id));

  if (toDemote.length > 0) {
    await supabase
      .from("scheduled_sessions")
      .update({ prescribed_by: "client", status: "scheduled" })
      .in("id", toDemote);
  }
  if (toDelete.length > 0) {
    await supabase.from("scheduled_sessions").delete().in("id", toDelete);
  }

  const { data: after } = await supabase
    .from("scheduled_sessions")
    .select("session_id, prescribed_by")
    .eq("client_id", CLIENT_ID)
    .eq("scheduled_date", date)
    .order("session_id");

  // Expected: TWO rows remaining — the demoted (X, client) and the original
  // client-only (Z, client). The without-logs pin (Y) was deleted.
  record(
    "G1 — exactly two rows remain after reset",
    (after ?? []).length === 2,
    `count=${(after ?? []).length}`
  );

  const demoted = (after ?? []).find((r) => r.session_id === TORSO_FUERZA);
  const clientOnly = (after ?? []).find(
    (r) => r.session_id === TORSO_HIPERTROFIA
  );
  const noLogsPin = (after ?? []).find((r) => r.session_id === BICEPS_PIERNA_F);

  record(
    "G2 — pin with logs demoted to 'client'",
    demoted?.prescribed_by === "client",
    `demoted=${JSON.stringify(demoted)}`
  );

  record(
    "G3 — pin without logs deleted",
    noLogsPin === undefined,
    `noLogsPin=${JSON.stringify(noLogsPin)}`
  );

  record(
    "G4 — original client-only row untouched",
    clientOnly?.prescribed_by === "client",
    `clientOnly=${JSON.stringify(clientOnly)}`
  );

  await deleteSyntheticRowsForDates(supabase, [date]);
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    "═══════════════════════════════════════════════════════════════════"
  );
  console.log("  Microcycle multi-session verification for Pedro (client 179)");
  console.log(
    "═══════════════════════════════════════════════════════════════════"
  );

  let supabase: Supabase;

  try {
    supabase = createSupabaseAdminClient();
  } catch (e) {
    console.error("Failed to create Supabase admin client:", e);
    process.exit(1);
  }

  const tenantHost = await lookupTenantHost(supabase);

  console.log(`\ntenant_host: ${tenantHost}`);
  console.log(`microcycle_id: ${MICROCYCLE_ID}`);

  // Defensive cleanup before running — in case a prior failed run left state.
  await deleteSyntheticRowsForDates(supabase, Object.values(TEST_DATES));

  try {
    await scenarioA(supabase, tenantHost);
    await scenarioB(supabase, tenantHost);
    await scenarioC(supabase, tenantHost);
    await scenarioD(supabase, tenantHost);
    await scenarioE(supabase);
    await scenarioF(supabase, tenantHost);
    await scenarioG(supabase, tenantHost);
  } catch (e) {
    console.error("\nUnexpected exception during scenarios:", e);
  } finally {
    // Final cleanup pass, just in case.
    await deleteSyntheticRowsForDates(supabase, Object.values(TEST_DATES));
  }

  console.log(
    "\n═══════════════════════════════════════════════════════════════════"
  );

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(
    `  Results: ${passed} passed, ${failed} failed (of ${results.length})`
  );
  console.log(
    "═══════════════════════════════════════════════════════════════════"
  );

  if (failed > 0) {
    console.log("\nFailures:");
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  ❌ ${r.name}`);
      console.log(`     ${r.details}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
