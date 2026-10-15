CREATE TABLE templux.maintenance_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  phase text NOT NULL DEFAULT 'online' CHECK (phase IN ('online','offline')),
  active boolean NOT NULL DEFAULT false,
  planned_at timestamptz,
  message text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((active AND planned_at IS NOT NULL AND length(message) BETWEEN 1 AND 300) OR
         (NOT active AND planned_at IS NULL AND message=''))
);
INSERT INTO templux.maintenance_state(singleton) VALUES(true);
-- Statement trigger, not a stale request-level check. The shared lock lasts to COMMIT.
-- VOLATILE PL/pgSQL statements see a fresh READ COMMITTED snapshot after lock wait.
CREATE FUNCTION templux.guard_maintenance_write() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Maintenance guarded writes require READ COMMITTED' USING ERRCODE='55000';
  END IF;
  PERFORM pg_advisory_xact_lock_shared(hashtext('templux:business-writes'));
  IF NOT EXISTS (SELECT 1 FROM templux.maintenance_state WHERE singleton AND phase='online') THEN
    RAISE EXCEPTION 'Business writes paused for maintenance' USING ERRCODE='55000';
  END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['accounts','identities','account_roles','auth_sessions','oauth_requests','password_credentials','password_failures','login_method_requests'] LOOP
    EXECUTE format('CREATE TRIGGER maintenance_write_guard BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON templux.%I FOR EACH STATEMENT EXECUTE FUNCTION templux.guard_maintenance_write()',name);
  END LOOP;
END $$;
