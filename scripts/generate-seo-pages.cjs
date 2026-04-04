const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://digimun.pro';
const OUTPUT_DIR = path.join(__dirname, '..', 'seo');
const DATA_DIR = path.join(__dirname, '..', 'seo-data');

const brokers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'brokers.json'), 'utf-8'));
const assets = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'assets.json'), 'utf-8'));
const indicators = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'indicators.json'), 'utf-8'));
const markets = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'markets.json'), 'utf-8'));

const blogLinks = [
  { url: '/blog/best-binary-options-strategy-beginners', title: 'Best Binary Options Strategy for Beginners' },
  { url: '/blog/how-ai-trading-signals-work', title: 'How AI Trading Signals Work' },
  { url: '/blog/quotex-trading-tips', title: 'Quotex Trading Tips: 10 Proven Ways to Win' },
  { url: '/blog/money-management-binary-options', title: 'Money Management for Binary Options' },
  { url: '/blog/otc-trading-guide', title: 'OTC Trading Guide: Trade 24/7' },
  { url: '/blog/candlestick-patterns-1-minute', title: 'Candlestick Patterns for 1-Minute Trading' },
  { url: '/blog/technical-indicators-beginners', title: 'Top 5 Technical Indicators for Beginners' },
  { url: '/blog/fibonacci-retracement-trading', title: 'Fibonacci Retracement in Binary Options' },
  { url: '/blog/trading-psychology-emotions', title: 'Trading Psychology: Control Your Emotions' },
  { url: '/blog/best-forex-pairs-binary-options', title: 'Best Forex Pairs for Binary Options' },
  { url: '/blog/risk-management-volatile-markets', title: 'Risk Management in Volatile Markets' },
  { url: '/blog/best-trading-sessions-hours', title: 'Best Trading Sessions & Hours' },
  { url: '/blog/how-to-read-trading-charts', title: 'How to Read Trading Charts' }
];

const productLinks = [
  { url: '/pro-bot-details', title: 'Digimun Pro Bot - Live Trading Signals' },
  { url: '/digimaxx', title: 'DigiMaxx - Premium Multi-Market Signals' },
  { url: '/DigimunX-details', title: 'DigimunX AI Chart Analyzer' },
  { url: '/auto-hedger-details', title: 'Auto Hedger - Automated Trade Execution' },
  { url: '/future-signals-details', title: 'Future Signals - Pre-Scheduled Signals' },
  { url: '/money-management', title: 'Money Management Calculator' },
  { url: '/choose-platform', title: 'Choose Your Trading Platform' }
];

function itemHash(seed, str) {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h & 0x7fffffff;
}

function pickStable(arr, n, seed) {
  if (arr.length <= n) return [...arr];
  let seedHash = 0;
  for (let i = 0; i < seed.length; i++) {
    seedHash = ((seedHash << 5) - seedHash) + seed.charCodeAt(i);
    seedHash |= 0;
  }
  const sorted = [...arr].sort((a, b) => {
    const ha = itemHash(seedHash, a.url || a.title || '');
    const hb = itemHash(seedHash, b.url || b.title || '');
    return ha - hb;
  });
  return sorted.slice(0, n);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildInternalLinks(currentUrl, relatedSeoUrls) {
  const blogs = pickStable(blogLinks.filter(b => b.url !== currentUrl), 3, currentUrl + 'blog');
  const products = pickStable(productLinks, 3, currentUrl + 'prod');
  const seoPages = pickStable(relatedSeoUrls.filter(u => u.url !== currentUrl), 4, currentUrl + 'seo');

  let html = '<section class="internal-links">\n<div class="container">\n';
  
  if (seoPages.length > 0) {
    html += '<h3>Related Guides</h3>\n<div class="link-grid">\n';
    for (const p of seoPages) {
      html += `<a href="${p.url}" class="link-card"><span class="link-icon">📊</span><span>${escapeHtml(p.title)}</span></a>\n`;
    }
    html += '</div>\n';
  }

  html += '<h3>From Our Blog</h3>\n<div class="link-grid">\n';
  for (const b of blogs) {
    html += `<a href="${b.url}" class="link-card"><span class="link-icon">📝</span><span>${escapeHtml(b.title)}</span></a>\n`;
  }
  html += '</div>\n';

  html += '<h3>Our Trading Tools</h3>\n<div class="link-grid">\n';
  for (const p of products) {
    html += `<a href="${p.url}" class="link-card"><span class="link-icon">🛠️</span><span>${escapeHtml(p.title)}</span></a>\n`;
  }
  html += '</div>\n</div>\n</section>';
  return html;
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

function buildBreadcrumbSchema(crumbs) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": crumbs.map((c, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": c.name,
      "item": c.url
    }))
  });
}

