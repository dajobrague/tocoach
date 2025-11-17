import { clearClientSession } from '@/lib/auth/client-session';
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        await clearClientSession();

        return NextResponse.json(
            { success: true, message: 'Logged out successfully' },
            { status: 200 }
        );
    } catch (error) {
        console.error('[Client Logout] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

