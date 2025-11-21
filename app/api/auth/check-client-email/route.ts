// Check if client email exists and whether password is set
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const { email, tenantHost } = await request.json();

    if (!email || !tenantHost) {
      return NextResponse.json(
        { error: "Email and tenant slug are required" },
        { status: 400 }
      );
    }

    // Look up client by email (simple query since no FK relationship exists)
    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, email, name, last_name, password, status, tenant")
      .eq("email", email.toLowerCase().trim());

    if (error || !clients || clients.length === 0) {
      return NextResponse.json(
        {
          exists: false,
          message: "No user found with that email and password setup",
        },
        { status: 404 }
      );
    }

    // For now, just use the first matching client
    // TODO: Add proper tenant validation once FK relationships are set up
    const client = clients[0];

    if (!client) {
      return NextResponse.json(
        {
          exists: false,
          message: "No user found with that email",
        },
        { status: 404 }
      );
    }

    // Check if client is active
    if (
      client.status !== "Activo" &&
      client.status !== "Onboarding Completado"
    ) {
      return NextResponse.json(
        {
          exists: false,
          message: "Your account is inactive. Please contact your trainer.",
        },
        { status: 403 }
      );
    }

    // Return whether password is set or not
    const hasPassword = !!client.password && client.password.trim() !== "";

    return NextResponse.json({
      exists: true,
      hasPassword: hasPassword,
      clientId: client.id,
      fullName: `${client.name} ${client.last_name || ""}`.trim(),
    });
  } catch (error) {
    console.error("[Check Client Email] Unexpected error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
