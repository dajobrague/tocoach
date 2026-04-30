import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

// Verify admin authentication (mirror of the trainer impersonate route)
async function verifyAdminAuth(request: NextRequest) {
  const sessionCookie = request.cookies.get("admin-session");

  if (!sessionCookie) {
    console.log("[AdminAuth] No admin session cookie found");

    return null;
  }

  try {
    const supabase = createSupabaseClient();
    const { jwtVerify } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(sessionCookie.value, secret);

    // JWT uses 'trainer_id' field for user ID (even for admins)
    const userId = payload.trainer_id as string;

    if (!userId) {
      console.log("[AdminAuth] No trainer_id in JWT payload");

      return null;
    }

    const { data: adminUser, error } = await supabase
      .from("admin_users")
      .select("id, email, role, status")
      .eq("id", userId)
      .single();

    if (error || !adminUser) {
      console.log("[AdminAuth] User not found in admin_users", {
        userId,
        error,
      });

      return null;
    }

    if (adminUser.status !== "active") {
      console.log("[AdminAuth] User is inactive");

      return null;
    }

    console.log(
      "[AdminAuth] Admin verified successfully for client impersonate",
      { adminId: adminUser.id }
    );

    return adminUser;
  } catch (error) {
    console.error("[AdminAuth] Error verifying admin:", error);

    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trainerId: string; clientId: string }> }
) {
  const { trainerId, clientId } = await params;

  const admin = await verifyAdminAuth(request);

  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseClient();

    // Resolve the trainer's tenant — needed for the slug in the redirect URL.
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("host, slug")
      .eq("trainer_id", trainerId)
      .eq("status", "active")
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado para este entrenador" },
        { status: 404 }
      );
    }

    // The URL nests clientId under trainerId, but we still enforce the
    // ownership constraint server-side: clients.tenant holds the trainer's
    // UUID. Without this, a typo'd URL could mint a session for a client
    // that doesn't belong to the trainer the admin is viewing.
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, email, name, last_name, status, tenant")
      .eq("id", clientId)
      .eq("tenant", trainerId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        {
          error: "Cliente no encontrado o no pertenece a este entrenador",
        },
        { status: 404 }
      );
    }

    // Note: we deliberately skip status / password gating here. Impersonation
    // is the support tool for exactly the broken accounts (no password set,
    // status="Inactivo", etc.).

    const fullName = `${client.name ?? ""} ${client.last_name ?? ""}`.trim();

    // Generate impersonation token (5 minutes expiry) — same TTL as trainer
    // impersonation. Distinct `type` so the consume endpoint can refuse
    // trainer impersonation tokens and vice versa.
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const impersonationToken = await new SignJWT({
      clientId: String(client.id),
      clientEmail: client.email,
      clientFullName: fullName,
      tenantSlug: tenant.slug,
      tenantHost: tenant.host,
      adminId: admin.id,
      adminEmail: admin.email,
      type: "client_impersonation",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(secret);

    console.log(
      `[ClientImpersonation] Admin ${admin.email} (${admin.id}) is impersonating client ${client.email} (id=${client.id}) under tenant ${tenant.slug}`
    );

    const impersonationUrl = `${request.nextUrl.origin}/${tenant.slug}/auth/client-impersonate?token=${impersonationToken}`;

    return NextResponse.json(
      {
        success: true,
        url: impersonationUrl,
        client: {
          id: client.id,
          email: client.email,
          fullName,
          status: client.status,
          tenantSlug: tenant.slug,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ClientImpersonation] Error:", error);

    return NextResponse.json(
      { error: "Error al generar enlace de impersonación de cliente" },
      { status: 500 }
    );
  }
}
