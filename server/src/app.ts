import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { authMiddleware } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import folderRoutes from './routes/folders.js';
import fileRoutes from './routes/files.js';
import shareRoutes from './routes/shares.js';
import { bootstrapAdmin } from './services/bootstrap.js';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: [env.CLIENT_ORIGIN], credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  const limiter = rateLimit({ windowMs: 60_000, max: 240, standardHeaders: true, legacyHeaders: false });
  app.use('/api', limiter);

  app.get('/health', (_req: Request, res: Response) => res.json({ ok: true, ts: new Date().toISOString() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/folders', folderRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/shares', shareRoutes);

  app.use('/api/me', authMiddleware, (req: Request, res: Response) => {
    res.json({ user: (req as any).user });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

// Re-export for tests
export default async function main() {
  const { connectDb } = await import('./config/db.js');
  await connectDb();
  await bootstrapAdmin();
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`✓ Vixi API listening on :${env.PORT} (${env.NODE_ENV})`);
  });
}
