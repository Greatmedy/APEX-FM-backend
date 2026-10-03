import { COUNTRY } from '../data/countries.js';
import { CLUBS, CLUB_BY_KEY } from '../data/clubs.js';
import { rngFrom, clamp } from './rng.js';

// offsets from OVR: [pace, shooting, passing, dribbling, defending, physical]
const PROFILE = {
  GK: [-28, -45, -18, -40, 0, -8],
  CB: [-12, -30, -13, -20, 3, 3],
  LB: [1, -20, -7, -5, -2, -6],
  RB: [1, -20, -7, -5, -2, -6],
  CDM: [-8, -14, 0, -6, 1, 3],
  CM: [-4, -9, 2, 0, -8, -1],
  CAM: [-1, -4, 3, 3, -25, -12],
  LW: [4, -3, -5, 4, -30, -12],
  RW: [4, -3, -5, 4, -30, -12],
  ST: [1, 2, -10, -2, -32, -2],
};
const HEIGHT = { GK: 190, CB: 188, LB: 178, RB: 178, CDM: 182, CM: 180, CAM: 177, LW: 175, RW: 175, ST: 183 };
const NUMBERS = { GK: [1, 13], DEF: [2, 3, 4, 5, 12, 15], MID: [6, 8, 10, 14, 16, 18], ATT: [7, 9, 11, 17] };
const KEY = { GK: [4], CB: [4, 5], LB: [0, 4], RB: [0, 4], CDM: [2, 4], CM: [2, 3], CAM: [2, 3], LW: [0, 3], RW: [0, 3], ST: [1, 0] };

export function genPlayer(line, idx, group) {
  const [name, pos, ovrS, cc, ageS] = line.split('|');
  const ovr = Number(ovrS), age = Number(ageS);
  const rng = rngFrom(name);
  const off = PROFILE[pos];
  const st = off.map((o) => clamp(Math.round(ovr + o + (rng() * 6 - 3)), 18, 96));
  if (pos === 'GK') st[4] = clamp(ovr + Math.round(rng() * 2), 40, 96);
  const keyAvg = KEY[pos].reduce((s, i) => s + st[i], 0) / KEY[pos].length;
  const stars = keyAvg >= 86 ? 5 : keyAvg >= 80 ? 4 : keyAvg >= 74 ? 3 : keyAvg >= 67 ? 2 : 1;
  const stamina = clamp(Math.round(70 + (age < 28 ? 5 : age > 33 ? -6 : 0) + (pos === 'ST' || pos === 'CB' ? -2 : 3) + rng() * 14 - 4), 55, 95);
  const sm = { GK: 1, CB: 1, LB: 2, RB: 2, CDM: 2, CM: 2, CAM: 3, LW: 3, RW: 3, ST: 2 }[pos] + (ovr >= 84 ? 1 : 0) + (ovr >= 89 ? 1 : 0) + (rng() < 0.3 ? 1 : 0);
  const height = Math.round(HEIGHT[pos] + rng() * 10 - 5);
  const nums = NUMBERS[group];
  return {
    name, position: pos, ovr, pace: st[0], shooting: st[1], passing: st[2], dribbling: st[3], defending: st[4], physical: st[5],
    stamina, stars, skillMoves: clamp(sm, 1, 5), country: COUNTRY[cc] || cc, countryCode: cc, foot: rng() < 0.76 ? 'Right' : 'Left',
    age, heightCm: height, weightKg: Math.round((height - 100) * 0.92 + rng() * 6 - 3), portraitSeed: Math.floor(rng() * 1e9),
    number: nums[idx] ?? 20 + idx,
  };
}

const GROUP_BY_INDEX = (i) => (i < 2 ? ['GK', i] : i < 8 ? ['DEF', i - 2] : i < 14 ? ['MID', i - 8] : ['ATT', i - 14]);

const cache = new Map();
/** Deterministic template squad (array of 18 plain player objects) */
export function templateSquad(key) {
  if (cache.has(key)) return cache.get(key);
  const t = CLUB_BY_KEY[key];
  const lines = t.squad.trim().split('\n').map((s) => s.trim());
  const squad = lines.map((l, i) => { const [g, gi] = GROUP_BY_INDEX(i); return genPlayer(l, gi, g); });
  cache.set(key, squad);
  return squad;
}
export const templateMeta = (key) => {
  const t = CLUB_BY_KEY[key];
  const squad = templateSquad(key);
  const top3 = [...squad].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  return { key: t.key, name: t.name, short: t.short, league: t.league, stadium: t.stadium, crest: t.crest, kit: t.kit, ovr: Math.round([...squad].sort((a, b) => b.ovr - a.ovr).slice(0, 11).reduce((s, p) => s + p.ovr, 0) / 11), stars: top3 };
};
export const ALL_KEYS = CLUBS.map((c) => c.key);