function buildPage({ title, metaDesc, keywords, canonicalPath, breadcrumbs, h1, content, faqs, internalLinksHtml }) {
  const canonicalUrl = DOMAIN + canonicalPath;
  const faqHtml = faqs.map(f => `
    <div class="faq-item">
      <button class="faq-question">${escapeHtml(f.q)}<span class="faq-toggle">+</span></button>
      <div class="faq-answer"><p>${f.a}</p></div>
    </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(metaDesc)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${DOMAIN}/assets/digimun-og-preview.png">
  <script type="application/ld+json">
  ${buildBreadcrumbSchema(breadcrumbs)}
  </script>
  <script type="application/ld+json">
  ${buildFaqSchema(faqs)}
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
    ${breadcrumbs.map((c, i) => i < breadcrumbs.length - 1 ? `<a href="${c.url}">${escapeHtml(c.name)}</a><span class="sep">›</span>` : `<span class="current">${escapeHtml(c.name)}</span>`).join('\n    ')}
  </div>
</div>

<header class="hero">
  <div class="container">
    <h1>${h1}</h1>
  </div>
</header>

<main class="content">
  <div class="container">
    ${content}
  </div>
</main>

<section class="faq-section">
  <div class="container">
    <h2>Frequently Asked Questions</h2>
    <div class="faq-list">
      ${faqHtml}
    </div>
  </div>
</section>

${internalLinksHtml}

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
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});
</script>

</body>
</html>`;
}

const allGeneratedPages = [];

function generateBrokerSignalPages() {
  for (const broker of brokers) {
    const slug = `binary-options-signals/${broker.slug}`;
    const url = `/${slug}`;
    const title = `${broker.name} Binary Options Signals | Free AI Trading Signals - Digimun Pro`;
    const h1 = `${broker.name} Binary Options Signals`;

    const relatedUrls = brokers.filter(b => b.slug !== broker.slug).map(b => ({
      url: `/binary-options-signals/${b.slug}`, title: `${b.name} Binary Options Signals`
    })).concat(brokers.map(b => ({
      url: `/trading-bots/${b.slug}`, title: `${b.name} Trading Bots`
    })));

    const content = `
    <p class="lead">${broker.description} With Digimun Pro, you can access free AI-powered trading signals optimized for ${broker.name}, helping you make smarter CALL/PUT decisions in real-time.</p>

    <h2>Why Use AI Signals on ${broker.name}?</h2>
    <p>Manual chart analysis takes years to master. AI trading signals use advanced algorithms and pattern recognition to analyze market data in milliseconds, generating high-probability CALL and PUT signals that you can follow directly on ${broker.name}.</p>
    <ul>
      <li><strong>Real-time analysis</strong> — Signals generated instantly from live market data</li>
      <li><strong>Multiple markets</strong> — Signals for ${broker.markets.join(', ')}</li>
      <li><strong>Beginner-friendly</strong> — No technical analysis knowledge required</li>
      <li><strong>AI-powered accuracy</strong> — Pattern recognition trained on thousands of historical trades</li>
    </ul>

    <h2>How to Use Signals on ${broker.name}</h2>
    <ol>
      <li>Create your free ${broker.name} account (minimum deposit: ${broker.minDeposit})</li>
      <li>Sign up on Digimun Pro to access the signal dashboard</li>
      <li>Select your preferred market and timeframe</li>
      <li>Follow the AI-generated CALL/PUT signals on ${broker.name}</li>
      <li>Apply proper money management (1-3% risk per trade)</li>
    </ol>

    <h2>${broker.name} Platform Features</h2>
    <div class="feature-grid">
      ${broker.features.map(f => `<div class="feature-card"><span class="feature-icon">✅</span><span>${escapeHtml(f)}</span></div>`).join('\n      ')}
    </div>

    <h2>Supported Markets on ${broker.name}</h2>
    <p>Digimun Pro provides signals for all major markets available on ${broker.name}:</p>
    <div class="tag-list">
      ${broker.markets.map(m => `<span class="market-tag">${m}</span>`).join('\n      ')}
    </div>

    <h2>Getting Started</h2>
    <p>Getting started with AI signals on ${broker.name} is simple and free. You can access Digimun Pro's basic signals at no cost by signing up through our platform. Premium signals covering all 5 market types are available with a VIP pass starting from just $6.</p>`;

    const faqs = [
      { q: `Are Digimun Pro signals compatible with ${broker.name}?`, a: `Yes, Digimun Pro signals are fully compatible with ${broker.name}. Our AI generates CALL/PUT signals for all assets available on ${broker.name} including ${broker.markets.join(', ')}.` },
      { q: `How accurate are the signals for ${broker.name}?`, a: `Signal accuracy varies by market conditions. Our AI is trained on historical data to maximize probability, but trading always involves risk. We recommend using proper money management and never risking more than 1-3% per trade.` },
      { q: `Is it free to use signals on ${broker.name}?`, a: `Yes, basic signals are free. You can get free access by signing up through our affiliate link. Premium VIP signals covering all markets start from $6.` },
      { q: `What is the minimum deposit on ${broker.name}?`, a: `The minimum deposit on ${broker.name} is ${broker.minDeposit}. You can start trading with small amounts while learning.` },
      { q: `Can I use signals on ${broker.name} mobile app?`, a: `Yes, Digimun Pro signals work with both ${broker.name}'s web platform and mobile app. Access signals from your phone and execute trades on ${broker.name}'s mobile trading interface.` }
    ];

    allGeneratedPages.push({ slug, url, title: `${broker.name} Binary Options Signals` });

    const html = buildPage({
      title, metaDesc: `Get free AI-powered binary options signals for ${broker.name}. Real-time CALL/PUT signals for ${broker.markets.join(', ')} markets. Start trading smarter today.`,
      keywords: `${broker.name} signals, ${broker.slug} binary options, ${broker.name} trading signals, AI signals ${broker.slug}, free ${broker.slug} signals`,
      canonicalPath: url,
      breadcrumbs: [
        { name: 'Home', url: DOMAIN + '/' },
        { name: 'Binary Options Signals', url: DOMAIN + '/blog' },
        { name: broker.name + ' Signals', url: DOMAIN + url }
      ],
      h1, content, faqs,
      internalLinksHtml: buildInternalLinks(url, relatedUrls)
    });

    const outDir = path.join(OUTPUT_DIR, 'binary-options-signals');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${broker.slug}.html`), html);
  }
}

function generateTradingBotPages() {
  for (const broker of brokers) {
    const slug = `trading-bots/${broker.slug}`;
    const url = `/${slug}`;
    const title = `Best Trading Bots for ${broker.name} | AI Signal Bots - Digimun Pro`;
    const h1 = `Trading Bots for ${broker.name}`;

    const relatedUrls = brokers.filter(b => b.slug !== broker.slug).map(b => ({
      url: `/trading-bots/${b.slug}`, title: `${b.name} Trading Bots`
    })).concat(brokers.map(b => ({
      url: `/best-trading-bot-for-${b.slug}`, title: `Best Trading Bot for ${b.name}`
    })));

    const content = `
    <p class="lead">Looking for the best trading bots to use on ${broker.name}? Digimun Pro offers a suite of AI-powered trading bots designed to help you trade more effectively on ${broker.name} — from signal generation to automated trade execution.</p>

    <h2>Digimun Pro Bots for ${broker.name}</h2>
    <p>Our platform provides multiple trading bot solutions, each designed for different trading needs:</p>

    <div class="bot-grid">
      <div class="bot-card">
        <h3>Digimun Pro Bot</h3>
        <p>AI-powered live signal generator for ${broker.name}. Generates real-time CALL/PUT signals for Live and OTC markets with M1 timeframe analysis.</p>
        <a href="/pro-bot-details" class="btn-sm">Learn More →</a>
      </div>
      <div class="bot-card">
        <h3>DigiMaxx Premium</h3>
        <p>VIP multi-market signal bot covering Live, OTC, Crypto, Commodities, and Stocks on ${broker.name}. Includes advanced entry tips.</p>
        <a href="/digimaxx" class="btn-sm">Learn More →</a>
      </div>
      <div class="bot-card">
        <h3>DigimunX AI Analyzer</h3>
        <p>Upload any ${broker.name} chart screenshot for instant AI analysis. Gets pattern recognition, trend identification, and trade recommendations.</p>
        <a href="/DigimunX-details" class="btn-sm">Learn More →</a>
      </div>
      <div class="bot-card">
        <h3>Auto Hedger</h3>
        <p>Automated hedge execution tool that works as an overlay on ${broker.name}. One-click auto trades with consecutive trade support.</p>
        <a href="/auto-hedger-details" class="btn-sm">Learn More →</a>
      </div>
    </div>

    <h2>Why Use Trading Bots on ${broker.name}?</h2>
    <ul>
      <li><strong>Eliminate emotions</strong> — Bots follow algorithms, not feelings</li>
      <li><strong>24/7 signal generation</strong> — Never miss a trading opportunity</li>
      <li><strong>Faster analysis</strong> — AI processes charts in milliseconds</li>
      <li><strong>Consistent strategy</strong> — Same rules applied to every trade</li>
      <li><strong>Risk management</strong> — Built-in money management tools</li>
    </ul>

    <h2>How to Get Started</h2>
    <p>Setting up Digimun Pro bots with your ${broker.name} account takes just a few minutes. Create your free Digimun Pro account, connect to ${broker.name}, and start receiving AI-generated signals immediately.</p>`;

    const faqs = [
      { q: `Do Digimun Pro bots work on ${broker.name}?`, a: `Yes, all Digimun Pro bots generate signals compatible with ${broker.name}. The Pro Bot and DigiMaxx provide CALL/PUT signals, DigimunX analyzes charts, and Auto Hedger works as an overlay on any broker including ${broker.name}.` },
      { q: `Are the trading bots free?`, a: `The basic Digimun Pro Bot is available for free through affiliate signup. DigiMaxx VIP and Auto Hedger are premium features with affordable pricing starting from $6.` },
      { q: `Can bots trade automatically on ${broker.name}?`, a: `The Auto Hedger can execute trades automatically on ${broker.name} with one-click operation. Other bots provide signals that you manually execute for full control over your trades.` },
      { q: `Which bot is best for beginners on ${broker.name}?`, a: `The Digimun Pro Bot is ideal for beginners — it provides simple CALL/PUT signals with clear entry points. As you advance, you can upgrade to DigiMaxx for multi-market coverage.` }
    ];

    allGeneratedPages.push({ slug, url, title: `${broker.name} Trading Bots` });

    const html = buildPage({
      title, metaDesc: `Discover the best trading bots for ${broker.name}. AI-powered signal bots, chart analyzers, and auto hedger tools. Start trading smarter today.`,
      keywords: `${broker.name} trading bot, ${broker.slug} bot, AI trading bot ${broker.slug}, signal bot ${broker.name}, automated trading ${broker.slug}`,
      canonicalPath: url,
      breadcrumbs: [
        { name: 'Home', url: DOMAIN + '/' },
        { name: 'Trading Bots', url: DOMAIN + '/blog' },
        { name: broker.name + ' Trading Bots', url: DOMAIN + url }
      ],
      h1, content, faqs,
      internalLinksHtml: buildInternalLinks(url, relatedUrls)
    });

    const outDir = path.join(OUTPUT_DIR, 'trading-bots');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${broker.slug}.html`), html);
  }
}

