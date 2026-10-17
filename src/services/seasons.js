import { Season, Fixture, Standing, Club, Player, User } from '../models/index.js';
import { generateRounds } from '../lib/schedule.js';
import { kickoffFor, addMonth, nextMondayOnOrAfter } from '../lib/time.js';
import { getTable, topStat } from './standings.js';
import { claimSlot, createAIClubs, tierList, tierName, nextTierToOpen, humansFull } from './clubs.js';
import { notify } from './notify.js';
import { TIER_SIZE, MAX_TIERS, CHAMPION_FANS } from '../config.js';

export const currentSeason = () => Season.findOne().sort({ number: -1 });

/** Fixtures + empty standings for one division. fromGw lets a division that opens mid-season join the remaining gameweeks. */
async function buildTierFixtures(number, startsAt, tier, fromGw = 1) {
  const clubs = await Club.find({ leagueTier: tier }).select('_id').lean();
  if (clubs.length !== TIER_SIZE) throw new Error(`League ${tier} has ${clubs.length} clubs, expected ${TIER_SIZE}`);
  const ids = clubs.map((c) => String(c._id));
  const rounds = generateRounds(ids, `s${number}t${tier}`);
  const docs = rounds.flatMap((rd, i) => (i + 1 < fromGw ? [] : rd.map(([home, away]) => ({ season: number, leagueTier: tier, gameweek: i + 1, kickoffAt: kickoffFor(startsAt, i + 1), home, away }))));
  if (docs.length) await Fixture.insertMany(docs);
  await Standing.insertMany(ids.map((club) => ({ season: number, leagueTier: tier, club })));
}

export async function createSeason(number, startsAt) {
  const endsAt = new Date(kickoffFor(startsAt, 38).getTime() + 15 * 60000);
  const season = await Season.create({ number, startsAt, endsAt, breakUntil: addMonth(endsAt), status: 'scheduled' });
  for (const tier of await tierList()) await buildTierFixtures(number, startsAt, tier);
  return season;
}

let opening = null;
/**
 * Open the next division (3, 4 or 5) with 20 AI clubs, only when every existing division is full of human managers.
 * A division that opens mid-season plays the remaining gameweeks on the same dates as everyone else (all clubs get equal games);
 * if fewer than 6 gameweeks remain it simply starts with the next season. Returns the new tier number or null.
 */
export async function openNextTier({ schedule = true } = {}) {
  while (opening) await opening.catch(() => {});
  opening = (async () => {
    const tier = await nextTierToOpen();
    if (!tier) return null;
    await createAIClubs(tier, TIER_SIZE);
    const season = schedule ? await currentSeason() : null;
    if (season && season.status !== 'archived') {
      let gw = 1;
      while (gw <= 38 && kickoffFor(season.startsAt, gw).getTime() < Date.now() + 2 * 3600000) gw++;
      await buildTierFixtures(season.number, season.startsAt, tier, 38 - gw + 1 >= 6 ? gw : 39);
    }
    console.log(`[apex] opened ${tierName(tier)} with ${TIER_SIZE} AI clubs`);
    return tier;
  })();
  try { return await opening; } finally { opening = null; }
}

export async function bootstrapLeagues(startsAt) {
  if (await Season.exists({})) return;
  console.log('[apex] seeding APEX League 1 and 2 with AI clubs...');
  for (const tier of [1, 2]) await createAIClubs(tier, TIER_SIZE);
  await createSeason(1, startsAt);
  console.log('[apex] season 1 created: ' + startsAt.toISOString());
}

/** Bottom 3 of each division go down, top 3 of the one below go up. Forfeited clubs are relegated first (and never promoted). Pure. */
export function computeMoves(tiers, tables) {
  const moves = [];
  for (let i = 0; i < tiers.length - 1; i++) {
    const [up, down] = [tiers[i], tiers[i + 1]];
    const forf = tables[up].filter((r) => r.club.forfeited);
    const bottom = tables[up].filter((r) => !r.club.forfeited).slice(-Math.max(0, 3 - forf.length));
    const relegated = [...forf, ...bottom].map((r) => r.club);
    const promoted = tables[down].filter((r) => !r.club.forfeited).slice(0, relegated.length).map((r) => r.club);
    relegated.forEach((c) => moves.push({ c, to: down, dir: 'down' }));
    promoted.forEach((c) => moves.push({ c, to: up, dir: 'up' }));
  }
  return moves;
}

const compact = (r) => ({ pos: r.pos, club: r.club.displayName, short: r.club.short, p: r.played, w: r.won, d: r.drawn, l: r.lost, gf: r.gf, ga: r.ga, gd: r.gd, pts: r.pts, forfeited: r.club.forfeited });

