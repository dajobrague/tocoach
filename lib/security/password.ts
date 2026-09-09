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
 *
 * Everything is handled as plain Uint8Array: Buffer's generic typing differs
 * between @types/node versions and does not assign cleanly to BinaryLike /
 * ArrayBufferView under the strict config.
 */
const PREFIX = "scrypt";
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function scrypt(
  password: string,
  salt: Uint8Array,
  keyLength: number,
  options: ScryptOptions
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(new Uint8Array(key.buffer, key.byteOffset, key.byteLength));
    });
  });
}

const toBase64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("base64");
const fromBase64 = (text: string): Uint8Array =>
  new Uint8Array(Buffer.from(text, "base64"));

export async function hashPassword(plain: string): Promise<string> {
  const salt = new Uint8Array(randomBytes(SALT_BYTES));
  const derived = await scrypt(plain, salt, KEY_LENGTH, { N, r: R, p: P });

  return [PREFIX, N, R, P, toBase64(salt), toBase64(derived)].join("$");
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
  const salt = fromBase64(parts[4] ?? "");
  const expected = fromBase64(parts[5] ?? "");

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scrypt(plain, salt, expected.length, { N: n, r, p });

  if (derived.length !== expected.length) return false;

  return timingSafeEqual(derived, expected);
}
