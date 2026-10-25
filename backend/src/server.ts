import app from './app';
import { env } from './config/env';
import { initializeDatabasePool, closeDatabasePool } from './config/database';

async function startServer() {
  try {
    console.log('====================================================');
    console.log('  LIFE INSURANCE CORE SYSTEM - BACKEND API SERVER   ');
    console.log('====================================================');

    // Attempt to initialize Oracle connection pool
    try {
      await initializeDatabasePool();
    } catch (dbErr: any) {
      console.warn('[Warning] Initial Oracle pool startup failed (server will still start):', dbErr?.message || dbErr);
      console.warn('[Warning] Ensure ORACLE_PASSWORD in backend/.env is correct and Oracle 19c is running.');
    }

    const server = app.listen(env.PORT, () => {
      console.log(`[Server] Backend service listening on http://localhost:${env.PORT}`);
      console.log(`[Server] Health check endpoint: http://localhost:${env.PORT}/api/health`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await closeDatabasePool();
        console.log('[Server] HTTP server and database pool closed.');
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        console.error('[Server] Forceful shutdown initiated after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
}

startServer();
