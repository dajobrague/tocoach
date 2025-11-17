// Client session management (separate from trainer sessions)
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);

const COOKIE_NAME = 'client-session'; // Different from trainer-session
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};

export interface ClientSession {
    client_id: string;        // Supabase user ID
    tenant_host: string;      // The tenant they belong to
    email: string;
    full_name?: string;
    iat: number;
    exp: number;
}

/**
 * Get the current client session from cookies
 */
export async function getClientSession(): Promise<ClientSession | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;

        if (!token) {
            return null;
        }

        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as unknown as ClientSession;
    } catch (error) {
        console.warn('[Client Session] Invalid or expired session:', error);
        return null;
    }
}

/**
 * Set client session cookie in response (for API routes)
 * Cookie is scoped to the specific subdomain to prevent conflicts with trainer sessions
 */
export async function setClientSessionCookie(
    response: NextResponse,
    clientId: string,
    tenantHost: string,
    email: string,
    fullName?: string
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (30 * 24 * 60 * 60); // 30 days

    const payload: ClientSession = {
        client_id: clientId,
        tenant_host: tenantHost,
        email,
        full_name: fullName || '',
        iat: now,
        exp,
    };

    const token = await new SignJWT(payload as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(now)
        .setExpirationTime(exp)
        .sign(JWT_SECRET);

    // In development with localhost, we can't use domain restrictions effectively
    // Rely on different cookie names (client-session vs trainer-session) for isolation
    // In production, set the specific subdomain
    const cookieOptionsWithDomain = process.env.NODE_ENV === 'production'
        ? { ...COOKIE_OPTIONS, domain: tenantHost } // Specific subdomain only
        : COOKIE_OPTIONS; // No domain in dev (use cookie name isolation instead)

    response.cookies.set(COOKIE_NAME, token, cookieOptionsWithDomain);
    return token;
}

/**
 * Clear the client session cookie
 */
export async function clearClientSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

/**
 * Verify client session from request (for middleware)
 */
export async function verifyClientSessionFromRequest(
    request: NextRequest
): Promise<ClientSession | null> {
    try {
        const token = request.cookies.get(COOKIE_NAME)?.value;

        if (!token) {
            return null;
        }

        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as unknown as ClientSession;
    } catch (error) {
        return null;
    }
}

/**
 * Update last login timestamp for client
 */
export async function updateClientLastLogin(clientId: string): Promise<void> {
    try {
        const { createClient } = await import('@supabase/supabase-js');

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Note: The clients table might not have a last_login_at field
        // This is a non-critical operation, so we just log if it fails
        await supabase
            .from('clients')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', clientId);
    } catch (error) {
        console.warn('[Client Session] Failed to update last login:', error);
    }
}

