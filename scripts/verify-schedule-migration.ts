/**
 * Verify check-in schedule data in `client_form_configs` (operator / local only).
 *
 * Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or `.env`.
 * Never expose the service role key to the browser; this script is for migrations / audits only.
 *
 * Run: npx tsx scripts/verify-schedule-migration.ts
 */

import { config } from "dotenv";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/clients/supabase-admin";
import { getScheduleOrDefault } from "../lib/forms/schedule";
import { validateCheckInScheduleInput } from "../lib/forms/schedule-validation";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const MAX_UNIQUE_PRINT = 50;

function timezoneLooksValid(tz: string): boolean {
  const t = tz.trim();

  if (!t) return false;

  try {
    Intl.DateTimeFormat("en-US", { timeZone: t }).format(new Date());

    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("--- verify-schedule-migration ---\n");

  let supabase;

  try {
    supabase = createSupabaseAdminClient();
  } catch (e) {
    console.error(
      "Failed to create Supabase admin client. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
    console.error(e);

    process.exit(1);
  }

  const { data: rows, error } = await supabase
    .from("client_form_configs")
    .select("client_id, tenant_host, schedule")
    .eq("form_type", "checkins");

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  const list = rows ?? [];
  const total = list.length;
  const nullSchedules = list.filter((r) => r.schedule == null);
  const nonNullSchedules = list.filter((r) => r.schedule != null);

  console.log(`Total check-ins configs: ${total}`);
  console.log(`schedule IS NULL:        ${nullSchedules.length}`);
  console.log(`schedule IS NOT NULL:    ${nonNullSchedules.length}\n`);

  const fingerprintCounts = new Map<string, number>();

  for (const r of list) {
    const key = r.schedule == null ? "__NULL__" : JSON.stringify(r.schedule);
    fingerprintCounts.set(key, (fingerprintCounts.get(key) ?? 0) + 1);
  }

  const sorted = [...fingerprintCounts.entries()].sort((a, b) => b[1] - a[1]);

  console.log(
    `Unique schedule fingerprints: ${sorted.length} (showing up to ${MAX_UNIQUE_PRINT})\n`
  );

  let shown = 0;

  for (const [fp, count] of sorted) {
    if (shown >= MAX_UNIQUE_PRINT) {
      console.log(`… ${sorted.length - shown} more bucket(s) not printed`);

      break;
    }

    const preview =
      fp === "__NULL__"
        ? "(null)"
        : fp.length > 120
          ? `${fp.slice(0, 117)}…`
          : fp;
    console.log(`  × ${count}  ${preview}`);
    shown++;
  }

  console.log("\n--- Validation (non-null JSON only) ---\n");

  const invalid: {
    client_id: number;
    tenant_host: string;
    errors: string[];
  }[] = [];
  const tzInvalid: { client_id: number; tz: string }[] = [];

  for (const r of nonNullSchedules) {
    const v = validateCheckInScheduleInput(r.schedule);

    if (!v.ok) {
      invalid.push({
        client_id: r.client_id as number,
        tenant_host: String(r.tenant_host),
        errors: v.errors,
      });
    } else {
      const s = getScheduleOrDefault(v.value);

      if (!timezoneLooksValid(s.timezone)) {
        tzInvalid.push({ client_id: r.client_id as number, tz: s.timezone });
      }
    }
  }

  if (invalid.length === 0) {
    console.log("No rows failed validateCheckInScheduleInput.");
  } else {
    console.log(
      `Invalid schedules (${invalid.length} row(s), showing first 30):`
    );

    for (const row of invalid.slice(0, 30)) {
      console.log(
        `  client_id=${row.client_id} tenant=${row.tenant_host}: ${row.errors.join("; ")}`
      );
    }

    if (invalid.length > 30) {
      console.log(`  … ${invalid.length - 30} more`);
    }
  }

  console.log("");

  if (tzInvalid.length === 0) {
    console.log("No rows with Intl-invalid timezone after coercion.");
  } else {
    console.log(
      `Rows with invalid IANA timezone (${tzInvalid.length}, first 20):`
    );

    for (const row of tzInvalid.slice(0, 20)) {
      console.log(
        `  client_id=${row.client_id} timezone=${JSON.stringify(row.tz)}`
      );
    }
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
