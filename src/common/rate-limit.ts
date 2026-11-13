type Bucket = { n: number; reset: number };

const buckets = new Map<string, Bucket>();

/** Returns true when the request is allowed. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  bucket.n += 1;
  if (bucket.n > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}
