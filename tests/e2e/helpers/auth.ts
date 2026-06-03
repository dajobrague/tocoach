import { config as loadEnv } from "dotenv";
import { SignJWT } from "jose";

import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
} from "../../../lib/test/nutrition-test-db";

import type { BrowserContext } from "@playwright/test";

// The dev server verifies the trainer-session cookie with JWT_SECRET from
// .env.local, so sign with the exact same secret.
loadEnv({ path: ".env.local" });

const TRAINER_COOKIE_NAME = "trainer-session";
const TEST_TRAINER_EMAIL = "trainer@nutrition-v2-test.local";
const TEST_TRAINER_FULL_NAME = "Nutrition V2 Test Trainer";

function jwtSecretBytes(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (secret === undefined || secret.length === 0) {
    throw new Error(
      "JWT_SECRET is required for the e2e auth helper — set it in .env.local"
    );
  }

  return new TextEncoder().encode(secret);
}

/**
 * Mint a trainer-session JWT for the dedicated test trainer, matching the
 * payload shape and HS256 signing of createTrainerSession() in
 * lib/auth/session.ts (trainer_id, tenant_host, email, full_name, iat, exp).
 */
export async function mintTrainerSessionJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 24 * 60 * 60; // 7 days

  const payload = {
    trainer_id: TEST_TRAINER_ID,
    tenant_host: TEST_TENANT_HOST,
    email: TEST_TRAINER_EMAIL,
    full_name: TEST_TRAINER_FULL_NAME,
    iat: now,
    exp,
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(jwtSecretBytes());
}

/** Add the trainer-session cookie to a Playwright context (no UI login). */
export async function addTrainerAuthCookie(
  context: BrowserContext
): Promise<void> {
  const token = await mintTrainerSessionJwt();

  await context.addCookies([
    {
      name: TRAINER_COOKIE_NAME,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
