import { hashPassword, verifyPassword } from "@/lib/security/password";

/**
 * Client passwords in transition: `password_hash` is the real credential;
 * `password` is the legacy plain-text column, kept only until each client
 * logs in once (2026-09-07 migration). Every check goes through here so no
 * route compares plain text on its own.
 */
export interface ClientPasswordColumns {
  password?: string | null;
  password_hash?: string | null;
}

/** Whether the client can log in at all (hash or legacy plain text present). */
export function hasClientPassword(client: ClientPasswordColumns): boolean {
  if (typeof client.password_hash === "string" && client.password_hash !== "") {
    return true;
  }

  return typeof client.password === "string" && client.password.trim() !== "";
}

/**
 * `ok` — the password matches. `upgrade` — it matched the LEGACY plain-text
 * column, so the caller should persist `clientPasswordUpdate(plain)` now.
 */
export async function verifyClientPassword(
  client: ClientPasswordColumns,
  plain: string
): Promise<{ ok: boolean; upgrade: boolean }> {
  if (typeof client.password_hash === "string" && client.password_hash !== "") {
    return {
      ok: await verifyPassword(plain, client.password_hash),
      upgrade: false,
    };
  }
  if (typeof client.password === "string" && client.password.trim() !== "") {
    return { ok: client.password === plain, upgrade: true };
  }

  return { ok: false, upgrade: false };
}

/** Update payload that stores the hash and wipes the legacy plain text. */
export async function clientPasswordUpdate(
  plain: string
): Promise<{ password_hash: string; password: null }> {
  return { password_hash: await hashPassword(plain), password: null };
}
