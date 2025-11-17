// Trainer logout API
import { clearTrainerSession } from '@/lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // Clear the session cookie
        await clearTrainerSession();

        console.log('[Logout] Trainer session cleared');

        return NextResponse.json(
            { success: true, message: 'Sesión cerrada correctamente' },
            { status: 200 }
        );

    } catch (error) {
        console.error('[Logout] Error clearing session:', error);
        return NextResponse.json(
            { error: 'Error al cerrar sesión' },
            { status: 500 }
        );
    }
}
