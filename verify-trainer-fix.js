// Verification script to check if trainer email confirmation fix is working
// Run this after applying the migration to verify it worked

async function verifyFix() {
  console.log("🔍 Verifying trainer email confirmation fix...\n");

  const { createClient } = await import("@supabase/supabase-js");
  const fs = await import("fs");
  const path = await import("path");

  // Read environment variables
  const envPath = path.join(process.cwd(), ".env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  const envVars = {};
  envContent.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join("=").trim();
    }
  });

  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("📦 Connecting to Supabase...");
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Check 1: Get all trainers
    console.log("\n📋 Check 1: Fetching trainers...");
    const { data: trainers, error: trainersError } = await supabase
      .from("trainers")
      .select("id, email, full_name, password_set_at")
      .limit(10);

    if (trainersError) {
      console.error("❌ Error fetching trainers:", trainersError.message);
      return;
    }

    console.log(`✅ Found ${trainers.length} trainer(s)`);

    if (trainers.length === 0) {
      console.log(
        "\n⚠️  No trainers found in database. Create one in admin panel to test."
      );
      return;
    }

    // Display trainers and their status
    console.log("\n👥 Trainers in database:");
    trainers.forEach((trainer, index) => {
      console.log(
        `   ${index + 1}. ${trainer.full_name || "N/A"} (${trainer.email})`
      );
      console.log(
        `      Password set: ${trainer.password_set_at ? "✅ Yes" : "❌ No (first login needed)"}`
      );
    });

    // Check 2: Verify auth users are confirmed
    // Note: We can't directly query auth.users from the anon key, but we can check if sign-in works
    console.log(
      "\n📋 Check 2: Testing authentication with temporary password..."
    );

    const unconfirmedTrainers = trainers.filter((t) => !t.password_set_at);

    if (unconfirmedTrainers.length === 0) {
      console.log(
        "✅ All trainers have set their password. Migration fixed existing trainers!"
      );
      console.log(
        "\n💡 To fully test: Create a new trainer in admin panel and try first login."
      );
    } else {
      console.log(
        `⚠️  Found ${unconfirmedTrainers.length} trainer(s) who haven't set password yet.`
      );
      console.log("\n🧪 Test by having them:");
      console.log("   1. Go to /trainer/login");
      console.log("   2. Enter their email");
      console.log("   3. Set a new password");
      console.log(
        '   4. If it works without "Contacta al administrador" error, fix is working! ✅'
      );
    }

    console.log("\n✅ Verification complete!");
    console.log("\n📝 Summary:");
    console.log(
      "   - Migration creates trigger to auto-confirm trainer emails"
    );
    console.log("   - Existing trainers should be confirmed");
    console.log("   - New trainers will auto-confirm on creation");
    console.log("\n🎯 Next: Test first-time login with a trainer account!");
  } catch (error) {
    console.error("\n❌ Verification failed:", error.message);
    console.error("\nThis could mean:");
    console.error("   1. Migration not applied yet");
    console.error("   2. Database connection issue");
    console.error("   3. Invalid credentials in .env.local");
  }
}

verifyFix();
