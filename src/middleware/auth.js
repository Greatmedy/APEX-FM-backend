import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User, Club } from '../models/index.js';

export const signToken = (user) => jwt.sign({ id: String(user._id) }, config.jwtSecret, { expiresIn: '30d' });
export const verifyToken = (t) => jwt.verify(t, config.jwtSecret);

export async function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
    const { id } = verifyToken(token);
    const user = await User.findById(id);
    if (!user) return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
}
export function admin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access only.' });
  next();
}
export async function needClub(req, res, next) {
  if (!req.user.clubId) return res.status(409).json({ error: 'Finish onboarding to get a club.' });
  const club = await Club.findById(req.user.clubId);
  if (!club) return res.status(404).json({ error: 'Club not found.' });
  req.club = club;
  next();
}
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
