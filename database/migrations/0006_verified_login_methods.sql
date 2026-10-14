CREATE UNIQUE INDEX identities_person_realm_idx ON templux.identities(account_id,provider,app_id,tenant_key);
CREATE TABLE templux.login_method_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES templux.accounts(id),
  expected_version bigint NOT NULL CHECK(expected_version>0),
  method text NOT NULL CHECK(method IN ('feishu','password')),
  username text,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','completed','cancelled')),
  issuer text NOT NULL,
  oauth_state_hash text UNIQUE,
  proof_session_hash text,
  app_id text,
  tenant_key text,
  subject text,
  verified_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
  CHECK((method='password' AND username IS NOT NULL) OR (method='feishu' AND username IS NULL)),
  CHECK(oauth_state_hash IS NULL OR oauth_state_hash ~ '^[a-f0-9]{64}$'),
  CHECK(proof_session_hash IS NULL OR proof_session_hash ~ '^[a-f0-9]{64}$'),
  CHECK(status NOT IN ('verified','completed') OR (app_id IS NOT NULL AND tenant_key IS NOT NULL AND subject IS NOT NULL))
);
CREATE INDEX login_method_requests_account_idx ON templux.login_method_requests(account_id,created_at DESC);
CREATE INDEX login_method_requests_expiry_idx ON templux.login_method_requests(expires_at);
