import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/index.js';
import { auth, signToken, wrap } from '../middleware/auth.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in a few minutes.' } });

export const userOut = (u) => ({
  id: u._id, username: u.usernameDisplay || u.username, email: u.email, managerName: u.managerName, continent: u.continent, country: u.country,
  role: u.role, clubId: u.clubId, onboarding: u.onboarding,
});

r.post('/signup', limiter, wrap(async (req, res) => {
  const { username = '', email = '', password = '', confirmPassword = '', terms } = req.body || {};
  const uname = String(username).trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(uname)) return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or underscores.', field: 'username' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.', field: 'email' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.', field: 'password' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.', field: 'confirmPassword' });
  if (!terms) return res.status(400).json({ error: 'Accept the terms to continue.', field: 'terms' });
  if (await User.exists({ username: uname.toLowerCase() })) return res.status(409).json({ error: 'That username is taken.', field: 'username' });
  if (await User.exists({ email: String(email).toLowerCase() })) return res.status(409).json({ error: 'An account with that email already exists.', field: 'email' });
  const user = await User.create({ username: uname, usernameDisplay: uname, email, passwordHash: await bcrypt.hash(password, 10), onboarding: { step: 'club' } });
  res.status(201).json({ token: signToken(user), user: userOut(user) });
}));

r.post('/login', limiter, wrap(async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const id = String(email).trim().toLowerCase();
  const user = await User.findOne({ $or: [{ email: id }, { username: id }] });
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json({ token: signToken(user), user: userOut(user) });
}));

r.post('/logout', auth, (req, res) => res.json({ ok: true }));
r.get('/me', auth, (req, res) => res.json({ user: userOut(req.user) }));

export default r;
