import { rngFrom, rand, clamp, weighted } from '../lib/rng.js';
import { opp, STYLE_FX, teamRatings, createState } from './matchCore.js';

const r1 = (n) => Math.round(n * 10) / 10;
const ev = (k, t, s, extra = {}) => ({ k, t, s: r1(s), ...extra });
const gauss = (d, w) => Math.exp(-(d * d) / (2 * w * w));
const onPitch = (S) => S.lineup.filter((p) => p.on);

/** Pick an on-pitch player near a point (own-attack-direction x, absolute y). */
function pickNear(S, t, rng, zSelf, yAbs, { exclude, gkOK = false, roleW = { DEF: 1, MID: 1, ATT: 1 }, skill } = {}) {
  const cands = onPitch(S).filter((p) => p.id !== exclude && (gkOK || p.sg !== 'GK'));
  const pool = cands.length ? cands : onPitch(S);
  return weighted(rng, pool, (p) => {
    const py = t === 'h' ? p.sy : 1 - p.sy;
    const base = p.sg === 'GK' ? (zSelf < 0.12 ? 1 : 0.02) : (roleW[p.sg] ?? 1) * gauss(p.sx - zSelf, 0.17) * (0.35 + gauss(py - yAbs, 0.35));
    return base * (skill ? Math.pow(Math.max(p.a[skill], 30) / 70, 2) : 1);
  });
}
const gkOf = (S) => S.lineup.find((p) => p.on && p.sg === 'GK') || onPitch(S)[0];

function shotChain(st, rng, A, at, { pen = false, shooter } = {}) {
  const B = opp(A), SA = st.sides[A], SB = st.sides[B];
  const rA = teamRatings(SA), rB = teamRatings(SB);
  const z = pen ? 0.89 : st.z;
  if (!shooter) {
    const lp = st.lastPass;
    const rcv = lp && lp.t === A ? SA.lineup.find((p) => p.id === lp.q && p.on && p.sg !== 'GK') : null;
    shooter = rcv && rng() < 0.6 ? rcv : pickNear(SA, A, rng, z, st.y, { roleW: { DEF: 0.1, MID: 0.45, ATT: 1 }, skill: 'sho' });
  }
  const lp = st.lastPass;
  const assist = !pen && lp && lp.t === A && lp.q === shooter.id && rng() < 0.82 ? lp.p : null;
  const sho = shooter.a.sho * shooter.f0 * (0.85 + 0.15 * shooter.e / 100);
  const dz = clamp((z - 0.6) / 0.4, 0, 1);
  const xg = pen ? 0.76 : 0.015 + 0.115 * Math.pow(dz, 1.5);
  const sf = clamp(1 + (sho - 72) / 70, 0.7, 1.4);
  const gf = clamp(1 - (rB.gk - 72) / 120, 0.8, 1.25);
  const df = clamp(1 + (rA.atk - rB.def) * 0.008, 0.78, 1.25);
  const pGoal = clamp(xg * sf * gf * df, 0.01, 0.86);
  const pOT = pen ? 0.92 : clamp(0.38 + (sho - 72) * 0.004, 0.26, 0.56);
  const evs = [];
  const yT = clamp(0.5 + rand(rng, -0.09, 0.09), 0.4, 0.6);
  evs.push(ev('shot', A, at, { p: shooter.id, z: 1, y: yT, xg: Math.round(xg * 100) / 100, pen: pen || undefined }));
  const r = rng();
  const gk = gkOf(SB);
  const t2 = at + 8;
  if (r < pGoal) {
    evs.push(ev('goal', A, t2, { p: shooter.id, q: assist, z: 1, y: yT, pen: pen || undefined }));
    evs.push(ev('kickoff', B, t2 + 22, { z: 0.5, y: 0.5, re: 1 }));
  } else if (r < Math.max(pOT, pGoal + 0.08)) {
    const corner = !pen && rng() < 0.45;
    evs.push(ev('save', B, t2, { p: gk.id, q: shooter.id, z: corner ? 0.02 : 0.05, y: yT, parry: corner || undefined }));
    if (corner) {
      const taker = pickNear(SA, A, rng, 0.5, 0.5, { roleW: { DEF: 0.1, MID: 1, ATT: 0.5 }, skill: 'pas' });
      evs.push(ev('corner', A, t2 + 14, { p: taker.id, z: 0.985, y: rng() < 0.5 ? 0.02 : 0.98 }));
    }
  } else {
    const blocked = !pen && rng() < 0.4;
    if (blocked) {
      const blk = pickNear(SB, B, rng, 0.12, st.y, { roleW: { DEF: 1, MID: 0.3, ATT: 0.05 } });
      evs.push(ev('miss', A, t2, { p: shooter.id, q: blk.id, bl: 1, z: 0.93, y: clamp(st.y + rand(rng, -0.15, 0.15), 0.1, 0.9) }));
      if (rng() < 0.75) { const tk = pickNear(SA, A, rng, 0.5, 0.5, { roleW: { MID: 1, ATT: 0.4, DEF: 0.1 } }); evs.push(ev('corner', A, t2 + 12, { p: tk.id, z: 0.985, y: rng() < 0.5 ? 0.02 : 0.98 })); }
      else evs.push(ev('goalkick', B, t2 + 14, { p: gk.id, z: 0.06, y: 0.5 }));
    } else {
      const post = rng() < 0.1;
      evs.push(ev('miss', A, t2, { p: shooter.id, post: post || undefined, z: 1.03, y: post ? 0.44 : rng() < 0.5 ? 0.3 : 0.7 }));
      evs.push(ev('goalkick', B, t2 + 14, { p: gk.id, z: 0.06, y: 0.5 }));
    }
  }
  return evs;
}

