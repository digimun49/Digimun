import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import "dotenv/config";
import OpenAI from "openai";
import { v2 as cloudinary } from "cloudinary";
import { initializeApp as firebaseInitApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import admin from 'firebase-admin';

if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    if (serviceAccount.project_id) {
      firebaseInitApp({ credential: cert(serviceAccount) });
    }
  } catch (e) { /* silent */ }
}
const firestoreDb = getApps().length ? getFirestore() : null;
const firebaseAuth = getApps().length ? getAuth() : null;

const ALLOWED_ORIGINS = [
  'https://digimun.pro',
  'https://www.digimun.pro'
];

function getAllowedOrigin(reqOrigin) {
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  const allowed = [...ALLOWED_ORIGINS];
  if (devDomain) {
    allowed.push('https://' + devDomain);
  }
  return (reqOrigin && allowed.includes(reqOrigin)) ? reqOrigin : null;
}

async function verifyFirebaseTokenExpress(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false };
  }
  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken || !firebaseAuth) {
    return { authenticated: false };
  }
  try {
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    return { authenticated: true, uid: decodedToken.uid, email: decodedToken.email || '' };
  } catch (err) {
    return { authenticated: false };
  }
}

function isAdminEmail(email) {
  const adminEmail = process.env.ADMIN_EMAIL || '';
  return adminEmail && email && email.toLowerCase().trim() === adminEmail.toLowerCase().trim();
}

const rateLimitStores = {};
function rateLimit(name, windowMs, maxRequests) {
  if (!rateLimitStores[name]) {
    rateLimitStores[name] = new Map();
  }
  const store = rateLimitStores[name];
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const now = Date.now();
    const record = store.get(ip);
    if (!record || now - record.firstRequest > windowMs) {
      store.set(ip, { count: 1, firstRequest: now });
      return next();
    }
    if (record.count >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    record.count++;
    next();
  };
}

async function getSignalLearningContext(pair) {
  if (!firestoreDb) return '';
  try {
    let query = firestoreDb.collection('signals')
      .where('status', '==', 'completed');

    if (pair && pair !== 'Unknown' && pair !== '') {
      query = query.where('pair', '==', pair);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').limit(30).get();
    if (snapshot.empty) return '';

    const limitedSignals = [];
    snapshot.forEach(doc => limitedSignals.push(doc.data()));

    const wins = limitedSignals.filter(s => s.result === 'WIN');
    const losses = limitedSignals.filter(s => s.result === 'LOSS');
    const total = wins.length + losses.length;
    const winRate = total > 0 ? ((wins.length / total) * 100).toFixed(1) : 0;

    const winReasons = wins.map(s => s.reason).filter(Boolean).slice(0, 10);
    const lossReasons = losses.map(s => s.failureReason || s.reason).filter(Boolean).slice(0, 10);

    const winDirections = wins.reduce((acc, s) => {
      acc[s.signal] = (acc[s.signal] || 0) + 1;
      return acc;
    }, {});

    const lossDirections = losses.reduce((acc, s) => {
      acc[s.signal] = (acc[s.signal] || 0) + 1;
      return acc;
    }, {});

    let context = `Past Signal Performance (${pair || 'all pairs'}):\n`;
    context += `Total completed: ${total} | Wins: ${wins.length} | Losses: ${losses.length} | Win Rate: ${winRate}%\n`;
    context += `Winning signal types: ${JSON.stringify(winDirections)}\n`;
    context += `Losing signal types: ${JSON.stringify(lossDirections)}\n`;

    if (winReasons.length > 0) {
      context += `Common WINNING patterns/reasons: ${winReasons.join(' | ')}\n`;
    }
    if (lossReasons.length > 0) {
      context += `Common LOSING patterns/reasons: ${lossReasons.join(' | ')}\n`;
    }

    const recentTimes = limitedSignals.slice(0, 5).map(s => `${s.signalTime || ''} ${s.pair || ''} ${s.signal || ''} → ${s.result || ''}`);
    if (recentTimes.length > 0) {
      context += `Recent signals: ${recentTimes.join('; ')}\n`;
    }

    return context;
  } catch (e) {
    return '';
  }
}

const app = express();

const BLOCKED_PATHS = [
  '/server.js', '/package.json', '/package-lock.json', '/.env',
  '/netlify', '/node_modules', '/.git', '/.replit', '/replit.nix',
  '/replit.md', '/.local', '/attached_assets',
  '/firestore.rules', '/firestore-rules-complete.txt',
  '/_redirects', '/netlify.toml'
];

const ADMIN_FILES = ['/mxpanel49d', '/mxpanel49d.html', '/mxpanel49d.js'];

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const resolvedOrigin = getAllowedOrigin(origin);
  if (resolvedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', resolvedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-2FA-Session');
  }
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use((req, res, next) => {
  const reqPath = req.path.toLowerCase();
  for (const blocked of BLOCKED_PATHS) {
    if (reqPath === blocked || reqPath.startsWith(blocked + '/')) {
      return res.status(404).send('Not found');
    }
  }
  next();
});

