import { supabase } from './supabase';

export interface Album {
  google_album_id: string;
  title: string;
  cover_image_url: string;
  album_url: string;
  photo_count: number;
  created_at: string;
  updated_at: string;
  display_order?: number;
}

export interface Photo {
  google_photo_id: string;
  album_id: string;
  image_url: string;
  width?: number;
  height?: number;
  media_type?: string;
  created_at: string;
}

export async function getAlbums() {
  const { data, error } = await supabase
    .from('gallery_albums')
    .select('*');
  
  if (error) {
    console.error('Error fetching albums:', error);
    return [];
  }
  
  const albums = data as Album[];

  // Split albums into two groups:
  //   - pinned: have display_order (user has manually ordered them) — keep that sequence
  //   - fresh: display_order is null (newly synced or updated) — slot in by title date
  const pinned = albums
    .filter(a => a.display_order != null)
    .sort((a, b) => (a.display_order! - b.display_order!));

  const fresh = albums
    .filter(a => a.display_order == null)
    .sort((a, b) => {
      const da = getAlbumDate(a.title);
      const db = getAlbumDate(b.title);
      if (da && db) return db.getTime() - da.getTime();
      if (da && !db) return -1;
      if (!da && db) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Merge: walk the pinned list, inserting each fresh album before the first
  // pinned album whose title date is older than the fresh album's date.
  // Fresh albums with no parseable date land at the top (treated as "Recent").
  const result: Album[] = [];
  const pinnedDates = pinned.map(p => getAlbumDate(p.title));
  let cursor = 0;

  for (const freshAlbum of fresh) {
    const fDate = getAlbumDate(freshAlbum.title);

    while (cursor < pinned.length) {
      const pDate = pinnedDates[cursor];
      // If fresh has no date, it ranks above all dated pinned albums.
      // If fresh has a date, insert before the first pinned album with an older date.
      const shouldInsert = fDate
        ? (pDate ? fDate.getTime() > pDate.getTime() : false)
        : (pDate !== null);
      if (shouldInsert) break;
      result.push(pinned[cursor]);
      cursor++;
    }
    result.push(freshAlbum);
  }

  while (cursor < pinned.length) {
    result.push(pinned[cursor]);
    cursor++;
  }

  return result;
}

// Helper to format date from title or created_at
export function getDisplayDate(title: string, createdAt: string) {
  const parsed = getAlbumDate(title);
  if (parsed) {
    return parsed.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  return new Date(createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// Helper to clean title for display
export function getDisplayTitle(title: string) {
  if (!title) return 'Untitled Album';
  return title.replace(/^\d{1,2}\/\d{2,4}(?:\/\d{1,2})?\s*-\s*/, '').trim();
}

export function getAlbumDate(title: string) {
  if (!title) return null;
  
  const match = title.match(/^(\d{1,2})\/(\d{2,4})(?:\/(\d{1,2}))?/);
  if (match) {
    let monthPart = parseInt(match[1], 10);
    let yearPart = parseInt(match[2], 10);
    
    // Handle MM/YY vs YYYY/MM heuristic
    if (monthPart > 12) {
      const temp = monthPart;
      monthPart = yearPart;
      yearPart = temp;
    }

    if (yearPart < 100) yearPart += 2000;
    const month = monthPart - 1;
    const day = match[3] ? parseInt(match[3], 10) : 1;
    const parsed = new Date(yearPart, month, day);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

export async function getAlbumById(albumId: string) {
  const { data, error } = await supabase
    .from('gallery_albums')
    .select('*')
    .eq('google_album_id', albumId)
    .single();
  
  if (error) {
    console.error('Error fetching album:', error);
    return null;
  }
  return data as Album;
}

export async function getPhotosByAlbumId(albumId: string) {
  const { data, error } = await supabase
    .from('gallery_photos')
    .select('*')
    .eq('album_id', albumId);
  
  if (error) {
    console.error('Error fetching photos:', error);
    return [];
  }
  return data as Photo[];
}

export async function getTotalPhotoCount() {
  const { data, error } = await supabase
    .from('gallery_photos')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error counting photos:', error);
    return 0;
  }
  return data?.length || 0;
}
