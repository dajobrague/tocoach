import { NextResponse } from "next/server";

import { clearClientSession } from "@/lib/auth/client-session";

export async function POST() {
  try {
    await clearClientSession();

    return NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Client Logout] Error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
