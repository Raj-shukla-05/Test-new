const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../services/notificationService');

// 1. GET /api/notifications - User's notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const list = await getUserNotifications(req.user.userId);
    res.json({ notifications: list });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve notifications' });
  }
});

// 2. PATCH /api/notifications/:id/read - Mark one as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const updated = await markNotificationAsRead(req.params.id, req.user.userId);
    if (!updated) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ notification: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update notification' });
  }
});

// 3. POST /api/notifications/read-all - Mark all as read
router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    await markAllNotificationsAsRead(req.user.userId);
    res.json({ ok: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update notifications' });
  }
});

module.exports = router;
