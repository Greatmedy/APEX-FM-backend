import { rngFrom, shuffle } from './rng.js';

/** Double round-robin for an even number of clubs. Returns 38 rounds of [home, away] id pairs for 20 clubs. */
export function generateRounds(clubIds, seed = 'apex') {
  const rng = rngFrom(seed + ':' + Date.now());
  const n = clubIds.length;
  const ids = shuffle(rng, clubIds);
  // circle method
  const rounds = [];
  const arr = ids.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([arr[i], arr[n - 1 - i]]);
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop());
  }
  const leg1Order = shuffle(rng, rounds.map((_, i) => i));
  let leg2Order = shuffle(rng, rounds.map((_, i) => i));
  let guard = 0;
  while (leg2Order[0] === leg1Order[n - 2] && guard++ < 50) leg2Order = shuffle(rng, rounds.map((_, i) => i));
  // orientation bit per pair key
  const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const orient = new Map();
  for (const rd of rounds) for (const [a, b] of rd) orient.set(key(a, b), rng() < 0.5);
  const build = () => {
    const out = [];
    const mk = (idx, flip) => rounds[idx].map(([a, b]) => {
      const o = orient.get(key(a, b)) !== flip; // true => a home
      return o ? [a, b] : [b, a];
    });
    leg1Order.forEach((i) => out.push(mk(i, false)));
    leg2Order.forEach((i) => out.push(mk(i, true)));
    return out;
  };
  const cost = (sched) => {
    let bad = 0;
    for (const id of clubIds) {
      let run = 0, last = null;
      for (const rd of sched) {
        const m = rd.find((p) => p[0] === id || p[1] === id);
        const home = m[0] === id;
        if (last === home) run++; else { run = 1; last = home; }
        if (run >= 3) bad++;
      }
    }
    return bad;
  };
  let sched = build();
  let best = cost(sched);
  const keys = [...orient.keys()];
  for (let it = 0; it < 30000 && best > 0; it++) {
    if (rng() < 0.7) {
      const k = keys[Math.floor(rng() * keys.length)];
      orient.set(k, !orient.get(k));
      const s2 = build();
      const c = cost(s2);
      if (c <= best) { best = c; sched = s2; } else orient.set(k, !orient.get(k));
    } else {
      const order = rng() < 0.5 ? leg1Order : leg2Order;
      const i = Math.floor(rng() * (n - 1)), j = Math.floor(rng() * (n - 1));
      [order[i], order[j]] = [order[j], order[i]];
      const junction = leg2Order[0] === leg1Order[n - 2];
      const s2 = build();
      const c = cost(s2) + (junction ? 5 : 0);
      if (c <= best) { best = c; sched = s2; } else [order[i], order[j]] = [order[j], order[i]];
    }
  }
  return sched;
}
