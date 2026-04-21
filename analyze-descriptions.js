import https from 'https';

const url = 'https://photos.app.goo.gl/6DcTzVZopm7zqdcK9';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Referer': 'https://photos.google.com/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const fetchWithRedirects = async (urlStr) => {
  return new Promise((resolve, reject) => {
    const makeRequest = (currentUrl) => {
      https.get(currentUrl, { headers }, (res) => {
        let data = '';
        
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
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
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   DESCRIPTION DATA EXTRACTION TEST    ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    console.log(`📊 HTML Content Length: ${(data.length / 1024).toFixed(2)} KB\n`);
    
    // Search for description-related keywords
    console.log('═══ 1️⃣  DESCRIPTION-RELATED KEYWORDS ═══\n');
    
    const descriptionKeywords = [
        { name: 'description', pattern: /"description["\w:]*[:=]/gi },
        { name: 'caption', pattern: /"caption["\w:]*[:=]/gi },
        { name: 'alt text', pattern: /"alt["\w:]*[:=]/gi },
        { name: 'text content', pattern: /"text["\w:]*[:=]/gi },
        { name: 'title', pattern: /"title["\w:]*[:=]/gi },
        { name: 'note', pattern: /"note["\w:]*[:=]/gi },
        { name: 'metadata', pattern: /"metadata["\w:]*[:=]/gi },
    ];
    
    let foundDescriptionData = false;
    for (const {name, pattern} of descriptionKeywords) {
        const matches = data.match(pattern);
        if (matches) {
            console.log(`✅ Found "${name}" (${matches.length} occurrences)`);
            foundDescriptionData = true;
        }
    }
    
    if (!foundDescriptionData) {
        console.log('❌ No description-related JSON keys found');
    }
    
    // Look for any text strings that might be descriptions
    console.log('\n═══ 2️⃣  SEARCHING FOR LONG TEXT STRINGS ═══\n');
    
    // Match quoted strings longer than 50 characters
    const longStrings = data.match(/"([^"]{50,200})"/g);
    
    if (longStrings) {
        const textStrings = longStrings
            .map(s => s.slice(1, -1))  // Remove quotes
            .filter(s => 
                !s.includes('http') &&           // Skip URLs
                !s.includes('.com') &&           // Skip domain strings
                !s.match(/^[0-9\-\.:/]+$/) &&    // Skip timestamps/paths
                s.match(/[a-z]{3,}/i)            // Has actual words
            )
            .slice(0, 10);
        
        if (textStrings.length > 0) {
            console.log(`Found ${longStrings.length} long text strings. Examples:\n`);
            textStrings.forEach((str, i) => {
                console.log(`  [${i+1}] "${str.substring(0, 100)}${str.length > 100 ? '...' : ''}"`);
            });
        }
    } else {
        console.log('❌ No long text strings found');
    }
    
    // Look for photo URLs + adjacent metadata
    console.log('\n═══ 3️⃣  PHOTO URLS + ADJACENT DATA ═══\n');
    
    const photoUrls = data.match(/https:\/\/lh\d+\.googleusercontent\.com\/[a-zA-Z0-9_\-/]+/g);
    
    if (photoUrls && photoUrls.length > 0) {
        console.log(`✅ Found ${photoUrls.length} photo URLs\n`);
        
        // For each URL, look at what comes before and after
        console.log('Analyzing first 3 photo URLs and their context:\n');
        
        for (let i = 0; i < Math.min(3, photoUrls.length); i++) {
            const url = photoUrls[i];
            const idx = data.indexOf(url);
            
            const before = data.substring(Math.max(0, idx - 300), idx);
            const after = data.substring(idx + url.length, Math.min(data.length, idx + url.length + 300));
            
            console.log(`  [Photo ${i+1}]`);
            
            // Look for JSON-like patterns around the URL
            const beforeMatch = before.match(/([a-zA-Z_"]+[":]\s*["']?[^"]*["']?)/g);
            const afterMatch = after.match(/([a-zA-Z_"]+[":]\s*["']?[^"]*["']?)/g);
            
            if (beforeMatch) {
                console.log(`    Before: ${beforeMatch.slice(-2).join(', ')}`);
            }
            if (afterMatch) {
                console.log(`    After: ${afterMatch.slice(0, 3).join(', ')}`);
            }
            console.log('');
        }
    }
    
    // Check if there are any arrays with photo data that might contain descriptions
    console.log('═══ 4️⃣  STRUCTURED PHOTO DATA ANALYSIS ═══\n');
    
    // Look for arrays with multiple fields: [photoId, url, description?, ...]
    const photoDataPatterns = [
        /\[\["?[a-zA-Z0-9_\-]{10,}"?,"https:\/\/[^"]*","[^"]*"\]/g,  // [id, url, text]
        /\["https:\/\/lh[^"]*","[^"]*"\]/g,  // [url, text]
    ];
    
    let foundStructuredData = false;
    for (const pattern of photoDataPatterns) {
        const matches = data.match(pattern);
        if (matches) {
            console.log(`✅ Found structured arrays: ${matches.length} matches\n`);
            console.log('First 2 examples:');
            matches.slice(0, 2).forEach((m, i) => {
                console.log(`  [${i+1}] ${m.substring(0, 150)}${m.length > 150 ? '...' : ''}`);
            });
            foundStructuredData = true;
        }
    }
    
    if (!foundStructuredData) {
        console.log('❌ No structured data arrays with text content found');
    }
    
    // Final verdict
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║            DESCRIPTION VERDICT         ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    if (foundDescriptionData) {
        console.log('✅ PROMISING: Description keys found in HTML');
        console.log('   Next step: Inspect structure to extract values\n');
    } else if (foundStructuredData) {
        console.log('🟡 PARTIAL: Structured data found, may contain descriptions');
        console.log('   Next step: Parse arrays to find text fields\n');
    } else {
        console.log('❌ SAME AS COMMENTS: Descriptions likely loaded dynamically via JavaScript');
        console.log('   Descriptions = Same difficulty as comments\n');
    }
    
    console.log('💡 CONCLUSION:');
    console.log('   - Descriptions are likely part of the same dynamic data load');
    console.log('   - If comments aren\'t in HTML, descriptions probably aren\'t either');
    console.log('   - Both would require headless browser + JS execution\n');
    
}).catch(err => {
  console.error('❌ Error:', err.message);
});
