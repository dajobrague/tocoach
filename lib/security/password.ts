import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "crypto";

/**
 * Password hashing with Node's built-in scrypt — no native dependency, and
 * the parameters travel inside the hash so they can be raised later without
 * invalidating existing rows.
 *
 * Format: `scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>`.
 */
function scrypt(
  password: string,
  salt: Uint8Array,
  keyLength: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

const PREFIX = "scrypt";
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(plain, salt, KEY_LENGTH, { N, r: R, p: P });

  return [
    PREFIX,
    N,
    R,
    P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/** True when the stored value is one of our hashes (vs. legacy plain text). */
export function isPasswordHash(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${PREFIX}$`);
}

export async function verifyPassword(
  plain: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");

  if (parts.length !== 6 || parts[0] !== PREFIX) return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? "", "base64");
  const expected = Buffer.from(parts[5] ?? "", "base64");

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scrypt(plain, salt, expected.length, { N: n, r, p });

  if (derived.length !== expected.length) return false;

  return timingSafeEqual(new Uint8Array(derived), new Uint8Array(expected));
}
