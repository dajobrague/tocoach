import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    console.log("[Clients Test] Starting test...");
    console.log(
      "[Clients Test] Supabase URL:",
      process.env.NEXT_PUBLIC_SUPABASE_URL
    );

    // Test 1: Check if we can connect to Supabase
    const { data: tables, error: tablesError } = await supabase
      .from("clients")
      .select("*")
      .limit(1);

    if (tablesError) {
      console.error(
        "[Clients Test] Error connecting to Supabase:",
        tablesError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Error connecting to database",
          details: tablesError.message,
          code: tablesError.code,
        },
        { status: 500 }
      );
    }

    // Test 2: Get all clients
    const { data: allClients, error: clientsError } = await supabase
      .from("clients")
      .select("*");

    if (clientsError) {
      console.error("[Clients Test] Error fetching clients:", clientsError);

      return NextResponse.json(
        {
          success: false,
          error: "Error fetching clients",
          details: clientsError.message,
          code: clientsError.code,
        },
        { status: 500 }
      );
    }

    console.log("[Clients Test] Found clients:", allClients?.length || 0);
    console.log(
      "[Clients Test] Clients data:",
      JSON.stringify(allClients, null, 2)
    );

    return NextResponse.json({
      success: true,
      message: "Connection successful",
      totalClients: allClients?.length || 0,
      clients: allClients,
      rawData: allClients,
    });
  } catch (error) {
    console.error("[Clients Test] Unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unexpected error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
