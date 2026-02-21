import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import "dotenv/config";
import OpenAI from "openai";
import { v2 as cloudinary } from "cloudinary";
import { initializeApp as firebaseInitApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import admin from 'firebase-admin';

if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    if (serviceAccount.project_id) {
      firebaseInitApp({ credential: cert(serviceAccount) });
    }
  } catch (e) {
    console.warn('Firebase Admin init skipped: invalid FIREBASE_SERVICE_ACCOUNT JSON');
  }
}
const firestoreDb = getApps().length ? getFirestore() : null;

async function getSignalLearningContext(pair) {
  if (!firestoreDb) return '';
  try {
    let query = firestoreDb.collection('signals')
      .where('status', '==', 'completed')
      .orderBy('createdAt', 'desc')
      .limit(30);

    if (pair && pair !== 'Unknown' && pair !== '') {
      query = firestoreDb.collection('signals')
        .where('status', '==', 'completed')
        .where('pair', '==', pair)
        .orderBy('createdAt', 'desc')
        .limit(30);
    }

    const snapshot = await query.get();
    if (snapshot.empty) return '';

    const signals = [];
    snapshot.forEach(doc => signals.push(doc.data()));

    const wins = signals.filter(s => s.result === 'WIN');
    const losses = signals.filter(s => s.result === 'LOSS');
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

    const recentTimes = signals.slice(0, 5).map(s => `${s.signalTime || ''} ${s.pair || ''} ${s.signal || ''} → ${s.result || ''}`);
    if (recentTimes.length > 0) {
      context += `Recent signals: ${recentTimes.join('; ')}\n`;
    }

    return context;
  } catch (e) {
    console.error('Learning context fetch error:', e.message);
    return '';
  }
}

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

// Parse JSON bodies
app.use(express.json());

// Cache for loaded netlify functions
const netlifyFunctionCache = {};

// Function to dynamically load a CommonJS module
function loadNetlifyFunction(funcName) {
  // Return cached version if available
  if (netlifyFunctionCache[funcName]) {
    return netlifyFunctionCache[funcName];
  }

  const funcPath = path.resolve(path.join('.', 'netlify', 'functions', `${funcName}.cjs`));
  
  console.log(`Loading Netlify function from: ${funcPath}`);
  
  // Create a fresh require context for this specific function
  const require = createRequire(funcPath);
  
  // Load the CommonJS module
  console.log(`About to require: ${funcPath}`);
  try {
    const funcModule = require(funcPath);
    console.log(`Successfully loaded module, type: ${typeof funcModule}, keys: ${Object.keys(funcModule).join(',')}`);
    netlifyFunctionCache[funcName] = funcModule;
    return funcModule;
  } catch (err) {
    console.log(`Error during require: ${err.message}`);
    console.log(`Error stack: ${err.stack}`);
    throw err;
  }
}

