-- Ban support: banned users keep their account but can no longer comment or
-- heart anything. Applied per user (the user_sessions table holds one row per
-- Google account, upserted on email at each login, so the flag survives
-- re-login).
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE;
