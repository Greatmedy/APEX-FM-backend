import { Notification } from '../models/index.js';

let io = null;
export const setIO = (x) => { io = x; };
export const getIO = () => io;

export async function notify(userId, { type, title, body, link, dedupeKey }) {
  if (!userId) return null;
  try {
    const n = await Notification.create({ user: userId, type, title, body, link, dedupeKey });
    io?.to('user:' + userId).emit('notification', { _id: n._id, type, title, body, link, createdAt: n.createdAt });
    return n;
  } catch (e) {
    if (e.code !== 11000) console.error('notify failed', e.message);
    return null;
  }
}
