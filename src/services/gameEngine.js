// APEX FM Games — authoritative server-side engine for APEX GT, Nigerian Whot, and Nigerian Ludo.
// All game state lives in memory + is mirrored to MongoDB for reconnect safety.
// Money moves only through gameLedger.js (atomic, virtual naira).
import { Types } from 'mongoose';
import { Race, WhotTable, LudoGame, GameBalance } from '../models/index.js';
import { move, escrow, releaseEscrow, START_BALANCE } from './gameLedger.js';
import { notify } from './notify.js';
import { User } from '../models/index.js';

const GAME = 'apex-gt';
const WHOT_GAME = 'whot';
const LUDO_GAME = 'ludo';
const ioRef = { io: null };
export const bindGameIO = (io) => { ioRef.io = io; };
const emit = (room, event, payload) => ioRef.io?.to(room).emit(event, payload);

const MIN_BET = 5000;
const MAX_BET = 100000;
const AUTO_CLEANUP_MS = 60000; // 1 minute
const AI_NAMES = ['AI Turbo', 'AI Nitro', 'AI Velocity', 'AI Phantom', 'AI Striker', 'AI Vortex', 'AI Inferno', 'AI Spectre'];
const AI_CARS = ['Apex GT-R', 'Vortex', 'Phantom', 'Striker', 'Velocity', 'Inferno', 'Eclipse', 'Titan', 'Spectre', 'Hyperion', 'Nova', 'Venom'];

const races = new Map(); // raceId -> in-memory state
const whotTables = new Map(); // tableId -> { timer, turnDeadline }
const ludoGames = new Map(); // gameId -> mem

// Auto-cleanup: remove empty races/tables/games after 1 minute
function scheduleCleanup(room, kind) {
  setTimeout(async () => {
    if (kind === 'race') {
      const r = await Race.findById(room).lean();
      if (r && r.participants.length === 0) { await Race.deleteOne({ _id: room }); races.delete(room); }
    }
    if (kind === 'whot') {
      const t = await WhotTable.findById(room).lean();
      if (t && t.players.length === 0) { await WhotTable.deleteOne({ _id: room }); whotTables.delete(room); }
    }
    if (kind === 'ludo') {
      const g = await LudoGame.findById(room).lean();
      if (g && g.players.length === 0) { await LudoGame.deleteOne({ _id: room }); ludoGames.delete(room); }
    }
  }, AUTO_CLEANUP_MS);
}

// ============================== HELPERS ==============================
const now = () => Date.now();
const rid = () => new Types.ObjectId().toString();
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(a.length, 1);
const userBrief = async (id) => {
  const { default: mongoose } = await import('mongoose');
  const User = mongoose.model('User');
  const u = await User.findById(id).select('username usernameDisplay managerName').lean();
  return { id: String(id), username: u ? (u.usernameDisplay || u.username) : '?', managerName: u?.managerName || '' };
};

export const validateBet = (bet) => {
  const n = Number(bet);
  if (!Number.isInteger(n) || n < MIN_BET || n > MAX_BET) return null;
  return n;
};

// ============================== APEX GT ==============================
const VENUES = {
  lekki: { id: 'lekki', name: 'Lekki–Ajah Expressway, Lagos' },
  ikeja: { id: 'ikeja', name: 'Ikeja, Lagos' },
  vi: { id: 'vi', name: 'Victoria Island, Lagos' },
  abuja: { id: 'abuja', name: 'Abuja city circuit' },
  ekpoma: { id: 'ekpoma', name: 'Ekpoma Expressway, Edo' },
  benin: { id: 'benin', name: 'Benin Expressway, Edo' },
  auchi: { id: 'auchi', name: 'Auchi road circuit, Edo' },
  uromi: { id: 'uromi', name: 'Uromi road circuit, Edo' },
  aau: { id: 'aau', name: 'AAU Main Campus, Ekpoma' },
  uniben: { id: 'uniben', name: 'UNIBEN Main Campus, Benin' },
};
export const VENUE_LIST = Object.values(VENUES);

