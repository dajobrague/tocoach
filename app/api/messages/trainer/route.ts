import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch all conversations or messages for a specific client
export async function GET(request: NextRequest) {
  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const conversationsOnly = searchParams.get("conversationsOnly") === "true";

    // If requesting conversations list
    if (conversationsOnly) {
      // Get trainer's tenant_host from trainers table
      const { data: trainer, error: trainerError } = await supabase
        .from("trainers")
        .select("tenant_host")
        .eq("id", session.trainer_id)
        .single();

      if (trainerError || !trainer?.tenant_host) {
        console.error("Error fetching trainer tenant:", trainerError);

        return NextResponse.json(
          { error: "Trainer tenant not found" },
          { status: 404 }
        );
      }

      // Get all clients for this trainer's tenant
      // Note: clients.tenant stores the trainer_id (UUID) not tenant.id
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, last_name, email, profile_picture_url")
        .eq("tenant", session.trainer_id)
        .order("name");

      console.log("[Trainer Messages] Querying with:", {
        trainerId: session.trainer_id,
        tenantHost: trainer.tenant_host,
        clientCount: clients?.length || 0,
      });

      if (clientsError) {
        console.error("Error fetching clients:", clientsError);

        return NextResponse.json(
          { error: "Failed to fetch clients" },
          { status: 500 }
        );
      }

      // Get unread message counts and last message for each client
      const clientsWithMessages = await Promise.all(
        clients.map(async (client) => {
          // Get last message
          const { data: lastMessage } = await supabase
            .from("messages")
            .select("message, created_at, sender_type")
            .eq("client_id", parseInt(client.id))
            .eq("tenant_slug", trainer.tenant_host)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          // Get unread count (messages from client that trainer hasn't read)
          const { count: unreadCount } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("client_id", parseInt(client.id))
            .eq("tenant_slug", trainer.tenant_host)
            .eq("sender_type", "client")
            .is("read_at", null);

          return {
            id: client.id,
            full_name: `${client.name} ${client.last_name || ""}`.trim(),
            email: client.email,
            avatar_url: client.profile_picture_url,
            lastMessage: lastMessage?.message || null,
            lastMessageAt: lastMessage?.created_at || null,
            lastMessageSender: lastMessage?.sender_type || null,
            unreadCount: unreadCount || 0,
          };
        })
      );

      // Sort by last message time (most recent first)
      clientsWithMessages.sort((a, b) => {
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;

        return (
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime()
        );
      });

      return NextResponse.json({ conversations: clientsWithMessages });
    }

    // If requesting messages for a specific client
    if (!clientId) {
      return NextResponse.json(
        { error: "Missing clientId parameter" },
        { status: 400 }
      );
    }

    // Get trainer's tenant_host from trainers table
    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("tenant_host")
      .eq("id", session.trainer_id)
      .single();

    if (trainerError || !trainer?.tenant_host) {
      console.error("Error fetching trainer tenant:", trainerError);

      return NextResponse.json(
        { error: "Trainer tenant not found" },
        { status: 404 }
      );
    }

    // Verify the client belongs to this trainer
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("tenant", session.trainer_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch messages
    console.log("[Trainer Messages GET] Querying messages with:", {
      clientId,
      clientIdType: typeof clientId,
      tenantSlug: trainer.tenant_host,
    });

    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("client_id", parseInt(clientId))
      .eq("tenant_slug", trainer.tenant_host)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);

      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    console.log(
      "[Trainer Messages GET] Found messages:",
      messages?.length || 0
    );
    if (messages && messages.length > 0) {
      console.log("[Trainer Messages GET] Sample message:", {
        id: messages[0].id,
        client_id: messages[0].client_id,
        tenant_slug: messages[0].tenant_slug,
        sender_type: messages[0].sender_type,
      });
    }

    // Mark unread client messages as read by trainer
    const unreadClientMessages = messages
      .filter((m) => m.sender_type === "client" && !m.read_at)
      .map((m) => m.id);

    if (unreadClientMessages.length > 0) {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadClientMessages);
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error("Error in GET /api/messages/trainer:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Send a new message from trainer to client
export async function POST(request: NextRequest) {
  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, message } = body;

    if (!clientId || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get trainer's tenant_host from trainers table
    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("tenant_host")
      .eq("id", session.trainer_id)
      .single();

    if (trainerError || !trainer?.tenant_host) {
      console.error("Error fetching trainer tenant:", trainerError);

      return NextResponse.json(
        { error: "Trainer tenant not found" },
        { status: 404 }
      );
    }

    // Verify the client belongs to this trainer
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, last_name")
      .eq("id", clientId)
      .eq("tenant", session.trainer_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Insert message
    const { data: newMessage, error } = await supabase
      .from("messages")
      .insert({
        tenant_slug: trainer.tenant_host,
        client_id: clientId,
        sender_type: "trainer",
        sender_id: session.trainer_id,
        sender_name: session.full_name || "Entrenador",
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

    // TODO: Send notification to client
    // You can integrate with the notifications API here

    return NextResponse.json({ message: newMessage }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/messages/trainer:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
