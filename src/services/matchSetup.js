import { Player, Club } from '../models/index.js';
import { FORMATIONS, groupOf, posFactor, autoPick, fitScore } from '../lib/formations.js';

const entry = (p, slot, on, cap) => {
  const sg = slot ? groupOf(slot[0]) : groupOf(p.position);
  return {
    id: String(p._id), num: p.number, name: p.name, pos: p.position, g: groupOf(p.position), role: slot ? slot[0] : null,
    sg, sx: slot ? slot[1] : 0, sy: slot ? slot[2] : 0, f0: slot ? posFactor(groupOf(p.position), sg) : 1,
    a: { pac: p.pace, sho: p.shooting, pas: p.passing, dri: p.dribbling, def: p.defending, phy: p.physical, sta: p.stamina, ovr: p.ovr },
    e: 100, y: 0, r: 0, on: on ? 1 : 0, inj: 0, cap: cap ? 1 : 0, stars: p.stars,
  };
};

/** Validate saved tactics against availability; swap in replacements automatically. */
export function resolveTactics(club, players) {
  const t = club.tactics || {};
  const formation = FORMATIONS[t.formation] ? t.formation : '4-3-3';
  const slots = FORMATIONS[formation];
  const unavailable = new Set(players.filter((p) => p.injuredFor > 0 || p.suspendedFor > 0).map((p) => String(p._id)));
  const byId = new Map(players.map((p) => [String(p._id), p]));
  const auto = autoPick(players, formation, unavailable);
  const used = new Set();
  const lineup = slots.map((slot, i) => {
    const sp = byId.get(String(t.lineup?.[i]));
    if (sp && !unavailable.has(String(sp._id)) && !used.has(String(sp._id)) && (slot[0] !== 'GK') === (sp.position !== 'GK')) { used.add(String(sp._id)); return sp; }
    return null;
  });
  lineup.forEach((p, i) => {
    if (p) return;
    let best = null, bs = -1e9;
    for (const c of players) {
      if (used.has(String(c._id)) || unavailable.has(String(c._id))) continue;
      if ((slots[i][0] === 'GK') !== (c.position === 'GK')) continue;
      const sc = c.ovr + fitScore(c, slots[i][0]);
      if (sc > bs) { bs = sc; best = c; }
    }
    best = best || auto.lineup[i];
    used.add(String(best._id)); lineup[i] = best;
  });
  const bench = [];
  for (const id of t.bench || []) { const p = byId.get(String(id)); if (p && !used.has(String(p._id)) && !unavailable.has(String(p._id)) && bench.length < 7) { bench.push(p); used.add(String(p._id)); } }
  const rest = players.filter((p) => !used.has(String(p._id)) && !unavailable.has(String(p._id))).sort((a, b) => b.ovr - a.ovr);
  if (!bench.some((p) => p.position === 'GK')) { const g = rest.findIndex((p) => p.position === 'GK'); if (g >= 0) { if (bench.length >= 7) bench.pop(); bench.push(rest.splice(g, 1)[0]); } }
  while (bench.length < 7 && rest.length) bench.push(rest.shift());
  return { formation, style: t.style || 'balanced', lineup, bench, captain: String(t.captain || '') };
}

export async function buildSide(club) {
  const players = await Player.find({ club: club._id }).lean();
  const r = resolveTactics(club, players);
  const slots = FORMATIONS[r.formation];
  const cap = r.lineup.find((p) => String(p._id) === r.captain) || [...r.lineup].sort((a, b) => b.ovr - a.ovr)[0];
  // availability counters tick down at kickoff
  await Player.updateMany({ club: club._id, injuredFor: { $gt: 0 } }, { $inc: { injuredFor: -1 } });
  await Player.updateMany({ club: club._id, suspendedFor: { $gt: 0 } }, { $inc: { suspendedFor: -1 } });
  return {
    clubId: String(club._id), name: club.displayName, short: club.short, manager: club.managerName, ai: !!club.isAI,
    crest: club.crestColors, kit: club.kit, stadium: club.stadiumName, formation: r.formation, style: r.style,
    lineup: r.lineup.map((p, i) => entry(p, slots[i], true, String(p._id) === String(cap._id))),
    bench: r.bench.map((p) => entry(p, null, false)),
  };
}

export async function buildSetup(fx) {
  const [home, away] = await Promise.all([Club.findById(fx.home), Club.findById(fx.away)]);
  const [h, a] = await Promise.all([buildSide(home), buildSide(away)]);
  return { seed: String(fx._id), season: fx.season, tier: fx.leagueTier, gameweek: fx.gameweek, kickoffAt: fx.kickoffAt.getTime(), h, a };
}
