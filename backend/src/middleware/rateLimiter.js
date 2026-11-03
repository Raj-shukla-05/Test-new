/**
 * Lightweight in-memory rate limiter middleware.
 * Implements a sliding window counter per client IP or user ID.
 */
function createRateLimiter({ windowMs = 60 * 1000, max = 30, message = 'Too many requests, please try again later.' } = {}) {
  const hits = new Map();

  // Cleanup expired entries periodically (every 5 minutes)
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now - record.resetTime > windowMs) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupTimer.unref) cleanupTimer.unref();

  return (req, res, next) => {
    const key = req.user?.userId || req.ip || req.headers['x-forwarded-for'] || 'anonymous';
    const now = Date.now();

    let record = hits.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        message,
        retryAfter: retryAfterSeconds,
      });
    }

    next();
  };
}

module.exports = { createRateLimiter };
