// Admin trainers management API
import { NextRequest, NextResponse } from "next/server";

import { fetchAll } from "@/lib/admin/fetch-all";
import { verifyAdminRequest as verifyAdminAuth } from "@/lib/auth/admin-auth";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { healThemeJson } from "@/lib/theme/heal";
import { slugFormatError } from "@/lib/tenant/slug";
import { TEMP_PASSWORD_TRAINER } from "@/lib/constants/auth";

const DAY_MS = 24 * 60 * 60 * 1000;

// GET: List all trainers with tenant info and client activity.
// ponytail: no server-side paging — the table is ~50 rows and the UI
// sorts/filters in memory. Page here if trainers reach the thousands.
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  // Admin check and reads run concurrently (DB is a transatlantic round
  // trip); reads have no side effects and nothing returns unless it passes.
  const authP = verifyAdminAuth(request);
  const dataP = Promise.all([
    supabase
      .from("trainers")
      .select(
        "id, email, full_name, subscription_status, status, password_set_at, invited_at, last_login_at, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("tenants")
      .select(
        "trainer_id, host, slug, status, onboarding_completed, nutrition_v2_enabled"
      ),
    fetchAll<{ tenant: string | null; last_login_at: string | null }>(
      (from, to, withCount) =>
        supabase
          .from("clients")
          .select(
            "tenant, last_login_at",
            withCount ? { count: "exact" } : undefined
          )
          .order("id")
          .range(from, to)
    ),
  ]);

  dataP.catch(() => undefined);

  const { isAdmin } = await authP;

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const [trainersRes, tenantsRes, clients] = await dataP;

    if (trainersRes.error) throw trainersRes.error;
    if (tenantsRes.error) throw tenantsRes.error;

    const tenantByTrainer = new Map(
      (tenantsRes.data ?? []).map((t) => [t.trainer_id, t])
    );

    // clients.tenant holds the trainer's UUID (legacy column name).
    const now = Date.now();
    const stats = new Map<
      string,
      {
        total: number;
        active7: number;
        active30: number;
        lastSeen: string | null;
      }
    >();

    for (const c of clients) {
      if (!c.tenant) continue;
      const s = stats.get(c.tenant) ?? {
        total: 0,
        active7: 0,
        active30: 0,
        lastSeen: null,
      };
      const age = c.last_login_at
        ? now - new Date(c.last_login_at).getTime()
        : Infinity;

      s.total += 1;
      if (age <= 7 * DAY_MS) s.active7 += 1;
      if (age <= 30 * DAY_MS) s.active30 += 1;
      if (c.last_login_at && (!s.lastSeen || c.last_login_at > s.lastSeen)) {
        s.lastSeen = c.last_login_at;
      }
      stats.set(c.tenant, s);
    }

    const trainers = (trainersRes.data ?? []).map((t) => {
      const tenant = tenantByTrainer.get(t.id);
      const s = stats.get(t.id);

      return {
        ...t,
        tenant_host: tenant?.host ?? null,
        tenant_slug: tenant?.slug ?? null,
        tenant_status: tenant?.status ?? null,
        onboarding_completed: tenant?.onboarding_completed === true,
        nutrition_v2_enabled: tenant?.nutrition_v2_enabled === true,
        clientCount: s?.total ?? 0,
        activeClients7d: s?.active7 ?? 0,
        activeClients30d: s?.active30 ?? 0,
        lastClientActivityAt: s?.lastSeen ?? null,
      };
    });

    return NextResponse.json({ trainers }, { status: 200 });
  } catch (error) {
    console.error("[AdminTrainers] Error fetching trainers:", error);

    return NextResponse.json(
      { error: "Error al obtener entrenadores" },
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

    const fieldError = (field: "email" | "slug", error: string) =>
      NextResponse.json({ error, field }, { status: 400 });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return fieldError("email", "Formato de correo electrónico no válido");
    }

    // The slug becomes the portal path (/<slug>) — reject non-ASCII and
    // reserved routes before anything is written.
    const slug = String(tenantHost).toLowerCase().trim();
    const slugError = slugFormatError(slug);

    if (slugError) return fieldError("slug", slugError);

    // A slug is taken if any tenant uses it as slug or host, or any trainer
    // still has it as tenant_host (renames can leave these out of sync).
    const [{ data: tenantTaken }, { data: hostTaken }, { data: emailTaken }] =
      await Promise.all([
        supabase
          .from("tenants")
          .select("slug")
          .or(`slug.eq.${slug},host.eq.${slug}`)
          .limit(1),
        supabase.from("trainers").select("id").eq("tenant_host", slug).limit(1),
        supabase
          .from("trainers")
          .select("id")
          .eq("email", email.toLowerCase().trim())
          .limit(1),
      ]);

    if (tenantTaken?.length || hostTaken?.length) {
      return fieldError("slug", "Esta dirección ya está en uso");
    }

    if (emailTaken?.length) {
      return fieldError("email", "Este correo electrónico ya está registrado");
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
        // healThemeJson: la semilla cruda (fonts string, shadow {sm,md},
        // sin accent/text/border/fill) NO pasa validateTheme — el
        // generador de CSS la descartaba y el tenant quedaba clavado en
        // el tema default aunque el trainer guardara sus colores después.
        theme_json: healThemeJson({
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
        }),
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
        tempPassword: TEMP_PASSWORD_TRAINER,
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
