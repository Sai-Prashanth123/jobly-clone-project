import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

// Azure passes IP:PORT in X-Forwarded-For — strip the port so express-rate-limit accepts it
const keyGenerator = (req: Request): string => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return ip.replace(/:\d+$/, '').replace(/^::ffff:/, '');
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { success: false, error: 'Too many requests, please try again later' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { success: false, error: 'Too many login attempts, please try again later' },
});