function generateStrategyPages() {
  for (const ind of indicators) {
    const slug = `binary-options-strategy/${ind.slug}`;
    const url = `/${slug}`;
    const title = `${ind.shortName} Binary Options Strategy | Trading Guide - Digimun Pro`;
    const h1 = `${ind.name} Strategy for Binary Options`;

    const relatedUrls = indicators.filter(i => i.slug !== ind.slug).map(i => ({
      url: `/binary-options-strategy/${i.slug}`, title: `${i.shortName} Strategy`
    }));

    const content = `
    <p class="lead">${ind.description}</p>

    <h2>How ${ind.shortName} Works</h2>
    <p>${ind.howItWorks}</p>

    <div class="info-box">
      <h4>Recommended Settings</h4>
      <p>${ind.settings}</p>
    </div>

    <h2>Best Use Case</h2>
    <p>${ind.bestFor}. ${ind.shortName} is particularly effective when combined with other indicators and price action analysis for confirmation.</p>

    <h2>${ind.shortName} Trading Strategy</h2>
    <p>${ind.strategy}</p>

    <h2>Tips for Using ${ind.shortName} in Binary Options</h2>
    <ul>
      <li><strong>Combine with trend analysis</strong> — Always confirm ${ind.shortName} signals with the overall market trend</li>
      <li><strong>Use multiple timeframes</strong> — Check the signal on both 1-minute and 5-minute charts</li>
      <li><strong>Wait for confirmation</strong> — Don't enter on the first signal; wait for candlestick confirmation</li>
      <li><strong>Practice on demo first</strong> — Test your ${ind.shortName} strategy on a demo account before trading real money</li>
      <li><strong>Apply money management</strong> — Never risk more than 1-3% of your account per trade</li>
    </ul>

    <h2>Combine ${ind.shortName} with AI Signals</h2>
    <p>Digimun Pro's AI signal system analyzes multiple indicators simultaneously, including ${ind.shortName}, to generate high-probability trading signals. Using AI signals alongside your own ${ind.shortName} analysis creates a powerful confirmation system for binary options trading.</p>`;

    const faqs = [
      { q: `How do I use ${ind.shortName} for binary options?`, a: `${ind.strategy}` },
      { q: `What are the best settings for ${ind.shortName}?`, a: `The recommended settings are: ${ind.settings}. These settings work well for 1-minute and 5-minute binary options trading.` },
      { q: `Can I combine ${ind.shortName} with other indicators?`, a: `Yes, combining ${ind.shortName} with trend indicators and price action improves accuracy. Popular combinations include ${ind.shortName} with Moving Averages for trend confirmation.` },
      { q: `Is ${ind.shortName} good for beginners?`, a: `${ind.shortName} is ${ind.bestFor.toLowerCase()}. Beginners should practice on a demo account first and always combine it with proper money management.` }
    ];

    allGeneratedPages.push({ slug, url, title: `${ind.shortName} Strategy` });

    const html = buildPage({
      title, metaDesc: `Learn the ${ind.shortName} binary options strategy. ${ind.bestFor}. Step-by-step guide with settings and entry rules.`,
      keywords: `${ind.shortName} strategy, ${ind.slug} binary options, ${ind.shortName} trading, ${ind.slug} indicator, binary options ${ind.slug}`,
      canonicalPath: url,
      breadcrumbs: [
        { name: 'Home', url: DOMAIN + '/' },
        { name: 'Trading Strategies', url: DOMAIN + '/blog' },
        { name: ind.shortName + ' Strategy', url: DOMAIN + url }
      ],
      h1, content, faqs,
      internalLinksHtml: buildInternalLinks(url, relatedUrls)
    });

    const outDir = path.join(OUTPUT_DIR, 'binary-options-strategy');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${ind.slug}.html`), html);
  }
}

function generateBestBotPages() {
  for (const broker of brokers) {
    const slug = `best-trading-bot-for-${broker.slug}`;
    const url = `/${slug}`;
    const title = `Best Trading Bot for ${broker.name} in 2026 | AI Signals - Digimun Pro`;
    const h1 = `Best Trading Bot for ${broker.name}`;

    const relatedUrls = brokers.filter(b => b.slug !== broker.slug).map(b => ({
      url: `/best-trading-bot-for-${b.slug}`, title: `Best Bot for ${b.name}`
    })).concat(brokers.map(b => ({
      url: `/trading-bots/${b.slug}`, title: `${b.name} Trading Bots`
    })));

    const content = `
    <p class="lead">Looking for the best trading bot for ${broker.name} in 2026? Digimun Pro is the top-rated AI signal platform used by thousands of ${broker.name} traders worldwide. Our bots provide real-time CALL/PUT signals for ${broker.markets.join(', ')} markets.</p>

    <h2>Why Digimun Pro is the Best Bot for ${broker.name}</h2>
    <ul>
      <li><strong>AI-powered signals</strong> — Advanced pattern recognition and market analysis</li>
      <li><strong>Multi-market support</strong> — Signals for ${broker.markets.join(', ')}</li>
      <li><strong>Free access available</strong> — Start with no cost through affiliate signup</li>
      <li><strong>10,000+ active traders</strong> — Trusted by a growing community</li>
      <li><strong>24/7 signal generation</strong> — Including OTC markets on weekends</li>
    </ul>

    <h2>Available Bots for ${broker.name}</h2>
    <div class="comparison-table">
      <table>
        <thead><tr><th>Bot</th><th>Markets</th><th>Price</th><th>Best For</th></tr></thead>
        <tbody>
          <tr><td>Pro Bot</td><td>Live, OTC</td><td>Free / VIP</td><td>Beginners</td></tr>
          <tr><td>DigiMaxx</td><td>All 5 Markets</td><td>From $6</td><td>Advanced traders</td></tr>
          <tr><td>DigimunX AI</td><td>Chart Analysis</td><td>Free / VIP</td><td>Visual analysis</td></tr>
          <tr><td>Auto Hedger</td><td>Any platform</td><td>From $30/week</td><td>Automated execution</td></tr>
        </tbody>
      </table>
    </div>

    <h2>How to Get Started</h2>
    <ol>
      <li>Create your ${broker.name} trading account</li>
      <li>Sign up on Digimun Pro (free or VIP)</li>
      <li>Access the signal dashboard and choose your bot</li>
      <li>Follow AI signals on ${broker.name} with proper risk management</li>
    </ol>`;

    const faqs = [
      { q: `What is the best trading bot for ${broker.name}?`, a: `Digimun Pro is the best AI trading bot platform for ${broker.name}, offering multiple bots including Pro Bot (free signals), DigiMaxx (premium multi-market), DigimunX AI (chart analysis), and Auto Hedger (automated execution).` },
      { q: `Is there a free trading bot for ${broker.name}?`, a: `Yes, Digimun Pro Bot offers free AI signals for ${broker.name} through affiliate signup. Premium features like DigiMaxx start from just $6.` },
      { q: `Can I use a trading bot on ${broker.name} mobile?`, a: `Yes, Digimun Pro's signal bots work on any device. Access signals from your phone and execute trades on ${broker.name}'s mobile platform.` }
    ];

    allGeneratedPages.push({ slug, url, title: `Best Bot for ${broker.name}` });

    const html = buildPage({
      title, metaDesc: `Find the best trading bot for ${broker.name} in 2026. AI-powered signal bots with free access. Trusted by 10,000+ traders.`,
      keywords: `best trading bot ${broker.slug}, ${broker.name} bot, ${broker.slug} signal bot, AI bot ${broker.name}, automated trading ${broker.slug}`,
      canonicalPath: url,
      breadcrumbs: [
        { name: 'Home', url: DOMAIN + '/' },
        { name: 'Best Trading Bots', url: DOMAIN + '/blog' },
        { name: 'Best Bot for ' + broker.name, url: DOMAIN + url }
      ],
      h1, content, faqs,
      internalLinksHtml: buildInternalLinks(url, relatedUrls)
    });

    fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.html`), html);
  }
}

