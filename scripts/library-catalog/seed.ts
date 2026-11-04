/**
 * Seed/refresh library_exercises from the RepDB bundle (idempotent upsert).
 *
 *   npx tsx --env-file=.env.local scripts/library-catalog/seed.ts <bundle>/exercises.json
 *
 * Re-run after changing the muscle mapping in lib/library/catalog.ts.
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { toCatalogRow } from "../../lib/library/catalog";

const file = process.argv[2];

if (!file) {
  console.error("usage: seed.ts <exercises.json>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(file, "utf8"));
const rows = data.exercises.map((e: never) => toCatalogRow(e, data.equipment));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
  { auth: { persistSession: false } }
);

async function main() {
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase
      .from("library_exercises")
      .upsert(rows.slice(i, i + 100), { onConflict: "slug" });

    if (error) {
      console.error("batch", i, error.message);
      process.exit(1);
    }
  }

  const empty = rows.filter(
    (r: { primary_muscles: string[]; category: string }) =>
      r.primary_muscles.length === 0 && r.category !== "cardio"
  );

  console.log(
    `seeded ${rows.length} exercises; ${empty.length} without primary muscle`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