app.use(async (req, res, next) => {
  const reqPath = req.path.toLowerCase();
  const isAdminFile = ADMIN_FILES.some(f => reqPath === f.toLowerCase() || reqPath === f.toLowerCase() + '.html');
  if (!isAdminFile) return next();

  const authResult = await verifyFirebaseTokenExpress(req);
  if (!authResult.authenticated || !isAdminEmail(authResult.email)) {
    return res.status(404).send('Not found');
  }
  next();
});

app.use((req, res, next) => {
  if (req.path.endsWith('.html') && req.path !== '/index.html') {
    const cleanPath = req.path.slice(0, -5);
    return res.redirect(301, cleanPath || '/');
  }
  
  if (req.path === '/index.html') {
    return res.redirect(301, '/');
  }
  next();
});

app.use(express.json());

const netlifyFunctionCache = {};

function loadNetlifyFunction(funcName) {
  if (netlifyFunctionCache[funcName]) {
    return netlifyFunctionCache[funcName];
  }

  const funcPath = path.resolve(path.join('.', 'netlify', 'functions', `${funcName}.cjs`));
  const require = createRequire(funcPath);
  
  try {
    const funcModule = require(funcPath);
    netlifyFunctionCache[funcName] = funcModule;
    return funcModule;
  } catch (err) {
    throw err;
  }
}

