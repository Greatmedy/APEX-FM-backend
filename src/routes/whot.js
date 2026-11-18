// Nigerian Whot routes — tables, balance, play.
import { Router } from 'express';
import { auth, wrap } from '../middleware/auth.js';
import { getBalance, ledger, START_BALANCE } from '../services/gameLedger.js';
import { createWhotTable, joinWhotTable, startWhotTable, setWhotReady, playWhotCard, whotStateFor, listWhotTables, validateBet } from '../services/gameEngine.js';

export const whotRouter = Router();
whotRouter.use(auth);

whotRouter.get('/balance', wrap(async (req, res) => {
  const { balance, grantedAt } = await getBalance(req.user._id, 'whot');
  res.json({ game: 'whot', balance, grantedAt: grantedAt ? grantedAt.getTime() : null, initial: START_BALANCE });
}));

whotRouter.get('/ledger', wrap(async (req, res) => {
  res.json({ entries: await ledger(req.user._id, 'whot') });
}));

whotRouter.post('/create', wrap(async (req, res) => {
  const table = await createWhotTable({ hostId: req.user._id, bet: req.body?.bet });
  res.status(201).json({ table: await whotStateFor(req.user._id, String(table._id)) });
}));

whotRouter.get('/tables/:id', wrap(async (req, res) => {
  res.json({ table: await whotStateFor(req.user._id, req.params.id) });
}));

whotRouter.post('/tables/:id/join', wrap(async (req, res) => {
  const table = await joinWhotTable({ tableId: req.params.id, userId: req.user._id });
  res.json({ table: await whotStateFor(req.user._id, String(table._id)) });
}));

whotRouter.post('/tables/:id/start', wrap(async (req, res) => {
  const table = await startWhotTable({ tableId: req.params.id, userId: req.user._id });
  res.json({ table: await whotStateFor(req.user._id, String(table._id)) });
}));

whotRouter.post('/tables/:id/ready', wrap(async (req, res) => {
  const table = await setWhotReady({ tableId: req.params.id, userId: req.user._id, ready: req.body?.ready === true });
  res.json({ table: await whotStateFor(req.user._id, String(table._id)) });
}));

whotRouter.post('/tables/:id/play', wrap(async (req, res) => {
  const result = await playWhotCard({ tableId: req.params.id, userId: req.user._id, cardId: req.body?.card, marketRule: req.body?.marketRule, calledShape: req.body?.calledShape });
  res.json({ ...result, table: await whotStateFor(req.user._id, req.params.id) });
}));

whotRouter.get('/tables', wrap(async (req, res) => {
  res.json({ tables: await listWhotTables() });
}));
