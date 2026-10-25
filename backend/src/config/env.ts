import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from backend root or parent if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  ORACLE_USER: z.string().default('KINS'),
  ORACLE_PASSWORD: z.string().default(''),
  ORACLE_CONNECT_STRING: z.string().default('localhost:1521/orcl'),
  JWT_SECRET: z.string().default('life_insurance_core_jwt_secret_key_2026_super_secure'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  COOKIE_SECURE: z.string().default('false').transform((val) => val.toLowerCase() === 'true'),
  NODE_ENV: z.string().default('development')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
