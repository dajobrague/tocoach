/**
 * Client profile management service
 * Handles CRUD operations for client profiles with tenant scoping
 */

import { createServerSupabaseClient } from '@/lib/clients/supabase-server';

export interface CreateClientProfileData {
    id: string; // UUID from auth.users
    tenant_host: string;
    email: string;
    full_name: string;
    phone?: string;
    timezone?: string;
    date_of_birth?: string;
    emergency_contact?: Record<string, any>;
    notes?: string;
}

export interface UpdateClientProfileData {
    full_name?: string;
    phone?: string;
    timezone?: string;
    date_of_birth?: string;
    emergency_contact?: Record<string, any>;
    notes?: string;
    onboarding_completed?: boolean;
    profile_image_url?: string;
    status?: 'active' | 'inactive' | 'suspended';
}

export class ClientService {
    private supabase: any = createServerSupabaseClient();

    /**
     * Create a new client profile
     */
    async createClientProfile(data: CreateClientProfileData) {
        const { data: profile, error } = await this.supabase
            .from('client_profiles')
            .insert({
                id: data.id,
                tenant_host: data.tenant_host,
                email: data.email,
                full_name: data.full_name,
                phone: data.phone,
                timezone: data.timezone || 'America/Chicago',
                date_of_birth: data.date_of_birth,
                emergency_contact: data.emergency_contact,
                notes: data.notes,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create client profile: ${error.message}`);
        }

        return profile;
    }

    /**
     * Get client profile by ID
     */
    async getClientProfile(clientId: string) {
        const { data, error } = await this.supabase
            .from('client_profiles')
            .select('*')
            .eq('id', clientId)
            .single();

        if (error) {
            throw new Error(`Failed to get client profile: ${error.message}`);
        }

        return data;
    }

    /**
     * Update client profile
     */
    async updateClientProfile(clientId: string, data: UpdateClientProfileData) {
        const { data: profile, error } = await this.supabase
            .from('client_profiles')
            .update(data)
            .eq('id', clientId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update client profile: ${error.message}`);
        }

        return profile;
    }

    /**
     * Get all clients for a tenant
     */
    async getClientsByTenant(tenantHost: string) {
        const { data, error } = await this.supabase
            .from('client_profiles')
            .select('*')
            .eq('tenant_host', tenantHost)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to get clients: ${error.message}`);
        }

        return data;
    }

    /**
     * Get clients for a specific trainer
     */
    async getClientsForTrainer(trainerId: string) {
        const { data, error } = await this.supabase
            .from('trainer_clients')
            .select(`
                *,
                client:client_profiles(*)
            `)
            .eq('trainer_id', trainerId)
            .eq('relationship_status', 'active');

        if (error) {
            throw new Error(`Failed to get trainer clients: ${error.message}`);
        }

        return data;
    }

    /**
     * Assign client to trainer
     */
    async assignClientToTrainer(
        trainerId: string,
        clientId: string,
        tenantHost: string,
        startDate?: string,
        notes?: string
    ) {
        const { data, error } = await this.supabase
            .from('trainer_clients')
            .insert({
                trainer_id: trainerId,
                client_id: clientId,
                tenant_host: tenantHost,
                start_date: startDate || new Date().toISOString().split('T')[0],
                notes,
                relationship_status: 'active',
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to assign client to trainer: ${error.message}`);
        }

        return data;
    }

    /**
     * Update last login timestamp
     */
    async updateLastLogin(clientId: string) {
        const { error } = await this.supabase
            .from('client_profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', clientId);

        if (error) {
            console.error('Failed to update last login:', error);
        }
    }
}

// Export singleton instance
export const clientService = new ClientService();

