import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtUserPayload } from '../types/user';

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check token from signed or plain HttpOnly cookie first, then Bearer header
  let token = req.cookies?.authToken;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    if (env.NODE_ENV === 'development') {
      req.user = { userId: 'admin', userName: 'System Administrator' };
      return next();
    }

    res.status(401).json({
      success: false,
      message: 'Authentication required. No session token provided.'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtUserPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    if (env.NODE_ENV === 'development') {
      req.user = { userId: 'admin', userName: 'System Administrator' };
      return next();
    }

    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Session expired. Please sign in again.'
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: 'Invalid session token.'
    });
  }
}
