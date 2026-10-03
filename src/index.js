import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Server } from 'socket.io';
import { config } from './config.js';
import { User, Setting } from './models/index.js';
import { verifyToken } from './middleware/auth.js';
import { setIO } from './services/notify.js';
import { bootstrapLeagues } from './services/seasons.js';
import { resumeAll } from './services/matchFlow.js';
import { startScheduler } from './jobs/scheduler.js';
import { parseSeasonStart } from './lib/time.js';
import authRoutes from './routes/auth.js';
import onboarding, { publicRouter as templates } from './routes/onboarding.js';
import league from './routes/league.js';
import clubs, { tacticsRouter } from './routes/clubs.js';
import matches from './routes/matches.js';
import home, { publicRouter as publicHome } from './routes/home.js';
import adminRoutes from './routes/admin.js';

const app = express();
const server = http.createServer(app);
const allow = (origin, cb) => {
  if (!origin || config.clientOrigins.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin) || /\.vercel\.app$/.test(origin) && config.clientOrigins.some((o) => o.includes('vercel.app'))) return cb(null, true);
  cb(new Error('Origin not allowed'));
};
app.set('trust proxy', 1);
app.use(cors({ origin: allow, credentials: true }));
app.use(express.json({ limit: '200kb' }));

app.get('/', (req, res) => res.json({ name: 'APEX FM 2027 API', ok: true }));
app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));
app.use('/api/auth', authRoutes);
app.use('/api/templates', templates);
app.use('/api', publicHome);
app.use('/api/onboarding', onboarding);
app.use('/api/league', league);
app.use('/api/clubs', clubs);
app.use('/api/tactics', tacticsRouter);
app.use('/api/matches', matches);
app.use('/api', home);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.name === 'CastError') return res.status(400).json({ error: 'Invalid id.' });
  if (err?.message === 'Origin not allowed') return res.status(403).json({ error: 'Origin not allowed.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
});

const io = new Server(server, { cors: { origin: allow, credentials: true }, pingInterval: 10000, pingTimeout: 15000 });
setIO(io);
io.use((socket, next) => {
  try { socket.data.uid = verifyToken(socket.handshake.auth?.token || '').id; } catch { socket.data.uid = null; }
  next();
});
io.on('connection', (socket) => {
  if (socket.data.uid) socket.join('user:' + socket.data.uid);
  socket.on('join', (fixtureId, ack) => { if (/^[a-f\d]{24}$/i.test(String(fixtureId))) socket.join('fixture:' + fixtureId); if (typeof ack === 'function') ack({ serverNow: Date.now() }); });
  socket.on('leave', (fixtureId) => socket.leave('fixture:' + fixtureId));
  socket.on('ping-time', (ack) => typeof ack === 'function' && ack({ serverNow: Date.now() }));
});

async function seedBasics() {
  if (config.adminEmail && config.adminPassword) {
    const exists = await User.findOne({ email: config.adminEmail });
    if (!exists) {
      await User.create({ username: 'admin', usernameDisplay: 'admin', email: config.adminEmail, passwordHash: await bcrypt.hash(config.adminPassword, 10), role: 'admin', managerName: 'APEX Admin', onboarding: { step: 'done' } });
      console.log('[apex] admin account seeded from env');
    } else if (exists.role !== 'admin') { exists.role = 'admin'; await exists.save(); }
  }
  if (!(await Setting.exists({ key: 'whatsapp' }))) await Setting.create({ key: 'whatsapp', value: config.whatsapp });
}

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('[apex] mongo connected');
  await seedBasics();
  await bootstrapLeagues(parseSeasonStart(config.seasonStart));
  await resumeAll();
  startScheduler();
  server.listen(config.port, () => console.log(`[apex] API + live clock on :${config.port}`));
}
main().catch((e) => { console.error('Fatal startup error', e); process.exit(1); });
