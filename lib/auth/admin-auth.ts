import type { NextRequest } from "next/server";

import { jwtVerify } from "jose";

import { JWT_SECRET_BYTES } from "@/lib/auth/jwt-secret";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

/** Result of verifying an admin-session request. */
export interface AdminAuthResult {
  isAdmin: boolean;
  adminId: string | null;
}

/**
 * Verify the `admin-session` cookie and confirm the subject is an active admin.
 *
 * Mirrors the inline `verifyAdminAuth` used across `app/api/admin/*`: the JWT is
 * signed with the shared secret and carries the user id in `trainer_id`; the id
 * must match an `admin_users` row with `status='active'`. Any failure mode —
 * missing/invalid cookie, non-admin subject, or query error — returns
 * `{ isAdmin: false }`, so callers fail closed. A trainer or client token
 * (verifies with the same secret but is not in `admin_users`) is rejected.
 */
export async function verifyAdminRequest(
  request: NextRequest
): Promise<AdminAuthResult> {
  const sessionCookie = request.cookies.get("admin-session")?.value;

  if (sessionCookie === undefined || sessionCookie.length === 0) {
    return { isAdmin: false, adminId: null };
  }

  try {
    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET_BYTES);
    const userId = (payload as { trainer_id?: unknown }).trainer_id;

    if (typeof userId !== "string" || userId.length === 0) {
      return { isAdmin: false, adminId: null };
    }

    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, status")
      .eq("id", userId)
      .eq("status", "active")
      .single();

    if (error !== null || data === null) {
      return { isAdmin: false, adminId: null };
    }

    return { isAdmin: true, adminId: (data as { id: string }).id };
  } catch {
    return { isAdmin: false, adminId: null };
  }
}
