import { Fixture } from '../models/index.js';
import { HALF_REAL_SEC, HT_REAL_SEC } from '../config.js';
import { realToMatch } from '../lib/time.js';
import { rngFrom, rand } from '../lib/rng.js';
import { createState, applyEvent, opp } from './matchCore.js';
import { genAction, buildSchedule, runScheduled, finalStats } from './engine.js';
import { finalizeLive } from '../services/results.js';
import { getIO } from '../services/notify.js';

const runners = new Map();
export const getRunner = (id) => runners.get(String(id));
export const runnerCount = () => runners.size;

class Runner { 
  constructor(fx, setup, events) {
    this.id = String(fx._id);
    this.t0 = new Date(fx.kickoffAt).getTime();
    this.setup = setup;
    this.st = createState(setup);
    this.events = events.slice();
    this.saved = events.length;
    this.queue = [];
    this.pending = [];
    this.rng = rngFrom(setup.seed + '|' + events.length);
    for (const e of events) applyEvent(this.st, e);
    const lastS = events.length ? events[events.length - 1].s : -1;
    this.sched = buildSchedule(setup).filter((i) => i.at > lastS);
    const last = events[events.length - 1];
    this.phase = !events.length ? 'new' : events.some((e) => e.k === 'halftime') ? (last.k === 'halftime' ? 'ht' : 'h2') : 'h1';
    this.nextAt = Math.max(lastS, 0) + this.gap();
    this.lastSave = Date.now();
    this.finishing = false;
    this.timer = setInterval(() => this.tick().catch((e) => console.error('runner tick', e)), 400);
  }
  gap() { return rand(this.rng, 11, 26); }
  room() { return 'fixture:' + this.id; }
  add(ev) {
    for (const k of ['z', 'y']) if (typeof ev[k] === 'number') ev[k] = Math.round(ev[k] * 1000) / 1000;
    applyEvent(this.st, ev); this.queue.push(ev);
  }
  validateSub(side, out, inn) {
    const S = this.st.sides[side];
    if (S.subsUsed >= 5) return 'You have used all 5 substitutions.';
    const o = S.lineup.find((p) => p.id === out && p.on);
    const i = S.bench.find((p) => p.id === inn);
    if (!o) return 'That player is not on the pitch.';
    if (!i) return 'That player is not on the bench.';
    if ((o.g === 'GK') !== (i.g === 'GK')) return 'Goalkeepers can only be swapped for goalkeepers.';
    return null;
  }
  command(c) { this.pending.push(c); }
  runPending(s) {
    while (this.pending.length) {
      const c = this.pending.shift();
      if (c.type === 'style') this.add({ k: 'style', t: c.side, s, style: c.style });
      else if (c.type === 'sub' && !this.validateSub(c.side, c.out, c.in)) this.add({ k: 'sub', t: c.side, s, p: c.out, q: c.in });
    }
  }
  genTo(limit) {
    const bound = this.phase === 'h1' ? 2700 : 5400;
    const lim = Math.min(limit, bound - 1);
    while (this.nextAt <= lim) {
      this.runPending(this.nextAt);
      while (this.sched.length && this.sched[0].at <= this.nextAt) runScheduled(this.st, this.rng, this.sched.shift()).forEach((e) => this.add({ ...e, s: Math.min(Math.max(e.s, this.st.sec), bound - 0.5) }));
      const evs = genAction(this.st, this.rng, this.nextAt);
      let lastS = this.nextAt;
      for (const e of evs) { e.s = Math.min(e.s, bound - 0.5); lastS = e.s; this.add(e); }
      this.nextAt = lastS + this.gap() * (this.st.sides[this.st.poss || 'h'].style === 'possession' ? 1.1 : 1);
    }
  }
  async tick() {
    if (this.finishing) return;
    const real = (Date.now() - this.t0) / 1000;
    const msec = realToMatch(real, HALF_REAL_SEC, HT_REAL_SEC);
    if (this.phase === 'new') { this.add({ k: 'kickoff', t: 'h', s: 0, z: 0.5, y: 0.5, p: this.st.sides.h.lineup.find((p) => p.sg === 'ATT')?.id }); this.phase = 'h1'; this.nextAt = this.gap(); }
    if (this.phase === 'h1' && real >= HALF_REAL_SEC) { this.genTo(2699); this.add({ k: 'halftime', t: 'h', s: 2700 }); this.phase = 'ht'; }
    if (this.phase === 'ht') this.runPending(2700);
    if (this.phase === 'ht' && real >= HALF_REAL_SEC + HT_REAL_SEC) {
      this.add({ k: 'kickoff', t: 'a', s: 2700, z: 0.5, y: 0.5, p: this.st.sides.a.lineup.find((p) => p.sg === 'ATT')?.id });
      this.phase = 'h2'; this.nextAt = 2700 + this.gap();
    }
    if (this.phase === 'h1' || this.phase === 'h2') this.genTo(msec);
    if (this.phase === 'h2' && real >= HALF_REAL_SEC * 2 + HT_REAL_SEC) {
      this.genTo(5399);
      this.add({ k: 'fulltime', t: 'h', s: 5400, sc: [this.st.score.h, this.st.score.a] });
      this.phase = 'ft';
    }
    await this.flush(this.phase === 'ft' ? 5400 : msec);
  }
  async flush(msec) {
    const io = getIO();
    let fulltime = false, force = false;
    while (this.queue.length && this.queue[0].s <= msec) {
      const ev = this.queue.shift();
      ev.i = this.events.length;
      this.events.push(ev);
      io?.to(this.room()).emit('event', { fixtureId: this.id, ev });
      if (ev.k === 'halftime') { io?.to(this.room()).emit('halftime', { fixtureId: this.id }); force = true; }
      if (ev.k === 'style') io?.to(this.room()).emit('opponent-tactic', { fixtureId: this.id, side: ev.t, style: ev.style });
      if (ev.k === 'fulltime') { fulltime = true; force = true; }
    }
    if (force || Date.now() - this.lastSave > 3000) await this.save();
    if (fulltime) await this.finish();
  }
  async save() {
    this.lastSave = Date.now();
    if (this.saved >= this.events.length) return;
    const chunk = this.events.slice(this.saved);
    this.saved = this.events.length;
    try { await Fixture.updateOne({ _id: this.id }, { $push: { eventLog: { $each: chunk } } }); } catch (e) { this.saved -= chunk.length; console.error('save log failed', e.message); }
  }
  async finish() {
    this.finishing = true;
    clearInterval(this.timer);
    runners.delete(this.id);
    const stats = finalStats(this.st, rngFrom(this.id + 'stats'));
    const fx = await finalizeLive(this.id, this.st, this.setup, stats);
    getIO()?.to(this.room()).emit('fulltime', { fixtureId: this.id, result: { h: this.st.score.h, a: this.st.score.a }, stats });
    return fx;
  }
  stop() { clearInterval(this.timer); runners.delete(this.id); }
}

export function startRunner(fx, setup, events = []) {
  if (runners.has(String(fx._id))) return runners.get(String(fx._id));
  const r = new Runner(fx, setup, events);
  runners.set(r.id, r);
  const io = getIO();
  io?.to(r.room()).emit('kickoff', { fixtureId: r.id, setup });
  io?.to(r.room()).emit('opponent-tactic', { fixtureId: r.id, side: 'h', style: setup.h.style, formation: setup.h.formation });
  io?.to(r.room()).emit('opponent-tactic', { fixtureId: r.id, side: 'a', style: setup.a.style, formation: setup.a.formation });
  return r;
}
export { opp };
