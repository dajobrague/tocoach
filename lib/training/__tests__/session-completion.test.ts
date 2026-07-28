import type { SupabaseClient } from "@supabase/supabase-js";

import { describe, expect, it } from "vitest";

import { isSessionFullyCovered } from "../session-completion";

interface LogRow {
  exercise_id: string;
  session_exercise_id: string | null;
}
interface SlotRow {
  id: string;
  exercise_id: string;
}

/**
 * Fake mínimo del cliente supabase para las DOS queries del helper: la tabla
 * decide qué dataset devolver; los métodos encadenados se ignoran y el objeto
 * es thenable para que el `await Promise.all` lo resuelva.
 */
function fakeSupabase(logs: LogRow[], slots: SlotRow[]): SupabaseClient {
  const make = (data: unknown) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;

    for (const method of ["select", "eq", "not"]) {
      chain[method] = self;
    }
    chain.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data, error: null });

    return chain;
  };

  return {
    from: (table: string) =>
      make(table === "exercise_logs" ? logs : slots),
  } as unknown as SupabaseClient;
}

const SLOTS: SlotRow[] = [
  { id: "slot-1", exercise_id: "ex-a" },
  { id: "slot-2", exercise_id: "ex-b" },
];

describe("isSessionFullyCovered", () => {
  it("true cuando cada slot tiene un log finalizado apuntándole", async () => {
    const supabase = fakeSupabase(
      [
        { exercise_id: "ex-a", session_exercise_id: "slot-1" },
        { exercise_id: "ex-b", session_exercise_id: "slot-2" },
      ],
      SLOTS
    );

    await expect(
      isSessionFullyCovered(supabase, "sched-1", "sess-1", 7)
    ).resolves.toBe(true);
  });

  it("false cuando falta un slot por cubrir", async () => {
    const supabase = fakeSupabase(
      [{ exercise_id: "ex-a", session_exercise_id: "slot-1" }],
      SLOTS
    );

    await expect(
      isSessionFullyCovered(supabase, "sched-1", "sess-1", 7)
    ).resolves.toBe(false);
  });

  it("logs legacy (sin slot) cubren por exercise_id de librería", async () => {
    const supabase = fakeSupabase(
      [
        { exercise_id: "ex-a", session_exercise_id: null },
        { exercise_id: "ex-b", session_exercise_id: "" },
      ],
      SLOTS
    );

    await expect(
      isSessionFullyCovered(supabase, "sched-1", "sess-1", 7)
    ).resolves.toBe(true);
  });

  it("slots duplicados del mismo ejercicio NO se cubren con un solo log por slot", async () => {
    const supabase = fakeSupabase(
      [{ exercise_id: "ex-a", session_exercise_id: "slot-1" }],
      [
        { id: "slot-1", exercise_id: "ex-a" },
        { id: "slot-2", exercise_id: "ex-a" },
      ]
    );

    await expect(
      isSessionFullyCovered(supabase, "sched-1", "sess-1", 7)
    ).resolves.toBe(false);
  });

  it("false para una sesión sin slots (nada que cubrir no es 'todo hecho')", async () => {
    const supabase = fakeSupabase([], []);

    await expect(
      isSessionFullyCovered(supabase, "sched-1", "sess-1", 7)
    ).resolves.toBe(false);
  });
});
