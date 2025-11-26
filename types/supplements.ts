// Supplement inventory and assignment types

export interface SupplementInventoryItem {
  id: string;
  tenant_host: string;
  trainer_id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  images: string[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientSupplementAssignment {
  id: string;
  tenant_host: string;
  client_id: number;
  trainer_id: string;
  supplement_id: string | null;
  supplement_name: string;
  supplement_description: string | null;
  dosage: string;
  frequency: string;
  timing: string;
  notes: string | null;
  status: "active" | "paused" | "discontinued";
  created_at: string;
  updated_at: string;
  // Joined from inventory (when supplement_id is not null)
  supplement?: SupplementInventoryItem;
}

export type SupplementStatus = "active" | "paused" | "discontinued";

// Form types for creating/updating
export interface CreateSupplementInventoryInput {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  images?: string[];
}

export interface UpdateSupplementInventoryInput {
  name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  images?: string[];
  is_archived?: boolean;
}

export interface CreateSupplementAssignmentInput {
  client_id: number;
  supplement_id: string;
  dosage: string;
  frequency: string;
  timing: string;
  notes?: string;
  status?: SupplementStatus;
}

export interface UpdateSupplementAssignmentInput {
  dosage?: string;
  frequency?: string;
  timing?: string;
  notes?: string;
  status?: SupplementStatus;
}
