import { Request, Response, NextFunction } from 'express';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('Unhandled error:', err);
  if (err?.name === 'MongoServerError' && err?.code === 11000) {
    res.status(409).json({ error: 'Resource already exists', key: Object.keys(err.keyValue || {})[0] });
    return;
  }
  res.status(err?.status || 500).json({
    error: err?.message || 'Internal server error',
  });
}