function foulCard(st, rng, B, fouler, at, pen) {
  const S = st.sides[B];
  const evs = [];
  const pl = S.lineup.find((p) => p.id === fouler.id);
  const r = rng();
  const yp = ((pen ? 0.26 : 0.14) * (pl && pl.y >= 1 ? 0.45 : 1)) + STYLE_FX[S.style].press * 0.05;
  if (r < 0.004) evs.push(ev('red', B, at, { p: fouler.id, why: 'straight' }));
  else if (r < 0.004 + yp) {
    evs.push(ev('yellow', B, at, { p: fouler.id, second: pl && pl.y >= 1 ? 1 : undefined }));
    if (pl && pl.y >= 1) evs.push(ev('red', B, at + 1, { p: fouler.id, why: '2y' }));
  }
  return evs;
}

/** One possession step. Returns events (not yet applied). */
export function genAction(st, rng, at) {
  const A = st.poss || 'h', B = opp(A);
  const SA = st.sides[A], SB = st.sides[B];
  const rA = teamRatings(SA), rB = teamRatings(SB);
  const fxA = STYLE_FX[SA.style], fxB = STYLE_FX[SB.style];
  const z = st.z;
  const pFoul = 0.065 + fxB.press * 0.015;
  const pLoss = clamp(0.21 + (rB.ctrl - rA.ctrl) * 0.005 + (z > 0.7 ? 0.04 : 0) - fxA.hold + fxB.press * 0.03, 0.09, 0.42);
  const roll = rng();

  if (roll < pFoul) {
    const fouler = pickNear(SB, B, rng, 1 - z, st.y, { roleW: { DEF: 1, MID: 1, ATT: 0.3 } });
    const victim = SA.lineup.find((p) => p.id === st.carrier && p.on) || pickNear(SA, A, rng, z, st.y);
    const pen = z > 0.84 && rng() < 0.38;
    const evs = [ev('foul', B, at, { p: fouler.id, q: victim.id, z, y: st.y })];
    evs.push(...foulCard(st, rng, B, fouler, at + 3, pen));
    if (pen) {
      evs.push(ev('pen', A, at + 9, { p: victim.id, z: 0.89, y: 0.5 }));
      const taker = onPitch(SA).filter((p) => p.sg !== 'GK').sort((a, b) => b.a.sho - a.a.sho)[0];
      evs.push(...shotChain(st, rng, A, at + 15, { pen: true, shooter: taker }));
    }
    return evs;
  }
  if (roll < pFoul + pLoss) {
    const nz = clamp(1 - z + rand(rng, -0.05, 0.1), 0.05, 0.95);
    const def = pickNear(SB, B, rng, 1 - z, st.y, { roleW: { DEF: 1, MID: 0.8, ATT: 0.15 }, skill: 'def' });
    const kind = rng() < 0.5 ? 'tackle' : 'interception';
    return [ev(kind, B, at, { p: def.id, q: st.carrier, z: nz, y: clamp(st.y + rand(rng, -0.12, 0.12), 0.08, 0.92) })];
  }
  const pShot = z < 0.55 ? 0.004 : (0.07 + 0.3 * clamp((z - 0.55) / 0.4, 0, 1)) * fxA.shot * clamp(1 + (rA.atk - rB.def) * 0.006, 0.7, 1.4);
  if (rng() < pShot) return shotChain(st, rng, A, at);

  // carry on: pass or dribble
  const carrier = SA.lineup.find((p) => p.id === st.carrier && p.on) || pickNear(SA, A, rng, z, st.y, { gkOK: true });
  const y2 = clamp(st.y + rand(rng, -0.25, 0.25), 0.06, 0.94);
  if (rng() < 0.22) {
    const nz = clamp(z + rand(rng, 0.03, 0.11) * fxA.dz * (0.8 + carrier.a.dri / 200), 0.03, 0.98);
    return [ev('dribble', A, at, { p: carrier.id, z: nz, y: y2 })];
  }
  const fwd = rng() < 0.72 + (fxA.dz - 1) * 0.15;
  const nz = clamp(z + (fwd ? rand(rng, 0.05, 0.2) * fxA.dz : -rand(rng, 0.02, 0.1)), 0.03, 0.98);
  const rcv = pickNear(SA, A, rng, nz, y2, { exclude: carrier.id, skill: 'pas' });
  return [ev('pass', A, at, { p: carrier.id, q: rcv.id, z: nz, y: y2 })];
}