app.use(async (req, res, next) => {
  const netlifyFuncMatch = req.path.match(/^\/\.netlify\/functions\/([a-zA-Z0-9\-_]+)$/);
  
  if (!netlifyFuncMatch) {
    return next();
  }

  const funcName = netlifyFuncMatch[1];
  const funcPath = path.join('.', 'netlify', 'functions', `${funcName}.cjs`);

  try {
    if (!fs.existsSync(funcPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const funcModule = loadNetlifyFunction(funcName);
    const handler = funcModule.handler;

    if (typeof handler !== 'function') {
      return res.status(500).json({ error: 'Internal server error' });
    }

    const event = {
      httpMethod: req.method,
      path: req.path,
      body: req.method === 'POST' || req.method === 'PUT' 
        ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
        : null,
      headers: req.headers,
      queryStringParameters: req.query && Object.keys(req.query).length > 0 ? req.query : null,
      multiValueQueryStringParameters: null,
      isBase64Encoded: false
    };

    const result = await handler(event, {});

    const statusCode = result.statusCode || 200;
    res.status(statusCode);

    if (result.headers && typeof result.headers === 'object') {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    let responseBody = result.body;
    if (result.isBase64Encoded && responseBody) {
      responseBody = Buffer.from(responseBody, 'base64');
    }

    res.send(responseBody || '');
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function parseRedirects() {
  const rules = [];
  try {
    const content = fs.readFileSync('_redirects', 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length < 3) continue;
      const [from, to, statusStr] = parts;
      const status = parseInt(statusStr, 10);
      if (isNaN(status)) continue;
      const isWildcard = from.endsWith('/*');
      rules.push({
        from: isWildcard ? from.slice(0, -2) : from,
        to,
        status,
        isWildcard
      });
    }
  } catch (e) {
    console.warn('Could not parse _redirects file:', e.message);
  }
  return rules;
}

const redirectRules = parseRedirects();
console.log(`Loaded ${redirectRules.length} redirect rules from _redirects`);

const redirectRulesNon404 = redirectRules.filter(r => r.status !== 404 || !r.isWildcard);
const fallback404Rule = redirectRules.find(r => r.status === 404 && r.isWildcard && r.from === '');

app.use((req, res, next) => {
  const reqPath = req.path;

  for (const rule of redirectRulesNon404) {
    let matched = false;
    if (rule.isWildcard) {
      matched = reqPath === rule.from || reqPath.startsWith(rule.from + '/');
    } else {
      matched = reqPath === rule.from;
    }

    if (!matched) continue;

    if (rule.status === 301 || rule.status === 302) {
      return res.redirect(rule.status, rule.to);
    }

    if (rule.status === 200) {
      const filePath = path.join('.', rule.to);
      if (fs.existsSync(filePath)) {
        return res.sendFile(path.resolve(filePath));
      }
    }

    if (rule.status === 404) {
      const filePath = path.join('.', rule.to);
      if (fs.existsSync(filePath)) {
        return res.status(404).sendFile(path.resolve(filePath));
      }
      return res.status(404).send('Not Found');
    }

    break;
  }

  next();
});

app.use((req, res, next) => {
  if (path.extname(req.path) || req.path === '/' || req.path.startsWith('/analyze') || req.path.startsWith('/uploads')) {
    return next();
  }
  
  const htmlPath = path.join('.', req.path + '.html');
  if (fs.existsSync(htmlPath)) {
    return res.sendFile(path.resolve(htmlPath));
  }
  
  const indexPath = path.join('.', req.path, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(path.resolve(indexPath));
  }
  
  next();
});

app.use(express.static('.', {
  setHeaders: (res) => {
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

app.get('/DigimunX', (req, res) => {
  res.sendFile(path.resolve('./digimunx/index.html'));
});
app.get('/Digimunx', (req, res) => {
  res.sendFile(path.resolve('./digimunx/index.html'));
});
app.get('/DIGIMUNX', (req, res) => {
  res.sendFile(path.resolve('./digimunx/index.html'));
});

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(file.mimetype);
    cb(ok ? null : new Error("Only images (jpg/png/webp) allowed"), ok);
  },
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const toDataURL = (p) => {
  const b64 = fs.readFileSync(p, "base64");
  const ext = (path.extname(p).slice(1) || "png").toLowerCase();
  return `data:image/${ext};base64,${b64}`;
};

function timePK() {
  const n = new Date();
  const utc = n.getTime() + n.getTimezoneOffset() * 60000;
  const pk = new Date(utc + 5 * 60 * 60000);
  const HH = String(pk.getHours()).padStart(2, "0");
  const MM = String(pk.getMinutes()).padStart(2, "0");
  return `${HH}:${MM} UTC+05:00`;
}

app.post("/api/ai-learning-status", async (req, res) => {
  const authResult = await verifyFirebaseTokenExpress(req);
  if (!authResult.authenticated || !isAdminEmail(authResult.email)) {
    return res.status(401).json({ status: 'error', issues: ['Unauthorized'], details: {} });
  }

  const diagnostics = {
    status: 'unknown',
    issues: [],
    details: {}
  };

  if (!firestoreDb) {
    diagnostics.status = 'error';
    diagnostics.issues.push('Firebase Admin SDK not initialized');
    return res.json(diagnostics);
  }

  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      diagnostics.issues.push('OPENAI_API_KEY not set - AI cannot analyze charts or use learning data');
    } else {
      diagnostics.details.openai = 'API key configured';
    }

    const allCompletedSnap = await firestoreDb.collection('signals')
      .where('status', '==', 'completed')
      .get();
    const allDocs = [];
    allCompletedSnap.forEach(doc => allDocs.push(doc.data()));
    allDocs.sort((a, b) => {
      const aTime = a.createdAt?._seconds || 0;
      const bTime = b.createdAt?._seconds || 0;
      return bTime - aTime;
    });
    const signals = allDocs.slice(0, 50);
    const totalCompleted = signals.length;
    diagnostics.details.totalCompletedSignals = totalCompleted;

    if (totalCompleted === 0) {
      diagnostics.issues.push('No completed signals found in Firestore - AI has zero data to learn from. Users need to submit WIN/LOSS results for their signals first.');
    }

    const wins = signals.filter(s => s.result === 'WIN');
    const losses = signals.filter(s => s.result === 'LOSS');
    const invalidOrRefunded = signals.filter(s => s.result === 'INVALID' || s.result === 'REFUNDED');
    const noResult = signals.filter(s => !s.result);

    diagnostics.details.breakdown = {
      wins: wins.length,
      losses: losses.length,
      invalidOrRefunded: invalidOrRefunded.length,
      noResult: noResult.length
    };

    diagnostics.details.winRate = (wins.length + losses.length) > 0
      ? ((wins.length / (wins.length + losses.length)) * 100).toFixed(1) + '%'
      : 'N/A';

    const withReasons = signals.filter(s => s.reason && s.reason.trim() !== '');
    const withFailureReasons = losses.filter(s => s.failureReason && s.failureReason.trim() !== '');
    diagnostics.details.signalsWithReasons = withReasons.length;
    diagnostics.details.lossesWithFailureReasons = withFailureReasons.length;

    if (wins.length > 0 && withReasons.length === 0) {
      diagnostics.issues.push('Winning signals have no "reason" field - AI cannot learn WHAT patterns led to wins');
    }
    if (losses.length > 0 && withFailureReasons.length === 0) {
      diagnostics.issues.push('Losing signals have no "failureReason" field - AI cannot learn what to avoid');
    }

    const pairs = {};
    signals.forEach(s => {
      const p = s.pair || 'Unknown';
      if (!pairs[p]) pairs[p] = { wins: 0, losses: 0, total: 0 };
      pairs[p].total++;
      if (s.result === 'WIN') pairs[p].wins++;
      if (s.result === 'LOSS') pairs[p].losses++;
    });
    diagnostics.details.pairBreakdown = pairs;

    if (totalCompleted < 5) {
      diagnostics.issues.push(`Only ${totalCompleted} completed signals - AI needs at least 10-15 signals with results for meaningful learning`);
    }

    const testContext = await getSignalLearningContext('');
    if (!testContext || testContext.trim() === '') {
      diagnostics.issues.push('getSignalLearningContext() returned empty - AI learning function is not producing any context data');
      diagnostics.details.learningContextGenerated = false;
    } else {
      diagnostics.details.learningContextGenerated = true;
      diagnostics.details.learningContextPreview = testContext.substring(0, 500);
    }

    const recentSignals = signals.slice(0, 5).map(s => ({
      pair: s.pair || 'Unknown',
      signal: s.signal || '?',
      result: s.result || 'none',
      hasReason: !!(s.reason && s.reason.trim()),
      hasFailureReason: !!(s.failureReason && s.failureReason.trim()),
      createdAt: s.createdAt ? (s.createdAt._seconds ? new Date(s.createdAt._seconds * 1000).toISOString() : s.createdAt) : 'unknown'
    }));
    diagnostics.details.recentSignals = recentSignals;

    if (diagnostics.issues.length === 0) {
      diagnostics.status = 'healthy';
    } else if (diagnostics.issues.some(i => i.includes('not initialized') || i.includes('OPENAI_API_KEY not set') || i.includes('returned empty'))) {
      diagnostics.status = 'error';
    } else {
      diagnostics.status = 'warning';
    }

    return res.json(diagnostics);
  } catch (e) {
    diagnostics.status = 'error';
    diagnostics.issues.push('Internal server error');
    return res.json(diagnostics);
  }
});

app.post("/analyze", rateLimit('analyze', 60000, 10), upload.single("chart"), async (req, res) => {
  const authResult = await verifyFirebaseTokenExpress(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  if (!req.file) return res.status(400).json({ ok: false, error: "No image uploaded" });

  const fp = req.file.path;
  try {
    const imageUrl = toDataURL(fp);
    const pairHint = req.body?.pair_hint || '';

    const learningContext = await getSignalLearningContext(pairHint);

    let systemPrompt = "Analyze ONE 1-minute chart screenshot. Predict ONLY the next 1-minute candle. Confidence 51–95 (never 100). Keep reasons short. If pair not visible → 'Unknown'. Also evaluate: volatility (HIGH/MEDIUM/LOW), market_state (TRENDING/RANGING/CHOPPY), pattern_clarity (HIGH/MEDIUM/LOW), sr_proximity (AT/NEAR/AWAY), mtg — whether multiple technical signals agree on direction (YES/NO), and patterns — describe detected chart patterns as a short string.";

    if (learningContext) {
      systemPrompt += `\n\nLEARNING FROM PAST SIGNALS:\n${learningContext}\nUse these patterns to improve your analysis accuracy. Avoid patterns that previously led to losses. Favor patterns that previously led to wins.`;
    }

    if (pairHint) {
      systemPrompt += `\n\nHint: The pair being analyzed is likely "${pairHint}".`;
    }

    const schema = {
      name: "SignalSchema",
      schema: {
        type: "object",
        properties: {
          pair: { type: "string" },
          signal: { type: "string", enum: ["CALL", "PUT"] },
          direction: { type: "string", enum: ["UP", "DOWN"] },
          arrow: { type: "string", enum: ["↑", "↓"] },
          confidence: { type: "integer", minimum: 51, maximum: 95 },
          reason: { type: "string" },
          failure_reason: { type: "string" },
          entry_tip: { type: "string" },
          volatility: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          market_state: { type: "string", enum: ["TRENDING", "RANGING", "CHOPPY"] },
          pattern_clarity: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          sr_proximity: { type: "string", enum: ["AT", "NEAR", "AWAY"] },
          mtg: { type: "string", enum: ["YES", "NO"] },
          patterns: { type: "string" }
        },
        required: ["pair","signal","direction","arrow","confidence","reason","failure_reason","entry_tip","volatility","market_state","pattern_clarity","sr_proximity","mtg","patterns"],
        additionalProperties: false
      },
      strict: true
    };

    const resp = await openai.responses.create({
      model: "gpt-4o",
      response_format: { type: "json_schema", json_schema: schema },
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }]},
        { role: "user", content: [
          { type: "input_text", text: "Return valid JSON per schema only." },
          { type: "input_image", image_url: imageUrl }
        ] }
      ],
      temperature: 0.1,
      max_output_tokens: 300
    });

    const data = JSON.parse(resp.output_text || "{}");

    const pair = (data.pair || "Unknown").trim();
    const signal = data.signal === "PUT" ? "PUT" : "CALL";
    const direction = data.direction === "DOWN" ? "DOWN" : "UP";
    const arrow = direction === "DOWN" ? "↓" : "↑";
    let conf = Number.isInteger(data.confidence) ? data.confidence : 72;
    conf = Math.max(51, Math.min(95, conf));
    const reason = (data.reason || "Structure favors this move.").trim();
    const fail = (data.failure_reason || "Sudden reversal/news.").trim();
    const tip = (data.entry_tip || "Enter near open; avoid long wicks.").trim();

    const msg = [
      "📊 Binary Signal Analysis",
      "",
      `Pair: ${pair}`,
      "Timeframe: M1 (1 Minute)",
      `Signal Time: ${timePK()}`,
      "",
      `✅ Signal: ${signal} (${direction} ${arrow})`,
      `🎯 Confidence: ${conf}%`,
      `📈 Reason: ${reason}`,
      `⚠️ Failure Reason: ${fail}`,
      "",
      `💡 Entry Tip: ${tip}`
    ].join("\n");

    const volVal = (data.volatility || "MEDIUM").toUpperCase();
    const msVal = (data.market_state || "RANGING").toUpperCase();
    const pcVal = (data.pattern_clarity || "MEDIUM").toUpperCase();
    const srVal = (data.sr_proximity || "AWAY").toUpperCase();
    const mtgVal = (data.mtg || "NO").toUpperCase();
    const patternsVal = (data.patterns || "").trim();

    const signalTime = timePK();
    const signalData = {
      pair,
      direction,
      signal,
      confidence: conf,
      reason,
      failureReason: fail,
      entryTip: tip,
      signalTime,
      volatility: volVal,
      market_state: msVal,
      pattern_clarity: pcVal,
      sr_proximity: srVal,
      mtg: mtgVal,
      patterns: patternsVal
    };

    fs.unlink(fp, () => {});
    res.json({ ok: true, message: msg, signalData });
  } catch (e) {
    console.error('Analysis error:', e.message, e.status || '', e.code || '');
    fs.unlink(fp, () => {});
    const statusCode = e.status || 500;
    const errorMsg = e.status === 429 ? "Rate limited by AI provider. Please wait and try again." : "Analysis failed";
    res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({ ok: false, error: errorMsg });
  }
});

const ticketUpload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|msword|vnd.openxmlformats-officedocument.wordprocessingml.document/;
    const ok = allowedTypes.test(file.mimetype);
    cb(ok ? null : new Error("File type not allowed"), ok);
  },
});

