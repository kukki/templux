ALTER TABLE templux.audit_events
  ADD COLUMN result text NOT NULL DEFAULT 'success' CHECK(result IN ('success','denied','failed')),
  ADD COLUMN actor_assurance text NOT NULL DEFAULT 'legacy' CHECK(actor_assurance IN ('legacy','host_claim','unverified','verified_identity','application_session','service')),
  ADD COLUMN actor_account_id bigint REFERENCES templux.accounts(id) ON DELETE SET NULL,
  ADD COLUMN actor_kind text CHECK(actor_kind IN ('person','agent')),
  ADD COLUMN actor_responsible_person_id bigint,
  ADD COLUMN target_kind text CHECK(target_kind IN ('person','agent')),
  ADD COLUMN target_responsible_person_id bigint;
ALTER TABLE templux.audit_events DROP CONSTRAINT audit_events_source_check;
ALTER TABLE templux.audit_events ADD CONSTRAINT audit_events_source_check CHECK(source IN ('cli','feishu','password','system'));
CREATE INDEX audit_events_time_idx ON templux.audit_events(occurred_at,id);
CREATE INDEX audit_events_source_time_idx ON templux.audit_events(source,occurred_at,id);
