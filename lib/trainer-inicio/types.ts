export interface PendingItem {
  id: string;
  clientId: number;
  client: string;
  /** Qué pasa, en una línea. */
  detail: string;
  /** Desde cuándo espera (ISO). */
  at: string;
  /** A dónde lleva el clic: lo que hay que revisar. */
  href: string;
}

export interface InicioData {
  pending: {
    /** Check-ins enviados que el entrenador aún no marcó como revisados. */
    review: PendingItem[];
    /** Clientes cuyo último check-in cerró sin respuesta. */
    expired: PendingItem[];
    /** Conversaciones con mensajes del cliente sin leer. */
    message: PendingItem[];
    /** Sesiones de los últimos 7 días que siguen sin completar. */
    unfinished: PendingItem[];
  };
  sessions: {
    /** Lunes a domingo de esta semana. */
    days: { done: number; planned: number }[];
    done: number;
    planned: number;
    /** % hecho la semana pasada hasta el mismo día; null si no hay datos. */
    lastWeekPct: number | null;
    /** Índice de hoy en `days` (0 = lunes). */
    todayIndex: number;
  };
  checkins: {
    received: number;
    due: number;
    /** % recibido por semana, de la más antigua a la actual. */
    trend: number[];
  };
  clients: {
    active: number;
    activeToday: number;
    /** Altas en los últimos 30 días entre los activos. */
    joinedLastMonth: number;
    /** Cartera actual según fecha de alta, 12 semanas. */
    trend: number[];
  };
}
