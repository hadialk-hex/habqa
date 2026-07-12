const fs = require('fs');
const path = require('path');

const FORBIDDEN_KEYWORDS = ['purple', 'violet', 'indigo', 'pink', 'rose', 'fuchsia'];
const TARGET_DIR = path.resolve(__dirname, '../../frontend/src');

// Exclude certain false positives or standard library imports if necessary,
// but keep it strict. For example, if a file has a name containing "rose",
// we should inspect it.
const FILE_EXTENSIONS = ['.tsx', '.ts', '.css', '.js', '.jsx'];

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (stat.isFile()) {
      if (FILE_EXTENSIONS.includes(path.extname(fullPath).toLowerCase())) {
        callback(fullPath);
      }
    }
  }
}

console.log(`Scanning directory: ${TARGET_DIR}`);
console.log(`Forbidden keywords: ${FORBIDDEN_KEYWORDS.join(', ')}\n`);

let totalMatches = 0;
const results = [];

walkDir(TARGET_DIR, (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(path.resolve(__dirname, '../../'), filePath);
  
  lines.forEach((line, index) => {
    // Check each keyword
    FORBIDDEN_KEYWORDS.forEach((keyword) => {
      // Look for Tailwind patterns like: [bg|text|border|ring|decoration|from|to|via|outline|divide|accent|shadow|placeholder|fill|stroke]-[keyword]
      // Or just a general match where the word is used in Tailwind class names.
      // A safe way is to find word boundaries or exact substrings. Let's do a case-insensitive search.
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes(keyword)) {
        // Special case: we might have 'chart-5' configured with '--chart-5: #f43f5e; /* Rose */' in globals.css
        // Let's print it anyway, but mark it if it's a CSS variable comment or if it's actually a Tailwind class.
        // We will output all matches so we can verify manually.
        results.push({
          file: relativePath,
          line: index + 1,
          keyword: keyword,
          content: line.trim()
        });
        totalMatches++;
      }
    });
  });
});

if (results.length === 0) {
  console.log('SUCCESS: No purple-adjacent or violet-adjacent Tailwind color keywords found in frontend/src.');
} else {
  console.log(`FOUND ${totalMatches} instances of forbidden color keywords:`);
  results.forEach((res) => {
    console.log(`[${res.file}:${res.line}] Found '${res.keyword}': ${res.content}`);
  });
}
