import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, stack, pathname, userAgent, tenantSlug, clientId } = body;

    console.error(
      "[CLIENT ERROR]",
      JSON.stringify({
        message,
        stack,
        pathname,
        tenantSlug,
        clientId,
        userAgent,
        timestamp: new Date().toISOString(),
        ip: request.headers.get("x-forwarded-for") || "unknown",
      })
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
