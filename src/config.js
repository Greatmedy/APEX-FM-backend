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
  vapidPublic: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivate: process.env.VAPID_PRIVATE_KEY || '',
  vapidSubject: process.env.VAPID_SUBJECT || (process.env.GMAIL_USER ? 'mailto:' + process.env.GMAIL_USER : 'mailto:admin@example.com'),
  clientUrl: (process.env.CLIENT_URL || (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0]).trim().replace(/\/$/, ''),
};

// Timing rules (all kickoffs are 20:00 WAT = 19:00 UTC)
export const READY_WINDOW_MS = 10 * 60 * 1000;
export const HALF_REAL_SEC = 300; // 45 match minutes in 5 real minutes
export const HT_REAL_SEC = 20;
export const MATCH_SEC = 5400;
export const HALF_MATCH_SEC = 2700;
export const TOTAL_REAL_SEC = HALF_REAL_SEC * 2 + HT_REAL_SEC;

// Divisions: 20 clubs each. Division N+1 opens only when every club in the divisions above is human-managed.
export const TIER_SIZE = 20;
export const MAX_TIERS = 5;
// Fans awarded to the champions of each division at season end.
export const CHAMPION_FANS = { 1: 50000, 2: 30000, 3: 20000, 4: 15000, 5: 10000 };
