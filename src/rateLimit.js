import { config } from "./config.js";
import { ApiError, errorBody } from "./errors.js";

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createRateLimiter(options = {}) {
  const enabled = options.enabled ?? config.rateLimitEnabled;
  const windowMs = options.windowMs ?? config.rateLimitWindowMs;
  const maxRequests = options.maxRequests ?? config.rateLimitMaxRequests;
  const keyGenerator = options.keyGenerator || clientKey;
  const now = options.now || (() => Date.now());
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    if (!enabled) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const timestamp = now();
    const current = buckets.get(key);
    const bucket =
      current && current.resetAt > timestamp
        ? current
        : {
            count: 0,
            resetAt: timestamp + windowMs
          };

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, maxRequests - bucket.count);
    res.set("X-RateLimit-Limit", String(maxRequests));
    res.set("X-RateLimit-Remaining", String(remaining));
    res.set("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - timestamp) / 1000));
      res.set("Retry-After", String(retryAfter));
      res
        .status(429)
        .json(errorBody(new ApiError(429, "rate_limited", "too many requests", { retryAfter })));
      return;
    }

    next();
  };
}
