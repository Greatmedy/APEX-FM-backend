import { Standing, Fixture } from '../models/index.js';

export async function applyResult({ season, tier, home, away, hg, ag, sign = 1 }) {
  const upd = (club, gf, ga) => {
    const w = gf > ga ? 1 : 0, d = gf === ga ? 1 : 0, l = gf < ga ? 1 : 0;
    return Standing.updateOne({ season, leagueTier: tier, club }, { $inc: { played: sign, won: sign * w, drawn: sign * d, lost: sign * l, gf: sign * gf, ga: sign * ga, pts: sign * (3 * w + d) } });
  };
  await Promise.all([upd(home, hg, ag), upd(away, ag, hg)]);
}

const CLUB_FIELDS = 'displayName short crestColors isAI forfeited managerName manager kit templateKey leagueTier stadiumName';

/** Sorted table: points, GD, GF, head-to-head points, then manager name. */
export async function getTable(season, tier) {
  const rows = await Standing.find({ season, leagueTier: tier }).populate('club', CLUB_FIELDS).lean();
  const base = rows.filter((r) => r.club).map((r) => ({ ...r, gd: r.gf - r.ga }));
  base.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  // resolve ties with head-to-head
  const out = [];
  let i = 0;
  while (i < base.length) {
    let j = i + 1;
    while (j < base.length && base[j].pts === base[i].pts && base[j].gd === base[i].gd && base[j].gf === base[i].gf) j++;
    const group = base.slice(i, j);
    if (group.length > 1) {
      const ids = group.map((g) => g.club._id);
      const fx = await Fixture.find({ season, leagueTier: tier, status: { $in: ['finished', 'forfeit'] }, home: { $in: ids }, away: { $in: ids } }).select('home away result').lean();
      const h2h = new Map(group.map((g) => [String(g.club._id), 0]));
      for (const f of fx) {
        const hs = String(f.home), as = String(f.away);
        if (f.result.h > f.result.a) h2h.set(hs, h2h.get(hs) + 3);
        else if (f.result.h < f.result.a) h2h.set(as, h2h.get(as) + 3);
        else { h2h.set(hs, h2h.get(hs) + 1); h2h.set(as, h2h.get(as) + 1); }
      }
      group.sort((a, b) => h2h.get(String(b.club._id)) - h2h.get(String(a.club._id)) || String(a.club.managerName || a.club.displayName).localeCompare(String(b.club.managerName || b.club.displayName)));
    }
    out.push(...group);
    i = j;
  }
  return out.map((r, idx) => ({ pos: idx + 1, ...r }));
}

export async function topStat(season, tier, field) {
  const key = field === 'assists' ? '$goals.q' : '$goals.p';
  const nameKey = field === 'assists' ? '$goals.qn' : '$goals.pn';
  const pipeline = [
    { $match: { season, leagueTier: tier, status: 'finished' } },
    { $unwind: '$goals' },
    ...(field === 'assists' ? [{ $match: { 'goals.q': { $ne: null } } }] : []),
    { $group: { _id: key, n: { $sum: 1 }, name: { $first: nameKey }, club: { $first: field === 'assists' ? '$goals.qclub' : '$goals.club' } } },
    { $sort: { n: -1, name: 1 } },
    { $limit: 20 },
  ];
  const rows = await Fixture.aggregate(pipeline);
  const { Club } = await import('../models/index.js');
  const clubs = await Club.find({ _id: { $in: rows.map((r) => r.club).filter(Boolean) } }).select('displayName short crestColors').lean();
  const cm = new Map(clubs.map((c) => [String(c._id), c]));
  return rows.map((r, i) => ({ pos: i + 1, playerId: r._id, name: r.name, count: r.n, club: cm.get(String(r.club)) || null }));
}
