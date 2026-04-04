const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://digimun.pro';
const TODAY = new Date().toISOString().split('T')[0];

const PRIVATE_PAGES = new Set([
  'signal.html', 'my-profile.html', 'my-tickets.html',
  'payment.html', 'payment-details.html', 'payment-submissions.html',
  'checkout.html', 'discount.html', 'discount-payment.html',
  'access-options.html', 'free-vip.html', 'paid-vip-portal.html',
  'free.html', 'oneday-access.html', 'threeday-access.html', 'sevenday-access.html',
  'digimunx-payment-portal.html', 'digimaxx.html', 'loss-pending.html', 'mxpanel49d.html',
  'verify.html', 'reset-password.html', 'time49.html', 'timecorrection.html',
  'timefix.html', 'login.html', 'signup.html',
  '404.html', 'google2477db8bd6d27e39.html',
  'sidebar.html', 'logo-animation-preview.html'
]);

const SKIP_DIRS = new Set(['node_modules', '.netlify', 'netlify', 'scripts', 'attached_assets', 'uploads', '.local', '.git', '.canvas', '.config', 'seo-data', 'digimunx']);

const URL_MAP = {};
const redirectsContent = fs.readFileSync(path.join(__dirname, '..', '_redirects'), 'utf-8');
redirectsContent.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const parts = line.split(/\s+/);
  if (parts.length >= 3 && parts[2] === '200') {
    if (parts[0].includes('*') || parts[0].endsWith('/')) return;
    URL_MAP[parts[1]] = parts[0];
  }
});

function getCleanUrl(filePath) {
  if (filePath === 'index.html') return '/';
  const rel = filePath.replace(/\\/g, '/');
  const htmlPath = '/' + rel;
  for (const [htmlTarget, cleanUrl] of Object.entries(URL_MAP)) {
    if (htmlTarget === htmlPath) return cleanUrl;
  }
  if (rel.startsWith('seo/')) {
    return '/' + rel.replace(/^seo\//, '').replace(/\.html$/, '');
  }
  return htmlPath.replace(/\.html$/, '');
}

function getPriority(urlPath) {
  if (urlPath === '/') return '1.0';
  if (urlPath === '/blog') return '0.90';
  if (['/binary-options-trading', '/ai-trading-signals', '/trading-bots', '/broker-reviews', '/trading-indicators', '/trading-strategies', '/risk-management'].includes(urlPath)) return '0.90';
  if (urlPath.startsWith('/blog/')) return '0.85';
  if (['/about', '/how-it-works', '/reviews', '/faq'].includes(urlPath)) return '0.80';
  if (['/pro-bot-details', '/future-signals-details', '/auto-hedger-details', '/DigimunX-details', '/digimax', '/future-signals', '/vip-groups-details'].includes(urlPath)) return '0.85';
  if (['/choose-platform', '/exnova', '/iq-option', '/other-brokers'].includes(urlPath)) return '0.75';
  if (['/team', '/connect', '/help', '/loss-recovery', '/digimunx-telegram', '/digimunxlive'].includes(urlPath)) return '0.70';
  if (['/login', '/signup'].includes(urlPath)) return '0.60';
  if (['/terms', '/privacy', '/rules', '/affiliate-agreement', '/refund', '/termsDigiMax', '/privacyDigiMax', '/faqDigiMax', '/lr-terms'].includes(urlPath)) return '0.40';
  if (['/affiliate', '/affiliate-offer'].includes(urlPath)) return '0.65';
  if (['/money-management', '/signal-rules', '/50-DigimunX'].includes(urlPath)) return '0.70';
  if (urlPath.startsWith('/binary-options-signals/') || urlPath.startsWith('/trading-bots/') || urlPath.startsWith('/best-trading-bot-for-')) return '0.80';
  if (urlPath.startsWith('/binary-options-strategy/') || urlPath.startsWith('/ai-trading-signals-for-') || urlPath.startsWith('/how-to-trade-') || urlPath.startsWith('/best-indicator-for-')) return '0.75';
  return '0.60';
}

function getChangeFreq(urlPath) {
  if (urlPath === '/' || urlPath === '/blog') return 'weekly';
  if (urlPath.startsWith('/blog/')) return 'monthly';
  if (['/reviews', '/pro-bot-details', '/future-signals-details', '/auto-hedger-details', '/digimax', '/future-signals', '/vip-groups-details', '/DigimunX-details'].includes(urlPath)) return 'weekly';
  if (['/binary-options-trading', '/ai-trading-signals', '/trading-bots', '/broker-reviews', '/trading-indicators', '/trading-strategies', '/risk-management'].includes(urlPath)) return 'weekly';
  if (urlPath.startsWith('/binary-options-signals/') || urlPath.startsWith('/trading-bots/') || urlPath.startsWith('/best-trading-bot-for-') || urlPath.startsWith('/binary-options-strategy/') || urlPath.startsWith('/ai-trading-signals-for-') || urlPath.startsWith('/how-to-trade-') || urlPath.startsWith('/best-indicator-for-')) return 'monthly';
  return 'monthly';
}

function scanHtmlFiles(dir, baseDir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        results.push(...scanHtmlFiles(fullPath, baseDir));
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      if (!PRIVATE_PAGES.has(entry.name)) {
        results.push(relPath);
      }
    }
  }
  return results;
}

const rootDir = path.join(__dirname, '..');
const htmlFiles = scanHtmlFiles(rootDir, rootDir);

const urls = [];
const seenUrls = new Set();

for (const file of htmlFiles) {
  const cleanUrl = getCleanUrl(file);
  const fullUrl = DOMAIN + cleanUrl;
  if (seenUrls.has(fullUrl)) continue;
  seenUrls.add(fullUrl);

  const stat = fs.statSync(path.join(rootDir, file));
  const lastmod = stat.mtime.toISOString().split('T')[0];

  urls.push({
    loc: fullUrl,
    lastmod,
    changefreq: getChangeFreq(cleanUrl),
    priority: getPriority(cleanUrl)
  });
}

urls.sort((a, b) => parseFloat(b.priority) - parseFloat(a.priority) || a.loc.localeCompare(b.loc));

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
for (const url of urls) {
  xml += '  <url>\n';
  xml += `    <loc>${url.loc}</loc>\n`;
  xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
  xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
  xml += `    <priority>${url.priority}</priority>\n`;
  xml += '  </url>\n';
}
xml += '</urlset>\n';

const outputPath = path.join(rootDir, 'sitemap.xml');
fs.writeFileSync(outputPath, xml);
console.log(`Sitemap generated with ${urls.length} URLs at ${outputPath}`);
