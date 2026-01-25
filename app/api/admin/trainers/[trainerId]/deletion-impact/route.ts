// Get trainer deletion impact - shows what will be deleted
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

// Helper to verify admin authentication
async function verifyAdminAuth(request: NextRequest) {
  const supabase = createSupabaseClient();
  const sessionCookie = request.cookies.get("admin-session")?.value;

  if (!sessionCookie) {
    return { isAdmin: false };
  }

  try {
    const { jwtVerify } = await import("jose");
    const JWT_SECRET = new TextEncoder().encode(
      process.env.JWT_SECRET || "fallback-secret-change-in-production"
    );

    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET);
    const userId = (payload as any).trainer_id;

    if (!userId) {
      return { isAdmin: false };
    }

    const { data: adminData, error } = await supabase
      .from("admin_users")
      .select("id, status")
      .eq("id", userId)
      .eq("status", "active")
      .single();

    if (error || !adminData) {
      return { isAdmin: false };
    }

    return { isAdmin: true };
  } catch (err) {
    return { isAdmin: false };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> }
) {
  const { isAdmin } = await verifyAdminAuth(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseClient();
  const { trainerId } = await params;

  try {
    // Call the database function to get deletion impact
    const { data, error } = await supabase.rpc("get_trainer_deletion_impact", {
      trainer_uuid: trainerId,
    });

    if (error) {
      console.error("[TrainerDeletionImpact] Error:", error);

      return NextResponse.json(
        { error: "Error al obtener información de eliminación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ impact: data }, { status: 200 });
  } catch (error) {
    console.error("[TrainerDeletionImpact] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
