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
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("host")
      .eq("slug", tenantSlug)
      .single();

    if (tenantError || !tenant) {
      console.error("[Messages GET] Tenant not found for slug:", tenantSlug);

      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Fetch messages using the actual tenant host
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("client_id", clientId)
      .eq("tenant_slug", tenant.host)
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
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("host")
      .eq("slug", tenantSlug)
      .single();

    if (tenantError || !tenant) {
      console.error("[Messages POST] Tenant not found for slug:", tenantSlug);

      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Insert message using the actual tenant host
    const { data: newMessage, error } = await supabase
      .from("messages")
      .insert({
        tenant_slug: tenant.host,
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
        .eq("tenant_host", tenant.host)
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
