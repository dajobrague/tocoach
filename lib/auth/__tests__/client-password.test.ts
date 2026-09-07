import { describe, expect, it } from "vitest";

import {
  clientPasswordUpdate,
  hasClientPassword,
  verifyClientPassword,
} from "@/lib/auth/client-password";

describe("client password transition (plain text → hash)", () => {
  it("legacy plain-text row: matches and asks for the upgrade", async () => {
    const legacy = { password: "Antigua1", password_hash: null };

    expect(hasClientPassword(legacy)).toBe(true);
    expect(await verifyClientPassword(legacy, "Antigua1")).toEqual({
      ok: true,
      upgrade: true,
    });
    expect(await verifyClientPassword(legacy, "Otra1234")).toEqual({
      ok: false,
      upgrade: true,
    });
  });

  it("hashed row: verifies against the hash, ignores any leftover plain text", async () => {
    const update = await clientPasswordUpdate("Nueva1234");
    const row = { password: "Antigua1", password_hash: update.password_hash };

    expect(update.password).toBeNull();
    expect(await verifyClientPassword(row, "Nueva1234")).toEqual({
      ok: true,
      upgrade: false,
    });
    expect(await verifyClientPassword(row, "Antigua1")).toEqual({
      ok: false,
      upgrade: false,
    });
  });

  it("no credential at all", async () => {
    expect(hasClientPassword({ password: "  ", password_hash: null })).toBe(
      false
    );
    expect(
      await verifyClientPassword({ password: null, password_hash: null }, "x")
    ).toEqual({ ok: false, upgrade: false });
  });
});
