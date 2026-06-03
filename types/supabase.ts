export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null;
          email: string;
          full_name: string;
          id: string;
          last_login_at: string | null;
          password_changed_at: string | null;
          role: string | null;
          status: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          full_name: string;
          id: string;
          last_login_at?: string | null;
          password_changed_at?: string | null;
          role?: string | null;
          status?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          last_login_at?: string | null;
          password_changed_at?: string | null;
          role?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      chart_config_audit: {
        Row: {
          action: string;
          actor_user_id: string;
          after_charts: Json | null;
          before_charts: Json | null;
          created_at: string;
          id: string;
          metadata: Json | null;
          target_id: string;
          target_kind: string;
          tenant_host: string;
        };
        Insert: {
          action: string;
          actor_user_id: string;
          after_charts?: Json | null;
          before_charts?: Json | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          target_id: string;
          target_kind: string;
          tenant_host: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string;
          after_charts?: Json | null;
          before_charts?: Json | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          target_id?: string;
          target_kind?: string;
          tenant_host?: string;
        };
        Relationships: [];
      };
      client_chart_configs: {
        Row: {
          charts: Json;
          client_id: number;
          created_at: string;
          id: string;
          tenant_host: string;
          updated_at: string;
        };
        Insert: {
          charts: Json;
          client_id: number;
          created_at?: string;
          id?: string;
          tenant_host: string;
          updated_at?: string;
        };
        Update: {
          charts?: Json;
          client_id?: number;
          created_at?: string;
          id?: string;
          tenant_host?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_chart_configs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_chart_configs_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      client_checkins: {
        Row: {
          checkin_date: string;
          checkin_time: string | null;
          client_id: number;
          created_at: string | null;
          energy_level: number | null;
          id: string;
          metadata: Json | null;
          mood: string | null;
          notes: string | null;
          tenant_host: string;
        };
        Insert: {
          checkin_date?: string;
          checkin_time?: string | null;
          client_id: number;
          created_at?: string | null;
          energy_level?: number | null;
          id?: string;
          metadata?: Json | null;
          mood?: string | null;
          notes?: string | null;
          tenant_host: string;
        };
        Update: {
          checkin_date?: string;
          checkin_time?: string | null;
          client_id?: number;
          created_at?: string | null;
          energy_level?: number | null;
          id?: string;
          metadata?: Json | null;
          mood?: string | null;
          notes?: string | null;
          tenant_host?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_checkins_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_checkins_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      client_form_configs: {
        Row: {
          client_id: number;
          created_at: string | null;
          form_type: string;
          id: string;
          questions_config: Json;
          schedule: Json | null;
          template_id: string | null;
          tenant_host: string;
          updated_at: string | null;
          uses_template: boolean | null;
        };
        Insert: {
          client_id: number;
          created_at?: string | null;
          form_type: string;
          id?: string;
          questions_config?: Json;
          schedule?: Json | null;
          template_id?: string | null;
          tenant_host: string;
          updated_at?: string | null;
          uses_template?: boolean | null;
        };
        Update: {
          client_id?: number;
          created_at?: string | null;
          form_type?: string;
          id?: string;
          questions_config?: Json;
          schedule?: Json | null;
          template_id?: string | null;
          tenant_host?: string;
          updated_at?: string | null;
          uses_template?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_form_configs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_form_configs_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "form_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_form_configs_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      client_goals: {
        Row: {
          client_id: number;
          created_at: string | null;
          goal_type: string;
          id: string;
          metadata: Json | null;
          notes: string | null;
          start_date: string;
          status: string;
          target_date: string | null;
          target_value: number;
          tenant_host: string;
          unit: string;
          updated_at: string | null;
        };
        Insert: {
          client_id: number;
          created_at?: string | null;
          goal_type: string;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          start_date?: string;
          status?: string;
          target_date?: string | null;
          target_value: number;
          tenant_host: string;
          unit: string;
          updated_at?: string | null;
        };
        Update: {
          client_id?: number;
          created_at?: string | null;
          goal_type?: string;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          start_date?: string;
          status?: string;
          target_date?: string | null;
          target_value?: number;
          tenant_host?: string;
          unit?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_goals_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_goals_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      client_measurements: {
        Row: {
          bicep_cm: number | null;
          body_fat_percentage: number | null;
          chest_cm: number | null;
          client_id: number;
          created_at: string | null;
          height_cm: number | null;
          hips_cm: number | null;
          id: string;
          measurement_date: string;
          metadata: Json | null;
          muscle_mass_kg: number | null;
          notes: string | null;
          tenant_host: string;
          thigh_cm: number | null;
          trainer_id: string;
          updated_at: string | null;
          waist_cm: number | null;
          weight_kg: number | null;
        };
        Insert: {
          bicep_cm?: number | null;
          body_fat_percentage?: number | null;
          chest_cm?: number | null;
          client_id: number;
          created_at?: string | null;
          height_cm?: number | null;
          hips_cm?: number | null;
          id?: string;
          measurement_date?: string;
          metadata?: Json | null;
          muscle_mass_kg?: number | null;
          notes?: string | null;
          tenant_host: string;
          thigh_cm?: number | null;
          trainer_id: string;
          updated_at?: string | null;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          bicep_cm?: number | null;
          body_fat_percentage?: number | null;
          chest_cm?: number | null;
          client_id?: number;
          created_at?: string | null;
          height_cm?: number | null;
          hips_cm?: number | null;
          id?: string;
          measurement_date?: string;
          metadata?: Json | null;
          muscle_mass_kg?: number | null;
          notes?: string | null;
          tenant_host?: string;
          thigh_cm?: number | null;
          trainer_id?: string;
          updated_at?: string | null;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_measurements_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_measurements_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "client_measurements_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      client_neat_cards: {
        Row: {
          card_order: number;
          client_id: number;
          created_at: string | null;
          id: string;
          label: string;
          notes: string | null;
          steps_goal: number | null;
          tenant_host: string;
          updated_at: string | null;
          weekdays: number[] | null;
        };
        Insert: {
          card_order?: number;
          client_id: number;
          created_at?: string | null;
          id?: string;
          label: string;
          notes?: string | null;
          steps_goal?: number | null;
          tenant_host: string;
          updated_at?: string | null;
          weekdays?: number[] | null;
        };
        Update: {
          card_order?: number;
          client_id?: number;
          created_at?: string | null;
          id?: string;
          label?: string;
          notes?: string | null;
          steps_goal?: number | null;
          tenant_host?: string;
          updated_at?: string | null;
          weekdays?: number[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_neat_cards_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_neat_cards_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      client_programs: {
        Row: {
          client_id: number;
          created_at: string | null;
          end_date: string | null;
          id: string;
          notes: string | null;
          program_id: string;
          progress_percentage: number | null;
          start_date: string;
          status: string;
          tenant_host: string;
          trainer_id: string;
          updated_at: string | null;
        };
        Insert: {
          client_id: number;
          created_at?: string | null;
          end_date?: string | null;
          id?: string;
          notes?: string | null;
          program_id: string;
          progress_percentage?: number | null;
          start_date: string;
          status?: string;
          tenant_host: string;
          trainer_id: string;
          updated_at?: string | null;
        };
        Update: {
          client_id?: number;
          created_at?: string | null;
          end_date?: string | null;
          id?: string;
          notes?: string | null;
          program_id?: string;
          progress_percentage?: number | null;
          start_date?: string;
          status?: string;
          tenant_host?: string;
          trainer_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_programs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_programs_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_programs_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "client_programs_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      client_step_tracking: {
        Row: {
          calories_burned: number | null;
          client_id: number;
          created_at: string | null;
          distance_meters: number | null;
          id: string;
          logged_at: string | null;
          metadata: Json | null;
          step_count: number;
          tenant_host: string;
          tracking_date: string;
        };
        Insert: {
          calories_burned?: number | null;
          client_id: number;
          created_at?: string | null;
          distance_meters?: number | null;
          id?: string;
          logged_at?: string | null;
          metadata?: Json | null;
          step_count: number;
          tenant_host: string;
          tracking_date?: string;
        };
        Update: {
          calories_burned?: number | null;
          client_id?: number;
          created_at?: string | null;
          distance_meters?: number | null;
          id?: string;
          logged_at?: string | null;
          metadata?: Json | null;
          step_count?: number;
          tenant_host?: string;
          tracking_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_step_tracking_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_step_tracking_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      client_supplement_assignments: {
        Row: {
          client_id: number;
          created_at: string | null;
          dosage: string;
          frequency: string;
          id: string;
          notes: string | null;
          status: string;
          supplement_description: string | null;
          supplement_id: string | null;
          supplement_name: string;
          tenant_host: string;
          timing: string;
          trainer_id: string;
          updated_at: string | null;
        };
        Insert: {
          client_id: number;
          created_at?: string | null;
          dosage: string;
          frequency: string;
          id?: string;
          notes?: string | null;
          status?: string;
          supplement_description?: string | null;
          supplement_id?: string | null;
          supplement_name: string;
          tenant_host: string;
          timing: string;
          trainer_id: string;
          updated_at?: string | null;
        };
        Update: {
          client_id?: number;
          created_at?: string | null;
          dosage?: string;
          frequency?: string;
          id?: string;
          notes?: string | null;
          status?: string;
          supplement_description?: string | null;
          supplement_id?: string | null;
          supplement_name?: string;
          tenant_host?: string;
          timing?: string;
          trainer_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_supplement_assignments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_supplement_assignments_supplement_id_fkey";
            columns: ["supplement_id"];
            isOneToOne: false;
            referencedRelation: "supplement_inventory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_supplement_assignments_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "client_supplement_assignments_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      client_water_intake: {
        Row: {
          amount_liters: number;
          client_id: number;
          created_at: string | null;
          id: string;
          intake_date: string;
          logged_at: string | null;
          metadata: Json | null;
          notes: string | null;
          tenant_host: string;
        };
        Insert: {
          amount_liters: number;
          client_id: number;
          created_at?: string | null;
          id?: string;
          intake_date?: string;
          logged_at?: string | null;
          metadata?: Json | null;
          notes?: string | null;
          tenant_host: string;
        };
        Update: {
          amount_liters?: number;
          client_id?: number;
          created_at?: string | null;
          id?: string;
          intake_date?: string;
          logged_at?: string | null;
          metadata?: Json | null;
          notes?: string | null;
          tenant_host?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_water_intake_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_water_intake_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      clients: {
        Row: {
          city: string | null;
          country: string | null;
          dob: string | null;
          email: string | null;
          id: number;
          last_login_at: string | null;
          last_name: string | null;
          name: string | null;
          national_id: string | null;
          nick_name: string | null;
          occupation: string | null;
          password: string | null;
          phone: string | null;
          profile_picture_url: string | null;
          sign_up_date: string;
          state: string | null;
          status: Database["public"]["Enums"]["client_status"] | null;
          tenant: string | null;
          zip: string | null;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          dob?: string | null;
          email?: string | null;
          id?: number;
          last_login_at?: string | null;
          last_name?: string | null;
          name?: string | null;
          national_id?: string | null;
          nick_name?: string | null;
          occupation?: string | null;
          password?: string | null;
          phone?: string | null;
          profile_picture_url?: string | null;
          sign_up_date?: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["client_status"] | null;
          tenant?: string | null;
          zip?: string | null;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          dob?: string | null;
          email?: string | null;
          id?: number;
          last_login_at?: string | null;
          last_name?: string | null;
          name?: string | null;
          national_id?: string | null;
          nick_name?: string | null;
          occupation?: string | null;
          password?: string | null;
          phone?: string | null;
          profile_picture_url?: string | null;
          sign_up_date?: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["client_status"] | null;
          tenant?: string | null;
          zip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_tenant_fkey";
            columns: ["tenant"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_log_sets: {
        Row: {
          created_at: string | null;
          exercise_log_id: string;
          id: string;
          metadata: Json | null;
          reps: number | null;
          set_number: number;
          video_url: string | null;
          weight_kg: number | null;
        };
        Insert: {
          created_at?: string | null;
          exercise_log_id: string;
          id?: string;
          metadata?: Json | null;
          reps?: number | null;
          set_number: number;
          video_url?: string | null;
          weight_kg?: number | null;
        };
        Update: {
          created_at?: string | null;
          exercise_log_id?: string;
          id?: string;
          metadata?: Json | null;
          reps?: number | null;
          set_number?: number;
          video_url?: string | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_log_sets_exercise_log_id_fkey";
            columns: ["exercise_log_id"];
            isOneToOne: false;
            referencedRelation: "exercise_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_logs: {
        Row: {
          client_id: number;
          completed_at: string | null;
          created_at: string | null;
          distance_meters: number | null;
          duration_seconds: number | null;
          exercise_id: string;
          finalized_at: string | null;
          id: string;
          metadata: Json | null;
          notes: string | null;
          perceived_exertion: number | null;
          reps_completed: string | null;
          scheduled_session_id: string | null;
          sets_completed: number | null;
          tenant_host: string;
          trainer_id: string;
          training_date: string | null;
          video_url: string | null;
          weight_kg: number | null;
        };
        Insert: {
          client_id: number;
          completed_at?: string | null;
          created_at?: string | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          exercise_id: string;
          finalized_at?: string | null;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          perceived_exertion?: number | null;
          reps_completed?: string | null;
          scheduled_session_id?: string | null;
          sets_completed?: number | null;
          tenant_host: string;
          trainer_id: string;
          training_date?: string | null;
          video_url?: string | null;
          weight_kg?: number | null;
        };
        Update: {
          client_id?: number;
          completed_at?: string | null;
          created_at?: string | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          exercise_id?: string;
          finalized_at?: string | null;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          perceived_exertion?: number | null;
          reps_completed?: string | null;
          scheduled_session_id?: string | null;
          sets_completed?: number | null;
          tenant_host?: string;
          trainer_id?: string;
          training_date?: string | null;
          video_url?: string | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_logs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_logs_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_logs_scheduled_session_id_fkey";
            columns: ["scheduled_session_id"];
            isOneToOne: false;
            referencedRelation: "scheduled_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_logs_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "exercise_logs_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      exercises: {
        Row: {
          category: string | null;
          created_at: string | null;
          default_reps: string | null;
          default_rest_seconds: number | null;
          default_sets: number | null;
          default_tempo: string | null;
          default_training_system: string | null;
          description: string | null;
          equipment: string[] | null;
          id: string;
          image_url: string | null;
          instructions: string[] | null;
          is_public: boolean | null;
          metadata: Json | null;
          movement_pattern: string | null;
          muscle_groups: string[] | null;
          name: string;
          tenant_host: string;
          tips: string[] | null;
          trainer_id: string;
          updated_at: string | null;
          uploaded_video_url: string | null;
          video_url: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          default_reps?: string | null;
          default_rest_seconds?: number | null;
          default_sets?: number | null;
          default_tempo?: string | null;
          default_training_system?: string | null;
          description?: string | null;
          equipment?: string[] | null;
          id?: string;
          image_url?: string | null;
          instructions?: string[] | null;
          is_public?: boolean | null;
          metadata?: Json | null;
          movement_pattern?: string | null;
          muscle_groups?: string[] | null;
          name: string;
          tenant_host: string;
          tips?: string[] | null;
          trainer_id: string;
          updated_at?: string | null;
          uploaded_video_url?: string | null;
          video_url?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          default_reps?: string | null;
          default_rest_seconds?: number | null;
          default_sets?: number | null;
          default_tempo?: string | null;
          default_training_system?: string | null;
          description?: string | null;
          equipment?: string[] | null;
          id?: string;
          image_url?: string | null;
          instructions?: string[] | null;
          is_public?: boolean | null;
          metadata?: Json | null;
          movement_pattern?: string | null;
          muscle_groups?: string[] | null;
          name?: string;
          tenant_host?: string;
          tips?: string[] | null;
          trainer_id?: string;
          updated_at?: string | null;
          uploaded_video_url?: string | null;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "exercises_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "exercises_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      form_responses: {
        Row: {
          answers: Json;
          client_id: number;
          created_at: string | null;
          form_type: string;
          id: string;
          metadata: Json | null;
          response_date: string;
          submitted_at: string | null;
          tenant_host: string;
          updated_at: string | null;
        };
        Insert: {
          answers?: Json;
          client_id: number;
          created_at?: string | null;
          form_type: string;
          id?: string;
          metadata?: Json | null;
          response_date?: string;
          submitted_at?: string | null;
          tenant_host: string;
          updated_at?: string | null;
        };
        Update: {
          answers?: Json;
          client_id?: number;
          created_at?: string | null;
          form_type?: string;
          id?: string;
          metadata?: Json | null;
          response_date?: string;
          submitted_at?: string | null;
          tenant_host?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "form_responses_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "form_responses_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      form_templates: {
        Row: {
          auto_apply_to_new_clients: boolean;
          created_at: string | null;
          default_schedule: Json | null;
          description: string | null;
          form_type: string;
          id: string;
          is_active: boolean | null;
          name: string;
          questions_config: Json;
          tenant_host: string;
          updated_at: string | null;
        };
        Insert: {
          auto_apply_to_new_clients?: boolean;
          created_at?: string | null;
          default_schedule?: Json | null;
          description?: string | null;
          form_type: string;
          id?: string;
          is_active?: boolean | null;
          name: string;
          questions_config?: Json;
          tenant_host: string;
          updated_at?: string | null;
        };
        Update: {
          auto_apply_to_new_clients?: boolean;
          created_at?: string | null;
          default_schedule?: Json | null;
          description?: string | null;
          form_type?: string;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          questions_config?: Json;
          tenant_host?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "form_templates_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      ingredients: {
        Row: {
          brand: string | null;
          carbs_g: number;
          created_at: string;
          created_by: string | null;
          default_unit: string;
          fat_g: number;
          fiber_g: number;
          id: string;
          kcal: number;
          name: string;
          nutrient_extra: Json;
          protein_g: number;
          sat_fat_g: number;
          sodium_mg: number;
          source: string;
          source_ref: string | null;
          sugar_g: number;
          tenant_host: string;
          updated_at: string;
        };
        Insert: {
          brand?: string | null;
          carbs_g?: number;
          created_at?: string;
          created_by?: string | null;
          default_unit?: string;
          fat_g?: number;
          fiber_g?: number;
          id?: string;
          kcal?: number;
          name: string;
          nutrient_extra?: Json;
          protein_g?: number;
          sat_fat_g?: number;
          sodium_mg?: number;
          source: string;
          source_ref?: string | null;
          sugar_g?: number;
          tenant_host: string;
          updated_at?: string;
        };
        Update: {
          brand?: string | null;
          carbs_g?: number;
          created_at?: string;
          created_by?: string | null;
          default_unit?: string;
          fat_g?: number;
          fiber_g?: number;
          id?: string;
          kcal?: number;
          name?: string;
          nutrient_extra?: Json;
          protein_g?: number;
          sat_fat_g?: number;
          sodium_mg?: number;
          source?: string;
          source_ref?: string | null;
          sugar_g?: number;
          tenant_host?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredients_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      invitation_codes: {
        Row: {
          code: string;
          created_at: string | null;
          created_by: string | null;
          current_uses: number | null;
          expires_at: string;
          id: string;
          max_uses: number | null;
          status: string | null;
          used_at: string | null;
          used_by_trainer_id: string | null;
        };
        Insert: {
          code: string;
          created_at?: string | null;
          created_by?: string | null;
          current_uses?: number | null;
          expires_at: string;
          id?: string;
          max_uses?: number | null;
          status?: string | null;
          used_at?: string | null;
          used_by_trainer_id?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          created_by?: string | null;
          current_uses?: number | null;
          expires_at?: string;
          id?: string;
          max_uses?: number | null;
          status?: string | null;
          used_at?: string | null;
          used_by_trainer_id?: string | null;
        };
        Relationships: [];
      };
      meal_cycles: {
        Row: {
          client_id: number;
          created_at: string;
          duration_days: number;
          id: string;
          name: string;
          start_date: string;
          status: string;
          tenant_host: string;
          trainer_id: string;
          updated_at: string;
        };
        Insert: {
          client_id: number;
          created_at?: string;
          duration_days: number;
          id?: string;
          name: string;
          start_date?: string;
          status?: string;
          tenant_host: string;
          trainer_id: string;
          updated_at?: string;
        };
        Update: {
          client_id?: number;
          created_at?: string;
          duration_days?: number;
          id?: string;
          name?: string;
          start_date?: string;
          status?: string;
          tenant_host?: string;
          trainer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_cycles_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_cycles_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "meal_cycles_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      meal_logs: {
        Row: {
          client_id: number;
          comment: string | null;
          created_at: string;
          id: string;
          log_date: string;
          option_id: string | null;
          photo_url: string | null;
          slot_id: string;
          status: string;
          tenant_host: string;
          updated_at: string;
        };
        Insert: {
          client_id: number;
          comment?: string | null;
          created_at?: string;
          id?: string;
          log_date: string;
          option_id?: string | null;
          photo_url?: string | null;
          slot_id: string;
          status: string;
          tenant_host: string;
          updated_at?: string;
        };
        Update: {
          client_id?: number;
          comment?: string | null;
          created_at?: string;
          id?: string;
          log_date?: string;
          option_id?: string | null;
          photo_url?: string | null;
          slot_id?: string;
          status?: string;
          tenant_host?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_logs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_logs_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "meal_slot_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_logs_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "meal_slots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_logs_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      meal_slot_option_selections: {
        Row: {
          client_id: number;
          created_at: string;
          id: string;
          option_id: string;
          slot_id: string;
          tenant_host: string;
          updated_at: string;
        };
        Insert: {
          client_id: number;
          created_at?: string;
          id?: string;
          option_id: string;
          slot_id: string;
          tenant_host: string;
          updated_at?: string;
        };
        Update: {
          client_id?: number;
          created_at?: string;
          id?: string;
          option_id?: string;
          slot_id?: string;
          tenant_host?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_slot_option_selections_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_slot_option_selections_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "meal_slot_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_slot_option_selections_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "meal_slots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_slot_option_selections_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      meal_slot_options: {
        Row: {
          created_at: string;
          id: string;
          item_snapshot: Json;
          position: number;
          slot_id: string;
          source_ref_id: string;
          source_type: string;
          tenant_host: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_snapshot?: Json;
          position?: number;
          slot_id: string;
          source_ref_id: string;
          source_type: string;
          tenant_host: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_snapshot?: Json;
          position?: number;
          slot_id?: string;
          source_ref_id?: string;
          source_type?: string;
          tenant_host?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_slot_options_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "meal_slots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_slot_options_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      meal_slots: {
        Row: {
          created_at: string;
          cycle_id: string;
          day_index: number;
          id: string;
          label: string;
          position: number;
          tenant_host: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          cycle_id: string;
          day_index: number;
          id?: string;
          label?: string;
          position?: number;
          tenant_host: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          cycle_id?: string;
          day_index?: number;
          id?: string;
          label?: string;
          position?: number;
          tenant_host?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meal_slots_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "meal_cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meal_slots_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      messages: {
        Row: {
          client_id: number;
          created_at: string | null;
          id: string;
          message: string;
          read_at: string | null;
          sender_id: string;
          sender_name: string;
          sender_type: Database["public"]["Enums"]["message_sender_type"];
          tenant_slug: string;
          updated_at: string | null;
        };
        Insert: {
          client_id: number;
          created_at?: string | null;
          id?: string;
          message: string;
          read_at?: string | null;
          sender_id: string;
          sender_name: string;
          sender_type: Database["public"]["Enums"]["message_sender_type"];
          tenant_slug: string;
          updated_at?: string | null;
        };
        Update: {
          client_id?: number;
          created_at?: string | null;
          id?: string;
          message?: string;
          read_at?: string | null;
          sender_id?: string;
          sender_name?: string;
          sender_type?: Database["public"]["Enums"]["message_sender_type"];
          tenant_slug?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_tenant_slug_fkey";
            columns: ["tenant_slug"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      microcycle_slots: {
        Row: {
          created_at: string;
          day_index: number;
          id: string;
          microcycle_id: string;
          session_id: string | null;
        };
        Insert: {
          created_at?: string;
          day_index: number;
          id?: string;
          microcycle_id: string;
          session_id?: string | null;
        };
        Update: {
          created_at?: string;
          day_index?: number;
          id?: string;
          microcycle_id?: string;
          session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "microcycle_slots_microcycle_id_fkey";
            columns: ["microcycle_id"];
            isOneToOne: false;
            referencedRelation: "microcycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "microcycle_slots_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      microcycles: {
        Row: {
          client_program_id: string;
          created_at: string;
          duration_days: number;
          id: string;
          start_date: string;
          tenant_host: string;
          updated_at: string;
        };
        Insert: {
          client_program_id: string;
          created_at?: string;
          duration_days?: number;
          id?: string;
          start_date: string;
          tenant_host: string;
          updated_at?: string;
        };
        Update: {
          client_program_id?: string;
          created_at?: string;
          duration_days?: number;
          id?: string;
          start_date?: string;
          tenant_host?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "microcycles_client_program_id_fkey";
            columns: ["client_program_id"];
            isOneToOne: true;
            referencedRelation: "client_programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "microcycles_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      notifications: {
        Row: {
          client_id: number;
          created_at: string | null;
          icon: string | null;
          id: string;
          link: string | null;
          message: string;
          metadata: Json | null;
          read_at: string | null;
          tenant_slug: string;
          title: string;
          trainer_id: string | null;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Insert: {
          client_id: number;
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          link?: string | null;
          message: string;
          metadata?: Json | null;
          read_at?: string | null;
          tenant_slug: string;
          title: string;
          trainer_id?: string | null;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Update: {
          client_id?: number;
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          link?: string | null;
          message?: string;
          metadata?: Json | null;
          read_at?: string | null;
          tenant_slug?: string;
          title?: string;
          trainer_id?: string | null;
          type?: Database["public"]["Enums"]["notification_type"];
        };
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_tenant_slug_fkey";
            columns: ["tenant_slug"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      nutrition_days: {
        Row: {
          calories: number | null;
          carbs: number | null;
          created_at: string | null;
          day_label: string;
          day_order: number;
          fats: number | null;
          id: string;
          nutrition_plan_id: string;
          protein: number | null;
          tenant_host: string;
          updated_at: string | null;
          weekdays: number[] | null;
        };
        Insert: {
          calories?: number | null;
          carbs?: number | null;
          created_at?: string | null;
          day_label: string;
          day_order?: number;
          fats?: number | null;
          id?: string;
          nutrition_plan_id: string;
          protein?: number | null;
          tenant_host: string;
          updated_at?: string | null;
          weekdays?: number[] | null;
        };
        Update: {
          calories?: number | null;
          carbs?: number | null;
          created_at?: string | null;
          day_label?: string;
          day_order?: number;
          fats?: number | null;
          id?: string;
          nutrition_plan_id?: string;
          protein?: number | null;
          tenant_host?: string;
          updated_at?: string | null;
          weekdays?: number[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_days_nutrition_plan_id_fkey";
            columns: ["nutrition_plan_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_days_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      nutrition_ingredients: {
        Row: {
          calories: number | null;
          carbs: number | null;
          created_at: string | null;
          fats: number | null;
          id: string;
          ingredient_order: number;
          name: string;
          nutrition_meal_id: string;
          option_id: string;
          protein: number | null;
          quantity: string;
          tenant_host: string;
          unit: string;
          updated_at: string | null;
        };
        Insert: {
          calories?: number | null;
          carbs?: number | null;
          created_at?: string | null;
          fats?: number | null;
          id?: string;
          ingredient_order?: number;
          name: string;
          nutrition_meal_id: string;
          option_id: string;
          protein?: number | null;
          quantity: string;
          tenant_host: string;
          unit: string;
          updated_at?: string | null;
        };
        Update: {
          calories?: number | null;
          carbs?: number | null;
          created_at?: string | null;
          fats?: number | null;
          id?: string;
          ingredient_order?: number;
          name?: string;
          nutrition_meal_id?: string;
          option_id?: string;
          protein?: number | null;
          quantity?: string;
          tenant_host?: string;
          unit?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_ingredient_option";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_meal_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_ingredients_nutrition_meal_id_fkey";
            columns: ["nutrition_meal_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_meals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_ingredients_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      nutrition_meal_options: {
        Row: {
          calories: number | null;
          carbs: number | null;
          cooking_time_minutes: number | null;
          created_at: string | null;
          fats: number | null;
          id: string;
          image_url: string | null;
          instructions: string | null;
          meal_id: string;
          name: string;
          option_order: number;
          prep_time_minutes: number | null;
          protein: number | null;
          recipe_notes: string | null;
          servings: number | null;
          updated_at: string | null;
        };
        Insert: {
          calories?: number | null;
          carbs?: number | null;
          cooking_time_minutes?: number | null;
          created_at?: string | null;
          fats?: number | null;
          id?: string;
          image_url?: string | null;
          instructions?: string | null;
          meal_id: string;
          name?: string;
          option_order?: number;
          prep_time_minutes?: number | null;
          protein?: number | null;
          recipe_notes?: string | null;
          servings?: number | null;
          updated_at?: string | null;
        };
        Update: {
          calories?: number | null;
          carbs?: number | null;
          cooking_time_minutes?: number | null;
          created_at?: string | null;
          fats?: number | null;
          id?: string;
          image_url?: string | null;
          instructions?: string | null;
          meal_id?: string;
          name?: string;
          option_order?: number;
          prep_time_minutes?: number | null;
          protein?: number | null;
          recipe_notes?: string | null;
          servings?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_meal_options_meal_id_fkey";
            columns: ["meal_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_meals";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_meals: {
        Row: {
          calories: number | null;
          carbs: number | null;
          created_at: string | null;
          fats: number | null;
          has_alternatives: boolean;
          id: string;
          image_url: string | null;
          label: string;
          meal_order: number;
          notes: string | null;
          nutrition_day_id: string;
          protein: number | null;
          show_calories: boolean | null;
          tenant_host: string;
          updated_at: string | null;
        };
        Insert: {
          calories?: number | null;
          carbs?: number | null;
          created_at?: string | null;
          fats?: number | null;
          has_alternatives?: boolean;
          id?: string;
          image_url?: string | null;
          label: string;
          meal_order?: number;
          notes?: string | null;
          nutrition_day_id: string;
          protein?: number | null;
          show_calories?: boolean | null;
          tenant_host: string;
          updated_at?: string | null;
        };
        Update: {
          calories?: number | null;
          carbs?: number | null;
          created_at?: string | null;
          fats?: number | null;
          has_alternatives?: boolean;
          id?: string;
          image_url?: string | null;
          label?: string;
          meal_order?: number;
          notes?: string | null;
          nutrition_day_id?: string;
          protein?: number | null;
          show_calories?: boolean | null;
          tenant_host?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_meals_nutrition_day_id_fkey";
            columns: ["nutrition_day_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_meals_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      nutrition_option_selections: {
        Row: {
          client_id: number;
          created_at: string | null;
          id: string;
          meal_id: string;
          option_id: string;
          selected_date: string;
        };
        Insert: {
          client_id: number;
          created_at?: string | null;
          id?: string;
          meal_id: string;
          option_id: string;
          selected_date: string;
        };
        Update: {
          client_id?: number;
          created_at?: string | null;
          id?: string;
          meal_id?: string;
          option_id?: string;
          selected_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_option_selections_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_option_selections_meal_id_fkey";
            columns: ["meal_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_meals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_option_selections_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_meal_options";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_plans: {
        Row: {
          client_id: number | null;
          created_at: string | null;
          id: string;
          is_template: boolean | null;
          name: string;
          notes: string | null;
          pdf_name: string | null;
          pdf_url: string | null;
          plan_mode: string;
          show_calories: boolean;
          show_meal_images: boolean;
          start_date: string;
          status: string;
          tenant_host: string;
          trainer_id: string;
          updated_at: string | null;
        };
        Insert: {
          client_id?: number | null;
          created_at?: string | null;
          id?: string;
          is_template?: boolean | null;
          name: string;
          notes?: string | null;
          pdf_name?: string | null;
          pdf_url?: string | null;
          plan_mode?: string;
          show_calories?: boolean;
          show_meal_images?: boolean;
          start_date?: string;
          status?: string;
          tenant_host: string;
          trainer_id: string;
          updated_at?: string | null;
        };
        Update: {
          client_id?: number | null;
          created_at?: string | null;
          id?: string;
          is_template?: boolean | null;
          name?: string;
          notes?: string | null;
          pdf_name?: string | null;
          pdf_url?: string | null;
          plan_mode?: string;
          show_calories?: boolean;
          show_meal_images?: boolean;
          start_date?: string;
          status?: string;
          tenant_host?: string;
          trainer_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_plans_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_plans_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "nutrition_plans_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      password_reset_otps: {
        Row: {
          attempts: number;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          ip_address: string | null;
          max_attempts: number;
          otp_hash: string;
          reset_token: string | null;
          reset_token_expires_at: string | null;
          tenant_slug: string | null;
          used_at: string | null;
          user_type: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          ip_address?: string | null;
          max_attempts?: number;
          otp_hash: string;
          reset_token?: string | null;
          reset_token_expires_at?: string | null;
          tenant_slug?: string | null;
          used_at?: string | null;
          user_type: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          ip_address?: string | null;
          max_attempts?: number;
          otp_hash?: string;
          reset_token?: string | null;
          reset_token_expires_at?: string | null;
          tenant_slug?: string | null;
          used_at?: string | null;
          user_type?: string;
        };
        Relationships: [];
      };
      personal_records: {
        Row: {
          achieved_date: string;
          client_id: number;
          created_at: string | null;
          exercise_id: string;
          exercise_log_id: string | null;
          id: string;
          notes: string | null;
          record_type: string;
          tenant_host: string;
          trainer_id: string;
          unit: string;
          value: number;
        };
        Insert: {
          achieved_date?: string;
          client_id: number;
          created_at?: string | null;
          exercise_id: string;
          exercise_log_id?: string | null;
          id?: string;
          notes?: string | null;
          record_type: string;
          tenant_host: string;
          trainer_id: string;
          unit: string;
          value: number;
        };
        Update: {
          achieved_date?: string;
          client_id?: number;
          created_at?: string | null;
          exercise_id?: string;
          exercise_log_id?: string | null;
          id?: string;
          notes?: string | null;
          record_type?: string;
          tenant_host?: string;
          trainer_id?: string;
          unit?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "personal_records_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personal_records_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personal_records_exercise_log_id_fkey";
            columns: ["exercise_log_id"];
            isOneToOne: false;
            referencedRelation: "exercise_logs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personal_records_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "personal_records_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      programs: {
        Row: {
          created_at: string | null;
          description: string | null;
          difficulty_level: string | null;
          duration_weeks: number | null;
          id: string;
          is_published: boolean | null;
          is_template: boolean | null;
          metadata: Json | null;
          name: string;
          tags: string[] | null;
          tenant_host: string;
          trainer_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          difficulty_level?: string | null;
          duration_weeks?: number | null;
          id?: string;
          is_published?: boolean | null;
          is_template?: boolean | null;
          metadata?: Json | null;
          name: string;
          tags?: string[] | null;
          tenant_host: string;
          trainer_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          difficulty_level?: string | null;
          duration_weeks?: number | null;
          id?: string;
          is_published?: boolean | null;
          is_template?: boolean | null;
          metadata?: Json | null;
          name?: string;
          tags?: string[] | null;
          tenant_host?: string;
          trainer_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "programs_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "programs_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_ingredients: {
        Row: {
          created_at: string;
          id: string;
          ingredient_id: string | null;
          name_snapshot: string;
          nutrient_snapshot: Json;
          quantity: number;
          recipe_id: string;
          sort_order: number;
          unit: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          ingredient_id?: string | null;
          name_snapshot: string;
          nutrient_snapshot?: Json;
          quantity: number;
          recipe_id: string;
          sort_order?: number;
          unit?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          ingredient_id?: string | null;
          name_snapshot?: string;
          nutrient_snapshot?: Json;
          quantity?: number;
          recipe_id?: string;
          sort_order?: number;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_media: {
        Row: {
          created_at: string;
          id: string;
          orientation: string | null;
          recipe_id: string;
          sort_order: number;
          type: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          orientation?: string | null;
          recipe_id: string;
          sort_order?: number;
          type: string;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          orientation?: string | null;
          recipe_id?: string;
          sort_order?: number;
          type?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_media_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          carbs_g: number;
          cook_time_min: number | null;
          created_at: string;
          description: string | null;
          fat_g: number;
          fiber_g: number;
          id: string;
          instructions: string | null;
          kcal: number;
          meal_type_tags: string[];
          name: string;
          prep_time_min: number | null;
          protein_g: number;
          sat_fat_g: number;
          sodium_mg: number;
          status: string;
          sugar_g: number;
          tenant_host: string;
          trainer_id: string;
          updated_at: string;
        };
        Insert: {
          carbs_g?: number;
          cook_time_min?: number | null;
          created_at?: string;
          description?: string | null;
          fat_g?: number;
          fiber_g?: number;
          id?: string;
          instructions?: string | null;
          kcal?: number;
          meal_type_tags?: string[];
          name: string;
          prep_time_min?: number | null;
          protein_g?: number;
          sat_fat_g?: number;
          sodium_mg?: number;
          status?: string;
          sugar_g?: number;
          tenant_host: string;
          trainer_id: string;
          updated_at?: string;
        };
        Update: {
          carbs_g?: number;
          cook_time_min?: number | null;
          created_at?: string;
          description?: string | null;
          fat_g?: number;
          fiber_g?: number;
          id?: string;
          instructions?: string | null;
          kcal?: number;
          meal_type_tags?: string[];
          name?: string;
          prep_time_min?: number | null;
          protein_g?: number;
          sat_fat_g?: number;
          sodium_mg?: number;
          status?: string;
          sugar_g?: number;
          tenant_host?: string;
          trainer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "recipes_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_session_exercise_sets: {
        Row: {
          created_at: string | null;
          id: string;
          notes: string | null;
          reps: string | null;
          scheduled_session_exercise_id: string;
          set_number: number;
          tenant_host: string;
          updated_at: string | null;
          weight_kg: number | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          reps?: string | null;
          scheduled_session_exercise_id: string;
          set_number: number;
          tenant_host: string;
          updated_at?: string | null;
          weight_kg?: number | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          reps?: string | null;
          scheduled_session_exercise_id?: string;
          set_number?: number;
          tenant_host?: string;
          updated_at?: string | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_session_exercise_se_scheduled_session_exercise_i_fkey";
            columns: ["scheduled_session_exercise_id"];
            isOneToOne: false;
            referencedRelation: "scheduled_session_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_session_exercise_sets_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      scheduled_session_exercises: {
        Row: {
          created_at: string | null;
          distance_meters: number | null;
          duration_seconds: number | null;
          exercise_id: string;
          exercise_order: number;
          id: string;
          metadata: Json | null;
          notes: string | null;
          reps: string | null;
          rest_seconds: number | null;
          scheduled_session_id: string;
          sets: number | null;
          tenant_host: string;
          updated_at: string | null;
          weight_kg: number | null;
        };
        Insert: {
          created_at?: string | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          exercise_id: string;
          exercise_order: number;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          reps?: string | null;
          rest_seconds?: number | null;
          scheduled_session_id: string;
          sets?: number | null;
          tenant_host: string;
          updated_at?: string | null;
          weight_kg?: number | null;
        };
        Update: {
          created_at?: string | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          exercise_id?: string;
          exercise_order?: number;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          reps?: string | null;
          rest_seconds?: number | null;
          scheduled_session_id?: string;
          sets?: number | null;
          tenant_host?: string;
          updated_at?: string | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_session_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_session_exercises_scheduled_session_id_fkey";
            columns: ["scheduled_session_id"];
            isOneToOne: false;
            referencedRelation: "scheduled_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_session_exercises_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      scheduled_sessions: {
        Row: {
          client_id: number;
          client_notes: string | null;
          client_program_id: string | null;
          completion_date: string | null;
          created_at: string | null;
          duration_minutes: number | null;
          id: string;
          metadata: Json | null;
          prescribed_by: string;
          scheduled_date: string;
          scheduled_time: string | null;
          session_id: string | null;
          status: string;
          tenant_host: string;
          trainer_id: string;
          trainer_notes: string | null;
          updated_at: string | null;
        };
        Insert: {
          client_id: number;
          client_notes?: string | null;
          client_program_id?: string | null;
          completion_date?: string | null;
          created_at?: string | null;
          duration_minutes?: number | null;
          id?: string;
          metadata?: Json | null;
          prescribed_by?: string;
          scheduled_date: string;
          scheduled_time?: string | null;
          session_id?: string | null;
          status?: string;
          tenant_host: string;
          trainer_id: string;
          trainer_notes?: string | null;
          updated_at?: string | null;
        };
        Update: {
          client_id?: number;
          client_notes?: string | null;
          client_program_id?: string | null;
          completion_date?: string | null;
          created_at?: string | null;
          duration_minutes?: number | null;
          id?: string;
          metadata?: Json | null;
          prescribed_by?: string;
          scheduled_date?: string;
          scheduled_time?: string | null;
          session_id?: string | null;
          status?: string;
          tenant_host?: string;
          trainer_id?: string;
          trainer_notes?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_sessions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_sessions_client_program_id_fkey";
            columns: ["client_program_id"];
            isOneToOne: false;
            referencedRelation: "client_programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_sessions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_sessions_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "scheduled_sessions_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      session_exercises: {
        Row: {
          created_at: string | null;
          custom_name: string | null;
          distance_meters: number | null;
          duration_seconds: number | null;
          exercise_id: string;
          exercise_order: number;
          id: string;
          metadata: Json | null;
          notes: string | null;
          reps: string | null;
          rest_seconds: number | null;
          session_id: string;
          sets: number | null;
          tenant_host: string;
          updated_at: string | null;
          weight_kg: number | null;
        };
        Insert: {
          created_at?: string | null;
          custom_name?: string | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          exercise_id: string;
          exercise_order: number;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          reps?: string | null;
          rest_seconds?: number | null;
          session_id: string;
          sets?: number | null;
          tenant_host: string;
          updated_at?: string | null;
          weight_kg?: number | null;
        };
        Update: {
          created_at?: string | null;
          custom_name?: string | null;
          distance_meters?: number | null;
          duration_seconds?: number | null;
          exercise_id?: string;
          exercise_order?: number;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          reps?: string | null;
          rest_seconds?: number | null;
          session_id?: string;
          sets?: number | null;
          tenant_host?: string;
          updated_at?: string | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_exercises_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
        ];
      };
      sessions: {
        Row: {
          created_at: string | null;
          description: string | null;
          duration_minutes: number | null;
          equipment_needed: string[] | null;
          id: string;
          intensity_level: string | null;
          metadata: Json | null;
          name: string;
          notes: string | null;
          program_id: string | null;
          session_order: number | null;
          session_type: string | null;
          tenant_host: string;
          trainer_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          duration_minutes?: number | null;
          equipment_needed?: string[] | null;
          id?: string;
          intensity_level?: string | null;
          metadata?: Json | null;
          name: string;
          notes?: string | null;
          program_id?: string | null;
          session_order?: number | null;
          session_type?: string | null;
          tenant_host: string;
          trainer_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          duration_minutes?: number | null;
          equipment_needed?: string[] | null;
          id?: string;
          intensity_level?: string | null;
          metadata?: Json | null;
          name?: string;
          notes?: string | null;
          program_id?: string | null;
          session_order?: number | null;
          session_type?: string | null;
          tenant_host?: string;
          trainer_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "sessions_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      supplement_inventory: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          images: string[] | null;
          is_archived: boolean | null;
          name: string;
          product_url: string | null;
          quantity: number | null;
          tenant_host: string;
          trainer_id: string;
          unit: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          images?: string[] | null;
          is_archived?: boolean | null;
          name: string;
          product_url?: string | null;
          quantity?: number | null;
          tenant_host: string;
          trainer_id: string;
          unit?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          images?: string[] | null;
          is_archived?: boolean | null;
          name?: string;
          product_url?: string | null;
          quantity?: number | null;
          tenant_host?: string;
          trainer_id?: string;
          unit?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplement_inventory_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "supplement_inventory_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_events: {
        Row: {
          actor: string | null;
          created_at: string | null;
          event_type: string;
          host: string;
          id: string;
          payload_hash: string | null;
        };
        Insert: {
          actor?: string | null;
          created_at?: string | null;
          event_type: string;
          host: string;
          id?: string;
          payload_hash?: string | null;
        };
        Update: {
          actor?: string | null;
          created_at?: string | null;
          event_type?: string;
          host?: string;
          id?: string;
          payload_hash?: string | null;
        };
        Relationships: [];
      };
      tenants: {
        Row: {
          created_at: string;
          features: Json;
          host: string;
          logo_url: string | null;
          maintenance_reason: string | null;
          maintenance_until: string | null;
          nutrition_v2_enabled: boolean;
          onboarding_completed: boolean | null;
          slug: string;
          status: Database["public"]["Enums"]["tenant_status"];
          stripe_customer_portal_conf: Json | null;
          tables: Json;
          theme_json: Json;
          theme_slug: string;
          theme_version: string | null;
          trainer_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          features?: Json;
          host: string;
          logo_url?: string | null;
          maintenance_reason?: string | null;
          maintenance_until?: string | null;
          nutrition_v2_enabled?: boolean;
          onboarding_completed?: boolean | null;
          slug: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          stripe_customer_portal_conf?: Json | null;
          tables?: Json;
          theme_json?: Json;
          theme_slug: string;
          theme_version?: string | null;
          trainer_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          features?: Json;
          host?: string;
          logo_url?: string | null;
          maintenance_reason?: string | null;
          maintenance_until?: string | null;
          nutrition_v2_enabled?: boolean;
          onboarding_completed?: boolean | null;
          slug?: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          stripe_customer_portal_conf?: Json | null;
          tables?: Json;
          theme_json?: Json;
          theme_slug?: string;
          theme_version?: string | null;
          trainer_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenants_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      trainer_chart_templates: {
        Row: {
          auto_apply_to_new_clients: boolean;
          charts: Json;
          created_at: string;
          id: string;
          tenant_host: string;
          trainer_id: string;
          updated_at: string;
        };
        Insert: {
          auto_apply_to_new_clients?: boolean;
          charts?: Json;
          created_at?: string;
          id?: string;
          tenant_host: string;
          trainer_id: string;
          updated_at?: string;
        };
        Update: {
          auto_apply_to_new_clients?: boolean;
          charts?: Json;
          created_at?: string;
          id?: string;
          tenant_host?: string;
          trainer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trainer_chart_templates_tenant_host_fkey";
            columns: ["tenant_host"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["host"];
          },
          {
            foreignKeyName: "trainer_chart_templates_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      trainers: {
        Row: {
          community_url: string | null;
          created_at: string | null;
          email: string;
          full_name: string | null;
          id: string;
          invitation_code_used: string | null;
          invited_at: string | null;
          invited_by: string | null;
          last_login_at: string | null;
          password_set_at: string | null;
          phone: string | null;
          profile_picture_url: string | null;
          status: string | null;
          subscription_status: string | null;
          tenant_host: string;
          updated_at: string | null;
        };
        Insert: {
          community_url?: string | null;
          created_at?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          invitation_code_used?: string | null;
          invited_at?: string | null;
          invited_by?: string | null;
          last_login_at?: string | null;
          password_set_at?: string | null;
          phone?: string | null;
          profile_picture_url?: string | null;
          status?: string | null;
          subscription_status?: string | null;
          tenant_host: string;
          updated_at?: string | null;
        };
        Update: {
          community_url?: string | null;
          created_at?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          invitation_code_used?: string | null;
          invited_at?: string | null;
          invited_by?: string | null;
          last_login_at?: string | null;
          password_set_at?: string | null;
          phone?: string | null;
          profile_picture_url?: string | null;
          status?: string | null;
          subscription_status?: string | null;
          tenant_host?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trainers_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "admin_users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_otp_rate_limit: {
        Args: {
          p_email: string;
          p_max_requests?: number;
          p_user_type: string;
          p_window_minutes?: number;
        };
        Returns: boolean;
      };
      cleanup_expired_otps: { Args: never; Returns: undefined };
      get_checkin_schedule: {
        Args: { p_config_schedule: Json; p_template_schedule: Json };
        Returns: Json;
      };
      get_client_checkin_streak: {
        Args: { p_client_id: number };
        Returns: number;
      };
      get_or_create_client_form_config: {
        Args: {
          p_client_id: number;
          p_form_type: string;
          p_tenant_host: string;
        };
        Returns: {
          client_id: number;
          created_at: string;
          form_type: string;
          id: string;
          questions_config: Json;
          template_id: string;
          tenant_host: string;
          updated_at: string;
          uses_template: boolean;
        }[];
      };
      get_tenant_host_for_client: {
        Args: { p_client_id: number };
        Returns: string;
      };
      get_trainer_deletion_impact: {
        Args: { trainer_uuid: string };
        Returns: Json;
      };
      replace_scheduled_session_overrides: {
        Args: {
          p_client_id: number;
          p_exercises: Json;
          p_scheduled_date: string;
          p_session_id: string;
          p_sets: Json;
          p_tenant_host: string;
          p_trainer_id: string;
        };
        Returns: string;
      };
      upsert_scheduled_session: {
        Args: {
          p_caller_role: string;
          p_client_id: number;
          p_client_program_id?: string;
          p_metadata?: Json;
          p_scheduled_date: string;
          p_session_id: string;
          p_status?: string;
          p_tenant_host: string;
          p_trainer_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      client_status:
        | "Onboarding Completado"
        | "Programación Inicial Pendiente"
        | "Suscripción a Pagos Pendiente"
        | "Activo"
        | "Pagos Pausados"
        | "Inactivo";
      message_sender_type: "client" | "trainer";
      notification_type:
        | "workout_assigned"
        | "message"
        | "check_in_reminder"
        | "measurement_due"
        | "achievement"
        | "program_updated"
        | "session_scheduled"
        | "form_weekly_available"
        | "form_weekly_reminder"
        | "form_weekly_expiring"
        | "form_weekly_expired"
        | "form_daily_available"
        | "form_daily_reminder";
      tenant_status: "active" | "inactive";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      client_status: [
        "Onboarding Completado",
        "Programación Inicial Pendiente",
        "Suscripción a Pagos Pendiente",
        "Activo",
        "Pagos Pausados",
        "Inactivo",
      ],
      message_sender_type: ["client", "trainer"],
      notification_type: [
        "workout_assigned",
        "message",
        "check_in_reminder",
        "measurement_due",
        "achievement",
        "program_updated",
        "session_scheduled",
        "form_weekly_available",
        "form_weekly_reminder",
        "form_weekly_expiring",
        "form_weekly_expired",
        "form_daily_available",
        "form_daily_reminder",
      ],
      tenant_status: ["active", "inactive"],
    },
  },
} as const;
