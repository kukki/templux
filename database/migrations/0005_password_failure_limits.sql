CREATE TABLE templux.password_failures (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  failures smallint NOT NULL CHECK (failures BETWEEN 1 AND 5),
  first_failed_at timestamptz NOT NULL,
  blocked_until timestamptz,
  expires_at timestamptz NOT NULL,
  CHECK ((failures < 5 AND blocked_until IS NULL) OR (failures = 5 AND blocked_until IS NOT NULL)),
  CHECK (expires_at > first_failed_at),
  CHECK (blocked_until IS NULL OR blocked_until = expires_at)
);
CREATE INDEX password_failures_expiry_idx ON templux.password_failures(expires_at);
