import { Router } from 'express';
import { auth, needClub, wrap } from '../middleware/auth.js';
import { Fixture, Notification, Post, Setting, Club } from '../models/index.js';
import { getTable } from '../services/standings.js';
import { currentSeason } from '../services/seasons.js';
import { tierName } from '../services/clubs.js';
import { config } from '../config.js';
import { fxOut, clubBrief } from './league.js';

export const getWhatsapp = async () => (await Setting.findOne({ key: 'whatsapp' }).lean())?.value ?? config.whatsapp;

export const publicRouter = Router();
publicRouter.get('/config', wrap(async (req, res) => {
  const s = await currentSeason();
  res.json({ whatsappLink: await getWhatsapp(), season: s && { number: s.number, startsAt: s.startsAt, endsAt: s.endsAt, breakUntil: s.breakUntil }, serverNow: Date.now() });
}));

const r = Router();
r.use(auth);
const POP = 'displayName short crestColors kit isAI managerName stadiumName forfeited leagueTier';

r.get('/home', needClub, wrap(async (req, res) => {
  const club = req.club;
  const season = await currentSeason();
  const table = await getTable(season.number, club.leagueTier);
  const rank = table.find((x) => String(x.club._id) === String(club._id))?.pos || null;
  const mine = await Fixture.find({ season: season.number, $or: [{ home: club._id }, { away: club._id }] }).sort({ gameweek: 1 }).populate('home away', POP).lean();
  const done = mine.filter((f) => ['finished', 'forfeit'].includes(f.status));
  const next = mine.find((f) => ['scheduled', 'starting', 'live'].includes(f.status));
  const unread = await Notification.countDocuments({ user: req.user._id, readAt: null });
  const now = Date.now();
  res.json({
    club: { ...clubBrief(club), fans: club.fans, seasonForm: club.seasonForm, tier: club.leagueTier, league: tierName(club.leagueTier) },
    rank, season: { number: season.number, startsAt: season.startsAt, endsAt: season.endsAt, breakUntil: season.breakUntil, phase: now < season.startsAt.getTime() ? (season.number > 1 ? 'offseason' : 'preseason') : 'active' },
    table: table.map((x) => ({ pos: x.pos, club: clubBrief(x.club), played: x.played, won: x.won, drawn: x.drawn, lost: x.lost, gf: x.gf, ga: x.ga, gd: x.gd, pts: x.pts })),
    last: done.length ? fxOut(done[done.length - 1]) : null, next: next ? fxOut(next) : null, unread, whatsappLink: await getWhatsapp(), serverNow: now,
    played: done.length, total: mine.length,
  });
}));

r.get('/notifications', wrap(async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(40).lean();
  res.json({ items, unread: items.filter((i) => !i.readAt).length });
}));
r.post('/notifications/read', wrap(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
}));

const last = new Map();
r.get('/board', wrap(async (req, res) => {
  const items = await Post.find({}).sort({ createdAt: -1 }).limit(40).lean();
  res.json({ items });
}));
r.post('/board', wrap(async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (text.length < 1 || text.length > 280) return res.status(400).json({ error: 'Posts are 1-280 characters.' });
  const k = String(req.user._id);
  if (Date.now() - (last.get(k) || 0) < 4000) return res.status(429).json({ error: 'Slow down. Wait a few seconds between posts.' });
  last.set(k, Date.now());
  const club = req.user.clubId ? await Club.findById(req.user.clubId).select('displayName').lean() : null;
  const post = await Post.create({ user: req.user._id, author: req.user.managerName || req.user.usernameDisplay, clubName: club?.displayName || (req.user.role === 'admin' ? 'APEX Admin' : ''), text });
  res.status(201).json({ post });
}));
export default r;
