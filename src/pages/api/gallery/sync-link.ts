import type { APIRoute } from 'astro';
import { isUserAdmin, SESSION_COOKIE } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const sessionId = cookies.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'No session found. Please sign in again.' }), { status: 401 });
  }

  const isAdmin = await isUserAdmin(sessionId);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Admin role required' }), { status: 403 });
  }

  const { url } = await request.json();
  if (!url || (!url.includes('photos.app.goo.gl') && !url.includes('photos.google.com'))) {
    return new Response(JSON.stringify({ error: 'Invalid Google Photos URL' }), { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      redirect: 'follow'
    });
    
    // Handle rate limiting
    if (response.status === 429) {
      return new Response(JSON.stringify({ 
        error: 'Google rate limit exceeded. Please wait a few minutes and try again. Tip: When adding multiple albums, add them with longer delays between requests.'
      }), { status: 429 });
    }
    
    const finalUrl = response.url;
    const html = await response.text();
    
    console.log('=== SYNC-LINK DEBUG ===');
    console.log('URL:', url);
    console.log('HTML Length:', html.length);
    
    // 2. Extract Album Title and Metadata
    let title = 'Untitled Album';
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1];
    } else {
      const pageTitleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (pageTitleMatch && pageTitleMatch[1]) {
        title = pageTitleMatch[1];
      }
    }

    // Clean up title: remove dates, emoji, and format properly
    title = title.replace('Album: ', '').replace(' - Google Photos', '').trim();
    // Handle HTML entities - comprehensive decoding
    title = title
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")           // Handle &#39; (numeric without leading zero)
      .replace(/&#039;/g, "'")          // Handle &#039; (numeric with leading zero)
      .replace(/&apos;/g, "'")          // Handle &apos; (named entity)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x27;/g, "'");         // Handle &#x27; (hex numeric)
    // Remove everything after the middle dot (dates, emoji, etc)
    // Pattern: · followed by date info and emoji
    title = title.replace(/\s·\s.*$/, '').trim();
    // Also handle case where there's date info after the title but no middle dot
    // Use word boundaries to avoid matching names like "Janusz" when looking for "Jan"
    title = title.replace(/\s+\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b.*$/i, '').trim();

    // 3. Extract Photo URLs - Use the EXACT regex that worked yesterday
    const photoUrlRegex = /(https:\/\/lh[0-9]\.googleusercontent\.com\/[a-zA-Z0-9\-_/]+)/g;
    const matches = Array.from(html.matchAll(photoUrlRegex));
    console.log('Total regex matches found:', matches.length);

    // Filter and clean URLs
    const baseUrls = matches.map(m => m[1] || m[0])
      .filter(url => url.length > 60)
      .filter(url => !url.includes('googleusercontent.com/a/')) // Ignore profile pictures
      .map(url => url.split('=')[0]); // Get base URL without sizing params

    const uniqueBaseUrls = [...new Set(baseUrls)];
    console.log('Found unique photo URLs:', uniqueBaseUrls.length);

    if (uniqueBaseUrls.length === 0) {
      // Log a sample of the HTML to understand what changed
      const lhMatches = html.match(/lh[0-9]\.googleusercontent\.com/g) || [];
      console.log('Non-https lh mentions:', lhMatches.length);
      console.log('HTML snippet containing "lh":', html.substring(html.indexOf('lh'), html.indexOf('lh') + 200));
      
      return new Response(JSON.stringify({ 
        error: `No photos found. Yesterday 3 albums worked fine. Google may have changed how they serve shared albums.`
      }), { status: 404 });
    }

    const urlParts = finalUrl.split('/').filter(Boolean);
    const albumUrlId = urlParts.pop()?.split('?')[0] || Date.now().toString();

    // Check if album already exists to preserve its display order
    const { data: existingAlbum, error: fetchError } = await supabaseAdmin
      .from('gallery_albums')
      .select('display_order')
      .eq('google_album_id', albumUrlId)
      .single();

    let displayOrder = existingAlbum?.display_order ?? null;

    // If album is being replaced, delete old photos
    if (existingAlbum) {
      const { error: deletePhotosError } = await supabaseAdmin
        .from('gallery_photos')
        .delete()
        .eq('album_id', albumUrlId);

      if (deletePhotosError) {
        console.warn('Warning: could not delete old photos:', deletePhotosError);
      }
    }

    const { error: albumError } = await supabaseAdmin
      .from('gallery_albums')
      .upsert({
        google_album_id: albumUrlId,
        title: title,
        cover_image_url: uniqueBaseUrls[0],
        album_url: url,
        photo_count: uniqueBaseUrls.length,
        display_order: displayOrder,
        updated_at: new Date().toISOString()
      }, { onConflict: 'google_album_id' });

    if (albumError) throw albumError;

    const photoRows = uniqueBaseUrls.map((photoUrl, index) => {
      const photoId = `${albumUrlId}_photo_${index}`;
      return {
        google_photo_id: photoId,
        album_id: albumUrlId,
        image_url: photoUrl
      };
    });

    const { error: photoError } = await supabaseAdmin
      .from('gallery_photos')
      .upsert(photoRows, { onConflict: 'google_photo_id' });

    if (photoError) throw photoError;

    return new Response(JSON.stringify({ 
      success: true, 
      count: uniqueBaseUrls.length,
      title: title
    }));

  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
