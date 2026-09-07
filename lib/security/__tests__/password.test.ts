import { describe, expect, it } from "vitest";

import {
  hashPassword,
  isPasswordHash,
  verifyPassword,
} from "@/lib/security/password";

describe("password hashing (scrypt)", () => {
  it("round-trips and rejects a wrong password", async () => {
    const hash = await hashPassword("Correcta1");

    expect(isPasswordHash(hash)).toBe(true);
    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("Correcta1", hash)).toBe(true);
    expect(await verifyPassword("Incorrecta1", hash)).toBe(false);
  });

  it("salts: two hashes of the same password differ", async () => {
    expect(await hashPassword("Misma1234")).not.toBe(
      await hashPassword("Misma1234")
    );
  });

  it("never treats plain text as a hash and rejects malformed values", async () => {
    expect(isPasswordHash("Correcta1")).toBe(false);
    expect(isPasswordHash(null)).toBe(false);
    expect(await verifyPassword("x", "scrypt$bad")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});
