import { Router } from 'express';
import { auth, wrap } from '../middleware/auth.js';
import { CLUB_BY_KEY, SIGNUP_CLUBS, LEAGUES } from '../data/clubs.js';
import { templateMeta, templateSquad } from '../lib/playerGen.js';
import { freeSlots, claimSlot, tierName, tierList, nextTierToOpen } from '../services/clubs.js';
import { openNextTier } from '../services/seasons.js';
import { MAX_TIERS, TIER_SIZE } from '../config.js';
import { User } from '../models/index.js';
import { userOut } from './auth.js';

export const publicRouter = Router();
export const router = Router();

publicRouter.get('/', (req, res) => {
  const out = Object.entries(SIGNUP_CLUBS).map(([lg, keys]) => ({ league: lg, leagueName: LEAGUES[lg], clubs: keys.map(templateMeta) }));
  res.json({ leagues: out });
});
publicRouter.get('/:key', (req, res) => {
  const t = CLUB_BY_KEY[req.params.key];
  if (!t) return res.status(404).json({ error: 'Club template not found.' });
  res.json({ club: templateMeta(t.key), players: templateSquad(t.key).map((p, i) => ({ ...p, _id: t.key + i })) });
});

router.use(auth);
router.get('/leagues', wrap(async (req, res) => {
  const out = [];
  for (const tier of await tierList()) out.push({ tier, name: tierName(tier), free: await freeSlots(tier) });
  // every division is full of managers: the next one opens as soon as someone joins it (up to APEX League 5)
  const next = await nextTierToOpen();
  if (next) out.push({ tier: next, name: tierName(next), free: TIER_SIZE, isNew: true });
  res.json({ leagues: out, max: MAX_TIERS });
}));
router.post('/club', wrap(async (req, res) => {
  const u = req.user;
  if (u.onboarding.step === 'done') return res.status(409).json({ error: 'You already manage a club for this season.' });
  const key = req.body?.templateKey;
  if (!SIGNUP_CLUBS.EPL.concat(SIGNUP_CLUBS.LALIGA, SIGNUP_CLUBS.SERIEA, SIGNUP_CLUBS.BUNDES).includes(key)) return res.status(400).json({ error: 'Choose a club from the list.' });
  u.onboarding.templateKey = key; u.onboarding.step = 'manager';
  await u.save();
  res.json({ user: userOut(u) });
}));
router.post('/manager', wrap(async (req, res) => {
  const u = req.user;
  if (!u.onboarding.templateKey) return res.status(409).json({ error: 'Choose your club first.' });
  if (u.onboarding.step === 'done') return res.status(409).json({ error: 'Onboarding is already complete.' });
  const { managerName = '', continent = '', country = '' } = req.body || {};
  const mn = String(managerName).trim().slice(0, 24);
  if (mn.length < 2) return res.status(400).json({ error: 'Manager name must be at least 2 characters.', field: 'managerName' });
  if (!continent) return res.status(400).json({ error: 'Choose a continent.', field: 'continent' });
  if (!String(country).trim()) return res.status(400).json({ error: 'Enter your country of residence.', field: 'country' });
  Object.assign(u, { managerName: mn, continent, country: String(country).trim().slice(0, 40) });
  u.onboarding.step = 'league';
  await u.save();
  res.json({ user: userOut(u) });
}));
router.post('/league', wrap(async (req, res) => {
  const u = req.user;
  if (u.clubId) return res.status(409).json({ error: 'You already manage a club.' });
  if (!['league', 'waitlist'].includes(u.onboarding.step) || !u.managerName) return res.status(409).json({ error: 'Finish the earlier steps first.' });
  const tier = Number(req.body?.tier);
  const tiers = await tierList();
  if (!Number.isInteger(tier) || tier < 1 || tier > MAX_TIERS) return res.status(400).json({ error: 'Choose one of the listed leagues.' });
  let club = null;
  if (tiers.includes(tier)) club = await claimSlot(tier, u);
  else if (tier === (await nextTierToOpen())) { await openNextTier(); club = await claimSlot(tier, u); }
  else return res.status(409).json({ error: `${tierName(tier)} is not open yet. It opens when the divisions above it are full.`, full: true });
  if (!club) {
    for (const t of await tierList()) { if (t !== tier && (await freeSlots(t)) > 0) return res.status(409).json({ error: `${tierName(tier)} is full. Pick ${tierName(t)} instead.`, full: true }); }
    if (await nextTierToOpen()) return res.status(409).json({ error: 'Every league is full. A new division is available: choose it from the list.', full: true });
    u.onboarding.step = 'waitlist'; u.onboarding.waitTier = tier;
    await u.save();
    return res.json({ waitlisted: true, user: userOut(u) });
  }
  const fresh = await User.findById(u._id);
  res.json({ club: { id: club._id, displayName: club.displayName }, user: userOut(fresh) });
}));
export default router;
