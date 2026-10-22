CREATE TABLE app_login (state_hash TEXT PRIMARY KEY NOT NULL, browser_hash TEXT NOT NULL, app TEXT NOT NULL, verifier TEXT NOT NULL, nonce TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX app_login_expiry ON app_login(expires);
CREATE TABLE app_session (handle_hash TEXT PRIMARY KEY NOT NULL, app TEXT NOT NULL, subject TEXT NOT NULL, email TEXT NOT NULL, issued INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX app_session_expiry ON app_session(expires);
