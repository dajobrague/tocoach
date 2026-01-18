/**
 * Application Configuration
 * Central configuration for the TopCoach application
 */

// Production domain configuration
export const APP_CONFIG = {
  // Production domain - this is the main domain for the application
  PRODUCTION_DOMAIN: "app.topcoach.io",

  // Development domain
  DEVELOPMENT_DOMAIN: "localhost:3000",

  // Get the current domain based on environment
  getDomain: () => {
    if (typeof window !== "undefined") {
      // Client-side
      return process.env.NODE_ENV === "production"
        ? APP_CONFIG.PRODUCTION_DOMAIN
        : APP_CONFIG.DEVELOPMENT_DOMAIN;
    }

    // Server-side
    return process.env.NEXT_PUBLIC_APP_DOMAIN || APP_CONFIG.PRODUCTION_DOMAIN;
  },

  // Check if we're in production
  isProduction: () => process.env.NODE_ENV === "production",

  // Check if we're in development
  isDevelopment: () => process.env.NODE_ENV === "development",
} as const;

// Export individual values for convenience
export const PRODUCTION_DOMAIN = APP_CONFIG.PRODUCTION_DOMAIN;
export const DEVELOPMENT_DOMAIN = APP_CONFIG.DEVELOPMENT_DOMAIN;
