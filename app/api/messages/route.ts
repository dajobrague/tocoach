import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getClientSession } from "@/lib/auth/client-session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch messages for a client
export async function GET(request: NextRequest) {
  try {
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

    // Verify session matches requested client
    if (session.client_id !== parseInt(clientId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch messages
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("client_id", clientId)
      .eq("tenant_slug", tenantSlug)
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

    // Verify session matches requested client
    if (session.client_id !== parseInt(clientId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Insert message
    const { data: newMessage, error } = await supabase
      .from("messages")
      .insert({
        tenant_slug: tenantSlug,
        client_id: parseInt(clientId),
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
