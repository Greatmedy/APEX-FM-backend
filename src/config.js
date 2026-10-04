import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/apex-fm',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  whatsapp: process.env.WHATSAPP_GROUP_LINK || '',
  seasonStart: process.env.SEASON_START || '2026-11-02',
  gmailUser: process.env.GMAIL_USER || '',
  gmailPass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''),
  mailFrom: process.env.MAIL_FROM || process.env.GMAIL_USER || '',
  clientUrl: (process.env.CLIENT_URL || (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0]).trim().replace(/\/$/, ''),
};

// Timing rules (all kickoffs are 20:00 WAT = 19:00 UTC)
export const READY_WINDOW_MS = 10 * 60 * 1000;
export const HALF_REAL_SEC = 300; // 45 match minutes in 5 real minutes
export const HT_REAL_SEC = 20;
export const MATCH_SEC = 5400;
export const HALF_MATCH_SEC = 2700;
export const TOTAL_REAL_SEC = HALF_REAL_SEC * 2 + HT_REAL_SEC;