export async function createRace({ hostId, venue, bet }) {
  if (!VENUES[venue]) throw new Error('Unknown venue.');
  const amount = validateBet(bet);
  if (!amount) throw new Error(`Bet must be ₦${MIN_BET.toLocaleString()}–₦${MAX_BET.toLocaleString()}.`);
  const bal = await GameBalance.findOne({ user: hostId, game: GAME });
  if (!bal || bal.balance < amount) throw new Error('Insufficient virtual funds.');
  const race = await Race.create({
    host: hostId, venue, bet: amount, state: 'WALLOON',
    participants: [{ user: hostId, ready: false, lapTimes: [] }],
  });
  races.set(String(race._id), { timer: null, countdown: null, lap: 0, startedAt: 0 });
  scheduleCleanup(String(race._id), 'race', () => race.participants.length === 0);
  return race;
}

export async function addAIRacers({ raceId, count }) {
  const race = await Race.findById(raceId);
  if (!race) throw new Error('Race not found.');
  if (race.state !== 'WALLOON') throw new Error('Race already started.');
  const n = Math.max(1, Math.min(3, Number(count) || 1));
  for (let i = 0; i < n; i++) {
    const aiUser = await createAIUser();
    race.participants.push({ user: aiUser, ready: true, lapTimes: [], ai: true, car: AI_CARS[Math.floor(Math.random() * AI_CARS.length)] });
  }
  // Auto-ready the host for AI races
  const hostP = race.participants.find(p => String(p.user) === String(race.host));
  if (hostP) hostP.ready = true;
  await race.save();
  return race;
}

async function createAIUser() {
  // Find or create a lightweight AI user record
  const name = `ai_${AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)]}_${Math.floor(Math.random() * 10000)}`;
  let ai = await User.findOne({ username: name.toLowerCase() });
  if (!ai) {
    ai = await User.create({
      username: name.toLowerCase(),
      usernameDisplay: name,
      email: `${name.toLowerCase()}@ai.apexfm.internal`,
      passwordHash: '$2a$10$' + Math.random().toString(36).slice(2, 28),
      onboarding: { step: 'done' },
      isAI: true,
    });
    // SEED AI BALANCE
    await GameBalance.create({ user: ai._id, game: GAME, balance: 10000000 });
  }
  return ai._id;
}

export async function joinRace({ raceId, userId }) {
  const race = await Race.findById(raceId);
  if (!race) throw new Error('Race not found.');
  if (['COUNTDOWN', 'STARTED', 'FINISHED'].includes(race.state)) throw new Error('Race already started.');
  if (race.participants.some((p) => String(p.user) === String(userId))) throw new Error('Already in this race.');
  if (race.participants.length >= 4) throw new Error('Race is full.');
  const amount = race.bet;
  const bal = await GameBalance.findOne({ user: userId, game: GAME });
  if (!bal || bal.balance < amount) throw new Error('Insufficient virtual funds.');
  race.participants.push({ user: userId, ready: false, lapTimes: [] });
  await race.save();
  return race;
}

export async function leaveRace({ raceId, userId }) {
  const race = await Race.findById(raceId);
  if (!race) return;
  if (['COUNTDOWN', 'STARTED'].includes(race.state)) return; // cannot leave during a race
  race.participants = race.participants.filter((p) => String(p.user) !== String(userId));
  if (race.participants.length === 0) { await Race.deleteOne({ _id: raceId }); races.delete(String(raceId)); return null; }
  await race.save();
  return race;
}

export async function setRaceReady({ raceId, userId, ready }) {
  const race = await Race.findById(raceId);
  if (!race) throw new Error('Race not found.');
  if (race.state !== 'WALLOON') throw new Error('Race is not in the waiting room.');
  const p = race.participants.find((x) => String(x.user) === String(userId));
  if (!p) throw new Error('You are not in this race.');
  p.ready = !!ready;
  await race.save();
  return race;
}

async function escrowRace(race) {
  for (const p of race.participants) {
    await escrow(p.user, GAME, race.bet, String(race._id));
  }
}

