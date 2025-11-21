import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const { email, tenantSlug } = await request.json();

    if (!email || !tenantSlug) {
      return NextResponse.json(
        { error: "Email and tenant slug are required" },
        { status: 400 }
      );
    }

    // Verify client exists for this tenant (don't reveal if user exists)
    const { data: client } = await supabase
      .from("client_profiles")
      .select("id, email")
      .eq("email", email.toLowerCase().trim())
      .eq("tenant_host", tenantSlug) // Database field is 'tenant_host' but contains slug values
      .single();

    // Always return success to prevent email enumeration
    if (!client) {
      console.log(
        `[Password Reset] No client found for ${email} on ${tenantSlug}`
      );

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Send password reset email via Supabase
    // Get the app domain and construct reset URL with slug-based path
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const resetUrl = `${protocol}://${appDomain}/${tenantSlug}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetUrl,
    });

    if (error) {
      console.error("[Password Reset] Supabase error:", error);
      // Still return success to prevent enumeration
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Password Reset] Unexpected error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
