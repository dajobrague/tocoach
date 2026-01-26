// Admin trainers management API
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { TEMP_PASSWORD_TRAINER } from "@/lib/constants/auth";

// Helper to verify admin authentication
async function verifyAdminAuth(request: NextRequest) {
  const supabase = createSupabaseClient();

  // Get admin session from cookie
  const sessionCookie = request.cookies.get("admin-session")?.value;

  if (!sessionCookie) {
    console.log("[AdminAuth] No session cookie found");

    return { isAdmin: false, adminId: null };
  }

  try {
    // Verify JWT token
    const { jwtVerify } = await import("jose");
    const JWT_SECRET = new TextEncoder().encode(
      process.env.JWT_SECRET || "fallback-secret-change-in-production"
    );

    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET);
    const userId = (payload as any).trainer_id;

    if (!userId) {
      return { isAdmin: false, adminId: null };
    }

    // Check if user is an active admin
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

    console.log("[AdminAuth] Admin verified successfully", {
      adminId: adminData.id,
    });

    return { isAdmin: true, adminId: adminData.id };
  } catch (err) {
    console.error("[AdminAuth] Error verifying admin:", err);

    return { isAdmin: false, adminId: null };
  }
}

// GET: List all trainers
export async function GET(request: NextRequest) {
  const { isAdmin, adminId } = await verifyAdminAuth(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseClient();
  const { searchParams } = new URL(request.url);

  // Get query parameters
  const status = searchParams.get("status"); // active, paused, cancelled, all
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    // First, get all trainers
    let trainersQuery = supabase
      .from("trainers")
      .select(
        `
        id,
        email,
        full_name,
        subscription_status,
        status,
        password_set_at,
        invited_at,
        last_login_at,
        created_at
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Apply filters
    if (status && status !== "all") {
      trainersQuery = trainersQuery.eq("subscription_status", status);
    }

    if (search) {
      trainersQuery = trainersQuery.or(
        `email.ilike.%${search}%,full_name.ilike.%${search}%`
      );
    }

    // Apply pagination
    trainersQuery = trainersQuery.range(offset, offset + limit - 1);

    const { data: trainersRaw, error, count } = await trainersQuery;

    if (error) {
      console.error("[AdminTrainers] Error fetching trainers:", error);

      return NextResponse.json(
        { error: "Error al obtener entrenadores" },
        { status: 500 }
      );
    }

    // Get trainer IDs to fetch their tenants
    const trainerIds = trainersRaw?.map((t) => t.id) || [];

    // Fetch tenants for these trainers
    const { data: tenantsData } = await supabase
      .from("tenants")
      .select("trainer_id, host, slug")
      .in("trainer_id", trainerIds);

    // Create a map of trainer_id to tenant info
    const tenantMap = (tenantsData || []).reduce(
      (acc, tenant) => {
        acc[tenant.trainer_id] = {
          host: tenant.host,
          slug: tenant.slug,
        };

        return acc;
      },
      {} as Record<string, { host: string; slug: string }>
    );

    // Transform data and add tenant info
    const trainers =
      trainersRaw?.map((trainer: any) => {
        const tenantInfo = tenantMap[trainer.id];

        return {
          id: trainer.id,
          email: trainer.email,
          full_name: trainer.full_name,
          subscription_status: trainer.subscription_status,
          status: trainer.status,
          password_set_at: trainer.password_set_at,
          invited_at: trainer.invited_at,
          last_login_at: trainer.last_login_at,
          created_at: trainer.created_at,
          tenant_host: tenantInfo?.host || "N/A",
          tenant_slug: tenantInfo?.slug || "N/A",
        };
      }) || [];

    // Get client counts for each trainer (reuse trainerIds from above)
    const { data: clientCounts } = await supabase
      .from("clients")
      .select("trainer_id")
      .in("trainer_id", trainerIds);

    // Count clients per trainer
    const clientCountMap = (clientCounts || []).reduce(
      (acc, client) => {
        acc[client.trainer_id] = (acc[client.trainer_id] || 0) + 1;

        return acc;
      },
      {} as Record<string, number>
    );

    // Add client counts to trainer data
    const trainersWithCounts = trainers?.map((trainer) => ({
      ...trainer,
      clientCount: clientCountMap[trainer.id] || 0,
    }));

    return NextResponse.json(
      {
        trainers: trainersWithCounts,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AdminTrainers] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST: Create new trainer
export async function POST(request: NextRequest) {
  const { isAdmin, adminId } = await verifyAdminAuth(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { email, fullName, tenantHost } = body;

    // Validate required fields
    if (!email || !fullName || !tenantHost) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Formato de correo electrónico no válido" },
        { status: 400 }
      );
    }

    // Check if tenant_host is already taken
    const { data: existingTenant } = await supabase
      .from("trainers")
      .select("id")
      .eq("tenant_host", tenantHost.toLowerCase().trim())
      .single();

    if (existingTenant) {
      return NextResponse.json(
        { error: "Este subdominio ya está en uso" },
        { status: 400 }
      );
    }

    // Check if email is already registered
    const { data: existingTrainer } = await supabase
      .from("trainers")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existingTrainer) {
      return NextResponse.json(
        { error: "Este correo electrónico ya está registrado" },
        { status: 400 }
      );
    }

    // Create Supabase user with a temporary password
    // Admin will share this temp password with the trainer
    // On first login, trainer will be redirected to setup their own password
    const tempPassword = TEMP_PASSWORD_TRAINER;

    console.log(
      `[AdminCreateTrainer] Creating auth user with temp password for: ${email}`
    );

    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password: tempPassword,
      options: {
        data: {
          full_name: fullName.trim(),
        },
        // Note: emailRedirectTo is omitted to prevent confirmation emails
        // Email will be auto-confirmed by database trigger (migration 056)
      },
    });

    if (authError || !authUser.user) {
      console.error("[AdminCreateTrainer] Auth error:", authError);
      console.error("[AdminCreateTrainer] Full error details:", {
        message: authError?.message,
        status: authError?.status,
        name: authError?.name,
      });

      return NextResponse.json(
        { error: "Error al crear el usuario en el sistema de autenticación" },
        { status: 500 }
      );
    }

    console.log(
      `[AdminCreateTrainer] Auth user created: ${authUser.user.id}, email: ${authUser.user.email}`
    );

    // Create trainer record (password_set_at is NULL - they need to set it)
    // Use fresh client to ensure we're using anon role (signup created an auth session)
    const insertClient = createSupabaseClient();
    const { error: trainerError } = await insertClient.from("trainers").insert({
      id: authUser.user.id,
      tenant_host: tenantHost.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      full_name: fullName.trim(),
      subscription_status: "active",
      invited_by: adminId,
      invited_at: new Date().toISOString(),
      password_set_at: null, // NULL means password not set yet
    });

    if (trainerError) {
      console.error(
        "[AdminCreateTrainer] Trainer creation error:",
        trainerError
      );

      return NextResponse.json(
        { error: "Error al crear el perfil de entrenador" },
        { status: 500 }
      );
    }

    // Create tenant record (use same fresh client)
    const { error: tenantError } = await insertClient.from("tenants").upsert(
      {
        slug: tenantHost.toLowerCase().trim(),
        host: tenantHost.toLowerCase().trim(),
        theme_slug: "default",
        status: "active",
        trainer_id: authUser.user.id,
        theme_json: {
          meta: {
            name: fullName.trim(),
            description: `${fullName.trim()}'s Coaching Platform`,
          },
          colors: {
            brand: "#0070f3",
            surface: {
              "1": "#ffffff",
              "2": "#f8fafc",
            },
          },
          fonts: {
            heading: "Poppins",
            body: "Poppins",
          },
          shadow: {
            sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            md: "0 2px 4px -1px rgb(0 0 0 / 0.1)",
          },
          radius: {
            sm: 6,
            md: 8,
            lg: 12,
            xl: 16,
          },
        },
      },
      {
        onConflict: "host",
      }
    );

    if (tenantError) {
      console.error("[AdminCreateTrainer] Tenant creation error:", tenantError);
      // Don't fail - tenant can be created later
    }

    console.log(
      `[AdminCreateTrainer] Successfully created trainer: ${email} by admin: ${adminId}`
    );

    return NextResponse.json(
      {
        success: true,
        trainer: {
          id: authUser.user.id,
          email: email.toLowerCase().trim(),
          fullName: fullName.trim(),
          tenantHost: tenantHost.toLowerCase().trim(),
        },
        message: `Entrenador creado exitosamente. Comparte estas credenciales con ${fullName}:\n\nEmail: ${email}\nContraseña temporal: ${TEMP_PASSWORD_TRAINER}\nURL: ${process.env.NEXT_PUBLIC_APP_DOMAIN || "tu-dominio.com"}/trainer/login\n\nAl iniciar sesión por primera vez, deberán configurar su propia contraseña.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[AdminCreateTrainer] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
