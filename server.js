import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import "dotenv/config";
import OpenAI from "openai";
import { v2 as cloudinary } from "cloudinary";

const app = express();

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

app.post("/analyze", upload.single("chart"), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "No image uploaded" });

  const fp = req.file.path;
  try {
    const imageUrl = toDataURL(fp);

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
        { role: "system", content: [{ type: "input_text", text:
          "Analyze ONE 1-minute chart screenshot. Predict ONLY the next 1-minute candle. Confidence 51–95 (never 100). Keep reasons short. If pair not visible → 'Unknown'." }]},
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log("Digimun server running on port " + PORT));
