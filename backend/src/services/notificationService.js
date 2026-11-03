const { notifications } = require('../store');
const { isMongoConnected } = require('../db');
const Notification = require('../models/Notification');

async function createNotification({ userId, type, title, message, appointmentId = null }) {
  if (!userId || !type || !title || !message) return null;

  const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const notif = {
    id,
    userId,
    type,
    title,
    message,
    appointmentId,
    read: false,
    createdAt: new Date().toISOString(),
  };

  notifications.unshift(notif);

  if (isMongoConnected()) {
    Notification.create(notif).catch((err) =>
      console.warn(`[Notification] Failed to persist to MongoDB: ${err.message}`)
    );
  }

  return notif;
}

async function getUserNotifications(userId) {
  if (!userId) return [];
  if (isMongoConnected()) {
    try {
      const records = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
      if (records && records.length > 0) return records;
    } catch (err) {
      console.warn(`[Notification] Failed to fetch from MongoDB: ${err.message}`);
    }
  }
  return notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);
}

async function markNotificationAsRead(id, userId) {
  const notif = notifications.find((n) => n.id === id && n.userId === userId);
  if (notif) notif.read = true;

  if (isMongoConnected()) {
    try {
      await Notification.findOneAndUpdate({ id, userId }, { read: true });
    } catch (err) {
      console.warn(`[Notification] Failed to update in MongoDB: ${err.message}`);
    }
  }
  return notif || null;
}

async function markAllNotificationsAsRead(userId) {
  notifications
    .filter((n) => n.userId === userId)
    .forEach((n) => { n.read = true; });

  if (isMongoConnected()) {
    try {
      await Notification.updateMany({ userId }, { read: true });
    } catch (err) {
      console.warn(`[Notification] Failed to update all in MongoDB: ${err.message}`);
    }
  }
  return true;
}

module.exports = {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
