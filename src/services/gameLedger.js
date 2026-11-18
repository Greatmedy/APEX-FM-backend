// Virtual naira ledger for APEX GT / Whot / Ludo.
// Integer amounts only. Server-side atomic writes. No real money.
import mongoose from 'mongoose';
import { GameLedger, GameBalance } from '../models/index.js';

export const START_BALANCE = 10_000_000;
export const MIN_BET = 5000;
export const MAX_BET = 100000;
export const validateBet = (bet) => {
  const n = Number(bet);
  if (!Number.isInteger(n) || n < MIN_BET || n > MAX_BET) return null;
  return n;
};

export const REASONS = {
  SIGNUP: 'signup_bonus',
  RACE_WIN: 'race_win',
  RACE_LOSE: 'race_loss',
  BET_WIN: 'bet_win',
  BET_LOSE: 'bet_loss',
  BET_REFUND: 'bet_refund',
  BET_ESCROW: 'bet_escrow',
  BET_RELEASE: 'bet_release',
  PURCHASE: 'purchase',
  REWARD: 'reward',
  PENALTY: 'penalty',
  ADJUST: 'admin_adjust',
};

export async function getBalance(userId, game) {
  let b = await GameBalance.findOne({ user: userId, game });
  if (!b) {
    b = await GameBalance.create({ user: userId, game, balance: START_BALANCE, grantedAt: new Date() });
  }
  return b;
}

/** Atomically credit or debit. Throws on insufficient funds. Returns { balance, entry }. */
export async function move(userId, game, amount, reason, relatedId = null) {
  if (!Number.isInteger(amount) || amount === 0) throw new Error('Invalid amount.');
  const session = await mongoose.startSession();
  let result;
  await session.withTransaction(async () => {
    const b = await GameBalance.findOne({ user: userId, game }).session(session);
    if (!b) throw new Error('Balance not initialized.');
    const next = b.balance + amount;
    if (next < 0) throw new Error('Insufficient virtual funds.');
    const entry = await GameLedger.create([{
      user: userId, game, reason, amount, balanceAfter: next, relatedId: relatedId ? String(relatedId) : null,
    }], { session });
    b.balance = next;
    await b.save({ session });
    result = { balance: next, entry: entry[0] };
  });
  await session.endSession();
  return result;
}

/** Escrow: debit from each player, hold in the pot. Refundable. */
export async function escrow(userId, game, amount, relatedId) {
  return move(userId, game, -amount, REASONS.BET_ESCROW, relatedId);
}

/** Release escrow back to the player (refund / cancel). */
export async function releaseEscrow(userId, game, amount, relatedId) {
  return move(userId, game, amount, REASONS.BET_RELEASE, relatedId);
}

/** Settle a bet: winner takes the pot. amount is the net gain (already includes opponent's stake). */
export async function settleWin(userId, game, amount, relatedId) {
  return move(userId, game, amount, REASONS.BET_WIN, relatedId);
}
export async function settleLoss(userId, game, amount, relatedId) {
  return move(userId, game, -amount, REASONS.BET_LOSE, relatedId);
}

export async function ledger(userId, game, limit = 50) {
  return GameLedger.find({ user: userId, game }).sort({ createdAt: -1 }).limit(limit).lean();
}