function generateAssetPages() {
  for (const asset of assets) {
    const slug = `ai-trading-signals-for-${asset.slug}`;
    const url = `/${slug}`;
    const title = `AI Trading Signals for ${asset.name} | ${asset.type} Signals - Digimun Pro`;
    const h1 = `AI Trading Signals for ${asset.name}`;

    const relatedUrls = assets.filter(a => a.slug !== asset.slug).map(a => ({
      url: `/ai-trading-signals-for-${a.slug}`, title: `${a.name} Signals`
    }));

    const content = `
    <p class="lead">${asset.description} Digimun Pro provides AI-powered trading signals for ${asset.name}, helping you identify high-probability CALL and PUT entries.</p>

    <h2>${asset.name} Trading Overview</h2>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-label">Asset Type</span><span class="stat-value">${asset.type}</span></div>
      <div class="stat-card"><span class="stat-label">Volatility</span><span class="stat-value">${asset.volatility}</span></div>
      <div class="stat-card"><span class="stat-label">Best Session</span><span class="stat-value">${asset.bestSession}</span></div>
    </div>

    <h2>Key Factors Affecting ${asset.name}</h2>
    <ul>
      ${asset.keyFactors.map(f => `<li>${f}</li>`).join('\n      ')}
    </ul>

    <h2>How AI Signals Work for ${asset.name}</h2>
    <p>Digimun Pro's AI analyzes real-time ${asset.name} price data, historical patterns, and technical indicators to generate CALL/PUT signals. The AI considers trend direction, momentum, support/resistance levels, and volatility to calculate signal confidence scores.</p>

    <h2>Trading Tips for ${asset.name}</h2>
    <ul>
      <li><strong>Trade during optimal hours</strong> — ${asset.bestSession}</li>
      <li><strong>Monitor key events</strong> — ${asset.keyFactors[0]} can cause significant moves</li>
      <li><strong>Use appropriate timeframes</strong> — 1-minute for scalping, 5-minute for trend trades</li>
      <li><strong>Manage volatility</strong> — ${asset.volatility} volatility means adjusting position size accordingly</li>
      <li><strong>Combine with AI signals</strong> — Use Digimun Pro signals as confirmation for your analysis</li>
    </ul>`;

    const faqs = [
      { q: `Can I get AI signals for ${asset.name}?`, a: `Yes, Digimun Pro provides real-time AI trading signals for ${asset.name}. Our AI analyzes chart patterns, indicators, and market conditions to generate CALL/PUT signals.` },
      { q: `What is the best time to trade ${asset.name}?`, a: `The best time to trade ${asset.name} is during ${asset.bestSession}. This is when liquidity is highest and trends are most reliable.` },
      { q: `How volatile is ${asset.name}?`, a: `${asset.name} has ${asset.volatility.toLowerCase()} volatility. This means ${asset.volatility === 'Very High' || asset.volatility === 'High' ? 'larger price moves and more trading opportunities, but also higher risk per trade' : 'more predictable movements with moderate trading opportunities'}.` }
    ];

    allGeneratedPages.push({ slug, url, title: `${asset.name} AI Signals` });

    const html = buildPage({
      title, metaDesc: `Get AI trading signals for ${asset.name} (${asset.fullName}). Real-time CALL/PUT signals with ${asset.volatility.toLowerCase()} volatility analysis.`,
      keywords: `${asset.name} signals, ${asset.slug} trading signals, AI signals ${asset.name}, ${asset.type} signals, binary options ${asset.slug}`,
      canonicalPath: url,
      breadcrumbs: [
        { name: 'Home', url: DOMAIN + '/' },
        { name: 'AI Trading Signals', url: DOMAIN + '/blog' },
        { name: asset.name + ' Signals', url: DOMAIN + url }
      ],
      h1, content, faqs,
      internalLinksHtml: buildInternalLinks(url, relatedUrls)
    });

    fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.html`), html);
  }
}

function generateCurrencyPairPages() {
  const forexAssets = assets.filter(a => a.type === 'Forex');
  for (const pair of forexAssets) {
    const pairSlug = pair.slug.toLowerCase();
    const slug = `how-to-trade-${pairSlug}`;
    const url = `/${slug}`;
    const title = `How to Trade ${pair.name} | Binary Options Guide - Digimun Pro`;
    const h1 = `How to Trade ${pair.name} in Binary Options`;

    const relatedUrls = forexAssets.filter(a => a.slug !== pair.slug).map(a => ({
      url: `/how-to-trade-${a.slug.toLowerCase()}`, title: `How to Trade ${a.name}`
    })).concat(assets.filter(a => a.type !== 'Forex').slice(0, 3).map(a => ({
      url: `/ai-trading-signals-for-${a.slug}`, title: `${a.name} Signals`
    })));

    const content = `
    <p class="lead">${pair.description} This guide covers everything you need to know about trading ${pair.name} with binary options — from the best trading sessions to effective strategies and risk management.</p>

    <h2>Understanding ${pair.name}</h2>
    <p>${pair.fullName} is one of the most actively traded pairs in the Forex market. Understanding its behavior, key drivers, and optimal trading times is essential for successful binary options trading.</p>

    <h2>Best Time to Trade ${pair.name}</h2>
    <p>The optimal trading session for ${pair.name} is during <strong>${pair.bestSession}</strong>. During these hours, liquidity is highest and price movements are most predictable, making it ideal for binary options trading.</p>

    <h2>Key Factors That Move ${pair.name}</h2>
    <ul>
      ${pair.keyFactors.map(f => `<li><strong>${f}</strong></li>`).join('\n      ')}
    </ul>

    <h2>Volatility Profile</h2>
    <p>${pair.name} has <strong>${pair.volatility.toLowerCase()}</strong> volatility. This means you should adjust your trade size and expiry times accordingly. Higher volatility pairs work well with shorter expiry times (1-2 minutes), while lower volatility pairs may benefit from longer 5-minute trades.</p>

    <h2>${pair.name} Trading Strategy</h2>
    <ol>
      <li><strong>Identify the trend</strong> on a 5-minute chart using moving averages</li>
      <li><strong>Wait for pullback</strong> to a support/resistance level</li>
      <li><strong>Confirm with indicators</strong> — RSI, MACD, or candlestick patterns</li>
      <li><strong>Enter in trend direction</strong> — CALL in uptrend, PUT in downtrend</li>
      <li><strong>Set 1-3 minute expiry</strong> for ${pair.name} during active sessions</li>
    </ol>

    <h2>Using AI Signals for ${pair.name}</h2>
    <p>Digimun Pro's AI signal system provides real-time CALL/PUT signals for ${pair.name} across multiple brokers including Quotex, IQ Option, and Pocket Option. The AI analyzes ${pair.name} charts using pattern recognition, indicator confluence, and historical data to generate high-confidence trading signals.</p>`;

    const faqs = [
      { q: `What is the best strategy for trading ${pair.name}?`, a: `The best strategy for ${pair.name} combines trend following with indicator confirmation. Identify the trend on a 5-minute chart, wait for a pullback, confirm with RSI or MACD, and enter in the trend direction.` },
      { q: `When is the best time to trade ${pair.name}?`, a: `The best time to trade ${pair.name} is during ${pair.bestSession}. This is when volume and volatility are optimal for binary options.` },
      { q: `Can I trade ${pair.name} on weekends?`, a: `${pair.name} is not available during weekends on live Forex markets. However, you can trade ${pair.name} OTC (Over-The-Counter) version on platforms like Quotex, which is available 24/7.` }
    ];

    allGeneratedPages.push({ slug, url, title: `How to Trade ${pair.name}` });

    const html = buildPage({
      title, metaDesc: `Learn how to trade ${pair.name} with binary options. Best strategies, optimal trading times, and AI signals for ${pair.fullName}.`,
      keywords: `how to trade ${pair.slug}, ${pair.name} binary options, ${pair.slug} strategy, ${pair.name} signals, trade ${pair.slug}`,
      canonicalPath: url,
      breadcrumbs: [
        { name: 'Home', url: DOMAIN + '/' },
        { name: 'Currency Trading Guides', url: DOMAIN + '/blog' },
        { name: 'Trade ' + pair.name, url: DOMAIN + url }
      ],
      h1, content, faqs,
      internalLinksHtml: buildInternalLinks(url, relatedUrls)
    });

    fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.html`), html);
  }
}

function generateMarketIndicatorPages() {
  for (const market of markets) {
    const slug = `best-indicator-for-${market.slug}`;
    const url = `/${slug}`;
    const title = `Best Indicator for ${market.name} Trading | Binary Options - Digimun Pro`;
    const h1 = `Best Indicators for ${market.name} Trading`;

    const topIndicators = indicators.slice(0, 5);

    const relatedUrls = markets.filter(m => m.slug !== market.slug).map(m => ({
      url: `/best-indicator-for-${m.slug}`, title: `Best Indicator for ${m.name}`
    })).concat(indicators.slice(0, 5).map(i => ({
      url: `/binary-options-strategy/${i.slug}`, title: `${i.shortName} Strategy`
    })));

    const content = `
    <p class="lead">${market.description} Choosing the right technical indicators is crucial for successful binary options trading in ${market.name} markets.</p>

    <h2>${market.name} Market Overview</h2>
    <p><strong>Trading Hours:</strong> ${market.tradingHours}</p>
    <p><strong>Key Advantage:</strong> ${market.keyAdvantage}</p>
    <p><strong>Top Assets:</strong> ${market.topPairs.join(', ')}</p>

    <h2>Top 5 Indicators for ${market.name}</h2>
    ${topIndicators.map((ind, i) => `
    <div class="indicator-card">
      <h3>${i + 1}. ${ind.name}</h3>
      <p>${ind.bestFor}. ${ind.description.split('.')[0]}.</p>
      <p><strong>Strategy:</strong> ${ind.strategy.split('.')[0]}.</p>
      <a href="/binary-options-strategy/${ind.slug}" class="btn-sm">Full ${ind.shortName} Guide →</a>
    </div>`).join('\n')}

    <h2>Combining Indicators for ${market.name}</h2>
    <p>The most effective approach for ${market.name} trading is combining a trend indicator (like Moving Averages) with a momentum oscillator (like RSI or Stochastic). This dual confirmation system filters out false signals and improves your win rate.</p>

    <h2>AI-Powered Analysis for ${market.name}</h2>
    <p>Instead of manually analyzing multiple indicators, Digimun Pro's AI automatically processes all relevant indicators for ${market.name} assets and generates CALL/PUT signals with confidence scores. This eliminates analysis paralysis and helps you make faster trading decisions.</p>`;

    const faqs = [
      { q: `What is the best indicator for ${market.name} trading?`, a: `The best single indicator for ${market.name} trading depends on your strategy, but RSI and Moving Averages are the most popular. For best results, combine a trend indicator with an oscillator.` },
      { q: `How many indicators should I use for ${market.name}?`, a: `We recommend using 2-3 indicators maximum. Too many indicators create conflicting signals. A good combination is: one trend indicator (Moving Average or Ichimoku), one momentum indicator (RSI or MACD), and price action/candlestick confirmation.` },
      { q: `When is the best time to trade ${market.name}?`, a: `The best trading hours for ${market.name} are: ${market.tradingHours}. Trade during peak hours for the best liquidity and signal reliability.` },
      { q: `What ${market.name} assets can I trade on Digimun Pro?`, a: `Digimun Pro supports signals for major ${market.name} assets including ${market.topPairs.join(', ')}. Both live and OTC markets are available.` }
    ];

    allGeneratedPages.push({ slug, url, title: `Best Indicator for ${market.name}` });

    const html = buildPage({
      title, metaDesc: `Discover the best technical indicators for ${market.name} binary options trading. Top 5 indicators with strategies and settings.`,
      keywords: `best indicator ${market.slug}, ${market.name} indicators, ${market.slug} trading indicator, binary options ${market.slug} indicator, technical analysis ${market.name}`,
      canonicalPath: url,
      breadcrumbs: [
        { name: 'Home', url: DOMAIN + '/' },
        { name: 'Market Indicators', url: DOMAIN + '/blog' },
        { name: market.name + ' Indicators', url: DOMAIN + url }
      ],
      h1, content, faqs,
      internalLinksHtml: buildInternalLinks(url, relatedUrls)
    });

    fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.html`), html);
  }
}

const CSS_SOURCE = path.join(DATA_DIR, 'seo-page.css');
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true });
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (fs.existsSync(CSS_SOURCE)) {
  fs.copyFileSync(CSS_SOURCE, path.join(OUTPUT_DIR, 'seo-page.css'));
}

generateBrokerSignalPages();
generateTradingBotPages();
generateStrategyPages();
generateBestBotPages();
generateAssetPages();
generateCurrencyPairPages();
generateMarketIndicatorPages();

const manifest = { generated: new Date().toISOString(), pages: allGeneratedPages };
fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Generated ${allGeneratedPages.length} SEO landing pages`);
console.log('Categories:');
console.log(`  - Binary Options Signals: ${brokers.length} pages`);
console.log(`  - Trading Bots: ${brokers.length} pages`);
console.log(`  - Strategy Guides: ${indicators.length} pages`);
console.log(`  - Best Trading Bot: ${brokers.length} pages`);
console.log(`  - Asset Signal Pages: ${assets.length} pages`);
console.log(`  - Currency Pair Guides: ${assets.filter(a => a.type === 'Forex').length} pages`);
console.log(`  - Market Indicator Pages: ${markets.length} pages`);