async function settleRace(race, winnerIdx) {
  const pot = race.bet * race.participants.length;
  for (let i = 0; i < race.participants.length; i++) {
    const p = race.participants[i];
    if (i === winnerIdx) {
      await move(p.user, GAME, pot, 'bet_win', String(race._id));
    } else {
      // loser already paid via escrow; nothing to move (winner gets pot)
      await releaseEscrow(p.user, GAME, 0, String(race._id)).catch(() => {});
    }
  }
}

export async function startRace({ raceId, userId }) {
  const race = await Race.findById(raceId);
  if (!race) throw new Error('Race not found.');
  if (String(race.host) !== String(userId)) throw new Error('Only the host can start.');
  if (race.state !== 'WALLOON') throw new Error('Race already started.');
  if (race.participants.length < 1) throw new Error('Need at least 1 racer.');
  if (!race.participants.every((p) => p.ready)) throw new Error('Every racer must be ready.');
  await escrowRace(race);
  race.state = 'COUNTDOWN';
  race.startedAt = now();
  await race.save();

  const mem = races.get(String(raceId)) || {};
  let countdown = 3;
  mem.countdown = setInterval(async () => {
    emit(`race-${raceId}`, 'race-countdown', { countdown });
    if (countdown <= 0) {
      clearInterval(mem.countdown);
      race.state = 'STARTED';
      await race.save();
      emit(`race-${raceId}`, 'race-started', { startedAt: now() });
      // simulated race: 3 laps, 2s each
      let lap = 0;
      mem.timer = setInterval(async () => {
        lap++;
        for (const p of race.participants) {
          p.lapTimes.push(2000 + Math.floor(Math.random() * 900));
        }
        await race.save();
        emit(`race-${raceId}`, 'race-lap', { lap, lapTimes: race.participants.map((p) => ({ user: String(p.user), last: p.lapTimes[p.lapTimes.length - 1] })) });
        if (lap >= 3) {
          clearInterval(mem.timer);
          race.state = 'FINISHED';
          race.finishedAt = now();
          const winnerIdx = race.participants.reduce((best, p, i) => (avg(p.lapTimes) < avg(race.participants[best].lapTimes) ? i : best), 0);
          await settleRace(race, winnerIdx);
          await race.save();
          const winner = race.participants[winnerIdx];
          const results = race.participants.map((p) => ({ user: String(p.user), avgLap: Math.round(avg(p.lapTimes)), win: p === winner }));
          emit(`race-${raceId}`, 'race-finished', { winner: String(winner.user), results });
          for (const p of race.participants) {
            notify(p.user, {
              type: 'race_result', title: 'APEX GT race finished',
              body: String(winner.user) === String(p.user) ? `You won ₦${potLocal(race)}!` : `You placed. Winner: ${String(winner.user)}`,
              link: '/games/apex-gt', dedupeKey: `race-${raceId}`,
            }).catch(() => {});
          }
          races.delete(String(raceId));
        }
      }, 2000);
    }
    countdown--;
  }, 1000);
  return race;
}
const potLocal = (race) => (race.bet * race.participants.length).toLocaleString();

export async function racePublic(race) {
  const participants = await Promise.all((race.participants || []).map(async (p) => {
    const u = await userBrief(p.user);
    return { user: String(p.user), name: u.username, ready: !!p.ready, lapTimes: p.lapTimes || [], paint: p.paint || null, car: p.car || null };
  }));
  return {
    id: String(race._id), venue: race.venue, venueName: VENUES[race.venue]?.name || race.venue,
    bet: race.bet, state: race.state, host: String(race.host),
    participants,
  };
}

export async function listRaces() {
  const open = await Race.find({ state: { $in: ['WALLOON'] } }).sort({ createdAt: -1 }).limit(30).lean();
  return Promise.all(open.map(racePublic));
}

// ============================== WHOT ==============================
const SHAPES = ['Circle', 'Triangle', 'Cross', 'Square', 'Star'];
// Card counts per spec (no 6 or 9)
const SHAPE_NUMS = { Circle: [1,2,3,4,5,7,8,10,11,12,13,14], Triangle: [1,2,3,4,5,7,8,10,11,12,13,14], Cross: [1,2,3,5,7,10,11,13,14], Square: [1,2,3,5,7,10,11,13,14], Star: [1,2,3,4,5,7,8] };

