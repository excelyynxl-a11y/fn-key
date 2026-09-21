import { randomUUID } from 'node:crypto';

export function requestContext(req, res, next) {
  const supplied = req.get('x-request-id');
  req.requestId = supplied && /^[A-Za-z0-9._-]{1,100}$/.test(supplied) ? supplied : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');

  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && ('data' in body || 'error' in body)) {
      body.meta = { ...(body.meta ?? {}), requestId: req.requestId };
    }
    return sendJson(body);
  };
  next();
}

export function corsOptionsFromEnvironment(value = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173') {
  const allowedOrigins = String(value).split(',').map((origin) => origin.trim()).filter(Boolean);
  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      const error = new Error('Origin is not allowed');
      error.code = 'CORS_DENIED';
      error.statusCode = 403;
      error.retryable = false;
      return callback(error);
    }
  };
}

export function createRateLimiter({
  maximum = Number(process.env.API_RATE_LIMIT_MAXIMUM ?? 300),
  windowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000),
  now = Date.now
} = {}) {
  const clients = new Map();
  const effectiveMaximum = Number.isFinite(maximum) && maximum > 0 ? Math.floor(maximum) : 300;
  const effectiveWindowMs = Number.isFinite(windowMs) && windowMs > 0 ? Math.floor(windowMs) : 60_000;
  return (req, res, next) => {
    const timestamp = now();
    const key = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const current = clients.get(key);
    const entry = !current || timestamp - current.startedAt >= effectiveWindowMs
      ? { startedAt: timestamp, count: 0 }
      : current;
    entry.count += 1;
    clients.set(key, entry);
    res.setHeader('ratelimit-limit', String(effectiveMaximum));
    res.setHeader('ratelimit-remaining', String(Math.max(0, effectiveMaximum - entry.count)));
    if (entry.count <= effectiveMaximum) return next();
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.startedAt + effectiveWindowMs - timestamp) / 1000));
    res.setHeader('retry-after', String(retryAfterSeconds));
    return res.status(429).json({
      data: null,
      error: { code: 'RATE_LIMITED', message: 'Too many API requests', retryable: true },
      meta: { retryAfterSeconds }
    });
  };
}
