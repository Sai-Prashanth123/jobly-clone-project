import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { env } from './config/env';
import { supabaseAdmin } from './config/supabase';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
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
  allowedHeaders: ['Content-Type', 'Authorization'],
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

// Health check
app.get('/health', async (_req, res) => {
  try {
    const { error } = await supabaseAdmin.from('portal_users').select('id').limit(1);
    res.json({ status: error ? 'degraded' : 'ok', db: error ? 'error' : 'connected', timestamp: new Date().toISOString(), env: env.NODE_ENV });
  } catch {
    res.status(503).json({ status: 'error', db: 'unreachable', timestamp: new Date().toISOString() });
  }
});

// API routes
app.use('/api/v1', router);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

export { app };