app.post("/api/upload-ticket-attachment", rateLimit('upload', 60000, 5), ticketUpload.single("file"), async (req, res) => {
  const authResult = await verifyFirebaseTokenExpress(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  if (!req.file) {
    return res.status(400).json({ ok: false, error: "No file uploaded" });
  }

  const fp = req.file.path;
  try {
    const ticketId = req.body.ticketId || "unknown";
    const result = await cloudinary.uploader.upload(fp, {
      folder: `digimun-tickets/${ticketId}`,
      resource_type: "auto"
    });

    fs.unlink(fp, () => {});

    res.json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size
    });
  } catch (e) {
    fs.unlink(fp, () => {});
    res.status(500).json({ ok: false, error: "Upload failed" });
  }
});

const DIGIMUNX_API = 'https://expert-backend--digimun49.replit.app';

app.get('/api/digimunx/stats', async (req, res) => {
  try {
    const response = await fetch(`${DIGIMUNX_API}/api/stats`);
    if (!response.ok) {
      return res.json({ 
        success: false, 
        error: 'Bot API unavailable',
        stats: {
          overall: { total_signals: 0, win_rate: 0 },
          today: { total_signals: 0, win_rate: 0 },
          top_pairs: []
        }
      });
    }
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.json({ 
      success: false, 
      error: 'Failed to fetch stats',
      stats: {
        overall: { total_signals: 0, win_rate: 0 },
        today: { total_signals: 0, win_rate: 0 },
        top_pairs: []
      }
    });
  }
});

