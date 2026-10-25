import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Rate limiter for authentication endpoint: 10 attempts per 15 minutes per IP
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication routes
router.post('/auth/login', loginRateLimiter, (req, res, next) => authController.login(req, res, next));
router.get('/auth/me', authMiddleware, (req, res, next) => authController.getMe(req, res, next));
router.post('/auth/logout', (req, res, next) => authController.logout(req, res, next));

// System Health Check
router.get('/health', (req, res, next) => authController.healthCheck(req, res, next));

export default router;
