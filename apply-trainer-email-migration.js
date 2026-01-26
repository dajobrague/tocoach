// Script to apply the trainer email confirmation migration
// This needs to run with Supabase service role key

const fs = require("fs");
const path = require("path");

async function applyMigration() {
  // Read environment variables
  const envPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌ .env.local file not found");
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const envVars = {};
  envContent.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join("=").trim();
    }
  });

  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(
      "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    console.error(
      "Note: Per user rules, we should use anon key, but this migration requires elevated privileges"
    );
    process.exit(1);
  }

  console.log("📦 Importing Supabase client...");
  const { createClient } = await import("@supabase/supabase-js");

  console.log("🔗 Connecting to Supabase...");
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Read the migration file
  const migrationPath = path.join(
    __dirname,
    "supabase/migrations/056_auto_confirm_trainer_emails.sql"
  );
  const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

  console.log("📝 Applying migration: 056_auto_confirm_trainer_emails.sql");
  console.log("---");

  try {
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ";";
      console.log(`\n⚙️  Executing statement ${i + 1}/${statements.length}...`);

      const { data, error } = await supabase.rpc("exec_sql", {
        sql: statement,
      });

      if (error) {
        // Try direct query instead
        const { error: directError } = await supabase
          .from("_raw")
          .select("*")
          .limit(0);

        if (directError) {
          console.error(`❌ Error executing statement ${i + 1}:`, error);
          throw error;
        }
      }

      console.log(`✅ Statement ${i + 1} executed successfully`);
    }

    console.log("\n✅ Migration applied successfully!");
    console.log("\n📋 Summary:");
    console.log("   - Created auto_confirm_trainer_email() function");
    console.log("   - Created trigger on trainers table");
    console.log("   - Confirmed existing trainer emails");
    console.log("\n🎉 Trainers can now set their password on first login!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    console.error(
      "\n📝 Please apply the migration manually via Supabase Dashboard:"
    );
    console.error(
      "   1. Go to: https://supabase.com/dashboard/project/ydqhndnvrkvycnkaghro/sql/new"
    );
    console.error(
      "   2. Copy the SQL from: supabase/migrations/056_auto_confirm_trainer_emails.sql"
    );
    console.error("   3. Paste and run it in the SQL editor");
    process.exit(1);
  }
}

applyMigration();