function buildDeck() {
  const deck = [];
  for (const shape of SHAPES) {
    for (const n of SHAPE_NUMS[shape]) deck.push({ num: n, shape, id: rid() });
  }
  for (let i = 0; i < 5; i++) deck.push({ num: 20, shape: 'Whot', id: rid() });
  return deck;
}
const handSize = () => 4 + Math.floor(Math.random() * 3); // 4–6

export async function createWhotTable({ hostId, bet }) {
  const amount = validateBet(bet);
  if (!amount) throw new Error(`Bet must be ₦${MIN_BET.toLocaleString()}–₦${MAX_BET.toLocaleString()}.`);
  const bal = await GameBalance.findOne({ user: hostId, game: WHOT_GAME });
  if (!bal || bal.balance < amount) throw new Error('Insufficient virtual funds.');
  const deck = buildDeck();
  const table = await WhotTable.create({ host: hostId, bet: amount, deck: [], playPile: [], state: 'WAITING', market: deck, players: [{ user: hostId, hand: [] }] });
  whotTables.set(String(table._id), { timer: null });
  scheduleCleanup(String(table._id), 'whot', () => table.players.length === 0);
  return table;
}

export async function joinWhotTable({ tableId, userId }) {
  const table = await WhotTable.findById(tableId);
  if (!table) throw new Error('Table not found.');
  if (['PLAY', 'FINISHED'].includes(table.state)) throw new Error('Table already playing.');
  if (table.players.some((p) => String(p.user) === String(userId))) throw new Error('Already seated.');
  if (table.players.length >= 4) throw new Error('Table is full.');
  const amount = table.bet;
  const bal = await GameBalance.findOne({ user: userId, game: WHOT_GAME });
  if (!bal || bal.balance < amount) throw new Error('Insufficient virtual funds.');
  table.players.push({ user: userId, hand: [] });
  await table.save();
  return table;
}

async function dealAndStart(table) {
  // Escrow all bets
  for (const p of table.players) await escrow(p.user, WHOT_GAME, table.bet, String(table._id));
  const deck = shuffle(table.market);
  const count = handSize();
  for (const p of table.players) p.hand = deck.splice(0, count);
  table.market = deck;
  table.playPile = [deck.pop()]; // opening card, no special effect
  table.state = 'PLAY';
  table.turnIndex = Math.floor(Math.random() * table.players.length);
  table.turnStartedAt = now();
  await table.save();
  startWhotTimer(table);
}

function startWhotTimer(table) {
  const mem = whotTables.get(String(table._id));
  if (!mem) return;
  if (mem.timer) clearInterval(mem.timer);
  // 15s turn timer
  let remaining = 15;
  mem.timer = setInterval(async () => {
    remaining--;
    emit(`whot-${table._id}`, 'whot-timer', { remaining, turnUser: String(table.players[table.turnIndex]?.user) });
    if (remaining <= 0) {
      clearInterval(mem.timer);
      // turn passes
      table.turnIndex = (table.turnIndex + 1) % table.players.length;
      table.turnStartedAt = now();
      await table.save();
      emit(`whot-${table._id}`, 'whot-state', await whotPublic(table));
      startWhotTimer(table);
    }
  }, 1000);
}

async function settleWhot(table) {
  const pot = table.bet * table.players.length;
  for (const p of table.players) {
    await move(p.user, WHOT_GAME, pot, 'bet_win', String(table._id)).catch(() => {});
  }
}

export async function startWhotTable({ tableId, userId }) {
  const table = await WhotTable.findById(tableId);
  if (!table) throw new Error('Table not found.');
  if (String(table.host) !== String(userId)) throw new Error('Only the host can start.');
  if (table.state !== 'WAITING') throw new Error('Table already started.');
  if (table.players.length < 2) throw new Error('Need at least 2 players.');
  await dealAndStart(table);
  emit(`whot-${tableId}`, 'whot-state', await whotPublic(table));
  return table;
}

