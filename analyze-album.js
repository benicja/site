import https from 'https';

const url = 'https://photos.app.goo.gl/6DcTzVZopm7zqdcK9';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Referer': 'https://photos.google.com/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

const fetchWithRedirects = async (urlStr) => {
  return new Promise((resolve, reject) => {
    const makeRequest = (currentUrl) => {
      https.get(currentUrl, { headers }, (res) => {
        let data = '';
        
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log(`Redirecting: ${res.statusCode} -> ${res.headers.location}`);
          makeRequest(res.headers.location);
          return;
        }
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve(data);
        });
      }).on('error', reject);
    };
    
    makeRequest(urlStr);
  });
};

fetchWithRedirects(url).then((data) => {
    console.log('\n=== ALBUM HTML ANALYSIS ===\n');
    console.log(`HTML Content Length: ${data.length} bytes\n`);
    
    // Look for comment-related patterns
    console.log('=== SEARCHING FOR COMMENT INDICATORS ===\n');
    
    // Check for various comment patterns
    const patterns = {
      'comment keyword': /comment/gi,
      'badge/number pattern': /badge|<svg[^>]*>\s*<[^>]*>\s*\d+/gi,
      'data-comment': /data-comment[^=]*="[^"]*"/gi,
      'squircle': /squircle/gi,
    };
    
    for (const [name, pattern] of Object.entries(patterns)) {
      const matches = data.match(pattern);
      if (matches) {
        console.log(`✓ Found "${name}": ${matches.length} matches`);
        // Show first 2 matches
        matches.slice(0, 2).forEach((match, i) => {
          console.log(`  [${i+1}] ${match.substring(0, 80)}`);
        });
      }
    }
    
    // Search for photo URL patterns with adjacent data
    console.log('\n=== PHOTO DATA STRUCTURES ===\n');
    
    const photoUrlMatches = data.match(/https:\/\/lh\d+\.googleusercontent\.com\/[a-zA-Z0-9_\-/]+/g);
    if (photoUrlMatches) {
      console.log(`Found ${photoUrlMatches.length} photo URLs`);
      console.log(`First URL: ${photoUrlMatches[0]}\n`);
      
      // Look at context around first photo URL
      const firstUrlIndex = data.indexOf(photoUrlMatches[0]);
      const context = data.substring(
        Math.max(0, firstUrlIndex - 300),
        Math.min(data.length, firstUrlIndex + 300)
      );
      
      console.log('Context around first photo URL:');
      console.log('---');
      console.log(context);
      console.log('---\n');
    }
    
    // Look for JSON structures that might contain metadata
    console.log('=== LOOKING FOR JSON DATA STRUCTURES ===\n');
    
    // Search for array-like structures with numbers
    const jsonMatches = data.match(/\[\[.*?\]\]/g);
    if (jsonMatches) {
      console.log(`Found ${jsonMatches.length} potential JSON arrays`);
      const interesting = jsonMatches.filter(m => m.length < 500 && /\d+/.test(m));
      if (interesting.length > 0) {
        console.log('\nCompact JSON structures (likely to contain metadata):');
        interesting.slice(0, 3).forEach((m, i) => {
          console.log(`[${i+1}] ${m.substring(0, 150)}${m.length > 150 ? '...' : ''}`);
        });
      }
    }
    
    // Check for specific comment count patterns
    console.log('\n=== COMMENT COUNT PATTERNS ===\n');
    const commentCountPatterns = [
      /(\d+)\s+(?:comment|reply)/gi,
      /"(\d+)"[^}]*(?:comment|badge)/gi
    ];
    
    let foundCommentCounts = false;
    for (const pattern of commentCountPatterns) {
      const matches = data.match(pattern);
      if (matches) {
        console.log(`Found potential comment counts: ${matches.join(', ')}`);
        foundCommentCounts = true;
      }
    }
    
    if (!foundCommentCounts) {
      console.log('No obvious comment count patterns found in initial HTML');
      console.log('(Comment data may be loaded dynamically via JavaScript)');
    }
    
}).catch(err => {
  console.error('Error fetching URL:', err.message);
});
