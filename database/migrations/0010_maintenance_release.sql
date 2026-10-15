-- Append-only: 0009 has already been exercised. An entry release receipt must
-- match this epoch; notice-only changes do not invalidate a healthy release.
ALTER TABLE templux.maintenance_state ADD COLUMN gate_version bigint NOT NULL DEFAULT 0 CHECK(gate_version>=0);
