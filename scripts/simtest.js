import { generateRounds } from '../src/lib/schedule.js';
const ids = Array.from({ length: 20 }, (_, i) => 'c' + i);
const s = generateRounds(ids);
let streak = 0, pairs = new Set(), same = 0;
for (const id of ids) {
  let run = 0, last = null, hs = 0;
  for (const rd of s) { const m = rd.find((p) => p.includes(id)); const h = m[0] === id; if (h) hs++; if (last === h) run++; else { run = 1; last = h; } if (run >= 3) streak++; }
  if (hs !== 19) console.log('home count off', id, hs);
}
for (const rd of s) for (const p of rd) pairs.add(p.join('>'));
console.log('rounds', s.length, 'fixtures', pairs.size, '3-in-a-row violations', streak);

// ---- engine calibration ----
import { createState, applyEvent } from '../src/sim/matchCore.js';
import { genAction, buildSchedule, runScheduled, finalStats } from '../src/sim/engine.js';
import { templateSquad } from '../src/lib/playerGen.js';
import { autoPick, FORMATIONS, groupOf, posFactor } from '../src/lib/formations.js';
import { rngFrom } from '../src/lib/rng.js';

function side(key, id, formation = '4-3-3', style = 'balanced', ai = true) {
  const squad = templateSquad(key).map((p, i) => ({ ...p, _id: id + i }));
  const { lineup, bench } = autoPick(squad, formation);
  const slots = FORMATIONS[formation];
  const entry = (p, i, on) => ({
    id: p._id, num: p.number, name: p.name, pos: p.position, g: groupOf(p.position), role: i == null ? null : slots[i][0],
    sg: i == null ? groupOf(p.position) : groupOf(slots[i][0]), sx: i == null ? 0 : slots[i][1], sy: i == null ? 0 : slots[i][2],
    f0: i == null ? 1 : posFactor(groupOf(p.position), groupOf(slots[i][0])),
    a: { pac: p.pace, sho: p.shooting, pas: p.passing, dri: p.dribbling, def: p.defending, phy: p.physical, sta: p.stamina, ovr: p.ovr },
    e: 100, y: 0, r: 0, on: on ? 1 : 0, inj: 0,
  });
  return { clubId: id, name: key, short: key.slice(0, 3).toUpperCase(), formation, style, ai, lineup: lineup.map((p, i) => entry(p, i, true)), bench: bench.map((p) => entry(p, null, false)) };
}
function playMatch(hk, ak, seed) {
  const setup = { seed, h: side(hk, 'H' + seed), a: side(ak, 'A' + seed) };
  const st = createState(setup);
  const rng = rngFrom(seed + 'x');
  const sched = buildSchedule(setup);
  applyEvent(st, { k: 'kickoff', t: 'h', s: 0, z: 0.5, y: 0.5 });
  let at = 10, n = 0;
  while (at < 5400) {
    if (at >= 2700 && at < 2711) { applyEvent(st, { k: 'halftime', t: 'h', s: 2700 }); applyEvent(st, { k: 'kickoff', t: 'a', s: 2700, z: 0.5, y: 0.5 }); at = 2712; }
    while (sched.length && sched[0].at <= at) runScheduled(st, rng, sched.shift()).forEach((e) => applyEvent(st, e));
    const evs = genAction(st, rng, at);
    evs.forEach((e) => { e.s = Math.min(e.s, 5399); applyEvent(st, e); n++; });
    at = evs[evs.length - 1].s + (10 + rng() * 16);
  }
  return { st, n, stats: finalStats(st, rng) };
}
const keys = ['mancity', 'chelsea', 'brighton', 'westham', 'realmadrid', 'athletic', 'inter', 'dortmund'];
let G = 0, SH = 0, SOT = 0, F = 0, Y = 0, R = 0, C = 0, N = 0, XG = 0, M = 0, hw = 0, aw = 0, dr = 0, strongWin = 0, strongN = 0;
for (let i = 0; i < 300; i++) {
  const hk = keys[i % keys.length], ak = keys[(i * 3 + 1) % keys.length];
  if (hk === ak) continue;
  const { st, n, stats } = playMatch(hk, ak, 's' + i);
  M++; N += n; G += st.score.h + st.score.a; SH += stats.h.shots + stats.a.shots; SOT += stats.h.sot + stats.a.sot; F += stats.h.fouls + stats.a.fouls;
  Y += stats.h.yellow + stats.a.yellow; R += stats.h.red + stats.a.red; C += stats.h.corners + stats.a.corners; XG += stats.h.xg + stats.a.xg;
  if (st.score.h > st.score.a) hw++; else if (st.score.h < st.score.a) aw++; else dr++;
}
console.log({ matches: M, eventsPerMatch: (N / M).toFixed(0), goals: (G / M).toFixed(2), shots: (SH / M).toFixed(1), sot: (SOT / M).toFixed(1), fouls: (F / M).toFixed(1), yellows: (Y / M).toFixed(2), reds: (R / M).toFixed(2), corners: (C / M).toFixed(1), xg: (XG / M).toFixed(2), home: hw, away: aw, draw: dr });
const r = playMatch('mancity', 'westham', 'final');
console.log('sample', r.st.score, r.stats);
let up = 0, tot = 0;
for (let i = 0; i < 200; i++) { const x = playMatch('westham', 'mancity', 'u' + i); tot++; if (x.st.score.h >= x.st.score.a) up++; }
console.log('weak(home) avoids defeat vs strong:', up + '/' + tot);
