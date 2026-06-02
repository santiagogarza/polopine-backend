import type { Request, Response, NextFunction, RequestHandler } from "express";

interface Bucket {
  hits: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests per key per window. */
  max: number;
  /** Optional key extractor; defaults to `req.ip` (set `trust proxy` for Render). */
  key?: (req: Request) => string;
}

/**
 * Tiny in-memory fixed-window rate limiter. Per-process state; resets on
 * deploy, which is acceptable for the only current caller (`/admin/verify`).
 * No external deps to keep with the "no new infra" demo posture.
 */
export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const keyFn = opts.key ?? ((req) => req.ip ?? "unknown");

  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const now = Date.now();
    const key = keyFn(req);
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { hits: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }

    if (existing.hits >= opts.max) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    existing.hits += 1;
    next();
  };
}
