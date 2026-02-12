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
  created_at: string;
}

export async function getAlbums() {
  const { data, error } = await supabase
    .from('gallery_albums')
    .select('*')
    .order('title', { ascending: false }); // Works well with YY/MM format
  
  if (error) {
    console.error('Error fetching albums:', error);
    return [];
  }
  
  // Sort by display_order if it exists and is set
  const albums = data as Album[];
  return albums.sort((a, b) => {
    // If both have display_order, use it
    if (a.display_order != null && b.display_order != null) {
      return a.display_order - b.display_order;
    }
    // If only one has it, that one comes first
    if (a.display_order != null) return -1;
    if (b.display_order != null) return 1;
    // Otherwise keep the database title sort order
    return 0;
  });
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
