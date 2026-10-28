// Admin endpoint: platform-wide ops metrics for the super-admin dashboard.
import { NextRequest, NextResponse } from "next/server";

import { verifyAdminRequest } from "@/lib/auth/admin-auth";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function GET(request: NextRequest) {
  // Everything is aggregated in one SQL function (admin_ops_metrics) — a
  // single round trip — and runs concurrently with the admin check. Nothing
  // is returned unless the caller is a super admin.
  const authP = verifyAdminRequest(request);
  // Wrap once: a Supabase builder re-sends the request on every .then().
  const dataP = Promise.resolve(
    createSupabaseClient().rpc("admin_ops_metrics")
  );

  // Don't leave a rejected promise unobserved if auth fails first.
  dataP.catch(() => undefined);

  const { isAdmin, role } = await authP;

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (role !== "super_admin") {
    return NextResponse.json(
      { error: "Solo los super admins pueden ver este panel" },
      { status: 403 }
    );
  }

  const { data, error } = await dataP;

  if (error) {
    console.error("[AdminOps] admin_ops_metrics failed:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 200 });
}
