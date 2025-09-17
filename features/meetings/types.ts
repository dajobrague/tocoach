// Virtual meetings types and interfaces

export interface Meeting {
  id: string;
  title: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  participants: MeetingParticipant[];
  roomUrl?: string;
  recordingUrl?: string;
}

export interface MeetingParticipant {
  id: string;
  name: string;
  email: string;
  role: "trainer" | "client";
  joinedAt?: Date;
  leftAt?: Date;
}

export interface MeetingRoom {
  id: string;
  name: string;
  isActive: boolean;
  maxParticipants: number;
  currentParticipants: number;
  createdAt: Date;
}
