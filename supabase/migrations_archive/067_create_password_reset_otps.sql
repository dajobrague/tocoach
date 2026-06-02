-- Migration: password reset OTP and short-lived reset token storage
-- OTP and reset_token values are hashed in the application layer before insert/update.

CREATE TABLE password_reset_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('trainer', 'client')),
  tenant_slug TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  ip_address TEXT,
  reset_token TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  CONSTRAINT password_reset_otps_email_lowercase CHECK (email = lower(email)),
  CONSTRAINT password_reset_otps_email_trimmed CHECK (email = trim(email)),
  CONSTRAINT password_reset_otps_tenant_slug_by_user_type CHECK (
    (user_type = 'trainer' AND tenant_slug IS NULL)
    OR (user_type = 'client' AND tenant_slug IS NOT NULL)
  )
);

CREATE INDEX password_reset_otps_email_user_type_tenant_slug_idx
  ON password_reset_otps (email, user_type, tenant_slug);

CREATE INDEX password_reset_otps_expires_at_idx
  ON password_reset_otps (expires_at);

CREATE INDEX password_reset_otps_reset_token_idx
  ON password_reset_otps (reset_token);

COMMENT ON TABLE password_reset_otps IS
  'Password reset flow: stores hashed OTP and optional hashed reset_token. RLS allows anon INSERT/SELECT/UPDATE; authorization is enforced in API routes.';

ALTER TABLE password_reset_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "password_reset_otps_anon_insert"
  ON password_reset_otps FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "password_reset_otps_anon_select"
  ON password_reset_otps FOR SELECT TO anon
  USING (true);

CREATE POLICY "password_reset_otps_anon_update"
  ON password_reset_otps FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.password_reset_otps TO anon;

-- Removes rows whose OTP window ended more than 1 hour ago (grace period for debugging).
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM password_reset_otps
  WHERE expires_at < now() - interval '1 hour';
$$;

COMMENT ON FUNCTION cleanup_expired_otps() IS
  'Deletes expired OTP rows after a 1 hour grace period. Runs with definer rights; schedule via cron or run as privileged role.';

-- TRUE = under rate limit (may issue another OTP); FALSE = rate limited or invalid user_type.
CREATE OR REPLACE FUNCTION check_otp_rate_limit(
  p_email TEXT,
  p_user_type TEXT,
  p_window_minutes INTEGER DEFAULT 15,
  p_max_requests INTEGER DEFAULT 3
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_type IS NULL
      OR p_user_type NOT IN ('trainer', 'client') THEN false
    ELSE (
      SELECT COUNT(*)::INTEGER
      FROM password_reset_otps
      WHERE lower(trim(email)) = lower(trim(p_email))
        AND user_type = p_user_type
        AND created_at > now() - (p_window_minutes * interval '1 minute')
    ) < p_max_requests
  END;
$$;

COMMENT ON FUNCTION public.check_otp_rate_limit(TEXT, TEXT, INTEGER, INTEGER) IS
  'Counts OTP rows in the sliding window for email+user_type; returns TRUE if count < p_max_requests.';

GRANT EXECUTE ON FUNCTION public.check_otp_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.check_otp_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
