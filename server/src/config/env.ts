import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from monorepo root (two levels up from src/config/)
loadEnv({ path: path.resolve(__dirname, '../../../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  CLIENT_ORIGIN: z.string().url().default('http://vixi.local'),
  PUBLIC_BASE_URL: z.string().url().default('http://vixi.local'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  INVITE_EXPIRES_DAYS: z.coerce.number().default(7),

  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 chars'),

  MONGODB_URI: z.string().url(),
  MONGODB_DB: z.string().default('vixi'),

  R2_ACCOUNT_ID: z.string(),
  R2_BUCKET: z.string().default('vixi'),
  R2_REGION: z.string().default('auto'),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_ENDPOINT: z.string().url(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
