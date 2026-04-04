const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://digimun.pro';
const OUTPUT_DIR = path.join(__dirname, '..', 'seo');
const DATA_DIR = path.join(__dirname, '..', 'seo-data');

const pillars = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pillars.json'), 'utf-8'));

let manifest = { generated: '', pages: [] };
const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildArticleSchema(pillar) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": pillar.h1,
    "description": pillar.metaDesc,
    "url": `${DOMAIN}/${pillar.slug}`,
    "datePublished": "2026-04-03",
    "dateModified": "2026-04-03",
    "author": { "@type": "Organization", "name": "Digimun Pro", "url": DOMAIN },
    "publisher": { "@type": "Organization", "name": "Digimun Pro", "logo": { "@type": "ImageObject", "url": `${DOMAIN}/assets/digimun-logo.png` } },
    "mainEntityOfPage": { "@type": "WebPage", "@id": `${DOMAIN}/${pillar.slug}` },
    "image": `${DOMAIN}/assets/digimun-og-preview.png`,
    "articleSection": "Trading Education",
    "wordCount": 3000
  });
}

function buildFaqSchema(faqs) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": { "@type": "Answer", "text": faq.a }
    }))
  });
}

function buildBreadcrumbSchema(pillar) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${DOMAIN}/` },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": `${DOMAIN}/blog` },
      { "@type": "ListItem", "position": 3, "name": pillar.h1, "item": `${DOMAIN}/${pillar.slug}` }
    ]
  });
}

function getSeoPageLinks(pillar) {
  const links = [];
  const seoPages = manifest.pages || [];
  for (const pattern of pillar.seoPatterns) {
    for (const page of seoPages) {
      if (page.url.includes(pattern)) {
        links.push(page);
      }
    }
  }
  return links;
}

function buildToc(sections) {
  let html = '<nav class="toc">\n<h2>Table of Contents</h2>\n<ol>\n';
  for (const s of sections) {
    const id = s.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    html += `  <li><a href="#${id}">${escapeHtml(s.heading)}</a></li>\n`;
  }
  html += '  <li><a href="#faq">Frequently Asked Questions</a></li>\n';
  html += '</ol>\n</nav>';
  return html;
}

function buildSections(sections) {
  let html = '';
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const id = s.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    html += `\n<section class="pillar-section" id="${id}">\n`;
    html += `  <h2>${escapeHtml(s.heading)}</h2>\n`;

    const sentences = s.content.split(/(?<=\.)\s+/);
    const mid = Math.ceil(sentences.length / 2);
    const intro = sentences.slice(0, mid).join(' ');
    const detail = sentences.slice(mid).join(' ');

    html += `  <h3>Overview</h3>\n`;
    html += `  <p>${intro}</p>\n`;
    if (detail) {
      html += `  <h3>Key Details</h3>\n`;
      html += `  <p>${detail}</p>\n`;
    }
    html += `  <h4>Why This Matters for Traders</h4>\n`;
    html += `  <p>Understanding ${escapeHtml(s.heading.toLowerCase())} is essential for developing a disciplined, profitable approach to binary options trading. Apply these concepts consistently for the best results.</p>\n`;

    html += `</section>\n`;
  }
  return html;
}

function buildClusterLinks(pillar) {
  const seoLinks = getSeoPageLinks(pillar);
  let html = '<section class="cluster-links">\n<div class="container">\n';
  html += '<h2>Topic Cluster: Related Guides & Resources</h2>\n';

  if (pillar.blogArticles.length > 0) {
    html += '<h3>Blog Articles</h3>\n<div class="link-grid">\n';
    for (const a of pillar.blogArticles) {
      html += `<a href="${a.url}" class="link-card"><span class="link-icon">📝</span><span>${escapeHtml(a.title)}</span></a>\n`;
    }
    html += '</div>\n';
  }

  if (seoLinks.length > 0) {
    html += '<h3>In-Depth Guides</h3>\n<div class="link-grid">\n';
    for (const p of seoLinks) {
      html += `<a href="${p.url}" class="link-card"><span class="link-icon">📊</span><span>${escapeHtml(p.title)}</span></a>\n`;
    }
    html += '</div>\n';
  }

  if (pillar.productLinks.length > 0) {
    html += '<h3>Trading Tools</h3>\n<div class="link-grid">\n';
    for (const p of pillar.productLinks) {
      html += `<a href="${p.url}" class="link-card"><span class="link-icon">🛠️</span><span>${escapeHtml(p.title)}</span></a>\n`;
    }
    html += '</div>\n';
  }

  html += '</div>\n</section>';
  return html;
}

function buildAuthoritySection() {
  return `
<section class="authority-section">
  <div class="container">
    <h2>Why Traders Trust Digimun Pro</h2>
    <div class="authority-grid">
      <div class="authority-card">
        <div class="authority-icon">👥</div>
        <div class="authority-stat">10,000+</div>
        <div class="authority-label">Active Traders</div>
        <p>Join a growing community of binary options traders using AI signals daily.</p>
      </div>
      <div class="authority-card">
        <div class="authority-icon">⭐</div>
        <div class="authority-stat">4.8/5</div>
        <div class="authority-label">Average Rating</div>
        <p>Verified reviews from real traders across multiple broker platforms.</p>
      </div>
      <div class="authority-card">
        <div class="authority-icon">📈</div>
        <div class="authority-stat">5 Markets</div>
        <div class="authority-label">Full Coverage</div>
        <p>Signals for Live, OTC, Crypto, Commodities, and Stock markets.</p>
      </div>
      <div class="authority-card">
        <div class="authority-icon">🤖</div>
        <div class="authority-stat">24/7</div>
        <div class="authority-label">Signal Availability</div>
        <p>Round-the-clock coverage including OTC markets on weekends.</p>
      </div>
    </div>
    <div class="authority-cta">
      <a href="/reviews" class="link-card"><span class="link-icon">⭐</span><span>Read Trader Reviews</span></a>
    </div>
  </div>
