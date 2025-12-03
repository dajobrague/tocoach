import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// =====================================================
// NEAT (Non-Exercise Activity Thermogenesis) Goals
// =====================================================

export interface ClientNeatGoal {
  id: string;
  client_id: string;
  tenant_host: string;
  weekday: number; // 0-6 (0=Sunday, 1=Monday, ..., 6=Saturday)
  day_type: "active" | "break";
  steps_goal: number | null;
  active_minutes_goal: number | null;
  distance_goal_km: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
