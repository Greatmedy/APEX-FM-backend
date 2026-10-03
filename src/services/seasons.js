import { Season, Fixture, Standing, Club, Player, User } from '../models/index.js';
import { generateRounds } from '../lib/schedule.js';
import { kickoffFor, addMonth, nextMondayOnOrAfter } from '../lib/time.js';
import { getTable, topStat } from './standings.js';
import { claimSlot, createAIClubs } from './clubs.js';
import { notify } from './notify.js';

export const currentSeason = () => Season.findOne().sort({ number: -1 });

export async function createSeason(number, startsAt) {
  const endsAt = new Date(kickoffFor(startsAt, 38).getTime() + 15 * 60000);
  const season = await Season.create({ number, startsAt, endsAt, breakUntil: addMonth(endsAt), status: 'scheduled' });
  for (const tier of [1, 2]) {
    const clubs = await Club.find({ leagueTier: tier }).select('_id').lean();
    if (clubs.length !== 20) throw new Error(`League ${tier} has ${clubs.length} clubs, expected 20`);
    const ids = clubs.map((c) => String(c._id));
    const rounds = generateRounds(ids, `s${number}t${tier}`);
    const docs = rounds.flatMap((rd, i) => rd.map(([home, away]) => ({ season: number, leagueTier: tier, gameweek: i + 1, kickoffAt: kickoffFor(startsAt, i + 1), home, away })));
    await Fixture.insertMany(docs);
    await Standing.insertMany(ids.map((club) => ({ season: number, leagueTier: tier, club })));
  }
  return season;
}

export async function bootstrapLeagues(startsAt) {
  if (await Season.exists({})) return;
  console.log('[apex] seeding APEX League 1 and 2 with AI clubs...');
  for (const tier of [1, 2]) await createAIClubs(tier, 20);
  await createSeason(1, startsAt);
  console.log('[apex] season 1 created: ' + startsAt.toISOString());
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
  const [t1, t2] = [await getTable(n, 1), await getTable(n, 2)];
  const archive = {};
  for (const tier of [1, 2]) {
    archive['table' + tier] = (tier === 1 ? t1 : t2).map(compact);
    archive['scorers' + tier] = (await topStat(n, tier, 'goals')).map((r) => ({ name: r.name, count: r.count, club: r.club?.displayName }));
    archive['assists' + tier] = (await topStat(n, tier, 'assists')).map((r) => ({ name: r.name, count: r.count, club: r.club?.displayName }));
  }
  season.archive = archive; season.status = 'archived';
  season.markModified('archive');
  await season.save();

  // promotion / relegation (forfeited clubs take relegation spots first)
  const forf1 = t1.filter((r) => r.club.forfeited);
  const bottom = t1.filter((r) => !r.club.forfeited).slice(-Math.max(0, 3 - forf1.length));
  const relegated = [...forf1, ...bottom].map((r) => r.club);
  const promoted = t2.filter((r) => !r.club.forfeited).slice(0, relegated.length).map((r) => r.club);
  await Club.updateMany({ _id: { $in: relegated.map((c) => c._id) } }, { $set: { leagueTier: 2 } });
  await Club.updateMany({ _id: { $in: promoted.map((c) => c._id) } }, { $set: { leagueTier: 1 } });
  await Club.updateMany({}, { $set: { forfeited: false, seasonForm: [] } });
  await Player.updateMany({}, { $set: { injuredFor: 0, suspendedFor: 0 } });
  for (const c of relegated) if (c.manager) await notify(c.manager, { type: 'info', title: 'Relegated to APEX League 2', body: `${c.displayName} drops down for season ${n + 1}.`, link: '/home', dedupeKey: `rel:${n}:${c._id}` });
  for (const c of promoted) if (c.manager) await notify(c.manager, { type: 'info', title: 'Promoted to APEX League 1', body: `${c.displayName} moves up for season ${n + 1}.`, link: '/home', dedupeKey: `pro:${n}:${c._id}` });

  // waitlisted managers take AI slots before the new fixtures are drawn
  const waiting = await User.find({ 'onboarding.step': 'waitlist' }).sort({ createdAt: 1 });
  for (const u of waiting) {
    const pref = u.onboarding.waitTier || 2;
    const club = (await claimSlot(pref, u)) || (await claimSlot(pref === 1 ? 2 : 1, u));
    if (club) await notify(u._id, { type: 'info', title: 'A league slot opened', body: `You are now managing ${club.displayName}.`, link: '/home', dedupeKey: 'wait:' + n + u._id });
  }

  const startsAt = nextMondayOnOrAfter(season.breakUntil);
  const next = await createSeason(n + 1, startsAt);
  const humans = await Club.find({ isAI: false, manager: { $ne: null } }).select('manager').lean();
  for (const h of humans) await notify(h.manager, { type: 'info', title: `Season ${n} is complete`, body: `Season ${n + 1} kicks off ${startsAt.toUTCString()}. Fixtures are already published.`, link: '/home', dedupeKey: 'newseason:' + (n + 1) + h.manager });
  console.log(`[apex] rolled over: season ${n} archived, season ${n + 1} starts ${startsAt.toISOString()}`);
  return next;
}
