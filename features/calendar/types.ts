// Calendar types and interfaces

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  type: "session" | "meeting" | "break" | "personal";
  clientId?: string;
  trainerId: string;
  location?: string;
  notes?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  eventId?: string;
}

export interface Availability {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  isAvailable: boolean;
}