export function aiDecide(st, rng, at, side) {
  const S = st.sides[side];
  const evs = [];
  const min = at / 60;
  const diff = st.score[side] - st.score[opp(side)];
  let style = S.baseStyle;
  if (min >= 60 && diff < 0) style = 'press';
  if (min >= 75 && diff > 0) style = 'park';
  if (style !== S.style) evs.push(ev('style', side, at, { style }));
  let n = 0;
  const tired = onPitch(S).filter((p) => p.sg !== 'GK' && p.e < 74).sort((a, b) => a.e - b.e);
  for (const out of tired) {
    if (S.subsUsed + n >= 5 || n >= 2) break;
    const cand = S.bench.filter((b) => b.g !== 'GK').sort((a, b) => (b.g === out.g) - (a.g === out.g) || b.a.ovr - a.a.ovr)[0];
    if (!cand || cand.a.ovr + 2 < out.a.ovr - 8) continue;
    evs.push(ev('sub', side, at + 1 + n, { p: out.id, q: cand.id }));
    n++;
    S.bench = S.bench.filter((b) => b.id !== cand.id); // local guard; real state mutated when events are applied
    S._tmp = (S._tmp || []).concat(cand);
  }
  if (S._tmp) { S.bench = S.bench.concat(S._tmp); delete S._tmp; }
  return evs;
}

export function injurySub(st, side, at, out) {
  const S = st.sides[side];
  const evs = [ev('injury', side, at, { p: out.id })];
  if (S.subsUsed < 5) {
    const cand = S.bench.filter((b) => (out.g === 'GK' ? b.g === 'GK' : b.g !== 'GK')).sort((a, b) => (b.g === out.g) - (a.g === out.g) || b.a.ovr - a.a.ovr)[0];
    if (cand) evs.push(ev('sub', side, at + 1, { p: out.id, q: cand.id, forced: 1 }));
  }
  return evs;
}

/** Pre-roll injuries (5% per starter) + AI check minutes. Deterministic from the seed. */
export function buildSchedule(setup) {
  const rng = rngFrom(setup.seed + ':sched');
  const items = [];
  for (const t of ['h', 'a']) {
    for (const p of setup[t].lineup) if (rng() < 0.05) items.push({ at: Math.floor(rand(rng, 5, 86) * 60), type: 'injury', t, id: p.id });
    if (setup[t].ai) [56, 64, 72, 80].forEach((m) => items.push({ at: m * 60, type: 'ai', t }));
  }
  return items.sort((a, b) => a.at - b.at);
}

export function runScheduled(st, rng, item) {
  const at = item.at;
  if (item.type === 'injury') {
    const p = st.sides[item.t].lineup.find((x) => x.id === item.id && x.on);
    return p ? injurySub(st, item.t, at, p) : [];
  }
  return aiDecide(st, rng, at, item.t);
}

export function finalStats(st, rng) {
  const tot = st.stats.h.poss + st.stats.a.poss || 1;
  const out = {};
  for (const t of ['h', 'a']) {
    const s = st.stats[t];
    const share = s.poss / tot;
    out[t] = {
      possession: Math.round(share * 100), shots: s.shots, sot: s.sot, passes: Math.round(s.passes * 4 + share * 60 + rng() * 25),
      fouls: s.fouls, penalties: s.pens, corners: s.corners, xg: Math.round(s.xg * 100) / 100, yellow: s.yellow, red: s.red,
    };
  }
  out.a.possession = 100 - out.h.possession;
  return out;
}

export { createState };
