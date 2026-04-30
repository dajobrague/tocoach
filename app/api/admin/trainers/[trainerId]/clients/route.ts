// Admin endpoint: list clients belonging to a specific trainer.
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

async function verifyAdminAuth(request: NextRequest) {
  const sessionCookie = request.cookies.get("admin-session")?.value;

  if (!sessionCookie) {
    return { isAdmin: false, adminId: null as string | null };
  }

  try {
    const { jwtVerify } = await import("jose");
    const JWT_SECRET = new TextEncoder().encode(
      process.env.JWT_SECRET || "fallback-secret-change-in-production"
    );
    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET);
    const userId = (payload as any).trainer_id as string | undefined;

    if (!userId) {
      return { isAdmin: false, adminId: null };
    }

    const supabase = createSupabaseClient();
    const { data: adminData, error } = await supabase
      .from("admin_users")
      .select("id, status")
      .eq("id", userId)
      .eq("status", "active")
      .single();

    if (error || !adminData) {
      return { isAdmin: false, adminId: null };
    }

    return { isAdmin: true, adminId: adminData.id as string };
  } catch {
    return { isAdmin: false, adminId: null };
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

  const { trainerId } = await params;
  const supabase = createSupabaseClient();

  try {
    // clients.tenant holds the trainer's UUID (legacy column name).
    const { data: clients, error } = await supabase
      .from("clients")
      .select(
        "id, email, name, last_name, status, last_login_at, sign_up_date, password"
      )
      .eq("tenant", trainerId)
      .order("sign_up_date", { ascending: false });

    if (error) {
      console.error("[AdminTrainerClients] Query error:", error);

      return NextResponse.json(
        { error: "Error al obtener clientes" },
        { status: 500 }
      );
    }

    // Don't echo the password field — only whether one is set, so the admin
    // UI can show "needs password setup".
    const sanitized = (clients ?? []).map((c: any) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      last_name: c.last_name,
      status: c.status,
      last_login_at: c.last_login_at,
      sign_up_date: c.sign_up_date,
      hasPassword: !!c.password && String(c.password).trim() !== "",
    }));

    return NextResponse.json({ clients: sanitized }, { status: 200 });
  } catch (error) {
    console.error("[AdminTrainerClients] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
