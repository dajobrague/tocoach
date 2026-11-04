// Upload build.mjs output to the private library-media bucket.
//   node --env-file=.env.local scripts/library-media/upload.mjs <outDir/male> <male|female> [subdir]
// subdir "body" puts the muscle-body kit under <sex>/body/ (build-body.mjs output).
// Idempotent (upsert). Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

const [dir, sex, subdir] = process.argv.slice(2);
const prefix = subdir ? `${sex}/${subdir}` : sex;

if (!dir || !["male", "female"].includes(sex)) {
  console.error("usage: upload.mjs <dir> <male|female>");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  { auth: { persistSession: false } }
);
const types = { ".mp4": "video/mp4", ".webp": "image/webp" };
let n = 0;

for (const file of readdirSync(dir)) {
  const type = types[file.slice(file.lastIndexOf("."))];

  if (!type) continue;
  const { error } = await supabase.storage
    .from("library-media")
    .upload(`${prefix}/${file}`, readFileSync(join(dir, file)), {
      contentType: type,
      upsert: true,
      cacheControl: "31536000",
    });

  if (error) {
    console.error(file, error.message);
    process.exit(1);
  }
  n++;
}
console.log(`${prefix}: uploaded ${n} files`);
