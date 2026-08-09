-- Share links for gallery albums.
--
-- One stable token per album. A signed-in user presenting the token via
-- ?share=<token> can view that album even without overall gallery approval.
-- Rotating the token (delete + re-create, or UPDATE) revokes every previously
-- shared link for that album; deleting the row disables sharing.
--
-- Tokens deliberately live in their own table rather than a column on
-- gallery_albums: the site reads gallery_albums with the anon key under
-- permissive RLS, and tokens must only ever be readable by the service role.

CREATE TABLE IF NOT EXISTS album_share_tokens (
  album_id TEXT PRIMARY KEY REFERENCES gallery_albums(google_album_id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS on with no policies: the anon and authenticated roles can read nothing.
-- The service-role key (server only) bypasses RLS.
ALTER TABLE album_share_tokens ENABLE ROW LEVEL SECURITY;
