import express, { Router } from 'express';
import { wrap } from '../middleware/auth.js';
import { Fixture, AdImage, AdLineup } from '../models/index.js';
import { currentSeason } from '../services/seasons.js';

export const MAX_BRANDS = 20;
export const MAX_IMAGE_BYTES = 500 * 1024;
const TYPES = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };

/** Sniff the real format from magic bytes. SVG and everything else is refused on purpose. */
function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return TYPES.png;
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return TYPES.jpeg;
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return TYPES.webp;
  return null;
}

/** A matchday is (season, gameweek). It starts at the earliest kickoff, or as soon as any fixture of it has started. */
export async function matchdayState(season, gameweek) {
  const [g] = await Fixture.aggregate([
    { $match: { season, gameweek } },
    { $group: { _id: null, first: { $min: '$kickoffAt' }, total: { $sum: 1 }, started: { $sum: { $cond: [{ $in: ['$status', ['live', 'starting', 'finished']] }, 1, 0] } } } },
  ]);
  if (!g) return null;
  return { season, gameweek, kickoffAt: g.first, fixtures: g.total, locked: g.started > 0 || Date.now() >= new Date(g.first).getTime() };
}

const urlOf = (id) => `/api/ads/images/${id}`;
export const brandsOut = (lineup) => (lineup?.brands || []).map((b) => ({ id: String(b.image), name: b.name, url: urlOf(b.image) }));

/** Public: serve an uploaded brand image. Ids are unguessable ObjectIds; content is immutable. */
export const publicAds = Router();
publicAds.get('/images/:id', wrap(async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(404).end();
  const img = await AdImage.findById(req.params.id).lean();
  if (!img) return res.status(404).end();
  res.set({
    'Content-Type': img.contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'", 'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(img.data.buffer ? Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length) : img.data);
}));

/** Admin (mounted under /api/admin, which already enforces auth + admin). */
export const adminAds = Router();

adminAds.get('/matchdays', wrap(async (req, res) => {
  const s = await currentSeason();
  if (!s) return res.json({ season: null, matchdays: [] });
  const rows = await Fixture.aggregate([
    { $match: { season: s.number } },
    { $group: { _id: '$gameweek', first: { $min: '$kickoffAt' }, started: { $sum: { $cond: [{ $in: ['$status', ['live', 'starting', 'finished']] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]);
  const lineups = await AdLineup.find({ season: s.number }).select('gameweek brands').lean();
  const count = new Map(lineups.map((l) => [l.gameweek, l.brands.length]));
  res.json({
    season: s.number, max: MAX_BRANDS,
    matchdays: rows.map((r) => ({ gameweek: r._id, kickoffAt: r.first, locked: r.started > 0 || Date.now() >= new Date(r.first).getTime(), brands: count.get(r._id) || 0 })),
  });
}));

adminAds.get('/:season/:gameweek', wrap(async (req, res) => {
  const season = Number(req.params.season), gameweek = Number(req.params.gameweek);
  const md = await matchdayState(season, gameweek);
  if (!md) return res.status(404).json({ error: 'That matchday does not exist.' });
  const lineup = await AdLineup.findOne({ season, gameweek }).lean();
  res.json({ ...md, max: MAX_BRANDS, brands: brandsOut(lineup) });
}));

adminAds.post('/:season/:gameweek/images',
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES + 1024 }),
  wrap(async (req, res) => {
    const season = Number(req.params.season), gameweek = Number(req.params.gameweek);
    const md = await matchdayState(season, gameweek);
    if (!md) return res.status(404).json({ error: 'That matchday does not exist.' });
    if (md.locked) return res.status(409).json({ error: 'This matchday has started. Its advertising lineup is locked.' });
    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buf || !buf.length) return res.status(400).json({ error: 'No image received.' });
    if (buf.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'Image is too large. Maximum is 500 KB.' });
    const type = sniff(buf);
    if (!type) return res.status(415).json({ error: 'Only PNG, JPEG or WebP images are accepted.' });
    const img = await AdImage.create({ season, gameweek, contentType: type, size: buf.length, data: buf });
    res.json({ id: String(img._id), url: urlOf(img._id) });
  }));

adminAds.put('/:season/:gameweek', wrap(async (req, res) => {
  const season = Number(req.params.season), gameweek = Number(req.params.gameweek);
  const md = await matchdayState(season, gameweek);
  if (!md) return res.status(404).json({ error: 'That matchday does not exist.' });
  if (md.locked) return res.status(409).json({ error: 'This matchday has started. Its advertising lineup is locked.' });
  const list = req.body?.brands;
  if (!Array.isArray(list)) return res.status(400).json({ error: 'Send a list of brands.' });
  if (list.length > MAX_BRANDS) return res.status(400).json({ error: `A matchday can have at most ${MAX_BRANDS} brands.` });
  const brands = [], seen = new Set();
  for (const [i, b] of list.entries()) {
    const name = String(b?.name ?? '').replace(/\s+/g, ' ').trim();
    if (!name || name.length > 32) return res.status(400).json({ error: `Brand ${i + 1}: name must be 1 to 32 characters.` });
    const id = String(b?.id ?? '');
    if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: `Brand ${i + 1} ("${name}") needs a logo image.` });
    if (seen.has(id)) return res.status(400).json({ error: `Brand ${i + 1} reuses another entry's image. Upload it again.` });
    seen.add(id);
    const img = await AdImage.findById(id).select('season gameweek').lean();
    if (!img || img.season !== season || img.gameweek !== gameweek) return res.status(400).json({ error: `Brand ${i + 1} ("${name}"): the image is missing. Upload it again.` });
    brands.push({ name, image: id });
  }
  const lineup = await AdLineup.findOneAndUpdate({ season, gameweek }, { $set: { brands } }, { upsert: true, new: true });
  await AdImage.deleteMany({ season, gameweek, _id: { $nin: brands.map((b) => b.image) } }); // drop replaced / removed uploads
  res.json({ ...md, max: MAX_BRANDS, brands: brandsOut(lineup) });
}));
