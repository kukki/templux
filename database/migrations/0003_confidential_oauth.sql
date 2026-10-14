-- Official v1 authorize currently supports PKCE with token v2 only.
-- The v3 confidential-client flow authenticates with the mandatory App Secret.
ALTER TABLE templux.oauth_requests DROP COLUMN verifier;
