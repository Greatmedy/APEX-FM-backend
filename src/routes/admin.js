import { Router } from 'express';
import { auth, admin, wrap } from '../middleware/auth.js';
import { Club, Player, Fixture, Setting, Post, User } from '../models/index.js';
import { setPlainResult } from '../services/results.js';
import { rolloverSeason, currentSeason } from '../services/seasons.js';
import { freeSlots } from '../services/clubs.js';
import { getRunner, runnerCount } from '../sim/runner.js';
import { getWhatsapp } from './home.js';
import { fxOut } from './league.js';

const r = Router();
r.use(auth, admin);

r.get('/overview', wrap(async (req, res) => {
  const season = await currentSeason();
  const slots = [];
  for (const tier of [1, 2]) {
    const humans = await Club.countDocuments({ leagueTier: tier, isAI: false });
    slots.push({ tier, humans, ai: await Club.countDocuments({ leagueTier: tier, isAI: true }), free: await freeSlots(tier) });
  }
  const forfeits = await Club.find({ forfeited: true }).select('displayName leagueTier').lean();
  const ai = await Club.find({ isAI: true }).select('displayName leagueTier').sort({ leagueTier: 1, displayName: 1 }).lean();
  const waitlist = await User.countDocuments({ 'onboarding.step': 'waitlist' });
  const crashed = await Fixture.find({ status: 'live' }).select('_id gameweek leagueTier').lean();
  res.json({ season, slots, forfeits, ai, waitlist, liveRunners: runnerCount(), liveFixtures: crashed.map((f) => ({ ...f, running: !!getRunner(f._id) })), whatsappLink: await getWhatsapp() });
}));
r.get('/clubs', wrap(async (req, res) => {
  const q = req.query.tier ? { leagueTier: Number(req.query.tier) } : {};
  res.json({ clubs: await Club.find(q).select('displayName leagueTier isAI forfeited').sort({ leagueTier: 1, displayName: 1 }).lean() });
}));
r.get('/clubs/:id/players', wrap(async (req, res) => res.json({ players: await Player.find({ club: req.params.id }).sort({ ovr: -1 }).lean() })));
const NUM = ['ovr', 'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'stamina', 'skillMoves', 'stars', 'age', 'heightCm', 'weightKg'];
r.put('/players/:id', wrap(async (req, res) => {
  const set = {};
  for (const k of NUM) if (req.body[k] != null) { const v = Number(req.body[k]); if (!Number.isFinite(v) || v < 1 || v > 250) return res.status(400).json({ error: `${k} is out of range.` }); set[k] = Math.round(v); }
  for (const k of ['name', 'position', 'country', 'foot']) if (typeof req.body[k] === 'string' && req.body[k].trim()) set[k] = req.body[k].trim();
  const p = await Player.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
  if (!p) return res.status(404).json({ error: 'Player not found.' });
  res.json({ player: p });
}));
r.put('/config', wrap(async (req, res) => {
  const link = String(req.body?.whatsappLink || '').trim();
  if (link && !/^https?:\/\//i.test(link)) return res.status(400).json({ error: 'The link must start with https://' });
  await Setting.updateOne({ key: 'whatsapp' }, { $set: { value: link } }, { upsert: true });
  res.json({ ok: true, whatsappLink: link });
}));
r.get('/fixtures', wrap(async (req, res) => {
  const s = await currentSeason();
  const q = { season: s.number };
  if (req.query.status) q.status = req.query.status;
  if (req.query.tier) q.leagueTier = Number(req.query.tier);
  const list = await Fixture.find(q).sort({ gameweek: 1 }).limit(120).populate('home away', 'displayName short crestColors kit').lean();
  res.json({ fixtures: list.map(fxOut) });
}));
r.post('/fixtures/:id/force', wrap(async (req, res) => {
  const h = Number(req.body?.home), a = Number(req.body?.away);
  if (![h, a].every((n) => Number.isInteger(n) && n >= 0 && n <= 20)) return res.status(400).json({ error: 'Scores must be whole numbers from 0 to 20.' });
  const fx = await Fixture.findById(req.params.id);
  if (!fx) return res.status(404).json({ error: 'Match not found.' });
  if (fx.status === 'forfeit') return res.status(409).json({ error: 'Forfeit results cannot be forced.' });
  const rn = getRunner(fx._id);
  if (rn) { rn.stop(); }
  await setPlainResult(fx, h, a, { forced: true });
  res.json({ ok: true });
}));
r.post('/season/next', wrap(async (req, res) => {
  const next = await rolloverSeason({ force: req.body?.force === true });
  if (!next) return res.status(409).json({ error: 'Season is not finished yet. Send {"force": true} to void unplayed fixtures and roll over now.' });
  res.json({ ok: true, season: next.number, startsAt: next.startsAt });
}));
r.delete('/board/:id', wrap(async (req, res) => { await Post.deleteOne({ _id: req.params.id }); res.json({ ok: true }); }));
export default r;
