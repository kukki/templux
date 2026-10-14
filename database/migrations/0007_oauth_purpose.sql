ALTER TABLE templux.oauth_requests
  ADD COLUMN purpose text NOT NULL DEFAULT 'login',
  ADD COLUMN login_request_id bigint REFERENCES templux.login_method_requests(id);
UPDATE templux.oauth_requests o SET purpose='login_link',login_request_id=l.id
FROM templux.login_method_requests l WHERE l.oauth_state_hash=o.state_hash;
ALTER TABLE templux.oauth_requests ADD CONSTRAINT oauth_requests_purpose_check
  CHECK((purpose='login' AND login_request_id IS NULL) OR (purpose='login_link' AND login_request_id IS NOT NULL));
CREATE INDEX oauth_requests_login_request_idx ON templux.oauth_requests(login_request_id) WHERE login_request_id IS NOT NULL;
