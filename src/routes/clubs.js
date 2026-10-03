import { Router } from 'express';
import { auth, needClub, wrap } from '../middleware/auth.js';
import { Club, Player, Fixture } from '../models/index.js';
import { autoPick, teamOvr, FORMATIONS, STYLES } from '../lib/formations.js';
import { getTable } from '../services/standings.js';
import { currentSeason } from '../services/seasons.js';
import { tierName } from '../services/clubs.js';
import { forfeitClub } from '../services/results.js';
import { clubBrief } from './league.js';

const r = Router();
r.use(auth);

async function summary(club) {
  const players = await Player.find({ club: club._id }).sort({ ovr: -1 }).lean();
  const best = autoPick(players, club.tactics?.formation || '4-3-3').lineup;
  const season = await currentSeason();
  let rank = null, record = null;
  if (season) {
    const t = await getTable(season.number, club.leagueTier);
    const row = t.find((x) => String(x.club._id) === String(club._id));
    if (row) { rank = row.pos; record = { played: row.played, won: row.won, drawn: row.drawn, lost: row.lost, gf: row.gf, ga: row.ga, pts: row.pts }; }
  }
  return { players, ovr: teamOvr(best), rank, record, league: tierName(club.leagueTier) };
}

r.get('/me', needClub, wrap(async (req, res) => {
  const club = req.club;
  const s = await summary(club);
  res.json({ club: { ...clubBrief(club), tier: club.leagueTier, fans: club.fans, seasonForm: club.seasonForm, tactics: club.tactics, stadiumName: club.stadiumName, name: club.name }, ...s });
}));

r.put('/me/identity', needClub, wrap(async (req, res) => {
  const { stadiumName, kit } = req.body || {};
  const club = req.club;
  if (typeof stadiumName === 'string') {
    const n = stadiumName.trim();
    if (n.length < 3 || n.length > 40) return res.status(400).json({ error: 'Stadium name must be 3-40 characters.' });
    club.stadiumName = n;
  }
  const hex = /^#[0-9a-fA-F]{6}$/;
  if (kit) for (const k of ['shirt', 'shorts', 'number']) if (kit[k] != null) { if (!hex.test(kit[k])) return res.status(400).json({ error: 'Use hex colours like #14F195.' }); club.kit[k] = kit[k]; }
  club.markModified('kit');
  await club.save();
  res.json({ ok: true, stadiumName: club.stadiumName, kit: club.kit });
}));

r.post('/me/forfeit', needClub, wrap(async (req, res) => {
  const club = req.club;
  if (club.forfeited) return res.status(409).json({ error: 'You already forfeited this season.' });
  if ((req.body?.confirm || '').trim() !== club.displayName) return res.status(400).json({ error: 'Type the club name exactly as shown to confirm.' });
  const live = await Fixture.exists({ status: { $in: ['live', 'starting'] }, $or: [{ home: club._id }, { away: club._id }] });
  if (live) return res.status(409).json({ error: 'You cannot forfeit while a match is live. Try again after full time.' });
  await forfeitClub(club);
  res.json({ ok: true });
}));

r.get('/:id', wrap(async (req, res) => {
  const club = await Club.findById(req.params.id).lean();
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  const players = await Player.find({ club: club._id }).sort({ ovr: -1 }).lean();
  const best = autoPick(players, club.tactics?.formation || '4-3-3').lineup;
  const season = await currentSeason();
  let rank = null;
  if (season) { const t = await getTable(season.number, club.leagueTier); rank = t.find((x) => String(x.club._id) === String(club._id))?.pos || null; }
  res.json({
    club: { ...clubBrief(club), name: club.name, fans: club.fans, seasonForm: club.seasonForm, tier: club.leagueTier, league: tierName(club.leagueTier) },
    players: players.map((p) => ({ ...p, unavailable: p.injuredFor > 0 || p.suspendedFor > 0 })), ovr: teamOvr(best), rank,
  });
}));

export const tacticsRouter = Router();
tacticsRouter.use(auth, needClub);
tacticsRouter.put('/', wrap(async (req, res) => {
  const { formation, style, lineup, bench, captain } = req.body || {};
  if (!FORMATIONS[formation]) return res.status(400).json({ error: 'Unknown formation.' });
  if (!STYLES.includes(style)) return res.status(400).json({ error: 'Unknown style of play.' });
  if (!Array.isArray(lineup) || lineup.length !== 11 || new Set(lineup).size !== 11) return res.status(400).json({ error: 'Pick 11 different players for the XI.' });
  const subs = Array.isArray(bench) ? bench : [];
  if (subs.length > 7 || new Set([...lineup, ...subs]).size !== lineup.length + subs.length) return res.status(400).json({ error: 'Choose up to 7 different substitutes.' });
  const players = await Player.find({ club: req.club._id }).select('_id position').lean();
  const map = new Map(players.map((p) => [String(p._id), p]));
  for (const id of [...lineup, ...subs]) if (!map.has(String(id))) return res.status(400).json({ error: 'A selected player is not in your squad.' });
  const slots = FORMATIONS[formation];
  const gkSlot = slots.findIndex((s) => s[0] === 'GK');
  if (map.get(String(lineup[gkSlot])).position !== 'GK') return res.status(400).json({ error: 'The goalkeeper slot needs a goalkeeper.' });
  if (lineup.some((id, i) => i !== gkSlot && map.get(String(id)).position === 'GK')) return res.status(400).json({ error: 'Only one goalkeeper can start.' });
  req.club.tactics = { formation, style, lineup, bench: subs, captain: lineup.includes(captain) ? captain : lineup[0] };
  await req.club.save();
  res.json({ ok: true, tactics: req.club.tactics });
}));
export default r;
