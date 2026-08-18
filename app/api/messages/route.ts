import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { buildChatNotificationRow } from "@/lib/notifications/chat-notification";

// Lazy Supabase client initialization
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// slug → host con cache en módulo (TTL 60s, mismo patrón que el tenant
// cache del middleware). El header del portal consulta este endpoint en
// cada pantalla; sin cache cada poll pagaba un lookup extra de tenants.
// Solo se cachean aciertos: la ruta es autenticada, los slugs son reales.
const tenantHostCache = new Map<string, { host: string; expires: number }>();
const TENANT_HOST_TTL_MS = 60_000;

async function resolveTenantHost(
  supabase: ReturnType<typeof getSupabaseClient>,
  tenantSlug: string
): Promise<string | null> {
  const cached = tenantHostCache.get(tenantSlug);

  if (cached && cached.expires > Date.now()) {
    return cached.host;
  }

  tenantHostCache.delete(tenantSlug);

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("host")
    .eq("slug", tenantSlug)
    .single();

  if (error || !tenant?.host) {
    return null;
  }

  tenantHostCache.set(tenantSlug, {
    host: tenant.host,
    expires: Date.now() + TENANT_HOST_TTL_MS,
  });

  return tenant.host;
}

// GET - Fetch messages for a client
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const tenantSlug = searchParams.get("tenantSlug");
    const countOnly = searchParams.get("countOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!clientId || !tenantSlug) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Verify session matches requested client (compare as strings)
    if (session.client_id.toString() !== clientId.toString()) {
      console.error("[Messages GET] Client ID mismatch:", {
        sessionClientId: session.client_id,
        requestedClientId: clientId,
        sessionClientIdType: typeof session.client_id,
        requestedClientIdType: typeof clientId,
      });

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the actual tenant host from the slug
    // tenant_slug in messages table stores the host (e.g., brachod7197.localhost), not the slug
    const tenantHost = await resolveTenantHost(supabase, tenantSlug);

    if (!tenantHost) {
      console.error("[Messages GET] Tenant not found for slug:", tenantSlug);

      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Modo conteo (badge de no-leídos): count exact + head — cero filas
    // transferidas. Antes el header bajaba el historial (limit 50 MÁS
    // ANTIGUO, ascending) y contaba en el cliente: pagaba todo el payload
    // y además dejaba de ver no-leídos cuando la conversación superaba
    // los 50 mensajes.
    if (countOnly) {
      const { count, error: countError } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("tenant_slug", tenantHost)
        .eq("sender_type", "trainer")
        .is("read_at", null);

      if (countError) {
        console.error("Error counting unread messages:", countError);

        return NextResponse.json(
          { error: "Failed to count unread messages" },
          { status: 500 }
        );
      }

      return NextResponse.json({ unreadCount: count ?? 0 });
    }

    // Fetch messages using the actual tenant host
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("client_id", clientId)
      .eq("tenant_slug", tenantHost)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("Error fetching messages:", error);

      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error("Error in GET /api/messages:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Send a new message
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, tenantSlug, message } = body;

    if (!clientId || !tenantSlug || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify session matches requested client (compare as strings)
    if (session.client_id.toString() !== clientId.toString()) {
      console.error("[Messages POST] Client ID mismatch:", {
        sessionClientId: session.client_id,
        requestedClientId: clientId,
      });

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the actual tenant host from the slug
    // tenant_slug in messages table stores the host (e.g., brachod7197.localhost), not the slug
    const tenantHost = await resolveTenantHost(supabase, tenantSlug);

    if (!tenantHost) {
      console.error("[Messages POST] Tenant not found for slug:", tenantSlug);

      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Insert message using the actual tenant host
    const { data: newMessage, error } = await supabase
      .from("messages")
      .insert({
        tenant_slug: tenantHost,
        client_id: clientId,
        sender_type: "client",
        sender_id: clientId,
        sender_name: session.full_name || "Client",
        message: message.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error sending message:", error);

      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    // Notifica al trainer en su campana (fila en `notifications` → el
    // dropdown ya está suscrito por trainer_id vía realtime). Fire-and-forget:
    // el envío del mensaje no debe fallar ni demorarse por la notificación.
    const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    void (async () => {
      const { data: trainer } = await supabase
        .from("trainers")
        .select("id")
        .eq("tenant_host", tenantHost)
        .maybeSingle();

      if (!trainer?.id) {
        console.warn(
          `[Messages POST] ${correlationId} no trainer for host — skipping chat notification`
        );

        return;
      }

      const { error: notifError } = await supabase.from("notifications").insert(
        buildChatNotificationRow({
          recipientType: "trainer",
          trainerId: trainer.id,
          clientId: Number(clientId),
          tenantSlug,
          senderName: session.full_name || "Un cliente",
          message: String(message),
        })
      );

      if (notifError) {
        console.error(
          `[Messages POST] ${correlationId} chat notification insert failed:`,
          notifError
        );
      }
    })().catch((e) => {
      console.error(
        `[Messages POST] ${correlationId} chat notification failed:`,
        e
      );
    });

    return NextResponse.json({ message: newMessage }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/messages:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Mark messages as read
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { messageIds } = body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid messageIds" },
        { status: 400 }
      );
    }

    // Update messages
    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", messageIds)
      .eq("client_id", session.client_id);

    if (error) {
      console.error("Error marking messages as read:", error);

      return NextResponse.json(
        { error: "Failed to mark messages as read" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PATCH /api/messages:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
