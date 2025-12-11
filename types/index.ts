import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// =====================================================
// NEAT (Non-Exercise Activity Thermogenesis) Cards
// =====================================================

export interface ClientNeatCard {
  id: string;
  client_id: string;
  tenant_host: string;
  label: string; // Free text name (e.g., "Día de entrenamiento", "Lunes", "Sesión de ciclismo")
  card_order: number;
  steps_goal: number | null;
  notes: string | null;
  weekdays?: number[]; // Optional array [0,1,2,3,4,5,6]
  created_at: string;
  updated_at: string;
}
