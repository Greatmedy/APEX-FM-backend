// Nigerian Ludo routes — games, balance, dice, moves.
import { Router } from 'express';
import { auth, wrap } from '../middleware/auth.js';
import { getBalance, ledger, START_BALANCE } from '../services/gameLedger.js';
import { createLudoGame, joinLudoGame, startLudoGame, setLudoReady, rollLudoDie, moveLudoToken, ludoStateFor, listLudoGames } from '../services/gameEngine.js';

export const ludoRouter = Router();
ludoRouter.use(auth);

ludoRouter.get('/balance', wrap(async (req, res) => {
  const { balance, grantedAt } = await getBalance(req.user._id, 'ludo');
  res.json({ game: 'ludo', balance, grantedAt: grantedAt ? grantedAt.getTime() : null, initial: START_BALANCE });
}));

ludoRouter.get('/ledger', wrap(async (req, res) => {
  res.json({ entries: await ledger(req.user._id, 'ludo') });
}));

ludoRouter.post('/create', wrap(async (req, res) => {
  const game = await createLudoGame({ hostId: req.user._id, bet: req.body?.bet || 0 });
  res.status(201).json({ game: await ludoStateFor(String(game._id)) });
}));

ludoRouter.get('/games/:id', wrap(async (req, res) => {
  res.json({ game: await ludoStateFor(req.params.id) });
}));

ludoRouter.post('/games/:id/join', wrap(async (req, res) => {
  const game = await joinLudoGame({ gameId: req.params.id, userId: req.user._id });
  res.json({ game: await ludoStateFor(String(game._id)) });
}));

ludoRouter.post('/games/:id/start', wrap(async (req, res) => {
  const game = await startLudoGame({ gameId: req.params.id, userId: req.user._id });
  res.json({ game: await ludoStateFor(String(game._id)) });
}));

ludoRouter.post('/games/:id/ready', wrap(async (req, res) => {
  const game = await setLudoReady({ gameId: req.params.id, userId: req.user._id, ready: req.body?.ready === true });
  res.json({ game: await ludoStateFor(String(game._id)) });
}));

ludoRouter.post('/games/:id/roll', wrap(async (req, res) => {
  res.json(await rollLudoDie({ gameId: req.params.id, userId: req.user._id }));
}));

ludoRouter.post('/games/:id/move', wrap(async (req, res) => {
  const result = await moveLudoToken({ gameId: req.params.id, userId: req.user._id, tokenIndex: Number(req.body?.token) });
  res.json({ ...result, game: await ludoStateFor(req.params.id) });
}));

ludoRouter.get('/games', wrap(async (req, res) => {
  res.json({ games: await listLudoGames() });
}));
