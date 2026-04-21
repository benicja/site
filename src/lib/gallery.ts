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

  // Sort logic matching the main gallery page
  return albums.sort((a, b) => {
    // 1. If both have manual display_order, strictly follow it
    if (a.display_order != null && b.display_order != null) {
      return a.display_order - b.display_order;
    }

    // Calculate "automatic" scores
    const dateA = getAlbumDate(a.title);
    const dateB = getAlbumDate(b.title);
    const createdA = new Date(a.created_at).getTime();
    const createdB = new Date(b.created_at).getTime();

    // Recent albums (no date in title) get a Year 3000 score
    const scoreA = dateA ? dateA.getTime() : new Date(3000, 0, 1).getTime() + createdA;
    const scoreB = dateB ? dateB.getTime() : new Date(3000, 0, 1).getTime() + createdB;

    // 2. If one is manual and the other is automatic:
    if (a.display_order != null) {
      // Manual album 'a' vs Automatic album 'b'
      // Automatic 'b' only wins if it's a "Recent" album (Year 3000 score)
      if (scoreB > new Date(2900, 0, 1).getTime()) return 1;
      return -1; // Otherwise, manual selection 'a' wins over dated automatic 'b'
    }
    if (b.display_order != null) {
      if (scoreA > new Date(2900, 0, 1).getTime()) return -1;
      return 1;
    }

    // 3. Both are automatic: use scores (Recent > Dated)
    return scoreB - scoreA;
  });
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
