// Deep debug script to check what's actually happening with trainer authentication

async function debugTrainerAuth() {
  console.log("🔍 Deep debugging trainer authentication...\n");

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
    // Get the specific trainer
    console.log("\n📋 Fetching trainer: coachjoseca@gmail.com");
    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("*")
      .eq("email", "coachjoseca@gmail.com")
      .single();

    if (trainerError || !trainer) {
      console.error("❌ Error fetching trainer:", trainerError?.message);
      return;
    }

    console.log("✅ Trainer found in trainers table:");
    console.log("   ID:", trainer.id);
    console.log("   Email:", trainer.email);
    console.log("   Full Name:", trainer.full_name);
    console.log(
      "   Password Set At:",
      trainer.password_set_at || "❌ NULL (needs to set)"
    );
    console.log("   Status:", trainer.status);
    console.log("   Created At:", trainer.created_at);

    // Now try to authenticate with the temporary password
    console.log(
      '\n🔐 Testing authentication with temporary password "TopCoach2026!"...'
    );

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: "coachjoseca@gmail.com",
        password: "TopCoach2026!",
      });

    if (authError) {
      console.error("\n❌ AUTHENTICATION FAILED!");
      console.error("Error Code:", authError.status);
      console.error("Error Message:", authError.message);
      console.error("Error Name:", authError.name);

      if (authError.message.includes("Email not confirmed")) {
        console.error("\n🚨 ROOT CAUSE: Email is NOT confirmed in auth.users!");
        console.error("The migration did NOT fix this user.");
        console.error("\nPossible reasons:");
        console.error("1. Migration ran before this trainer was created");
        console.error(
          "2. Trainer ID in trainers table doesn't match auth.users"
        );
        console.error("3. SQL didn't execute properly");
      } else if (authError.message.includes("Invalid login credentials")) {
        console.error("\n🚨 ROOT CAUSE: Password doesn't match!");
        console.error(
          'The temporary password "TopCoach2026!" is incorrect for this user.'
        );
        console.error("\nPossible reasons:");
        console.error("1. User was created with a different temp password");
        console.error("2. Password was already changed");
        console.error("3. Account needs password reset");
      } else {
        console.error("\n🚨 ROOT CAUSE: Unknown authentication error");
        console.error("Check Supabase Auth settings or logs");
      }

      return;
    }

    console.log("\n✅ AUTHENTICATION SUCCESSFUL!");
    console.log("User ID:", authData.user.id);
    console.log("Email:", authData.user.email);
    console.log(
      "Email Confirmed:",
      authData.user.email_confirmed_at ? "✅ Yes" : "❌ No"
    );
    console.log("Created At:", authData.user.created_at);

    console.log(
      "\n🎉 Great! Auth works. The issue might be in the frontend code."
    );

    // Sign out
    await supabase.auth.signOut();
  } catch (error) {
    console.error("\n❌ Debug failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

debugTrainerAuth();
