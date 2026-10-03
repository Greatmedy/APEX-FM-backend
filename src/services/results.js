import { Fixture, Club, Player, User } from '../models/index.js';
import { applyResult } from './standings.js';
import { notify, getIO } from './notify.js';
import { rngFrom, clamp } from '../lib/rng.js';

const label = (c) => c?.displayName || 'Club';

/** Shared post-result bookkeeping: fans, form, notifications, sockets. */
export async function afterResult(fx, hg, ag, { forfeitBy = null, noShow = false } = {}) {
  const [home, away] = await Promise.all([Club.findById(fx.home), Club.findById(fx.away)]);
  const upd = async (club, gf, ga) => {
    const r = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
    const form = [...(club.seasonForm || []), r].slice(-10);
    await Club.updateOne({ _id: club._id }, { $set: { seasonForm: form }, ...(r === 'W' ? { $inc: { fans: 1000 } } : {}) });
  };
  await Promise.all([upd(home, hg, ag), upd(away, ag, hg)]);
  const link = `/match/${fx._id}`;
  for (const [club, gf, ga, opp] of [[home, hg, ag, away], [away, ag, hg, home]]) {
    if (club.isAI || !club.manager) continue;
    let title = `Result: ${label(home)} ${hg}-${ag} ${label(away)}`;
    let body = `Gameweek ${fx.gameweek} is final.`;
    if (forfeitBy) {
      const iForfeited = String(forfeitBy) === String(club._id);
      title = iForfeited ? 'You forfeited this match' : 'Opponent forfeited. You win 3-0';
      body = iForfeited ? `${label(opp)} gets a 3-0 win.` : `${label(opp)} forfeited the league. No need to watch.`;
    } else if (noShow) body = 'Neither manager was ready at kickoff. Recorded as 0-0, one point each.';
    await notify(club.manager, { type: forfeitBy ? 'forfeit' : 'result', title, body, link, dedupeKey: `${forfeitBy ? 'forfeit' : 'result'}:${fx._id}` });
  }
  getIO()?.emit('league-update', { tier: fx.leagueTier });
}

/** Finalize a live match that has reached full time. */
export async function finalizeLive(fxId, st, setup, stats) {
  const hg = st.score.h, ag = st.score.a;
  const clubOf = { h: setup.h.clubId, a: setup.a.clubId };
  const nameOf = (t, id) => (st.sides[t].lineup.find((p) => p.id === id) || st.sides[t].bench.find((p) => p.id === id))?.name || 'Unknown';
  const goals = st.goals.map((g) => ({
    s: g.s, m: g.m, t: g.t, p: g.p, pn: nameOf(g.t, g.p), q: g.q, qn: g.q ? nameOf(g.t, g.q) : null, pen: g.pen,
    club: clubOf[g.t], qclub: clubOf[g.t],
  }));
  const fx = await Fixture.findOneAndUpdate({ _id: fxId, status: 'live' }, {
    $set: { status: 'finished', result: { h: hg, a: ag }, stats, goals, cards: st.cards, endedAt: new Date() },
  }, { new: true });
  if (!fx) return null;
  await applyResult({ season: fx.season, tier: fx.leagueTier, home: fx.home, away: fx.away, hg, ag });
  // players: availability, form, appearances
  const rng = rngFrom('rate' + fxId);
  for (const t of ['h', 'a']) {
    const gf = st[t === 'h' ? 'score' : 'score'][t], ga = st.score[t === 'h' ? 'a' : 'h'];
    const base = gf > ga ? 0.5 : gf === ga ? 0.1 : -0.3;
    for (const p of st.sides[t].lineup) {
      const g = st.goals.filter((x) => x.t === t && x.p === p.id).length;
      const a = st.goals.filter((x) => x.t === t && x.q === p.id).length;
      const cs = ga === 0 && (p.g === 'DEF' || p.g === 'GK') ? 0.4 : 0;
      const rating = clamp(Math.round((6 + base + g * 1.1 + a * 0.7 + cs - p.r * 1.5 + (rng() - 0.5)) * 10) / 10, 4, 10);
      const doc = await Player.findById(p.id).select('form apps');
      if (!doc) continue;
      const set = { form: [...(doc.form || []), rating].slice(-5) };
      if (p.r) set.suspendedFor = 1;
      if (p.inj) set.injuredFor = 1;
      await Player.updateOne({ _id: doc._id }, { $set: set, $inc: { apps: 1 } });
    }
  }
  await afterResult(fx, hg, ag);
  return fx;
}

/** Result without a simulation: 0-0 no-show, admin forced result. Reverses a previous result if one was already applied. */
export async function setPlainResult(fx, hg, ag, { noShow = false, forced = false } = {}) {
  const prev = ['finished', 'forfeit'].includes(fx.status) && fx.result?.h != null ? { h: fx.result.h, a: fx.result.a } : null;
  if (prev) await applyResult({ season: fx.season, tier: fx.leagueTier, home: fx.home, away: fx.away, hg: prev.h, ag: prev.a, sign: -1 });
  await Fixture.updateOne({ _id: fx._id }, { $set: { status: 'finished', result: { h: hg, a: ag, noShow, forced }, endedAt: new Date(), stats: fx.stats || null } });
  await applyResult({ season: fx.season, tier: fx.leagueTier, home: fx.home, away: fx.away, hg, ag });
  if (!prev) await afterResult(fx, hg, ag, { noShow });
  else getIO()?.emit('league-update', { tier: fx.leagueTier });
}

/** Forfeit: every unplayed league game becomes a 3-0 loss. */
export async function forfeitClub(club) {
  await Club.updateOne({ _id: club._id }, { $set: { forfeited: true } });
  const open = await Fixture.find({ season: { $exists: true }, status: 'scheduled', $or: [{ home: club._id }, { away: club._id }] }).lean();
  const cur = open.length ? Math.max(...open.map((f) => f.season)) : null;
  for (const f of open.filter((x) => x.season === cur)) {
    const isHome = String(f.home) === String(club._id);
    const hg = isHome ? 0 : 3, ag = isHome ? 3 : 0;
    const done = await Fixture.findOneAndUpdate({ _id: f._id, status: 'scheduled' }, { $set: { status: 'forfeit', result: { h: hg, a: ag, forfeitBy: club._id }, endedAt: new Date() } }, { new: true });
    if (!done) continue;
    await applyResult({ season: f.season, tier: f.leagueTier, home: f.home, away: f.away, hg, ag });
    await afterResult(done, hg, ag, { forfeitBy: club._id });
  }
  if (club.manager) await notify(club.manager, { type: 'forfeit', title: 'League forfeited', body: 'You will be relegated at season end. You can return next season in the lower league.', link: '/home', dedupeKey: 'forfeit-self:' + Date.now() });
}
export { User };
