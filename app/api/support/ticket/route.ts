import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

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
    const { asunto, categoria, prioridad, descripcion } = body;

    if (!asunto || !descripcion) {
      return NextResponse.json(
        { error: "Asunto y descripción son requeridos" },
        { status: 400 }
      );
    }

    // Build trainer name from session
    const trainerName = session.full_name || session.email || "Desconocido";

    // Create record in Airtable via REST API
    const airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableId}`;
    const airtableRes = await fetch(airtableUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          asunto,
          categoria: categoria || "Consulta General",
          prioridad: prioridad || "Media",
          descripcion,
          trainer: trainerName,
        },
      }),
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
