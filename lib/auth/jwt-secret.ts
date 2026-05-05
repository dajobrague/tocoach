// Centralized JWT signing secret. Imported by every module that signs or
// verifies a session JWT (trainer, admin, client, CSRF, impersonation).
//
// We *deliberately* throw at module load if `JWT_SECRET` is missing rather
// than silently falling back to a placeholder string. The previous pattern
//
//   process.env.JWT_SECRET || "fallback-secret-change-in-production"
//
// meant that any environment where the var failed to inject (typo, missing
// in a freshly-provisioned env, race on container start) would sign every
// trainer/admin/client session with a hardcoded public string — anyone
// reading the repo could then forge sessions undetectably. Failing fast at
// boot is strictly safer: the misconfig is loud and immediate instead of
// silent and exploitable.
const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error(
    "JWT_SECRET environment variable is required. " +
      "Set it in your environment (.env.local for development, deploy config for production) before starting the app."
  );
}

export const JWT_SECRET_BYTES = new TextEncoder().encode(secret);
