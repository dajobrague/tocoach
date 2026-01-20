// Server-only invitation code validation
import { createClient } from "@supabase/supabase-js";

// Lazy Supabase client initialization
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface InvitationCode {
  id: string;
  code: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_at?: string;
  used_by_trainer_id?: string;
  max_uses: number;
  current_uses: number;
  status: "active" | "used" | "expired" | "revoked";
}

/**
 * Validate an invitation code
 */
export async function validateInvitationCode(
  code: string
): Promise<InvitationCode> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("invitation_codes")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    throw new Error("Invalid or expired invitation code");
  }

  // Check if code has reached max uses
  if (data.current_uses >= data.max_uses) {
    throw new Error("Invitation code has reached maximum uses");
  }

  return data as InvitationCode;
}

/**
 * Mark invitation code as used
 */
export async function markInvitationCodeUsed(
  code: string,
  trainerId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  // First, increment the usage count
  const { data: currentData, error: fetchError } = await supabase
    .from("invitation_codes")
    .select("current_uses, max_uses")
    .eq("code", code.toUpperCase().trim())
    .single();

  if (fetchError || !currentData) {
    throw new Error("Failed to update invitation code");
  }

  const newUsageCount = currentData.current_uses + 1;
  const shouldMarkAsUsed = newUsageCount >= currentData.max_uses;

  const updateData: any = {
    current_uses: newUsageCount,
    used_at: new Date().toISOString(),
    used_by_trainer_id: trainerId,
  };

  // If this is the last use, mark as 'used'
  if (shouldMarkAsUsed) {
    updateData.status = "used";
  }

  const { error: updateError } = await supabase
    .from("invitation_codes")
    .update(updateData)
    .eq("code", code.toUpperCase().trim());

  if (updateError) {
    throw new Error("Failed to update invitation code usage");
  }
}

/**
 * Check if a tenant host is available
 */
export async function checkTenantHostAvailability(
  tenantHost: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  // Check if host already exists in trainers table
  const { data: trainerData } = await supabase
    .from("trainers")
    .select("tenant_host")
    .eq("tenant_host", tenantHost.toLowerCase().trim())
    .single();

  if (trainerData) {
    return false; // Host is taken
  }

  // Check if host already exists in tenants table
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("host")
    .eq("host", tenantHost.toLowerCase().trim())
    .single();

  return !tenantData; // Available if no existing tenant
}

/**
 * Get available tenant slug suggestions
 */
export function generateTenantHostSuggestions(baseName: string): string[] {
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 20);

  return [
    `${sanitized}`,
    `${sanitized}-coach`,
    `${sanitized}-fitness`,
    `coach-${sanitized}`,
    `${sanitized}123`,
  ];
}

/**
 * Validate tenant slug format
 */
export function validateTenantHostFormat(tenantHost: string): boolean {
  // Slug validation: lowercase letters, numbers, hyphens only
  // Must start and end with alphanumeric, 3-30 characters
  const pattern = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

  return pattern.test(tenantHost.toLowerCase().trim());
}
