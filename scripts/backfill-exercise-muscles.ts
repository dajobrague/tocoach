/**
 * One-off: turn the legacy free-text exercises.muscle_groups into
 * primary_muscles / secondary_muscles (migration 20261027120000).
 *
 * Offline on purpose: export the rows from the SQL editor, review the report,
 * apply the generated SQL by hand. Only rows whose structured columns are
 * still empty are updated, so re-running never overwrites a trainer's pick.
 *
 *   -- SQL editor, save the result as JSON:
 *   select id, name, muscle_groups from exercises
 *   where array_length(muscle_groups, 1) > 0 and primary_muscles = '{}';
 *
 * Run: npx tsx scripts/backfill-exercise-muscles.ts rows.json out.sql
 */

import { readFileSync, writeFileSync } from "node:fs";

import { legacyToMuscles } from "../lib/training/muscles";

type Row = { id: string; name: string; muscle_groups: string[] | null };

const [input, output] = process.argv.slice(2);

if (!input || !output) {
  console.error(
    "Usage: npx tsx scripts/backfill-exercise-muscles.ts rows.json out.sql"
  );
  process.exit(1);
}

const rows: Row[] = JSON.parse(readFileSync(input, "utf8"));
const sqlArray = (ids: string[]) =>
  ids.length
    ? `ARRAY[${ids.map((id) => `'${id}'`).join(", ")}]`
    : "'{}'::TEXT[]";

const updates: string[] = [];
const unknown = new Map<string, number>();
let partial = 0;
let empty = 0;

for (const row of rows) {
  const mapped = legacyToMuscles(row.muscle_groups, row.name);

  for (const word of mapped.unknown)
    unknown.set(word, (unknown.get(word) ?? 0) + 1);

  if (mapped.primary.length === 0) {
    empty++;
    continue;
  }
  if (mapped.unknown.length > 0) partial++;

  updates.push(
    `UPDATE exercises SET primary_muscles = ${sqlArray(mapped.primary)}, ` +
      `secondary_muscles = ${sqlArray(mapped.secondary)} ` +
      `WHERE id = '${row.id}' AND primary_muscles = '{}';`
  );
}

writeFileSync(output, ["BEGIN;", ...updates, "COMMIT;", ""].join("\n"));

console.log(`rows: ${rows.length}`);
console.log(`updated: ${updates.length} (${partial} with some words skipped)`);
console.log(`left empty (nothing recognised): ${empty}`);
console.log("unrecognised words:");
for (const [word, count] of [...unknown].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}\t${word}`);
}
