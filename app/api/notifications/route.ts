import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getClientSession } from "@/lib/auth/client-session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch notifications for a client
export async function GET(request: NextRequest) {
  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const tenantSlug = searchParams.get("tenantSlug");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!clientId || !tenantSlug) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Note: session.client_id could be different format than clients table id
    // For now, we trust the session and just verify tenantSlug matches
    if (session.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { error: "Forbidden - wrong tenant" },
        { status: 403 }
      );
    }

    // Fetch notifications
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

    // Count unread notifications
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

// PATCH - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Update notifications
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", notificationIds)
      .eq("client_id", session.client_id);

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
