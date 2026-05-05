// Admin users management API
import { NextRequest, NextResponse } from "next/server";

import { JWT_SECRET_BYTES } from "@/lib/auth/jwt-secret";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// Helper to verify admin authentication and get role
async function verifyAdminAuth(request: NextRequest) {
  const supabase = createSupabaseClient();
  const sessionCookie = request.cookies.get("admin-session")?.value;

  if (!sessionCookie) {
    return { isAdmin: false, adminId: null, role: null };
  }

  try {
    const { jwtVerify } = await import("jose");

    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET_BYTES);
    const userId = (payload as any).trainer_id;

    if (!userId) {
      return { isAdmin: false, adminId: null, role: null };
    }

    const { data: adminData, error } = await supabase
      .from("admin_users")
      .select("id, status, role")
      .eq("id", userId)
      .eq("status", "active")
      .single();

    if (error || !adminData) {
      return { isAdmin: false, adminId: null, role: null };
    }

    return { isAdmin: true, adminId: adminData.id, role: adminData.role };
  } catch (err) {
    console.error("[AdminAuth] Error verifying admin:", err);

    return { isAdmin: false, adminId: null, role: null };
  }
}

// GET: List all admin users
export async function GET(request: NextRequest) {
  const { isAdmin, role, adminId } = await verifyAdminAuth(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Only super_admin can view admin users
  if (role !== "super_admin") {
    return NextResponse.json(
      { error: "Solo los super administradores pueden ver usuarios admin" },
      { status: 403 }
    );
  }

  const supabase = createSupabaseClient();

  try {
    const { data: adminUsers, error } = await supabase
      .from("admin_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[AdminUsers] Error fetching admin users:", error);

      return NextResponse.json(
        { error: "Error al obtener usuarios admin" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { adminUsers, currentAdminId: adminId },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AdminUsers] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST: Create new admin user
export async function POST(request: NextRequest) {
  const { isAdmin, role } = await verifyAdminAuth(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Only super_admin can create admin users
  if (role !== "super_admin") {
    return NextResponse.json(
      { error: "Solo los super administradores pueden crear usuarios admin" },
      { status: 403 }
    );
  }

  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { email, fullName, role: newUserRole } = body;

    // Validate required fields
    if (!email || !fullName || !newUserRole) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios" },
        { status: 400 }
      );
    }

    // Validate role
    if (!["super_admin", "admin"].includes(newUserRole)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Formato de correo electrónico no válido" },
        { status: 400 }
      );
    }

    // Check if email is already registered
    const { data: existingAdmin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existingAdmin) {
      return NextResponse.json(
        { error: "Este correo electrónico ya está registrado como admin" },
        { status: 400 }
      );
    }

    // Create Supabase auth user
    // Email will be auto-confirmed by database trigger
    const tempPassword = "TopCoachAdmin2026!";
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password: tempPassword,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (authError || !authUser.user) {
      console.error("[AdminUsers] Auth error:", authError);

      return NextResponse.json(
        { error: "Error al crear el usuario en el sistema de autenticación" },
        { status: 500 }
      );
    }

    console.log("[AdminUsers] Auth user created successfully:", {
      userId: authUser.user.id,
      email: authUser.user.email,
      session: authUser.session ? "Session exists" : "No session",
    });

    // Create a fresh Supabase client to ensure we're using anon context
    const insertClient = createSupabaseClient();

    // Create admin_users record
    const { error: adminError } = await insertClient
      .from("admin_users")
      .insert({
        id: authUser.user.id,
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        role: newUserRole,
        status: "active",
      });

    if (adminError) {
      console.error("[AdminUsers] Admin creation error:", adminError);
      console.error("[AdminUsers] Attempted to insert:", {
        id: authUser.user.id,
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        role: newUserRole,
        status: "active",
      });

      return NextResponse.json(
        { error: "Error al crear el usuario admin" },
        { status: 500 }
      );
    }

    console.log(
      `[AdminUsers] Successfully created admin user: ${email} with role: ${newUserRole}`
    );

    return NextResponse.json(
      {
        success: true,
        admin: {
          id: authUser.user.id,
          email: email.toLowerCase().trim(),
          fullName: fullName.trim(),
          role: newUserRole,
        },
        message: `Usuario admin creado exitosamente.\n\nEmail: ${email}\nContraseña temporal: TopCoachAdmin2026!\n\nEl usuario debe cambiar su contraseña en el primer inicio de sesión.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[AdminUsers] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
