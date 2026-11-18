// Games lobby — shared entry point. Redirects to /games/apex-gt, /games/whot, or /games/ludo
import { Router } from 'express';
import { auth, wrap } from '../middleware/auth.js';
import { User, GameBalance } from '../models/index.js';
import { getBalance } from '../services/gameLedger.js';

export const gamesRouter = Router();

gamesRouter.get('/leaderboard', auth, wrap(async (req, res) => {
  const leaderboards = {
    apex: [],
    whot: [],
    ludo: [],
  };
  for (const game of ['apex-gt', 'whot', 'ludo']) {
    const balances = await GameBalance.find({ game }).sort({ balance: -1 }).limit(20).lean();
    leaderboards[game] = await Promise.all(balances.map(async (b) => {
      const u = await User.findById(b.user).select('username usernameDisplay').lean();
      return {
        user: String(b.user),
        username: u ? (u.usernameDisplay || u.username) : '?',
        balance: b.balance,
      };
    }));
  }
  res.json(leaderboards);
}));