import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getClientSession } from "@/lib/auth/client-session";
import { getTrainerSession } from "@/lib/auth/session";

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET - Fetch notifications for a client or trainer
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const trainerId = searchParams.get("trainerId");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Trainer-mode: filter by trainer_id
    if (trainerId) {
      const trainerSession = await getTrainerSession();

      if (!trainerSession || trainerSession.trainer_id !== trainerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: notifications, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("trainer_id", trainerId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching trainer notifications:", error);

        return NextResponse.json(
          { error: "Failed to fetch notifications" },
          { status: 500 }
        );
      }

      const unreadCount = (notifications || []).filter(
        (n) => !n.read_at
      ).length;

      return NextResponse.json({
        notifications: notifications || [],
        unreadCount,
      });
    }

    // Client-mode: existing behaviour
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = searchParams.get("clientId");
    const tenantSlug = searchParams.get("tenantSlug");

    if (!clientId || !tenantSlug) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    if (session.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { error: "Forbidden - wrong tenant" },
        { status: 403 }
      );
    }

    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("client_id", clientId)
      .eq("tenant_slug", tenantSlug)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching notifications:", error);

      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 }
      );
    }

    const unreadCount = (notifications || []).filter((n) => !n.read_at).length;

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount,
    });
  } catch (error) {
    console.error("Error in GET /api/notifications:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Mark notifications as read (client or trainer)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { notificationIds } = body;

    if (
      !notificationIds ||
      !Array.isArray(notificationIds) ||
      notificationIds.length === 0
    ) {
      return NextResponse.json(
        { error: "Invalid notificationIds" },
        { status: 400 }
      );
    }

    // Try trainer session first, then client session
    const trainerSession = await getTrainerSession();

    if (trainerSession) {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", notificationIds)
        .eq("trainer_id", trainerSession.trainer_id);

      if (error) {
        console.error("Error marking trainer notifications as read:", error);

        return NextResponse.json(
          { error: "Failed to mark notifications as read" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    const clientSession = await getClientSession();

    if (!clientSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", notificationIds)
      .eq("client_id", clientSession.client_id);

    if (error) {
      console.error("Error marking notifications as read:", error);

      return NextResponse.json(
        { error: "Failed to mark notifications as read" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PATCH /api/notifications:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Clear/delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get("notificationId");

    if (!notificationId) {
      return NextResponse.json(
        { error: "Missing notificationId" },
        { status: 400 }
      );
    }

    // Delete notification
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("client_id", session.client_id);

    if (error) {
      console.error("Error deleting notification:", error);

      return NextResponse.json(
        { error: "Failed to delete notification" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/notifications:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
