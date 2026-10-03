import { Fixture, Club } from '../models/index.js';
import { buildSetup } from './matchSetup.js';
import { startRunner } from '../sim/runner.js';
import { setPlainResult } from './results.js';
import { getIO } from './notify.js';

/** Called by the scheduler at 20:00 WAT. Handles ready/auto-ready rules and starts the live runner. */
export async function kickoff(id) {
  const fx = await Fixture.findOneAndUpdate({ _id: id, status: 'scheduled' }, { $set: { status: 'starting' } }, { new: true });
  if (!fx) return;
  try {
    const [home, away] = await Promise.all([Club.findById(fx.home).lean(), Club.findById(fx.away).lean()]);
    const hH = !home.isAI, aH = !away.isAI;
    const r = fx.ready;
    if (hH && aH && !r.h && !r.a) {
      await Fixture.updateOne({ _id: fx._id }, { $set: { status: 'scheduled' } });
      const fresh = await Fixture.findById(fx._id);
      await setPlainResult(fresh, 0, 0, { noShow: true });
      getIO()?.to('fixture:' + fx._id).emit('fulltime', { fixtureId: String(fx._id), result: { h: 0, a: 0 }, noShow: true });
      return;
    }
    const auto = { h: hH && !r.h && r.a, a: aH && !r.a && r.h };
    const setup = await buildSetup(fx);
    await Fixture.updateOne({ _id: fx._id }, { $set: { status: 'live', setup, eventLog: [], 'ready.h': hH ? r.h || auto.h : true, 'ready.a': aH ? r.a || auto.a : true, 'autoReady.h': auto.h, 'autoReady.a': auto.a } });
    startRunner(fx, setup, []);
    getIO()?.to('fixture:' + fx._id).emit('ready', { fixtureId: String(fx._id), ready: { h: true, a: true }, auto });
  } catch (e) {
    console.error('kickoff failed', fx._id, e);
    await Fixture.updateOne({ _id: fx._id, status: 'starting' }, { $set: { status: 'scheduled' } });
  }
}

/** On boot: put crashed fixtures back on track and resume live runners from their saved event log. */
export async function resumeAll() {
  await Fixture.updateMany({ status: 'starting' }, { $set: { status: 'scheduled' } });
  const live = await Fixture.find({ status: 'live' });
  for (const fx of live) {
    if (!fx.setup) { await Fixture.updateOne({ _id: fx._id }, { $set: { status: 'scheduled' } }); continue; }
    startRunner(fx, fx.setup, fx.eventLog || []);
  }
  if (live.length) console.log(`[apex] resumed ${live.length} live match(es) from saved event logs`);
}
