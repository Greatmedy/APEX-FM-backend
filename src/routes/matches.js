import { Router } from 'express';
import { auth, wrap } from '../middleware/auth.js';
import { Fixture, Club } from '../models/index.js';
import { READY_WINDOW_MS } from '../config.js';
import { STYLES } from '../lib/formations.js';
import { getRunner } from '../sim/runner.js';
import { getIO } from '../services/notify.js';
import { currentSeason } from '../services/seasons.js';
import { fxOut } from './league.js';

const r = Router();
r.use(auth);
const POP = 'displayName short crestColors kit isAI managerName stadiumName forfeited leagueTier manager';

function sideOf(fx, user) {
  if (!user.clubId) return null;
  if (String(fx.home._id || fx.home) === String(user.clubId)) return 'h';
  if (String(fx.away._id || fx.away) === String(user.clubId)) return 'a';
  return null;
}
async function load(id) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  return Fixture.findById(id).populate('home away', POP);
}

r.get('/mine', wrap(async (req, res) => {
  if (!req.user.clubId) return res.json({ fixtures: [] });
  const s = await currentSeason();
  const list = await Fixture.find({ season: s.number, $or: [{ home: req.user.clubId }, { away: req.user.clubId }] }).sort({ gameweek: 1 }).populate('home away', POP).lean();
  res.json({ season: s.number, fixtures: list.map(fxOut) });
}));

r.get('/:id', wrap(async (req, res) => {
  const fx = await load(req.params.id);
  if (!fx) return res.status(404).json({ error: 'Match not found.' });
  const out = { ...fxOut(fx), ready: fx.ready, autoReady: fx.autoReady, mySide: sideOf(fx, req.user), serverNow: Date.now(), readyOpensAt: new Date(fx.kickoffAt.getTime() - READY_WINDOW_MS), hasLog: (fx.eventLog || []).length > 0 };
  if (fx.status === 'live') {
    const rn = getRunner(fx._id);
    out.setup = fx.setup;
    out.events = rn ? rn.events : fx.eventLog;
    out.live = !!rn;
    if (rn) out.subsUsed = { h: rn.st.sides.h.subsUsed, a: rn.st.sides.a.subsUsed };
  }
  if (fx.status === 'finished') { out.stats = fx.stats; out.goals = fx.goals; out.cards = fx.cards; out.hasReplay = !!fx.setup; }
  res.json(out);
}));

r.post('/:id/ready', wrap(async (req, res) => {
  const fx = await load(req.params.id);
  if (!fx) return res.status(404).json({ error: 'Match not found.' });
  const side = sideOf(fx, req.user);
  if (!side) return res.status(403).json({ error: 'You are not managing in this match.' });
  const club = side === 'h' ? fx.home : fx.away;
  if (club.forfeited) return res.status(409).json({ error: 'You forfeited this season.' });
  if (fx.status !== 'scheduled') return res.status(409).json({ error: 'This match is no longer waiting for ready.' });
  const now = Date.now(), ko = fx.kickoffAt.getTime();
  if (now < ko - READY_WINDOW_MS) return res.status(409).json({ error: 'Ready opens 10 minutes before kickoff.' });
  if (now >= ko) return res.status(409).json({ error: 'Kickoff has passed.' });
  await Fixture.updateOne({ _id: fx._id }, { $set: { ['ready.' + side]: true } });
  const fresh = await Fixture.findById(fx._id).select('ready').lean();
  getIO()?.to('fixture:' + fx._id).emit('ready', { fixtureId: String(fx._id), ready: fresh.ready });
  res.json({ ok: true, ready: fresh.ready });
}));

async function liveGuard(req, res) {
  const fx = await load(req.params.id);
  if (!fx) { res.status(404).json({ error: 'Match not found.' }); return null; }
  const side = sideOf(fx, req.user);
  if (!side) { res.status(403).json({ error: 'Only the managers in this match can change tactics.' }); return null; }
  const rn = getRunner(fx._id);
  if (fx.status !== 'live' || !rn) { res.status(409).json({ error: 'The match is not live.' }); return null; }
  return { fx, side, rn };
}
r.post('/:id/style', wrap(async (req, res) => {
  const g = await liveGuard(req, res); if (!g) return;
  const style = req.body?.style;
  if (!STYLES.includes(style)) return res.status(400).json({ error: 'Unknown style of play.' });
  g.rn.command({ type: 'style', side: g.side, style });
  res.json({ ok: true, appliesFrom: 'next event' });
}));
r.post('/:id/sub', wrap(async (req, res) => {
  const g = await liveGuard(req, res); if (!g) return;
  const { out, in: inn } = req.body || {};
  const err = g.rn.validateSub(g.side, String(out), String(inn));
  if (err) return res.status(400).json({ error: err });
  g.rn.command({ type: 'sub', side: g.side, out: String(out), in: String(inn) });
  res.json({ ok: true, appliesFrom: 'next event' });
}));
r.get('/:id/replay', wrap(async (req, res) => {
  const fx = await Fixture.findById(req.params.id).lean();
  if (!fx) return res.status(404).json({ error: 'Match not found.' });
  if (!fx.setup) return res.status(404).json({ error: 'No replay is available for this match.' });
  const rn = getRunner(fx._id);
  res.json({ status: fx.status, setup: fx.setup, events: rn ? rn.events : fx.eventLog, stats: fx.stats, goals: fx.goals, cards: fx.cards, result: fx.result, serverNow: Date.now() });
}));
export default r;