</section>`;
}

function buildPillarPage(pillar) {
  const canonicalUrl = `${DOMAIN}/${pillar.slug}`;
  const faqHtml = pillar.faqs.map(f => `
    <div class="faq-item">
      <button class="faq-question">${escapeHtml(f.q)}<span class="faq-toggle">+</span></button>
      <div class="faq-answer"><p>${f.a}</p></div>
    </div>`).join('\n');

  const otherPillars = pillars.filter(p => p.slug !== pillar.slug);
  const pillarNav = otherPillars.map(p =>
    `<a href="/${p.slug}" class="pillar-nav-link">${escapeHtml(p.h1.split(':')[0])}</a>`
  ).join('\n        ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pillar.title)}</title>
  <meta name="description" content="${escapeHtml(pillar.metaDesc)}">
  <meta name="keywords" content="${escapeHtml(pillar.keywords)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(pillar.title)}">
  <meta property="og:description" content="${escapeHtml(pillar.metaDesc)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="article">
  <meta property="og:image" content="${DOMAIN}/assets/digimun-og-preview.png">
  <script type="application/ld+json">
  ${buildArticleSchema(pillar)}
  </script>
  <script type="application/ld+json">
  ${buildFaqSchema(pillar.faqs)}
  </script>
  <script type="application/ld+json">
  ${buildBreadcrumbSchema(pillar)}
  </script>
  <link rel="icon" type="image/png" href="/assets/digimun-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/seo/seo-page.css">
</head>
<body>

<nav class="top-nav">
  <div class="nav-inner">
    <a href="/" class="logo-link">
      <img src="/assets/digimun-logo.png" alt="Digimun Pro">
      <span class="brand-text">Digimun Pro</span>
    </a>
    <div class="nav-right">
      <a href="/blog" class="nav-btn">Blog</a>
      <a href="/signup" class="nav-btn nav-btn-accent">Get Started</a>
    </div>
  </div>
</nav>

<div class="breadcrumb">
  <div class="container">
    <a href="/">Home</a><span class="sep">›</span>
    <a href="/blog">Blog</a><span class="sep">›</span>
    <span class="current">${escapeHtml(pillar.h1.split(':')[0])}</span>
  </div>
</div>

<header class="hero pillar-hero">
  <div class="container">
    <div class="pillar-badge">Comprehensive Guide</div>
    <h1>${escapeHtml(pillar.h1)}</h1>
    <p class="pillar-overview">${pillar.overview}</p>
  </div>
</header>

<main class="content pillar-content">
  <div class="container">
    ${buildToc(pillar.sections)}
    ${buildSections(pillar.sections)}
  </div>
</main>

<section class="faq-section" id="faq">
  <div class="container">
    <h2>Frequently Asked Questions</h2>
    <div class="faq-list">
      ${faqHtml}
    </div>
  </div>
</section>

${buildAuthoritySection()}

${buildClusterLinks(pillar)}

<section class="pillar-nav-section">
  <div class="container">
    <h3>Explore More Topics</h3>
    <div class="pillar-nav-grid">
      ${pillarNav}
    </div>
  </div>
</section>

<section class="cta-section">
  <div class="container">
    <div class="cta-card">
      <h2>Start Trading with AI-Powered Signals</h2>
      <p>Join 10,000+ traders using Digimun Pro's free AI signals for smarter binary options trading.</p>
      <div class="cta-buttons">
        <a href="/signup" class="cta-btn primary">Create Free Account</a>
        <a href="/connect" class="cta-btn secondary">Join Telegram</a>
      </div>
    </div>
  </div>
</section>

<footer class="footer">
  <div class="container">
    <p>&copy; 2026 <a href="/">Digimun Pro</a>. All rights reserved. Trading involves risk. This is not financial advice.</p>
  </div>
</footer>

<script>
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    item.classList.toggle('open');
    btn.querySelector('.faq-toggle').textContent = item.classList.contains('open') ? '−' : '+';
  });
});
</script>

</body>
</html>`;
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const pillarPages = [];
for (const pillar of pillars) {
  const html = buildPillarPage(pillar);
  const filePath = path.join(OUTPUT_DIR, `${pillar.slug}.html`);
  fs.writeFileSync(filePath, html);
  pillarPages.push({
    url: `/${pillar.slug}`,
    title: pillar.h1,
    file: `seo/${pillar.slug}.html`,
    type: 'pillar'
  });
}

manifest.pages = manifest.pages.filter(p => p.type !== 'pillar');
manifest.pages.push(...pillarPages);
manifest.generated = new Date().toISOString();
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`Generated ${pillarPages.length} pillar pages`);
pillarPages.forEach(p => console.log(`  - ${p.url}: ${p.title}`));
