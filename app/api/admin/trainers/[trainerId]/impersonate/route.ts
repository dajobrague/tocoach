import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { getPublicOrigin } from "@/lib/utils/public-origin";

// Verify admin authentication
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

    // Check if user is admin
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

    console.log("[AdminAuth] Admin verified successfully for impersonate", {
      adminId: adminUser.id,
    });

    return adminUser;
  } catch (error) {
    console.error("[AdminAuth] Error verifying admin:", error);

    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> }
) {
  const { trainerId } = await params;

  // Verify admin authentication
  const admin = await verifyAdminAuth(request);

  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseClient();

    // Verify trainer exists
    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("id, email, full_name, status")
      .eq("id", trainerId)
      .single();

    if (trainerError || !trainer) {
      return NextResponse.json(
        { error: "Entrenador no encontrado" },
        { status: 404 }
      );
    }

    // Get tenant/subdomain for this trainer
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

    // Generate impersonation token (5 minutes expiry)
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const impersonationToken = await new SignJWT({
      trainerId: trainer.id,
      trainerEmail: trainer.email,
      tenantHost: tenant.host,
      tenantSlug: tenant.slug,
      adminId: admin.id,
      adminEmail: admin.email,
      type: "impersonation",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m") // 5 minutes
      .sign(secret);

    // Log impersonation event
    console.log(
      `[Impersonation] Admin ${admin.email} (${admin.id}) is impersonating trainer ${trainer.email} (${trainer.id})`
    );

    // All tenants live under the same app origin and are routed by slug
    // (see middleware.ts). `tenant.host` is a legacy column from the
    // pre-slug architecture and is NOT a routable domain — using it here
    // produced broken impersonation URLs.
    const impersonationUrl = `${getPublicOrigin(request)}/${tenant.slug}/auth/impersonate?token=${impersonationToken}`;

    return NextResponse.json(
      {
        success: true,
        url: impersonationUrl,
        trainer: {
          name: trainer.full_name,
          email: trainer.email,
          subdomain: tenant.host,
          slug: tenant.slug,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Impersonation] Error:", error);

    return NextResponse.json(
      { error: "Error al generar enlace de impersonación" },
      { status: 500 }
    );
  }
}
