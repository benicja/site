import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from './supabase';

// Share-token access for gallery albums. Tokens are service-role only (see
// migrations/008): the anon key must never be able to read them. Every helper
// tolerates the table not existing yet, so the code can deploy before the
// migration is applied - sharing just stays off until then.

export async function getShareTokenForAlbum(albumId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('album_share_tokens')
      .select('token')
      .eq('album_id', albumId)
      .maybeSingle();
    if (error) return null;
    return data?.token ?? null;
  } catch {
    return null;
  }
}

export async function getAlbumIdForToken(token: string): Promise<string | null> {
  if (!token || token.length < 16) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('album_share_tokens')
      .select('album_id')
      .eq('token', token)
      .maybeSingle();
    if (error) return null;
    return data?.album_id ?? null;
  } catch {
    return null;
  }
}

// 128 bits of entropy; stable per album until rotated
export function generateShareToken(): string {
  return randomBytes(16).toString('hex');
}

export async function setShareToken(
  albumId: string,
  token: string,
  createdBy: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('album_share_tokens')
    .upsert({ album_id: albumId, token, created_by: createdBy, created_at: new Date().toISOString() });
  if (error) console.error('Failed to save share token:', error);
  return !error;
}

export async function deleteShareToken(albumId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('album_share_tokens')
    .delete()
    .eq('album_id', albumId);
  if (error) console.error('Failed to delete share token:', error);
  return !error;
}

// The media proxies only relay URLs that actually belong to the gallery, so
// they can't be used as an open relay for arbitrary Google URLs

export async function isMediaUrlInAlbum(albumId: string, url: string): Promise<boolean> {
  const { data: photo } = await supabaseAdmin
    .from('gallery_photos')
    .select('google_photo_id')
    .eq('album_id', albumId)
    .eq('image_url', url)
    .limit(1)
    .maybeSingle();
  if (photo) return true;

  const { data: album } = await supabaseAdmin
    .from('gallery_albums')
    .select('google_album_id')
    .eq('google_album_id', albumId)
    .eq('cover_image_url', url)
    .maybeSingle();
  return !!album;
}

export async function isKnownMediaUrl(url: string): Promise<boolean> {
  const { data: photo } = await supabaseAdmin
    .from('gallery_photos')
    .select('google_photo_id')
    .eq('image_url', url)
    .limit(1)
    .maybeSingle();
  if (photo) return true;

  const { data: album } = await supabaseAdmin
    .from('gallery_albums')
    .select('google_album_id')
    .eq('cover_image_url', url)
    .limit(1)
    .maybeSingle();
  return !!album;
}
