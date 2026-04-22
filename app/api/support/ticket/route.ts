import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    // Try to authenticate trainer via session cookie (preferred)
    // Fall back to body-provided trainer info if cookie is unavailable
    // (some browsers/clients may block or strip cookies on certain requests).
    const session = await getTrainerSession();

    // Read Airtable credentials from env
    const pat = process.env.AIRTABLE_PAT;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableId = process.env.AIRTABLE_TABLE_ID;

    if (!pat || !baseId || !tableId) {
      console.error(
        "[Support Ticket] Missing Airtable env vars (AIRTABLE_PAT, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID)"
      );

      return NextResponse.json(
        { error: "Soporte no configurado. Contacta al administrador." },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      asunto,
      categoria,
      prioridad,
      descripcion,
      video_url,
      trainer_name,
      trainer_email,
    } = body;

    if (!asunto || !descripcion) {
      return NextResponse.json(
        { error: "Asunto y descripción son requeridos" },
        { status: 400 }
      );
    }

    // Resolve trainer identification:
    // 1) From cookie-based session (preferred, verified JWT).
    // 2) From body-provided trainer info (client-side fallback — pulled from
    //    the session the dashboard already loaded). This isn't cryptographically
    //    verified, but the ticket endpoint only writes to Airtable for support
    //    purposes, so spoofing just produces a mislabeled ticket — no auth escalation.
    const trainerFromBody =
      (typeof trainer_name === "string" && trainer_name.trim()) ||
      (typeof trainer_email === "string" && trainer_email.trim()) ||
      "";

    const trainerName =
      session?.full_name || session?.email || trainerFromBody || "Desconocido";

    // Resolve trainer email separately (for the Airtable Email field used
    // for notifications). Prefer the verified session, fall back to body.
    const trainerEmailResolved =
      session?.email ||
      (typeof trainer_email === "string" && trainer_email.trim()) ||
      "";

    if (!session && !trainerFromBody) {
      console.warn(
        "[Support Ticket] No session cookie and no trainer info in body — rejecting"
      );

      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!session) {
      console.warn(
        "[Support Ticket] No session cookie — falling back to body-provided trainer:",
        trainerFromBody
      );
    }

    // Build Airtable fields — only include Video URL if provided
    const fields: Record<string, string> = {
      asunto,
      categoria: categoria || "Consulta General",
      prioridad: prioridad || "Media",
      descripcion,
      trainer: trainerName,
    };

    if (trainerEmailResolved) {
      fields["Email"] = trainerEmailResolved;
    }

    if (video_url && video_url.trim()) {
      fields["Video URL"] = video_url.trim();
    }

    // Create record in Airtable via REST API
    const airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableId}`;
    const airtableRes = await fetch(airtableUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!airtableRes.ok) {
      const errBody = await airtableRes.text();

      console.error(
        "[Support Ticket] Airtable API error:",
        airtableRes.status,
        errBody
      );

      return NextResponse.json(
        { error: "Error al crear el ticket. Intenta de nuevo." },
        { status: 502 }
      );
    }

    const record = await airtableRes.json();

    console.log(
      `[Support Ticket] Created ticket for trainer ${trainerName}: ${asunto}`
    );

    return NextResponse.json({
      success: true,
      ticketId: record.id,
      message: "Ticket creado exitosamente",
    });
  } catch (error) {
    console.error("[Support Ticket] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
