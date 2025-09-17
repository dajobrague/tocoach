// Dashboard types and interfaces

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalSessions: number;
  upcomingSessions: number;
  monthlyRevenue: number;
  completionRate: number;
}

export interface RecentActivity {
  id: string;
  type:
    | "session_completed"
    | "client_registered"
    | "payment_received"
    | "session_cancelled";
  description: string;
  timestamp: Date;
  clientId?: string;
  amount?: number;
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  enabled: boolean;
}
