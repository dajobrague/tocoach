import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { getTrainerSession } from "@/lib/auth/session";
import {
  figureSex,
  parseMediaQuery,
  signLibraryMedia,
} from "@/lib/library/media";

// GET /api/library/media?slugs=a,b,c[&sex=male|female]  (sex: trainers only)
// Short-lived signed URLs for the licensed exercise media. JSON (not a
// redirect) because <video src> cannot send the client's Bearer fallback.
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

    const params = request.nextUrl.searchParams;
    const query = parseMediaQuery(params.get("sex"), params.get("slugs"));

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

    const media = await signLibraryMedia(sex, query.slugs);

    return NextResponse.json(
      { media },
      { headers: { "Cache-Control": "private, max-age=1800" } }
    );
  } catch (error) {
    console.error("[Library Media API] failed", { correlationId, error });

    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