export async function playWhotCard({ tableId, userId, cardId, marketRule }) {
  const table = await WhotTable.findById(tableId);
  if (!table) throw new Error('Table not found.');
  if (table.state !== 'PLAY') throw new Error('Table is not playing.');
  const idx = table.players.findIndex((p) => String(p.user) === String(userId));
  if (idx !== table.turnIndex) throw new Error('It is not your turn.');
  const player = table.players[idx];
  const top = table.playPile[table.playPile.length - 1];

  // Special: draw from market
  if (cardId === '__draw__') {
    if (!table.market.length) throw new Error('Market is empty.');
    player.hand.push(table.market.pop());
    table.turnIndex = (idx + 1) % table.players.length;
    table.turnStartedAt = now();
    await table.save();
    clearWhotTimer(table);
    startWhotTimer(table);
    emit(`whot-${tableId}`, 'whot-state', await whotPublic(table));
    return { drew: true };
  }

  const card = player.hand.find((c) => c.id === cardId);
  if (!card) throw new Error('Card not in your hand.');

  const special = card.num === 20 || [1, 2, 5, 8, 14].includes(card.num);
  const matches = card.num === 20 || card.shape === top.shape || card.num === top.num;
  if (!matches) throw new Error('Card does not match the play pile.');

  player.hand = player.hand.filter((c) => c.id !== cardId);
  table.playPile.push(card);
  table.lastPlay = { user: String(userId), card: { num: card.num, shape: card.shape } };

  // Apply special effects
  let continueTurn = false;
  if (card.num === 20) {
    // Whot wild — next player must match the called shape (simplified: turn passes normally, shape is card's called)
    continueTurn = false;
  } else if (card.num === 1) {
    continueTurn = true; // Hold On
  } else if (card.num === 2) {
    const nextIdx = (idx + 1) % table.players.length;
    const next = table.players[nextIdx];
    for (let i = 0; i < 2; i++) if (table.market.length) next.hand.push(table.market.pop());
    table.turnIndex = nextIdx;
    table.turnStartedAt = now();
    await table.save();
    clearWhotTimer(table);
    startWhotTimer(table);
    emit(`whot-${tableId}`, 'whot-state', await whotPublic(table));
    return { drew: false, effect: 'pick-two' };
  } else if (card.num === 5) {
    const nextIdx = (idx + 1) % table.players.length;
    const next = table.players[nextIdx];
    for (let i = 0; i < 3; i++) if (table.market.length) next.hand.push(table.market.pop());
    table.turnIndex = nextIdx;
    table.turnStartedAt = now();
    await table.save();
    clearWhotTimer(table);
    startWhotTimer(table);
    emit(`whot-${tableId}`, 'whot-state', await whotPublic(table));
    return { drew: false, effect: 'pick-three' };
  } else if (card.num === 8) {
    table.turnIndex = (idx + 2) % table.players.length; // Suspension — skip next
    table.turnStartedAt = now();
    await table.save();
    clearWhotTimer(table);
    startWhotTimer(table);
    emit(`whot-${tableId}`, 'whot-state', await whotPublic(table));
    return { drew: false, effect: 'skip' };
  } else if (card.num === 14) {
    for (let i = 0; i < table.players.length; i++) {
      if (i !== idx && table.market.length) table.players[i].hand.push(table.market.pop());
    }
    continueTurn = true; // General Market — play again
  }

  // Check winner
  if (player.hand.length === 0) {
    table.state = 'FINISHED';
    table.winner = String(userId);
    table.finishedAt = now();
    await settleWhot(table);
    await table.save();
    clearWhotTimer(table);
    emit(`whot-${tableId}`, 'whot-finished', { winner: String(userId), pot: table.bet * table.players.length });
    return { won: true };
  }

  if (!continueTurn) {
    table.turnIndex = (idx + 1) % table.players.length;
  }
  table.turnStartedAt = now();
  await table.save();
  clearWhotTimer(table);
  startWhotTimer(table);
  emit(`whot-${tableId}`, 'whot-state', await whotPublic(table));
  return { played: true };
}
function clearWhotTimer(table) {
  const mem = whotTables.get(String(table._id));
  if (mem?.timer) clearInterval(mem.timer);
}

