-- Inspect gallery albums to diagnose title/date issues.
-- Run in Supabase SQL editor.

SELECT
  google_album_id,
  title,
  photo_count,
  display_order,
  created_at,
  updated_at
FROM gallery_albums
ORDER BY created_at DESC;
