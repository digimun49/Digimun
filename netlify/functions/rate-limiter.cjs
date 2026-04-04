const rateLimitStore = {};

const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const key of Object.keys(rateLimitStore)) {
    const entry = rateLimitStore[key];
    if (entry.timestamps.length === 0 || now - entry.timestamps[entry.timestamps.length - 1] > 60 * 60 * 1000) {
      delete rateLimitStore[key];
    }
  }
}

function isRateLimited(identifier, { maxRequests = 5, windowMs = 60000 } = {}) {
  cleanup();
  const now = Date.now();
  const key = identifier;

  if (!rateLimitStore[key]) {
    rateLimitStore[key] = { timestamps: [] };
  }

  const entry = rateLimitStore[key];
  entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return { limited: true, retryAfterMs: Math.ceil(retryAfterMs) };
  }

  entry.timestamps.push(now);
  return { limited: false };
}

function getClientIP(event) {
  return (
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['x-real-ip'] ||
    event.headers['client-ip'] ||
    'unknown'
  );
}

module.exports = { isRateLimited, getClientIP };
