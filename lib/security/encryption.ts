/**
 * Server-only encryption utilities for tenant secrets
 * 
 * SECURITY: This module must NEVER be imported by client components
 * Use only in server components, API routes, and middleware
 */

import { webcrypto } from "crypto";

// Ensure we have an encryption key
function getEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error("ENCRYPTION_KEY environment variable is required");
    }
    if (key.length < 32) {
        throw new Error("ENCRYPTION_KEY must be at least 32 characters");
    }
    return key;
}

// Convert string key to CryptoKey for AES-GCM
async function getAESKey(): Promise<CryptoKey> {
    const keyString = getEncryptionKey();
    const keyBuffer = new TextEncoder().encode(keyString.slice(0, 32)); // Use first 32 chars

    return await webcrypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypt a plaintext string using AES-GCM
 * Returns base64-encoded encrypted data with IV prepended
 */
export async function encryptSecret(plaintext: string): Promise<string> {
    try {
        const key = await getAESKey();
        const iv = webcrypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);

        const encrypted = await webcrypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            data
        );

        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        // Return as base64
        return Buffer.from(combined).toString("base64");
    } catch (error) {
        console.error("[Encryption] Failed to encrypt secret:", error);
        throw new Error("Encryption failed");
    }
}

/**
 * Decrypt a base64-encoded encrypted string
 * Returns the original plaintext
 */
export async function decryptSecret(encryptedData: string): Promise<string> {
    try {
        const key = await getAESKey();
        const combined = Buffer.from(encryptedData, "base64");

        // Extract IV (first 12 bytes) and encrypted data
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);

        const decrypted = await webcrypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            encrypted
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        console.error("[Decryption] Failed to decrypt secret:", error);
        throw new Error("Decryption failed");
    }
}

/**
 * Safely log tenant context without exposing secrets
 */
export function logTenantContext(context: any, correlationId: string): void {
    const safeContext = {
        host: context.host,
        slug: context.slug,
        theme_slug: context.theme_slug,
        status: context.status,
        correlationId,
        // Explicitly exclude encrypted fields
    };

    console.log("[Tenant Context]", JSON.stringify(safeContext));
}
