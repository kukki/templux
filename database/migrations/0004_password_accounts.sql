ALTER TABLE templux.accounts ADD COLUMN kind text NOT NULL DEFAULT 'person' CHECK(kind IN ('person','agent'));
ALTER TABLE templux.accounts ADD COLUMN responsible_person_id bigint REFERENCES templux.accounts(id);
ALTER TABLE templux.accounts ADD CONSTRAINT account_kind_owner CHECK(
  (kind='person' AND responsible_person_id IS NULL) OR
  (kind='agent' AND responsible_person_id IS NOT NULL AND responsible_person_id<>id));
CREATE INDEX accounts_responsible_person_idx ON templux.accounts(responsible_person_id);
CREATE TABLE templux.password_credentials (
  account_id bigint PRIMARY KEY REFERENCES templux.accounts(id),
  username text NOT NULL UNIQUE CHECK(username ~ '^[a-z0-9][a-z0-9._-]{2,79}$'),
  password_hash text NOT NULL CHECK(length(password_hash) BETWEEN 100 AND 300),
  enabled boolean NOT NULL DEFAULT true
);
ALTER TABLE templux.auth_sessions ADD COLUMN method text NOT NULL DEFAULT 'feishu' CHECK(method IN ('feishu','password'));
ALTER TABLE templux.audit_events DROP CONSTRAINT audit_events_source_check;
ALTER TABLE templux.audit_events ADD CONSTRAINT audit_events_source_check CHECK(source IN ('cli','feishu','password'));
