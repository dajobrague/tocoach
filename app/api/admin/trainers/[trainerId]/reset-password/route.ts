import { NextRequest, NextResponse } from "next/server";

import { JWT_SECRET_BYTES } from "@/lib/auth/jwt-secret";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// Verify admin authentication
async function verifyAdminAuth(request: NextRequest) {
  const supabase = createSupabaseClient();
  const sessionCookie = request.cookies.get("admin-session")?.value;

  if (!sessionCookie) {
    console.log("[AdminAuth] No admin session cookie found");

    return { isAdmin: false, adminId: null };
  }

  try {
    const { jwtVerify } = await import("jose");

    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET_BYTES);
    const userId = (payload as any).trainer_id;

    if (!userId) {
      return { isAdmin: false, adminId: null };
    }

    const { data: adminData, error } = await supabase
      .from("admin_users")
      .select("id, status")
      .eq("id", userId)
      .eq("status", "active")
      .single();

    if (error || !adminData) {
      console.log("[AdminAuth] User is not an admin or inactive", {
        userId,
        error,
      });

      return { isAdmin: false, adminId: null };
    }

    return { isAdmin: true, adminId: adminData.id };
  } catch (err) {
    console.error("[AdminAuth] Error verifying admin:", err);

    return { isAdmin: false, adminId: null };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> }
) {
  const { trainerId } = await params;
  const { isAdmin } = await verifyAdminAuth(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseClient();

  try {
    // Verify trainer exists
    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("id, email, full_name")
      .eq("id", trainerId)
      .single();

    if (trainerError || !trainer) {
      return NextResponse.json(
        { error: "Entrenador no encontrado" },
        { status: 404 }
      );
    }

    // For existing trainers: mark password_set_at as NULL
    // They'll need to contact admin or use "forgot password" to reset
    // We can't reset Supabase Auth password with anon key
    const { error: updateError } = await supabase
      .from("trainers")
      .update({
        password_set_at: null,
      })
      .eq("id", trainerId);

    if (updateError) {
      console.error("[ResetPassword] Update error:", updateError);

      return NextResponse.json(
        { error: "Error al marcar entrenador para reset" },
        { status: 500 }
      );
    }

    console.log(
      `[ResetPassword] Marked trainer for password reset: ${trainer.email} (${trainerId})`
    );

    return NextResponse.json(
      {
        success: true,
        message: "Entrenador marcado para reset de contraseña",
        note: "El entrenador debe usar 'Olvidé mi contraseña' o contactarte para resetear su contraseña",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ResetPassword] Error:", error);

    return NextResponse.json(
      { error: "Error al resetear contraseña" },
      { status: 500 }
    );
  }
}
