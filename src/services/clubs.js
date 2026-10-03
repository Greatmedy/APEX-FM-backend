import { Club, Player, Standing, Fixture, User } from '../models/index.js';
import { ALL_KEYS, templateSquad } from '../lib/playerGen.js';
import { CLUB_BY_KEY } from '../data/clubs.js';
import { autoPick } from '../lib/formations.js';
import { rngFrom, shuffle, pick } from '../lib/rng.js';
import { STYLES } from '../lib/formations.js';

export const tierName = (t) => (t === 1 ? 'APEX League 1' : 'APEX League 2');

export async function cloneSquad(club, key) {
  await Player.deleteMany({ club: club._id });
  const docs = await Player.insertMany(templateSquad(key).map((p) => ({ ...p, club: club._id })));
  const tpl = CLUB_BY_KEY[key];
  const { lineup, bench } = autoPick(docs.map((d) => d.toObject()), '4-3-3');
  club.tactics = {
    formation: '4-3-3',
    style: club.isAI ? pick(rngFrom(key + club._id), STYLES) : 'balanced',
    lineup: lineup.map((p) => p._id), bench: bench.map((p) => p._id),
    captain: [...docs].sort((a, b) => b.ovr - a.ovr)[0]._id,
  };
  return { docs, tpl };
}

export function applyTemplate(club, key, managerName) {
  const t = CLUB_BY_KEY[key];
  club.templateKey = key; club.name = t.name; club.short = t.short;
  club.managerName = managerName; club.displayName = `${t.name} — ${managerName}`;
  club.crestColors = t.crest; club.stadiumName = t.stadium; club.kit = { ...t.kit };
}

/** Create the 20 APEX AI clubs for a tier (distinct templates inside the league). */
export async function createAIClubs(tier, count = 20) {
  const keys = shuffle(rngFrom('apex-ai-' + tier), ALL_KEYS).slice(0, count);
  for (const key of keys) {
    const club = new Club({ leagueTier: tier, isAI: true, fans: 10000 });
    applyTemplate(club, key, 'APEX AI');
    await cloneSquad(club, key);
    await club.save();
  }
}

/** Free human slots = AI clubs that are claimable right now. */
export async function claimableAIClubs(tier) {
  const clubs = await Club.find({ leagueTier: tier, isAI: true, forfeited: false }).select('_id').lean();
  if (!clubs.length) return [];
  const ids = clubs.map((c) => c._id);
  const live = await Fixture.find({ status: { $in: ['live', 'starting'] }, $or: [{ home: { $in: ids } }, { away: { $in: ids } }] }).select('home away').lean();
  const busy = new Set(live.flatMap((f) => [String(f.home), String(f.away)]));
  const stands = await Standing.find({ leagueTier: tier, club: { $in: ids } }).sort({ season: -1 }).lean();
  const played = new Map();
  for (const s of stands) if (!played.has(String(s.club))) played.set(String(s.club), s.played);
  return ids.filter((id) => !busy.has(String(id))).sort((a, b) => (played.get(String(a)) || 0) - (played.get(String(b)) || 0));
}

export async function freeSlots(tier) { return (await claimableAIClubs(tier)).length; }

/** Atomically convert an AI club into the user's club. Returns the club or null. */
export async function claimSlot(tier, user) {
  const candidates = await claimableAIClubs(tier);
  const key = user.onboarding.templateKey;
  const mname = user.managerName || user.usernameDisplay || user.username;
  for (const id of candidates) {
    const club = await Club.findOneAndUpdate({ _id: id, isAI: true }, { $set: { isAI: false, manager: user._id } }, { new: true });
    if (!club) continue;
    let display = `${CLUB_BY_KEY[key].name} — ${mname}`;
    const dupe = await Club.exists({ leagueTier: tier, displayName: display, _id: { $ne: club._id } });
    applyTemplate(club, key, mname);
    if (dupe) club.displayName = `${display} (${user.usernameDisplay || user.username})`;
    club.fans = 10000; club.seasonForm = []; club.forfeited = false;
    await cloneSquad(club, key);
    await club.save();
    await User.updateOne({ _id: user._id }, { $set: { clubId: club._id, 'onboarding.step': 'done' } });
    return club;
  }
  return null;
}
