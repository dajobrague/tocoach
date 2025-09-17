// Authentication types and interfaces

export interface User {
  id: string;
  email: string;
  userType: "trainer" | "client";
  status: "active" | "paused" | "locked";
  lastLoginAt?: Date;
  tenantHost?: string; // For trainers
  clientAlias?: string; // For clients
}

export interface AuthSession {
  user: User;
  expiresAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthError extends Error {
  code: "INVALID_CREDENTIALS" | "ACCOUNT_LOCKED" | "RATE_LIMITED";
}
