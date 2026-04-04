const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['node_modules', '.netlify', 'netlify', '.local', '.git', '.canvas', '.config', 'attached_assets']);

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  const imgRegex = /<img\b([^>]*?)>/gi;
  content = content.replace(imgRegex, (match, attrs) => {
    if (/loading\s*=/i.test(attrs)) return match;
    
    if (/class\s*=\s*["'][^"']*logo[^"']*["']/i.test(attrs) ||
        /class\s*=\s*["'][^"']*nav[^"']*["']/i.test(attrs) ||
        /alt\s*=\s*["'][^"']*logo[^"']*["']/i.test(attrs)) {
      return match;
    }
    
    changed = true;
    return `<img loading="lazy"${attrs}>`;
  });

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
  }
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        scanDir(path.join(dir, entry.name));
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      processFile(path.join(dir, entry.name));
    }
  }
}

const rootDir = path.join(__dirname, '..');
scanDir(rootDir);
console.log('Image optimization complete.');
