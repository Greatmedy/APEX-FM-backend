import { Router } from 'express';
import { auth, wrap } from '../middleware/auth.js';
import { PushSub } from '../models/index.js';
import { config } from '../config.js';
import { pushEnabled } from '../services/push.js';

const r = Router();
/** Public key the browser needs to subscribe. null = push is not configured on this server. */
r.get('/key', (req, res) => res.json({ key: pushEnabled() ? config.vapidPublic : null }));
r.use(auth);
r.post('/subscribe', wrap(async (req, res) => {
  const sub = req.body?.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000 || !sub.keys?.p256dh || !sub.keys?.auth) return res.status(400).json({ error: 'That is not a valid push subscription.' });
  await PushSub.findOneAndUpdate({ endpoint: sub.endpoint }, { $set: { user: req.user._id, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) }, ua: String(req.headers['user-agent'] || '').slice(0, 200) } }, { upsert: true });
  res.json({ ok: true });
}));
r.post('/unsubscribe', wrap(async (req, res) => {
  const endpoint = String(req.body?.endpoint || '');
  await PushSub.deleteOne({ endpoint, user: req.user._id });
  res.json({ ok: true });
}));
export default r;
