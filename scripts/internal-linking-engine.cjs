const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const KEYWORD_MAP = [
  { keywords: ['binary options trading', 'binary options guide'], url: '/binary-options-trading', title: 'Binary Options Trading Guide' },
  { keywords: ['ai trading signals', 'ai signals', 'ai-powered signals'], url: '/ai-trading-signals', title: 'AI Trading Signals Guide' },
  { keywords: ['trading bots', 'trading bot', 'signal bot'], url: '/trading-bots', title: 'Trading Bots Guide' },
  { keywords: ['broker reviews', 'broker comparison', 'best broker'], url: '/broker-reviews', title: 'Broker Reviews' },
  { keywords: ['trading indicators', 'technical indicators'], url: '/trading-indicators', title: 'Trading Indicators Guide' },
  { keywords: ['trading strategies', 'trading strategy'], url: '/trading-strategies', title: 'Trading Strategies Guide' },
  { keywords: ['risk management', 'money management'], url: '/risk-management', title: 'Risk Management Guide' }
];

const PRIVATE_PATTERNS = [
  'dashboard', 'checkout', 'payment', 'my-tickets', 'free-vip', 'paid-vip',
  'admin', 'profile', 'oneday-access', 'threeday-access', 'sevenday-access',
  'loss-recovery', 'loss-pending', 'reset-password', 'verify', 'mxpanel',
  'digimunx-payment', 'discount', 'access-options', 'login', 'signup'
];

function isPrivate(filePath) {
  const name = path.basename(filePath, '.html');
  return PRIVATE_PATTERNS.some(p => name.includes(p));
}

const SKIP_DIRS = new Set([
  'node_modules', '.netlify', 'netlify', 'scripts', 'attached_assets',
  'uploads', '.local', '.git', '.canvas', '.config', 'seo-data',
  'assets', 'digimunx'
]);

function getPublicHtmlFiles() {
  const files = [];

  const rootEntries = fs.readdirSync(ROOT, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(path.join(ROOT, entry.name));
    }
  }

  const scanDirs = ['blog', 'seo'];
  for (const dir of scanDirs) {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const f of fs.readdirSync(dirPath)) {
      const fullPath = path.join(dirPath, f);
      if (f.endsWith('.html')) {
        files.push(fullPath);
      } else if (fs.statSync(fullPath).isDirectory()) {
        for (const sub of fs.readdirSync(fullPath)) {
          if (sub.endsWith('.html')) {
            files.push(path.join(fullPath, sub));
          }
        }
      }
    }
  }

  return files.filter(f => !isPrivate(f));
}

function getCleanUrl(filePath) {
  const rel = path.relative(ROOT, filePath);
  if (rel.startsWith('blog/')) return '/' + rel.replace('.html', '');
  if (rel.startsWith('seo/')) {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo', 'manifest.json'), 'utf-8'));
    const seoRel = rel.replace(/\\/g, '/');
    const match = manifest.pages.find(p => p.file === seoRel);
    return match ? match.url : '/' + rel.replace('.html', '');
  }
  return '/' + rel.replace('.html', '');
}

function insertLinks(html, currentUrl) {
  const bodyMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    || html.match(/<div class="article-body">([\s\S]*?)<\/div>/i);

  if (!bodyMatch) return { html, insertedCount: 0 };

  let body = bodyMatch[0];
  let insertedCount = 0;
  const maxLinks = 3;

  for (const entry of KEYWORD_MAP) {
    if (insertedCount >= maxLinks) break;
    if (entry.url === currentUrl) continue;

    for (const keyword of entry.keywords) {
      if (insertedCount >= maxLinks) break;

      const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<![">\/])\\b(${escapedKw})\\b(?![^<]*<\/a>)(?![^<]*href)`, 'i');

      if (regex.test(body)) {
        body = body.replace(regex, `<a href="${entry.url}" title="${entry.title}">$1</a>`);
        insertedCount++;
        break;
      }
    }
  }

  if (insertedCount > 0) {
    html = html.replace(bodyMatch[0], body);
  }

  return { html, insertedCount };
}

const files = getPublicHtmlFiles();
let totalInserted = 0;
let modifiedFiles = 0;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf-8');
  const currentUrl = getCleanUrl(file);
  const { html: newHtml, insertedCount } = insertLinks(html, currentUrl);

  if (insertedCount > 0) {
    fs.writeFileSync(file, newHtml);
    totalInserted += insertedCount;
    modifiedFiles++;
  }
}

console.log(`Internal linking engine: inserted ${totalInserted} contextual links across ${modifiedFiles} files`);
console.log(`Scanned ${files.length} public HTML files`);