app.get('/api/digimunx/signals', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const response = await fetch(`${DIGIMUNX_API}/api/signals?limit=${limit}`);
    if (!response.ok) {
      return res.json({ success: false, error: 'Bot API unavailable', signals: [] });
    }
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.json({ success: false, error: 'Failed to fetch signals', signals: [] });
  }
});

app.post('/api/admin/delete-account', async (req, res) => {
  const authResult = await verifyFirebaseTokenExpress(req);
  if (!authResult.authenticated || !isAdminEmail(authResult.email)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { userEmail } = req.body || {};

  if (!userEmail || userEmail.toLowerCase().trim() === authResult.email.toLowerCase().trim()) {
    return res.status(400).json({ success: false, message: 'Invalid user email provided' });
  }

  const emailLower = userEmail.toLowerCase().trim();

  try {
    try {
      const userRecord = await admin.auth().getUserByEmail(emailLower);
      await admin.auth().deleteUser(userRecord.uid);
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') { /* non-critical */ }
    }

    if (firestoreDb) {
      await firestoreDb.collection('users').doc(emailLower).delete();

      await firestoreDb.collection('deletedAccounts').doc(emailLower).set({
        email: emailLower,
        deletedAt: new Date(),
        deletedBy: authResult.email,
        reason: 'Deleted by admin upon user request'
      });
    }

    return res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
});

if (fallback404Rule) {
  app.use((req, res) => {
    const filePath = path.join('.', fallback404Rule.to);
    if (fs.existsSync(filePath)) {
      return res.status(404).sendFile(path.resolve(filePath));
    }
    res.status(404).send('Not Found');
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {});
