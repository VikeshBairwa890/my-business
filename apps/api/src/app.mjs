import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import { corsMiddleware } from './middlewares/CorsMiddleware.mjs';
import { errorHandler } from './middlewares/ErrorMiddleware.mjs';
import apiRouter from './routes/index.mjs';
import prisma from './prisma.mjs';

export function createApp(db = null, options = {}) {
  const app = express();
  const testing = Boolean(options.testing);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  }));

  app.use(corsMiddleware);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  if (!testing) {
    app.use(rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }));
  }

  // Health Check
  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, database: 'postgresql' });
    } catch {
      res.status(500).json({ ok: false, error: 'Database disconnected' });
    }
  });

  // Application Routes
  app.use(apiRouter);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export default createApp;
