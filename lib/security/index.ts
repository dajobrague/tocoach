/**
 * Security utilities for the TopCoach application
 *
 * This module provides security helpers including CSRF protection,
 * which is especially important when using sameSite: "none" cookies
 * for iframe embedding support.
 */

export {
  generateCSRFToken,
  setCSRFTokenCookie,
  getCSRFToken,
  validateCSRFToken,
  validateCSRFForMutation,
  getCSRFTokenFromCookie,
  fetchWithCSRF,
} from "./csrf";