export async function whotPublic(table) {
  const top = table.playPile?.[table.playPile.length - 1] || null;
  const players = await Promise.all((table.players || []).map(async (p, i) => ({
    user: String(p.user), name: (await userBrief(p.user)).username, handCount: (p.hand || []).length, isTurn: i === table.turnIndex,
  })));
  return {
    id: String(table._id), bet: table.bet, state: table.state, host: String(table.host),
    players,
    marketCount: (table.market || []).length,
    topCard: top ? { num: top.num, shape: top.shape } : null,
    turnUser: String(table.players?.[table.turnIndex]?.user || ''),
    turnIndex: table.turnIndex || 0,
    lastPlay: table.lastPlay || null,
  };
}

export async function whotStateFor(userId, tableId) {
  const table = await WhotTable.findById(tableId);
  if (!table) throw new Error('Table not found.');
  const publicState = await whotPublic(table);
  const me = table.players.find((p) => String(p.user) === String(userId));
  publicState.myHand = me ? me.hand.map((c) => ({ id: c.id, num: c.num, shape: c.shape })) : [];
  return publicState;
}

export async function listWhotTables() {
  const open = await WhotTable.find({ state: 'WAITING' }).sort({ createdAt: -1 }).limit(30).lean();
  return Promise.all(open.map(async (t) => ({
    id: String(t._id), bet: t.bet, host: String(t.host), players: t.players.length,
    hostName: (await userBrief(t.host)).username,
  })));
}

// ============================== LUDO ==============================
const LUDO_COLORS = ['red', 'yellow', 'green', 'blue'];

export async function createLudoGame({ hostId, bet = 0 }) {
  const amount = Number(bet) || 0;
  if (amount < 0 || amount > MAX_BET) throw new Error('Invalid entry amount.');
  const game = await LudoGame.create({
    host: hostId, bet: amount, state: 'WAITING',
    players: [{ user: hostId, color: LUDO_COLORS[0], tokens: [-1, -1, -1, -1] }],
  });
  scheduleCleanup(String(game._id), 'ludo', () => game.players.length === 0);
  return game;
}

export async function joinLudoGame({ gameId, userId }) {
  const game = await LudoGame.findById(gameId);
  if (!game) throw new Error('Game not found.');
  if (['PLAY', 'FINISHED'].includes(game.state)) throw new Error('Game already started.');
  if (game.players.some((p) => String(p.user) === String(userId))) throw new Error('Already seated.');
  if (game.players.length >= 4) throw new Error('Game is full.');
  const used = game.players.map((p) => p.color);
  const color = LUDO_COLORS.find((c) => !used.includes(c));
  if (!color) throw new Error('No color available.');
  game.players.push({ user: userId, color, tokens: [-1, -1, -1, -1] });
  await game.save();
  return game;
}

export async function startLudoGame({ gameId, userId }) {
  const game = await LudoGame.findById(gameId);
  if (!game) throw new Error('Game not found.');
  if (String(game.host) !== String(userId)) throw new Error('Only the host can start.');
  if (game.state !== 'WAITING') throw new Error('Game already started.');
  if (game.players.length < 2) throw new Error('Need at least 2 players.');
  game.state = 'PLAY';
  game.turnIndex = Math.floor(Math.random() * game.players.length);
  await game.save();
  emit(`ludo-${gameId}`, 'ludo-state', await ludoPublic(game));
  return game;
}

// Ludo board: 52 main squares + home path 6 + center. Tokens tracked as position index.
export async function rollLudoDie({ gameId, userId }) {
  const game = await LudoGame.findById(gameId);
  if (!game) throw new Error('Game not found.');
  if (game.state !== 'PLAY') throw new Error('Game not playing.');
  const idx = game.players.findIndex((p) => String(p.user) === String(userId));
  if (idx !== game.turnIndex) throw new Error('It is not your turn.');
  const die = 1 + Math.floor(Math.random() * 6);
  game.lastDie = die;
  game.lastRoll = { user: String(userId), at: now() };
  await game.save();
  emit(`ludo-${gameId}`, 'ludo-state', await ludoPublic(game));
  return { die };
}

