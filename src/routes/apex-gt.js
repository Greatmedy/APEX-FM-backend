// APEX GT routes — races, venues, balance, garage, parts shop, history.
import { Router } from 'express';
import { auth, wrap } from '../middleware/auth.js';
import { GameBalance, GameLedger } from '../models/index.js';
import { getBalance, ledger, START_BALANCE } from '../services/gameLedger.js';
import { createRace, joinRace, leaveRace, setRaceReady, startRace, addAIRacers, racePublic, listRaces, VENUE_LIST, validateBet } from '../services/gameEngine.js';
import { notify } from '../services/notify.js';

export const apexGTRouter = Router();
apexGTRouter.use(auth);

apexGTRouter.get('/balance', wrap(async (req, res) => {
  const { balance, grantedAt } = await getBalance(req.user._id, 'apex-gt');
  res.json({ game: 'apex-gt', balance, grantedAt: grantedAt ? grantedAt.getTime() : null, initial: START_BALANCE });
}));

apexGTRouter.get('/ledger', wrap(async (req, res) => {
  res.json({ entries: await ledger(req.user._id, 'apex-gt') });
}));

apexGTRouter.get('/venues', wrap(async (req, res) => {
  res.json({ venues: VENUE_LIST });
}));

apexGTRouter.get('/races', wrap(async (req, res) => {
  res.json({ races: await listRaces() });
}));

apexGTRouter.post('/create', wrap(async (req, res) => {
  const race = await createRace({ hostId: req.user._id, venue: req.body?.venue, bet: req.body?.bet });
  res.status(201).json({ race: await racePublic(race) });
}));

apexGTRouter.get('/races/:id', wrap(async (req, res) => {
  const { Race } = await import('../models/index.js');
  const race = await Race.findById(req.params.id);
  if (!race) return res.status(404).json({ error: 'Race not found.' });
  res.json({ race: await racePublic(race) });
}));

apexGTRouter.post('/races/:id/join', wrap(async (req, res) => {
  const race = await joinRace({ raceId: req.params.id, userId: req.user._id });
  res.json({ race: await racePublic(race) });
}));

apexGTRouter.post('/races/:id/leave', wrap(async (req, res) => {
  const race = await leaveRace({ raceId: req.params.id, userId: req.user._id });
  res.json({ race: race ? await racePublic(race) : null });
}));

apexGTRouter.post('/races/:id/ready', wrap(async (req, res) => {
  const race = await setRaceReady({ raceId: req.params.id, userId: req.user._id, ready: req.body?.ready === true });
  res.json({ race: await racePublic(race) });
}));

apexGTRouter.post('/races/:id/start', wrap(async (req, res) => {
  const race = await startRace({ raceId: req.params.id, userId: req.user._id });
  res.json({ race: await racePublic(race) });
}));

apexGTRouter.post('/races/:id/start-ai', wrap(async (req, res) => {
  const race = await addAIRacers({ raceId: req.params.id, count: req.body?.count || 3 });
  const started = await startRace({ raceId: req.params.id, userId: req.user._id });
  res.json({ race: await racePublic(started) });
}));

// Car parts catalog + purchase
export const PARTS = {
  engine: { name: 'Engine Tune', price: 500000, effect: 'speed' },
  turbo: { name: 'Turbo', price: 750000, effect: 'accel' },
  tires: { name: 'Racing Tires', price: 300000, effect: 'grip' },
  suspension: { name: 'Suspension', price: 400000, effect: 'handling' },
  brakes: { name: 'Brakes', price: 350000, effect: 'brake' },
  transmission: { name: 'Transmission', price: 600000, effect: 'shift' },
  nitro: { name: 'Nitro Boost', price: 900000, effect: 'nitro' },
};

apexGTRouter.get('/parts', wrap(async (req, res) => {
  res.json({ parts: Object.entries(PARTS).map(([id, p]) => ({ id, ...p })) });
}));

apexGTRouter.post('/parts/buy', wrap(async (req, res) => {
  const partId = req.body?.part;
  const part = PARTS[partId];
  if (!part) return res.status(400).json({ error: 'Unknown part.' });
  const { move } = await import('../services/gameLedger.js');
  try {
    const result = await move(req.user._id, 'apex-gt', -part.price, 'purchase', partId);
    res.json({ ok: true, balance: result.balance, part: partId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

apexGTRouter.get('/history', wrap(async (req, res) => {
  const { Race } = await import('../models/index.js');
  const races = await Race.find({ 'participants.user': req.user._id }).sort({ createdAt: -1 }).limit(30).lean();
  res.json({
    races: races.map((r) => ({
      id: String(r._id), venue: r.venue, bet: r.bet, state: r.state,
      winner: r.winner ? String(r.winner) : null,
      at: r.createdAt, finishedAt: r.finishedAt,
    })),
  });
}));
