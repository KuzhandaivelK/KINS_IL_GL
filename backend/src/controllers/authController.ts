import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { checkDatabaseHealth } from '../config/database';
import { env } from '../config/env';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50, 'Username too long'),
  password: z.string().min(1, 'Password is required')
});

export class AuthController {
  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = loginSchema.parse(req.body);

      const { user, token } = await authService.authenticate(username, password);

      // Set secure HttpOnly cookie for session management
      // 15 minutes = 15 * 60 * 1000 ms
      const maxAge = 15 * 60 * 1000;

      res.cookie('authToken', token, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: maxAge,
        path: '/'
      });

      res.status(200).json({
        success: true,
        message: 'Authentication successful',
        data: {
          user,
          token // Also provided for clients utilizing Bearer token header
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/me
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
        return;
      }

      const user = await authService.getProfile(req.user.userId);

      res.status(200).json({
        success: true,
        data: {
          user
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Clear authentication cookie
      res.clearCookie('authToken', {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: 'lax',
        path: '/'
      });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/health
   */
  async healthCheck(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dbHealth = await checkDatabaseHealth();
      const isHealthy = dbHealth.status === 'UP';

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'UP' : 'DEGRADED',
        database: dbHealth.status,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
