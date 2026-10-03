import cron from 'node-cron';
import { Fixture, Club } from '../models/index.js';
import { kickoff } from '../services/matchFlow.js';
import { notify } from '../services/notify.js';
import { currentSeason, rolloverSeason } from '../services/seasons.js';
import { READY_WINDOW_MS } from '../config.js';

let busy = false;
async function kickoffTick() {
  if (busy) return;
  busy = true;
  try {
    const due = await Fixture.find({ status: 'scheduled', kickoffAt: { $lte: new Date() } }).select('_id').limit(60).lean();
    await Promise.all(due.map((f) => kickoff(f._id)));
  } catch (e) { console.error('kickoffTick', e); } finally { busy = false; }
}

async function notificationsJob() {
  const now = Date.now();
  const fixtures = await Fixture.find({ status: 'scheduled', kickoffAt: { $gt: new Date(now), $lte: new Date(now + 24 * 3600 * 1000) } }).lean();
  if (!fixtures.length) return;
  const clubs = await Club.find({ _id: { $in: fixtures.flatMap((f) => [f.home, f.away]) }, isAI: false }).lean();
  const cm = new Map(clubs.map((c) => [String(c._id), c]));
  for (const f of fixtures) {
    const when = new Date(f.kickoffAt).getTime() - now;
    for (const [mine, theirs] of [[f.home, f.away], [f.away, f.home]]) {
      const c = cm.get(String(mine));
      if (!c?.manager) continue;
      const opp = await Club.findById(theirs).select('displayName').lean();
      await notify(c.manager, { type: 'upcoming', title: `Upcoming: ${opp.displayName}`, body: `Gameweek ${f.gameweek} kicks off at 20:00 WAT.`, link: `/match/${f._id}`, dedupeKey: `up:${f._id}` });
      if (when <= READY_WINDOW_MS) await notify(c.manager, { type: 'ready', title: 'Ready window is open', body: `Tap Ready for ${opp.displayName}. Kickoff is in under 10 minutes.`, link: `/match/${f._id}`, dedupeKey: `ready:${f._id}` });
    }
  }
}

async function seasonJob() {
  const s = await currentSeason();
  if (s && s.status !== 'archived' && Date.now() > s.endsAt.getTime()) await rolloverSeason();
}

export function startScheduler() {
  setInterval(kickoffTick, 2000);
  cron.schedule('* * * * *', () => { notificationsJob().catch((e) => console.error('notif job', e)); seasonJob().catch((e) => console.error('season job', e)); });
  kickoffTick();
}
