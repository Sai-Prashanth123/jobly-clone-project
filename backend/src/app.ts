import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { env } from './config/env';
import { supabaseAdmin } from './config/supabase';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { originVerify } from './middleware/originVerify';
import { router } from './routes';

const app = express();

// Trust Azure / reverse-proxy X-Forwarded-For headers (fixes express-rate-limit warning)
app.set('trust proxy', 1);

// Request ID (must be first)
app.use(requestId);

// Security
app.use(helmet());
app.use(cors({
  origin: [env.FRONTEND_URL, 'http://localhost:8080', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // X-Silent-Error: opt-out header the frontend apiClient sends on requests
  // whose errors it handles itself (e.g. useEmployee tolerating a 404 for a
  // deleted employee) so the global error toast stays quiet. Must be allowed
  // here or the CORS preflight rejects the request entirely.
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Silent-Error'],
}));

// Request parsing
app.use(compression() as express.RequestHandler);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// Rate limiting
app.use('/api', apiLimiter);

// Only CloudFront-originated traffic may reach the API. Scoped to /api so
// /health stays reachable directly for uptime checks, which carry no data and
// no credentials. No-op unless ORIGIN_VERIFY_SECRET is set.
app.use('/api', originVerify);

// Health check
// This checks the database, which makes it the only honest post-deploy signal.
//
// Registered at BOTH paths deliberately. CloudFront only forwards /api/* to the
// Lambda, so a request to the bare /health at the edge is served the SPA's
// index.html with a 200 — which is what made `curl /health` look like a passing
// health check while the API underneath was returning a 404 for every record in
// the app. Verification has to use /api/v1/health.
const healthHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { error } = await supabaseAdmin.from('portal_users').select('id').limit(1);
    res.status(error ? 503 : 200).json({
      status: error ? 'degraded' : 'ok',
      db: error ? 'error' : 'connected',
      ...(error && { dbError: error.message, dbCode: error.code }),
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: 'unreachable',
      dbError: (err as Error)?.message,
      timestamp: new Date().toISOString(),
    });
  }
};

app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// API routes
app.use('/api/v1', router);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

export { app };
