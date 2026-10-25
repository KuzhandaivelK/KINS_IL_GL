import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../services/authService';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If it's a known authentication or authorization error
  if (err instanceof AuthenticationError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
    return;
  }

  // If it's a request validation error (Zod)
  if (err instanceof ZodError) {
    const errorDetails = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message
    }));
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorDetails
    });
    return;
  }

  // Internal or Oracle Database errors:
  // Log sanitized error message on server, NEVER send SQL or stack trace to client
  console.error('[ServerError]', {
    name: err?.name,
    message: err?.message,
    timestamp: new Date().toISOString()
  });

  res.status(500).json({
    success: false,
    message: 'An unexpected internal error occurred. Please try again later.'
  });
}
