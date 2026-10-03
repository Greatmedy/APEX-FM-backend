import { Router } from 'express';
import { auth, wrap } from '../middleware/auth.js';
import { Fixture, Season, Club } from '../models/index.js';
import { getTable, topStat } from '../services/standings.js';
import { currentSeason } from '../services/seasons.js';

const r = Router();
r.use(auth);

export const clubBrief = (c) => c && ({ id: c._id, displayName: c.displayName, short: c.short, crestColors: c.crestColors, kit: c.kit, isAI: c.isAI, managerName: c.managerName, stadiumName: c.stadiumName, forfeited: c.forfeited, leagueTier: c.leagueTier });
export const fxOut = (f) => ({
  id: f._id, season: f.season, tier: f.leagueTier, gw: f.gameweek, kickoffAt: f.kickoffAt, status: f.status,
  home: clubBrief(f.home), away: clubBrief(f.away), result: f.result?.h != null ? { h: f.result.h, a: f.result.a, forfeitBy: f.result.forfeitBy, noShow: f.result.noShow } : null,
});

async function seasonNo(req) { return Number(req.query.season) || (await currentSeason())?.number; }
function tierOf(req, res) { const t = Number(req.params.tier); if (![1, 2].includes(t)) { res.status(400).json({ error: 'Unknown league.' }); return null; } return t; }

r.get('/:tier/table', wrap(async (req, res) => {
  const tier = tierOf(req, res); if (!tier) return;
  const season = await seasonNo(req);
  const rows = await getTable(season, tier);
  res.json({ season, tier, rows: rows.map((x) => ({ pos: x.pos, club: clubBrief(x.club), played: x.played, won: x.won, drawn: x.drawn, lost: x.lost, gf: x.gf, ga: x.ga, gd: x.gd, pts: x.pts })) });
}));
r.get('/:tier/fixtures', wrap(async (req, res) => {
  const tier = tierOf(req, res); if (!tier) return;
  const season = await seasonNo(req);
  const q = { season, leagueTier: tier };
  if (req.query.gw) q.gameweek = Number(req.query.gw);
  if (req.query.club) q.$or = [{ home: req.query.club }, { away: req.query.club }];
  const list = await Fixture.find(q).sort({ gameweek: 1, kickoffAt: 1 }).populate('home away', 'displayName short crestColors kit isAI managerName stadiumName forfeited leagueTier').lean();
  res.json({ season, tier, fixtures: list.map(fxOut) });
}));
r.get('/:tier/scorers', wrap(async (req, res) => { const tier = tierOf(req, res); if (!tier) return; res.json({ rows: await topStat(await seasonNo(req), tier, 'goals') }); }));
r.get('/:tier/assists', wrap(async (req, res) => { const tier = tierOf(req, res); if (!tier) return; res.json({ rows: await topStat(await seasonNo(req), tier, 'assists') }); }));
r.get('/:tier/archive', wrap(async (req, res) => {
  const seasons = await Season.find({ status: 'archived' }).sort({ number: -1 }).select('number startsAt endsAt archive').lean();
  res.json({ seasons });
}));
export default r;
