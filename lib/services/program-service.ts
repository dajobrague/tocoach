/**
 * Program and session management service
 * Handles training programs, sessions, and client assignments
 */

import { createServerSupabaseClient } from '@/lib/clients/supabase-server';

export interface CreateProgramData {
    tenant_host: string;
    trainer_id: string;
    name: string;
    description?: string;
    duration_weeks?: number;
    difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
    is_template?: boolean;
    is_published?: boolean;
    tags?: string[];
}

export interface CreateSessionData {
    tenant_host: string;
    program_id?: string;
    trainer_id: string;
    name: string;
    description?: string;
    session_order?: number;
    duration_minutes?: number;
    session_type?: 'strength' | 'cardio' | 'flexibility' | 'sports' | 'recovery' | 'other';
    intensity_level?: 'low' | 'moderate' | 'high';
    equipment_needed?: string[];
    notes?: string;
}

export interface AssignProgramToClientData {
    tenant_host: string;
    client_id: string;
    program_id: string;
    trainer_id: string;
    start_date: string;
    end_date?: string;
    notes?: string;
}

export class ProgramService {
    private supabase: any = createServerSupabaseClient();

    /**
     * Create a new program
     */
    async createProgram(data: CreateProgramData) {
        const { data: program, error } = await this.supabase
            .from('programs')
            .insert(data)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create program: ${error.message}`);
        }

        return program;
    }

    /**
     * Get program by ID with sessions
     */
    async getProgramWithSessions(programId: string) {
        const { data, error } = await this.supabase
            .from('programs')
            .select(`
                *,
                sessions:sessions(*)
            `)
            .eq('id', programId)
            .single();

        if (error) {
            throw new Error(`Failed to get program: ${error.message}`);
        }

        return data;
    }

    /**
     * Get all programs for a trainer
     */
    async getProgramsByTrainer(trainerId: string) {
        const { data, error } = await this.supabase
            .from('programs')
            .select('*')
            .eq('trainer_id', trainerId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to get programs: ${error.message}`);
        }

        return data;
    }

    /**
     * Update program
     */
    async updateProgram(programId: string, updates: Partial<CreateProgramData>) {
        const { data, error } = await this.supabase
            .from('programs')
            .update(updates)
            .eq('id', programId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update program: ${error.message}`);
        }

        return data;
    }

    /**
     * Delete program
     */
    async deleteProgram(programId: string) {
        const { error } = await this.supabase
            .from('programs')
            .delete()
            .eq('id', programId);

        if (error) {
            throw new Error(`Failed to delete program: ${error.message}`);
        }
    }

    /**
     * Create a session
     */
    async createSession(data: CreateSessionData) {
        const { data: session, error } = await this.supabase
            .from('sessions')
            .insert(data)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create session: ${error.message}`);
        }

        return session;
    }

    /**
     * Get sessions for a program
     */
    async getSessionsByProgram(programId: string) {
        const { data, error } = await this.supabase
            .from('sessions')
            .select('*')
            .eq('program_id', programId)
            .order('session_order', { ascending: true });

        if (error) {
            throw new Error(`Failed to get sessions: ${error.message}`);
        }

        return data;
    }

    /**
     * Assign program to client
     */
    async assignProgramToClient(data: AssignProgramToClientData) {
        const { data: assignment, error } = await this.supabase
            .from('client_programs')
            .insert({
                ...data,
                status: 'active',
                progress_percentage: 0,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to assign program: ${error.message}`);
        }

        return assignment;
    }

    /**
     * Get client's active programs
     */
    async getClientPrograms(clientId: string) {
        const { data, error } = await this.supabase
            .from('client_programs')
            .select(`
                *,
                program:programs(*)
            `)
            .eq('client_id', clientId)
            .in('status', ['active', 'paused'])
            .order('start_date', { ascending: false });

        if (error) {
            throw new Error(`Failed to get client programs: ${error.message}`);
        }

        return data;
    }

    /**
     * Update program progress
     */
    async updateProgramProgress(clientProgramId: string, progressPercentage: number) {
        const { data, error } = await this.supabase
            .from('client_programs')
            .update({ progress_percentage: progressPercentage })
            .eq('id', clientProgramId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update progress: ${error.message}`);
        }

        return data;
    }

    /**
     * Schedule a session for a client
     */
    async scheduleSession(
        clientId: string,
        trainerId: string,
        tenantHost: string,
        sessionId: string,
        scheduledDate: string,
        scheduledTime?: string,
        clientProgramId?: string
    ) {
        const { data, error } = await this.supabase
            .from('scheduled_sessions')
            .insert({
                tenant_host: tenantHost,
                client_id: clientId,
                trainer_id: trainerId,
                session_id: sessionId,
                client_program_id: clientProgramId,
                scheduled_date: scheduledDate,
                scheduled_time: scheduledTime,
                status: 'scheduled',
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to schedule session: ${error.message}`);
        }

        return data;
    }

    /**
     * Get client's scheduled sessions
     */
    async getClientSchedule(clientId: string, startDate?: string, endDate?: string) {
        let query = this.supabase
            .from('scheduled_sessions')
            .select(`
                *,
                session:sessions(*)
            `)
            .eq('client_id', clientId)
            .order('scheduled_date', { ascending: true });

        if (startDate) {
            query = query.gte('scheduled_date', startDate);
        }
        if (endDate) {
            query = query.lte('scheduled_date', endDate);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Failed to get client schedule: ${error.message}`);
        }

        return data;
    }

    /**
     * Mark session as completed
     */
    async completeSession(scheduledSessionId: string, clientNotes?: string) {
        const { data, error } = await this.supabase
            .from('scheduled_sessions')
            .update({
                status: 'completed',
                completion_date: new Date().toISOString(),
                client_notes: clientNotes,
            })
            .eq('id', scheduledSessionId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to complete session: ${error.message}`);
        }

        return data;
    }
}

// Export singleton instance
export const programService = new ProgramService();