export async function seasonFinished(season) {
  const open = await Fixture.countDocuments({ season: season.number, status: { $in: ['scheduled', 'starting', 'live'] } });
  return open === 0;
}

/** Archive, promote/relegate, one-month break, generate the next season. */
export async function rolloverSeason({ force = false } = {}) {
  const season = await currentSeason();
  if (!season || season.status === 'archived') return null;
  const finished = await seasonFinished(season);
  if (!finished && !force) return null;
  if (!finished) await Fixture.updateMany({ season: season.number, status: { $in: ['scheduled', 'starting', 'live'] } }, { $set: { status: 'void' } });

  const n = season.number;
  const tiers = await tierList();
  const tables = {};
  const archive = {};
  for (const tier of tiers) {
    tables[tier] = await getTable(n, tier);
    archive['table' + tier] = tables[tier].map(compact);
    archive['scorers' + tier] = (await topStat(n, tier, 'goals')).map((r) => ({ name: r.name, count: r.count, club: r.club?.displayName }));
    archive['assists' + tier] = (await topStat(n, tier, 'assists')).map((r) => ({ name: r.name, count: r.count, club: r.club?.displayName }));
  }
  // champions: top of every division, with a fans boost
  const champions = [];
  for (const tier of tiers) {
    const top = tables[tier][0];
    if (!top || !top.played || top.club.forfeited) continue;
    champions.push({ tier, club: top.club.displayName, pts: top.pts });
    await Club.updateOne({ _id: top.club._id }, { $inc: { fans: CHAMPION_FANS[tier] || 10000 }, $push: { titles: { season: n, tier } } });
    if (top.club.manager) await notify(top.club.manager, { type: 'info', title: `Champions of ${tierName(tier)}!`, body: `${top.club.displayName} won the title in season ${n} on ${top.pts} points. Your fans grew by ${(CHAMPION_FANS[tier] || 10000).toLocaleString('en-US')}.`, link: '/home', dedupeKey: `champ:${n}:${top.club._id}` });
  }
  archive.champions = champions;
  season.archive = archive; season.status = 'archived';
  season.markModified('archive');
  await season.save();

  // promotion / relegation between every pair of neighbouring divisions: bottom 3 down, top 3 up (forfeited clubs go down first)
  const moves = computeMoves(tiers, tables);
  for (const to of new Set(moves.map((m) => m.to))) await Club.updateMany({ _id: { $in: moves.filter((m) => m.to === to).map((m) => m.c._id) } }, { $set: { leagueTier: to } });
  await Club.updateMany({}, { $set: { forfeited: false, seasonForm: [] } });
  await Player.updateMany({}, { $set: { injuredFor: 0, suspendedFor: 0 } });
  for (const { c, to, dir } of moves) if (c.manager) await notify(c.manager, { type: 'info', title: dir === 'down' ? `Relegated to ${tierName(to)}` : `Promoted to ${tierName(to)}`, body: `${c.displayName} ${dir === 'down' ? 'drops down' : 'moves up'} for season ${n + 1}.`, link: '/home', dedupeKey: `${dir === 'down' ? 'rel' : 'pro'}:${n}:${c._id}` });

  // waitlisted managers take AI slots before the new fixtures are drawn
  const waiting = await User.find({ 'onboarding.step': 'waitlist' }).sort({ createdAt: 1 });
  for (const u of waiting) {
    const order = [u.onboarding.waitTier || 2, ...(await tierList())];
    let club = null;
    for (const t of [...new Set(order)]) { club = await claimSlot(t, u); if (club) break; }
    if (!club && (await openNextTier({ schedule: false }))) { const ts = await tierList(); club = await claimSlot(ts[ts.length - 1], u); }
    if (club) await notify(u._id, { type: 'info', title: 'A league slot opened', body: `You are now managing ${club.displayName}.`, link: '/home', dedupeKey: 'wait:' + n + u._id });
  }

  const startsAt = nextMondayOnOrAfter(season.breakUntil);
  const next = await createSeason(n + 1, startsAt);
  const humans = await Club.find({ isAI: false, manager: { $ne: null } }).select('manager').lean();
  for (const h of humans) await notify(h.manager, { type: 'info', title: `Season ${n} is complete`, body: `Season ${n + 1} kicks off ${startsAt.toUTCString()}. Fixtures are already published.`, link: '/home', dedupeKey: 'newseason:' + (n + 1) + h.manager });
  console.log(`[apex] rolled over: season ${n} archived, season ${n + 1} starts ${startsAt.toISOString()}`);
  return next;
}
