CREATE TABLE templux.accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 200),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'disabled')),
  auth_version bigint NOT NULL DEFAULT 1 CHECK (auth_version > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE templux.identities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES templux.accounts(id),
  provider text NOT NULL CHECK (provider = 'feishu'),
  app_id text NOT NULL,
  tenant_key text NOT NULL,
  subject text NOT NULL,
  UNIQUE (provider, app_id, tenant_key, subject)
);
CREATE INDEX identities_account_idx ON templux.identities(account_id);
CREATE TABLE templux.account_roles (
  account_id bigint NOT NULL REFERENCES templux.accounts(id),
  role_key text NOT NULL CHECK (length(role_key) BETWEEN 1 AND 80),
  PRIMARY KEY (account_id, role_key)
);
CREATE INDEX account_roles_key_idx ON templux.account_roles(role_key, account_id);
CREATE TABLE templux.auth_sessions (
  token_hash text PRIMARY KEY CHECK (length(token_hash) = 64),
  account_id bigint NOT NULL REFERENCES templux.accounts(id),
  auth_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_reason text
);
CREATE INDEX auth_sessions_account_idx ON templux.auth_sessions(account_id);
CREATE INDEX auth_sessions_expiry_idx ON templux.auth_sessions(expires_at);
CREATE TABLE templux.oauth_requests (
  state_hash text PRIMARY KEY CHECK (length(state_hash) = 64),
  browser_hash text NOT NULL CHECK (length(browser_hash) = 64),
  verifier text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX oauth_requests_expiry_idx ON templux.oauth_requests(expires_at);
CREATE TABLE templux.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('cli', 'feishu')),
  actor text NOT NULL,
  event text NOT NULL,
  account_id bigint REFERENCES templux.accounts(id),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object')
);
CREATE INDEX audit_events_account_idx ON templux.audit_events(account_id, occurred_at DESC);