// Netlify functions adapter middleware
app.use(async (req, res, next) => {
  const netlifyFuncMatch = req.path.match(/^\/\.netlify\/functions\/([a-zA-Z0-9\-_]+)$/);
  
  if (!netlifyFuncMatch) {
    return next();
  }

  const funcName = netlifyFuncMatch[1];
  const funcPath = path.join('.', 'netlify', 'functions', `${funcName}.cjs`);

  try {
    // Check if function file exists
    if (!fs.existsSync(funcPath)) {
      return res.status(404).json({ error: `Function ${funcName} not found` });
    }

    // Load the function module
    const funcModule = loadNetlifyFunction(funcName);
    const handler = funcModule.handler;

    console.log(`Loaded function ${funcName}, handler type: ${typeof handler}, module keys: ${Object.keys(funcModule).join(',')}`);

    if (typeof handler !== 'function') {
      return res.status(500).json({ error: `Invalid handler in function ${funcName}` });
    }

    // Build Netlify-compatible event object
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

    // Call the handler
    const result = await handler(event, {});

    // Set response status
    const statusCode = result.statusCode || 200;
    res.status(statusCode);

    // Set response headers from function result
    if (result.headers && typeof result.headers === 'object') {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    // Set response body
    let responseBody = result.body;
    if (result.isBase64Encoded && responseBody) {
      responseBody = Buffer.from(responseBody, 'base64');
    }

    res.send(responseBody || '');
  } catch (error) {
    console.error(`Error calling Netlify function ${funcName}:`, error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Clean URL middleware - serve .html files without extension
app.use((req, res, next) => {
  // Skip if already has extension, is a directory, or is an API route
  if (path.extname(req.path) || req.path === '/' || req.path.startsWith('/analyze') || req.path.startsWith('/uploads')) {
    return next();
  }
  
  // Check if .html version exists
  const htmlPath = path.join('.', req.path + '.html');
  if (fs.existsSync(htmlPath)) {
    return res.sendFile(path.resolve(htmlPath));
  }
  
  // Check for index.html in subfolder (e.g., /digimunx -> /digimunx/index.html)
  const indexPath = path.join('.', req.path, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(path.resolve(indexPath));
  }
  
  next();
});

// Serve static files
app.use(express.static('.', {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// Serve index.html as default
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

// DigimunX route - handle case-insensitive access
app.get('/DigimunX', (req, res) => {
  res.sendFile(path.resolve('./digimunx/index.html'));
});
app.get('/Digimunx', (req, res) => {
  res.sendFile(path.resolve('./digimunx/index.html'));
});
app.get('/DIGIMUNX', (req, res) => {
  res.sendFile(path.resolve('./digimunx/index.html'));
});

// uploads: 5MB images only
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(file.mimetype);
    cb(ok ? null : new Error("Only images (jpg/png/webp) allowed"), ok);
  },
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// helper: convert file → data URL
const toDataURL = (p) => {
  const b64 = fs.readFileSync(p, "base64");
  const ext = (path.extname(p).slice(1) || "png").toLowerCase();
  return `data:image/${ext};base64,${b64}`;
};

// helper: HH:MM in UTC+05:00
function timePK() {
  const n = new Date();
  const utc = n.getTime() + n.getTimezoneOffset() * 60000;
  const pk = new Date(utc + 5 * 60 * 60000);
  const HH = String(pk.getHours()).padStart(2, "0");
  const MM = String(pk.getMinutes()).padStart(2, "0");
  return `${HH}:${MM} UTC+05:00`;
}

app.post("/api/ai-learning-status", async (req, res) => {
  const ADMIN_EMAIL = 'muneebg249@gmail.com';
  const { adminEmail } = req.body || {};
  if (adminEmail !== ADMIN_EMAIL) {
    return res.status(403).json({ status: 'error', issues: ['Unauthorized'], details: {} });
  }

  const diagnostics = {
    status: 'unknown',
    issues: [],
    details: {}
  };

  if (!firestoreDb) {
    diagnostics.status = 'error';
    diagnostics.issues.push('Firebase Admin SDK not initialized - FIREBASE_SERVICE_ACCOUNT environment variable missing or invalid JSON');
    return res.json(diagnostics);
  }

  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      diagnostics.issues.push('OPENAI_API_KEY not set - AI cannot analyze charts or use learning data');
    } else {
      diagnostics.details.openai = 'API key configured';
    }

    const allCompleted = await firestoreDb.collection('signals')
      .where('status', '==', 'completed')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const totalCompleted = allCompleted.size;
    diagnostics.details.totalCompletedSignals = totalCompleted;

    if (totalCompleted === 0) {
      diagnostics.issues.push('No completed signals found in Firestore - AI has zero data to learn from. Users need to submit WIN/LOSS results for their signals first.');
    }

    const signals = [];
    allCompleted.forEach(doc => signals.push(doc.data()));

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
    diagnostics.issues.push(`Firestore query error: ${e.message}`);
    if (e.message.includes('index')) {
      diagnostics.issues.push('Missing Firestore composite index - You need to create an index on "signals" collection for fields: status (==) + createdAt (desc). Click the link in server logs to create it.');
    }
    return res.json(diagnostics);
  }
});

app.post("/analyze", upload.single("chart"), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "No image uploaded" });

  const fp = req.file.path;
  try {
    const imageUrl = toDataURL(fp);
    const pairHint = req.body?.pair_hint || '';

    const learningContext = await getSignalLearningContext(pairHint);

    let systemPrompt = "Analyze ONE 1-minute chart screenshot. Predict ONLY the next 1-minute candle. Confidence 51–95 (never 100). Keep reasons short. If pair not visible → 'Unknown'.";

    if (learningContext) {
      systemPrompt += `\n\nLEARNING FROM PAST SIGNALS:\n${learningContext}\nUse these patterns to improve your analysis accuracy. Avoid patterns that previously led to losses. Favor patterns that previously led to wins.`;
    }

    if (pairHint) {
      systemPrompt += `\n\nHint: The pair being analyzed is likely "${pairHint}".`;
    }

    // Strongly-typed JSON output
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
          entry_tip: { type: "string" }
        },
        required: ["signal","direction","arrow","confidence","reason","failure_reason","entry_tip"],
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

    // server-side defaults/safety
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

    const signalTime = timePK();
    const signalData = {
      pair,
      direction,
      signal,
      confidence: conf,
      reason,
      failureReason: fail,
      entryTip: tip,
      signalTime
    };

    fs.unlink(fp, () => {});
    res.json({ ok: true, message: msg, signalData });
  } catch (e) {
    fs.unlink(fp, () => {});
    res.status(500).json({ ok: false, error: e.message });
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

app.post("/api/upload-ticket-attachment", ticketUpload.single("file"), async (req, res) => {
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
    console.error("Cloudinary upload error:", e);
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
    console.error('DigimunX stats proxy error:', e);
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
    console.error('DigimunX signals proxy error:', e);
    res.json({ success: false, error: 'Failed to fetch signals', signals: [] });
  }
});

app.post('/api/admin/delete-account', async (req, res) => {
  const { adminEmail, userEmail } = req.body || {};

  if (adminEmail !== 'muneebg249@gmail.com') {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  if (!userEmail || userEmail.toLowerCase().trim() === adminEmail.toLowerCase().trim()) {
    return res.status(400).json({ success: false, message: 'Invalid user email provided' });
  }

  const emailLower = userEmail.toLowerCase().trim();

  try {
    try {
      const userRecord = await admin.auth().getUserByEmail(emailLower);
      await admin.auth().deleteUser(userRecord.uid);
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') {
        console.error('Firebase Auth delete error:', authErr.message);
      }
    }

    if (firestoreDb) {
      await firestoreDb.collection('users').doc(emailLower).delete();

      await firestoreDb.collection('deletedAccounts').doc(emailLower).set({
        email: emailLower,
        deletedAt: new Date(),
        deletedBy: adminEmail,
        reason: 'Deleted by admin upon user request'
      });
    }

    return res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to delete account: ' + err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log("Digimun server running on port " + PORT));
