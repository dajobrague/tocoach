import { getTrainerSession } from '@/lib/auth/session';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
    try {
        const session = await getTrainerSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Get query params for filtering
        const { searchParams } = new URL(request.url);
        const filter = searchParams.get('filter') || 'all'; // all, active, checkins, plans
        const search = searchParams.get('search') || '';

        // Get tenant ID from session
        const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('trainer_id', session.trainer_id)
            .single();

        if (!tenant) {
            return NextResponse.json(
                { success: false, error: 'Tenant no encontrado' },
                { status: 404 }
            );
        }

        // Get clients from the actual table structure
        let query = supabase
            .from('clients')
            .select('*')
            .eq('tenant', tenant.id);

        // Apply filters
        if (filter === 'active') {
            query = query.eq('status', 'Activo');
        }

        const { data: clients, error } = await query.order('sign_up_date', { ascending: false });

        if (error) {
            console.error('[Clients List] Error fetching clients:', error);
            return NextResponse.json(
                { success: false, error: 'Error al obtener clientes' },
                { status: 500 }
            );
        }

        // Transform data for frontend
        const transformedClients = clients?.map((client: any) => {
            return {
                id: client.id,
                name: `${client.name} ${client.last_name}`,
                firstName: client.name,
                lastName: client.last_name,
                nickName: client.nick_name,
                email: client.email,
                phone: client.phone,
                status: client.status,
                profileImage: client.profile_picture_url,
                joinedDate: client.sign_up_date,
                occupation: client.occupation,
                dob: client.dob,
                location: {
                    city: client.city,
                    state: client.state,
                    country: client.country,
                    zip: client.zip
                },
                nationalId: client.national_id,
                // Mock data for now - will be implemented later
                currentProgram: null,
                totalPrograms: 0,
                lastLogin: null
            };
        }) || [];

        // Apply search filter
        let filteredClients = transformedClients;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredClients = transformedClients.filter((client: any) =>
                client.name.toLowerCase().includes(searchLower) ||
                client.email.toLowerCase().includes(searchLower) ||
                client.nickName?.toLowerCase().includes(searchLower)
            );
        }

        return NextResponse.json({
            success: true,
            clients: filteredClients,
            total: filteredClients.length
        });

    } catch (error) {
        console.error('[Clients List] Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

