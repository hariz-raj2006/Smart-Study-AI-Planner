import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Always load server/.env, no matter which folder you start Node from.
const serverRoot = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(serverRoot, '.env') });

const env = process.env;
const nodeEnv = env.NODE_ENV || 'development';

const sessionSecret = (env.SESSION_SECRET || '').trim();
if (sessionSecret.length < 16 || sessionSecret.startsWith('replace_with')) {
  throw new Error(
    'SESSION_SECRET is missing or too weak. Open server/.env and set SESSION_SECRET ' +
      'to a long random string (the README explains how to generate one).'
  );
}

const geminiKey = (env.GEMINI_API_KEY || '').trim();
const geminiModel = (env.GEMINI_MODEL || '').trim();

export const config = {
  serverRoot,
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(env.PORT) || 5000,
  clientUrl: (env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, ''),
  sessionSecret,
  cookieName: 'smartstudy_token',
  sessionDays: 7,
  databasePath: path.resolve(serverRoot, env.DATABASE_PATH || './database/smartstudy.json'),
  gemini: {
    apiKey: geminiKey,
    model: geminiModel,
    timeoutMs: Number(env.GEMINI_TIMEOUT_MS) || 45000,
    // The placeholder text from .env.example does not count as a real key.
    configured: Boolean(geminiKey) && !geminiKey.startsWith('your_') && Boolean(geminiModel),
  },
};