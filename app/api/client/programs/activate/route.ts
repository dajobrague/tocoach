// POST /api/client/programs/activate
// RETIRADO (ago 2026, decisión David): los clientes ya no pueden reactivar
// programas pausados — pausar es la herramienta del trainer para OCULTAR un
// programa al cliente, y la reactivación autoservicio la deshacía. El
// endpoint responde 403 (no 404) para que los bundles viejos con el botón
// "Activar" muestren un error claro en vez de romper.

import { NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";

export async function POST() {
  const session = await getClientSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error:
        "Solo tu entrenador puede activar o pausar programas. Pídeselo desde el chat.",
    },
    { status: 403 }
  );
}
