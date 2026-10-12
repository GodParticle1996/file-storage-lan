import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: 'admin' | 'user';
  user?: {
    id: string;
    email: string;
    role: 'admin' | 'user';
    displayName: string;
    storageBytes: number;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const tokenMatch = header.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      res.status(401).json({ error: 'Missing or malformed Authorization header' });
      return;
    }
    const token = tokenMatch[1];
    let payload: any;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'Account does not exist or is disabled' });
      return;
    }
    req.userId = user.id;
    req.userRole = user.role;
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      storageBytes: user.storageBytes || 0,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Like authMiddleware, but continues anonymously when no valid token is supplied. */
export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const tokenMatch = header.match(/^Bearer\s+(.+)$/i);
    if (tokenMatch) {
      try {
        const payload: any = jwt.verify(tokenMatch[1], env.JWT_SECRET);
        const user = await User.findById(payload.sub);
        if (user && user.status === 'active') {
          req.userId = user.id;
          req.userRole = user.role;
          req.user = { id: user.id, email: user.email, role: user.role, displayName: user.displayName, storageBytes: user.storageBytes || 0 };
        }
      } catch {
        // invalid/expired token → treat as anonymous
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
