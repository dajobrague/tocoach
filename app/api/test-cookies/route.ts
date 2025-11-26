// Simple test to verify cookies are readable
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  console.log("[TEST-COOKIES] Route handler called");

  // Get cookies from request
  const requestCookies = request.cookies.getAll();

  console.log("[TEST-COOKIES] Request cookies:", requestCookies);

  // Get cookies from cookies() function
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  console.log("[TEST-COOKIES] Cookies from cookies():", allCookies);

  // Specifically look for trainer-session
  const trainerSession = cookieStore.get("trainer-session");

  console.log("[TEST-COOKIES] trainer-session cookie:", trainerSession);

  return NextResponse.json({
    requestCookies: requestCookies.map((c) => ({
      name: c.name,
      hasValue: !!c.value,
    })),
    cookiesFunction: allCookies.map((c) => ({
      name: c.name,
      hasValue: !!c.value,
    })),
    trainerSessionExists: !!trainerSession,
  });
}
