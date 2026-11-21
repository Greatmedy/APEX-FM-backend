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
import { publicAds } from './routes/ads.js';
import pushRoutes from './routes/push.js';
import { gamesRouter } from './routes/games.js';
import { apexGTRouter } from './routes/apex-gt.js';
import { whotRouter } from './routes/whot.js';
import { ludoRouter } from './routes/ludo.js';
import { bindGameIO, races } from './services/gameEngine.js';

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
app.use('/api/ads', publicAds);
app.use('/api/push', pushRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/templates', templates);
app.use('/api', publicHome);
app.use('/api/onboarding', onboarding);
app.use('/api/league', league);
app.use('/api/clubs', clubs);
app.use('/api/tactics', tacticsRouter);
app.use('/api/matches', matches);
app.use('/api', home);
app.use('/api/games', gamesRouter);
app.use('/api/games/apex-gt', apexGTRouter);
app.use('/api/games/whot', whotRouter);
app.use('/api/games/ludo', ludoRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/ads', publicAds);
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.name === 'CastError') return res.status(400).json({ error: 'Invalid id.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Upload is too large.' });
  if (err?.message === 'Origin not allowed') return res.status(403).json({ error: 'Origin not allowed.' });
  // Validation errors from game engine - return 400 with actual message
  const validationErrors = [
    'Every racer must be ready',
    'Race already started',
    'Race is full',
    'Need at least',
    'Insufficient virtual funds',
    'Unknown venue',
    'Bet must be',
    'Already in this race',
    'Not your turn',
    'Card does not match',
    'Market is empty',
    'Whot card requires',
    'It is not your turn',
    'Table is not playing',
    'Table already playing',
    'Game not playing',
    'Roll the die first',
    'Move exceeds board',
    'You need a 6',
    'Invalid token',
  ];
  if (validationErrors.some(v => err?.message?.includes?.(v))) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
});

const io = new Server(server, { cors: { origin: allow, credentials: true }, pingInterval: 10000, pingTimeout: 15000 });
setIO(io);
bindGameIO(io);
io.use((socket, next) => {
  try { socket.data.uid = verifyToken(socket.handshake.auth?.token || '').id; } catch { socket.data.uid = null; }
  next();
});
io.on('connection', (socket) => {
  if (socket.data.uid) socket.join('user:' + socket.data.uid);
  socket.on('join', (fixtureId, ack) => { if (/^[a-f\d]{24}$/i.test(String(fixtureId))) socket.join('fixture:' + fixtureId); if (typeof ack === 'function') ack({ serverNow: Date.now() }); });
  socket.on('leave', (fixtureId) => socket.leave('fixture:' + fixtureId));
  socket.on('ping-time', (ack) => typeof ack === 'function' && ack({ serverNow: Date.now() }));

  // ---- APEX GT live rooms ----
  socket.on('race:join-room', (raceId) => { if (/^[a-f\d]{24}$/i.test(String(raceId))) socket.join('race:' + raceId); });
  socket.on('race:leave-room', (raceId) => socket.leave('race:' + raceId));

  // Race input handling - store in race memory for physics tick
  socket.on('race:input', (data) => {
    const raceId = data?.raceId;
    if (!raceId || !/^[a-f\d]{24}$/i.test(String(raceId))) return;
    const mem = races.get(String(raceId));
    if (!mem || !mem.physics || mem.physics.state !== 'STARTED') return;

    const car = mem.physics.participants.find(c => c.user === socket.data.uid);
    if (!car || car.ai) return; // AI cars don't accept input

    // Validate and clamp inputs
    car.steer = Math.max(-1, Math.min(1, Number(data.steer) || 0));
    car.accelerate = Math.max(0, Math.min(1, Number(data.accelerate) || 0));
    car.brake = Math.max(0, Math.min(1, Number(data.brake) || 0));
    car.nitro = !!data.nitro;
  });

  // Request full state sync (for reconnection)
  socket.on('race:request-sync', (data) => {
    const raceId = data?.raceId;
    if (!raceId || !/^[a-f\d]{24}$/i.test(String(raceId))) return;
    const mem = races.get(String(raceId));
    if (!mem || !mem.physics) return;

    const physics = mem.physics;
    const cars = physics.participants.map(car => ({
      user: car.user,
      x: car.x,
      z: car.z,
      angle: car.angle,
      speed: Math.round(car.speed * 3.6),
      progress: car.progress,
      lapsCompleted: car.lapsCompleted,
      position: car.position,
      finished: car.finished,
      ai: car.ai,
      car: car.car,
      paint: car.paint,
    }));

    socket.emit('race-tick', {
      cars,
      timestamp: now(),
      tick: mem.tickCount || 0,
      trackPoints: physics.trackPoints.map(p => ({ x: p.x, z: p.z, width: p.width })),
      laps: physics.laps,
      startedAt: physics.startedAt,
    });
  });

  // ---- Whot live rooms ----
  socket.on('whot:join-room', (tableId) => { if (/^[a-f\d]{24}$/i.test(String(tableId))) socket.join('whot:' + tableId); });
  socket.on('whot:leave-room', (tableId) => socket.leave('whot:' + tableId));

  // ---- Ludo live rooms ----
  socket.on('ludo:join-room', (gameId) => { if (/^[a-f\d]{24}$/i.test(String(gameId))) socket.join('ludo:' + gameId); });
  socket.on('ludo:leave-room', (gameId) => socket.leave('ludo:' + gameId));
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
