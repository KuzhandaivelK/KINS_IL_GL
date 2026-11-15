import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import menuRoutes from './routes/menuRoutes';
import customerRoutes from './routes/customerRoutes';
import tariffRoutes from './routes/tariffRoutes';
import coverRoutes from './routes/coverRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration for frontend
app.use(
  cors({
    origin: [env.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Body parsers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Request logger (safe, no passwords or tokens logged)
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Mount API routes
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/tariff', tariffRoutes);
app.use('/api/covers', coverRoutes);

// Centralized error handling
app.use(errorHandler);

export default app;
