// Trainer password reset API - sends reset email
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "El correo electrónico es obligatorio" },
        { status: 400 }
      );
    }

    // Verify trainer exists (don't reveal if user exists for security)
    const { data: trainer } = await supabase
      .from("trainers")
      .select("id, email, status")
      .eq("email", email.toLowerCase().trim())
      .single();

    // Always return success to prevent email enumeration
    if (!trainer) {
      console.log(`[TrainerPasswordReset] No trainer found for ${email}`);

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Check if trainer is active
    if (trainer.status !== "active") {
      console.log(`[TrainerPasswordReset] Trainer ${email} is not active`);

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Send password reset email via Supabase
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const resetUrl = `${protocol}://${appDomain}/trainer/reset-password`;

    console.log(
      `[TrainerPasswordReset] Sending reset email to ${email}, redirect: ${resetUrl}`
    );

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      {
        redirectTo: resetUrl,
      }
    );

    if (error) {
      console.error("[TrainerPasswordReset] Supabase error:", error);
      // Still return success to prevent enumeration
    } else {
      console.log(`[TrainerPasswordReset] Reset email sent to ${email}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[TrainerPasswordReset] Unexpected error:", err);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
