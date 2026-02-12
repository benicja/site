import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const imageUrl = url.searchParams.get('url');
  const width = url.searchParams.get('w') || '800';

  if (!imageUrl) {
    return new Response('Missing image URL', { status: 400 });
  }

  try {
    // Decode the URL
    const decodedUrl = decodeURIComponent(imageUrl);
    const imageWithSizing = `${decodedUrl}=w${width}`;

    // Fetch from Google
    const response = await fetch(imageWithSizing, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://photos.google.com/',
      },
    });

    if (!response.ok) {
      return new Response('Failed to fetch image', { status: response.status });
    }

    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=604800', // Cache for 7 days
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new Response('Error fetching image', { status: 500 });
  }
};
