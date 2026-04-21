import https from 'https';
import fs from 'fs';

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
        
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log(`📍 Redirecting: ${res.statusCode} -> ${res.headers.location.substring(0, 80)}...`);
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
    console.log('║   GOOGLE PHOTOS ALBUM ANALYSIS        ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    console.log(`📊 HTML Content Length: ${(data.length / 1024).toFixed(2)} KB\n`);
    
    // Strategy 1: Look for nested arrays with numeric values (Google's typical data structure)
    console.log('═══ 1️⃣  SEARCHING FOR STRUCTURED PHOTO DATA ═══\n');
    
    // Google often embeds photo data like: [["id1","url1",0],["id2","url2",1],...]
    // The numbers could be metadata (comments, reactions, etc)
    const photoDataArrays = data.match(/\[\["[a-zA-Z0-9_\-\/:\.]+","https:\/\/[^"]*",[0-9,\[\]"]*?\]/g);
    
    if (photoDataArrays && photoDataArrays.length > 0) {
        console.log(`✅ Found ${photoDataArrays.length} photo data structures!\n`);
        console.log('First 3 structures:');
        photoDataArrays.slice(0, 3).forEach((arr, idx) => {
            console.log(`  [${idx+1}] ${arr.substring(0, 140)}${arr.length > 140 ? '...' : ''}`);
        });
        
        // Extract and analyze the numeric patterns
        console.log('\n📊 Analyzing numeric patterns in photo data:');
        const allNumbers = [];
        photoDataArrays.forEach(arr => {
            const nums = arr.match(/,(\d+)(?:[,\]\}])/g);
            if (nums) {
                nums.forEach(n => {
                    const num = parseInt(n.match(/\d+/)[0]);
                    if (num < 100) allNumbers.push(num);  // Likely comment counts
                });
            }
        });
        
        if (allNumbers.length > 0) {
            const numberFrequency = {};
            allNumbers.forEach(n => {
                numberFrequency[n] = (numberFrequency[n] || 0) + 1;
            });
            
            const sorted = Object.entries(numberFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            
            console.log('\n  Number frequencies (potential comment counts):');
            sorted.forEach(([num, freq]) => {
                console.log(`    "${num}": appears ${freq} times`);
            });
        }
    } else {
        console.log('❌ No structured photo arrays found with this pattern\n');
    }
    
    // Strategy 2: Look for comment-related metadata
    console.log('\n═══ 2️⃣  SEARCHING FOR COMMENT METADATA ═══\n');
    
    const commentKeywords = [
        { name: 'comment', pattern: /"comment["\w:]*[":]/gi },
        { name: 'commentCount', pattern: /"commentCount[":]/gi },
        { name: 'replyCount', pattern: /"replyCount[":]/gi },
        { name: 'interactionCount', pattern: /"interactionCount[":]/gi },
        { name: 'responseCount', pattern: /"responseCount[":]/gi },
        { name: 'badge', pattern: /"badge["\w:]*[":]/gi },
    ];
    
    let foundCommentMetadata = false;
    for (const {name, pattern} of commentKeywords) {
        const matches = data.match(pattern);
        if (matches) {
            console.log(`✅ Found "${name}" (${matches.length} occurrences)`);
            foundCommentMetadata = true;
        }
    }
    
    if (!foundCommentMetadata) {
        console.log('❌ No comment-related keys found in standard format');
    }
    
    // Strategy 3: Extract actual photo URLs and look at their context
    console.log('\n═══ 3️⃣  ANALYZING PHOTO URL CONTEXT ═══\n');
    
    const photoUrls = data.match(/https:\/\/lh\d+\.googleusercontent\.com\/[a-zA-Z0-9_\-/]+/g);
    
    if (photoUrls && photoUrls.length > 0) {
        console.log(`✅ Found ${photoUrls.length} photo URLs\n`);
        
        // Get context around first URL
        const firstUrl = photoUrls[0];
        const idx = data.indexOf(firstUrl);
        const contextStart = Math.max(0, idx - 200);
        const contextEnd = Math.min(data.length, idx + 200);
        const context = data.substring(contextStart, contextEnd);
        
        console.log('Context around first photo URL (before + after):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Highlight the URL
        const highlighted = context
            .replace(firstUrl, `🔗 ${firstUrl}`)
            .replace(/[\u0000-\u001F]/g, ' ');  // Remove control characters
        
        console.log(highlighted);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Look for numbers immediately after URL (could be comment count)
        const afterUrl = data.substring(idx + firstUrl.length, idx + firstUrl.length + 100);
        const numbers = afterUrl.match(/(\d+)/g);
        
        if (numbers) {
            console.log(`Numbers found right after URL: ${numbers.slice(0, 5).join(', ')}`);
            console.log('(These could represent comment counts or other indicators)\n');
        }
    }
    
    // Strategy 4: Search for "comment" context
    console.log('═══ 4️⃣  CHECKING FOR "COMMENT" MENTIONS ═══\n');
    
    const commentIndex = data.toLowerCase().indexOf('comment');
    if (commentIndex >= 0) {
        const beforeComment = data.substring(Math.max(0, commentIndex - 150), commentIndex);
        const afterComment = data.substring(commentIndex, Math.min(data.length, commentIndex + 150));
        
        console.log('✅ Found "comment" keyword!\n');
        console.log('Context:');
        console.log(beforeComment + `🔍[COMMENT]${afterComment}`.substring(0, 150));
    } else {
        console.log('❌ "comment" keyword not found in initial HTML');
        console.log('   (May be loaded dynamically via JavaScript)\n');
    }
    
    // Final Assessment
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║            FINAL ASSESSMENT            ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    if (photoUrls && photoUrls.length > 0) {
        console.log('✅ Photo URLs are in the HTML');
        console.log('❓ Comment counts may be embedded as numeric values in data structures');
        console.log('❓ Need to inspect actual data structure to confirm comment indicators\n');
        console.log('💡 NEXT STEP: Use browser DevTools → Network tab to see what data Google loads');
        console.log('             when the page renders the photo grid with comment badges');
    }
    
}).catch(err => {
  console.error('❌ Error:', err.message);
});
