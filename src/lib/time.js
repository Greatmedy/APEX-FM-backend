export const DAY = 86400000;
export const KICKOFF_UTC_HOUR = 19; // 20:00 WAT (UTC+1, no DST)

/** First Monday on/after the given moment (measured in WAT), at 20:00 WAT. */
export function nextMondayOnOrAfter(date) {
  const wat = new Date(date.getTime() + 3600000);
  const dow = wat.getUTCDay();
  const add = (8 - dow) % 7;
  return new Date(Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate() + add, KICKOFF_UTC_HOUR, 0, 0));
}
/** "2026-11-02" -> Monday 20:00 WAT on/after that date. */
export function parseSeasonStart(str) {
  const [y, m, d] = String(str).split('-').map(Number);
  return nextMondayOnOrAfter(new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0)));
}
/** Gameweek n: odd = Monday, even = Thursday, 20:00 WAT. */
export function kickoffFor(startsAt, gw) {
  const week = Math.floor((gw - 1) / 2);
  const extra = gw % 2 === 1 ? 0 : 3;
  return new Date(startsAt.getTime() + (week * 7 + extra) * DAY);
}
export function addMonth(date) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}
/** Real seconds since kickoff -> match seconds (90 min in 10 real min, 20s break). */
export function realToMatch(real, HALF = 300, HT = 20) {
  if (real <= 0) return 0;
  if (real < HALF) return real * 9;
  if (real < HALF + HT) return 2700;
  return Math.min(5400, 2700 + (real - HALF - HT) * 9);
}
