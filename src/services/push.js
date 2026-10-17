import webpush from 'web-push';
import { config } from '../config.js';
import { PushSub } from '../models/index.js';

let ready = false;
if (config.vapidPublic && config.vapidPrivate) {
  try { webpush.setVapidDetails(config.vapidSubject, config.vapidPublic, config.vapidPrivate); ready = true; } catch (e) { console.error('[apex] VAPID keys invalid, push disabled:', e.message); }
}
export const pushEnabled = () => ready;

/** Types that are also delivered as a phone push notification (the in-app notification always exists). */
export const PUSH_TYPES = new Set(['ready']);

/** Send a Web Push message to every device the user enabled. Never throws; dead subscriptions are removed. */
export async function pushToUser(userId, { title, body, link, tag }) {
  if (!ready || !userId) return 0;
  const subs = await PushSub.find({ user: userId }).lean();
  let sent = 0;
  const payload = JSON.stringify({ title, body, url: link || '/home', tag: tag || 'apex' });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 30, urgency: 'high', topic: (tag || 'apex').slice(0, 32).replace(/[^A-Za-z0-9_-]/g, '') });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await PushSub.deleteOne({ _id: s._id }).catch(() => {});
      else console.error('[apex] push failed:', e.statusCode || e.message);
    }
  }));
  return sent;
}