export async function moveLudoToken({ gameId, userId, tokenIndex }) {
  const game = await LudoGame.findById(gameId);
  if (!game) throw new Error('Game not found.');
  if (game.state !== 'PLAY') throw new Error('Game not playing.');
  const idx = game.players.findIndex((p) => String(p.user) === String(userId));
  if (idx !== game.turnIndex) throw new Error('It is not your turn.');
  const die = game.lastDie;
  if (!die) throw new Error('Roll the die first.');
  const player = game.players[idx];
  const pos = player.tokens[tokenIndex];
  if (pos === undefined) throw new Error('Invalid token.');

  let newPos;
  if (pos === -1) {
    if (die !== 6) throw new Error('You need a 6 to leave the yard.');
    newPos = 0; // start square
  } else {
    newPos = pos + die;
  }
  const MAX_TRACK = 51;
  if (newPos > MAX_TRACK + 6) throw new Error('Move exceeds board.');
  player.tokens[tokenIndex] = newPos;

  // Capture: land on an opponent's token outside safe squares (0 or every 8th)
  if (newPos <= MAX_TRACK) {
    const safe = newPos === 0 || newPos % 8 === 0;
    if (!safe) {
      for (let j = 0; j < game.players.length; j++) {
        if (j === idx) continue;
        const other = game.players[j];
        other.tokens = other.tokens.map((t) => (t === newPos ? -1 : t));
      }
    }
  }

  // Win check: all 4 tokens reach center (51 + 6 = 57)
  const finished = player.tokens.every((t) => t >= MAX_TRACK + 1);
  if (finished) {
    game.state = 'FINISHED';
    game.winner = String(userId);
    game.finishedAt = now();
    // Optional bet settle
    if (game.bet > 0) {
      const pot = game.bet * game.players.length;
      for (const p of game.players) await move(p.user, LUDO_GAME, pot, 'bet_win', String(game._id)).catch(() => {});
    }
    await game.save();
    emit(`ludo-${gameId}`, 'ludo-finished', { winner: String(userId) });
    return { won: true };
  }

  // Three 6s in a row ends turn; otherwise a 6 grants another roll
  if (die === 6 && game.lastRoll?.user === String(userId)) {
    game.sixStreak = (game.sixStreak || 0) + 1;
    if (game.sixStreak >= 3) {
      game.sixStreak = 0;
      game.turnIndex = (idx + 1) % game.players.length;
    }
  } else {
    game.sixStreak = 0;
    game.turnIndex = (idx + 1) % game.players.length;
  }
  game.lastDie = null;
  await game.save();
  emit(`ludo-${gameId}`, 'ludo-state', await ludoPublic(game));
  return { moved: true };
}

export async function ludoPublic(game) {
  const players = await Promise.all((game.players || []).map(async (p, i) => ({
    user: String(p.user), name: (await userBrief(p.user)).username, color: p.color, tokens: p.tokens || [-1, -1, -1, -1], isTurn: i === game.turnIndex,
  })));
  return {
    id: String(game._id), bet: game.bet, state: game.state, host: String(game.host),
    players,
    turnIndex: game.turnIndex, lastDie: game.lastDie || null,
  };
}

export async function ludoStateFor(gameId) {
  const game = await LudoGame.findById(gameId);
  if (!game) throw new Error('Game not found.');
  return ludoPublic(game);
}

export async function listLudoGames() {
  const open = await LudoGame.find({ state: 'WAITING' }).sort({ createdAt: -1 }).limit(30).lean();
  return Promise.all(open.map(async (g) => ({
    id: String(g._id), bet: g.bet, host: String(g.host), players: g.players.length,
    hostName: (await userBrief(g.host)).username,
  })));
}
