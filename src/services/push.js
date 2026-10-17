import webpush from 'web-push';
import { PushSub } from '../models/index.js';
import { config } from '../config.js';

// Types worth waking the phone for. In-app notifications still save either way.
export const PUSH_TYPES = new Set(['upcoming', 'ready', 'result', 'forfeit']);

let ready = false;
function setup() {
  if (ready) return true;
  if (!config.vapidPublic || !config.vapidPrivate) return false;
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublic, config.vapidPrivate);
  ready = true;
  return true;
}

export async function pushToUser(userId, { title, body, link, tag }) {
  if (!userId || !setup()) return;
  const subs = await PushSub.find({ user: userId }).lean();
  if (!subs.length) return;
  const payload = JSON.stringify({ title, body, link: link || '/home', tag });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await PushSub.deleteOne({ _id: s._id });
    }
  }));
}
