// Training sessions types and interfaces

export interface TrainingSession {
  id: string;
  clientId: string;
  trainerId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show";
  type: "personal_training" | "consultation" | "assessment" | "follow_up";
  location?: string;
  notes?: string;
  workoutPlan?: string;
}

export interface SessionBooking {
  sessionId: string;
  clientId: string;
  requestedTime: Date;
  status: "pending" | "confirmed" | "declined";
  createdAt: Date;
  notes?: string;
}

export interface SessionFeedback {
  sessionId: string;
  rating: number; // 1-5
  comments?: string;
  improvements?: string[];
  nextGoals?: string[];
  submittedAt: Date;
}
