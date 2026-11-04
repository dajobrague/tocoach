import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { getTrainerSession } from "@/lib/auth/session";
import { figureSex, parseMediaQuery, signBodyMedia } from "@/lib/library/media";

// GET /api/library/body[?sex=male|female]  (sex: trainers only)
// Short-lived signed URLs for the shaded muscle-body kit (35 small WebP:
// two bases + overlays). Same sex rule as /api/library/media.
export async function GET(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const [trainer, client] = await Promise.all([
      getTrainerSession(),
      getClientSession(),
    ]);

    if (!trainer && !client) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Reuse the query validator: sex only, no slugs here.
    const requested = request.nextUrl.searchParams.get("sex");
    const query = parseMediaQuery(requested, "body");

    if (!query) {
      return NextResponse.json(
        { error: "Parámetros no válidos" },
        { status: 400 }
      );
    }

    const sex = await figureSex(
      Boolean(trainer),
      client?.client_id ?? null,
      query.sex
    );

    return NextResponse.json(
      { sex, files: await signBodyMedia(sex) },
      { headers: { "Cache-Control": "private, max-age=1800" } }
    );
  } catch (error) {
    console.error("[Library Body API] failed", { correlationId, error });

    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
