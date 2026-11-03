import React, { useState, useEffect, useRef } from 'react';
import { Bell, HelpCircle, LogOut, Search, Check, CheckCheck, X } from 'lucide-react';
import { api } from '../lib/api';

export default function Topbar({ onLogout, userName, systemStatus }) {
  const isMongoConnected = systemStatus?.database === 'connected';
  const isInMemory = systemStatus?.database === 'in-memory';

  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const loadNotifications = () => {
    api.notifications()
      .then((res) => setNotifications(res.notifications || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="eyebrow">Home recovery monitoring</span>
        <div
          className={`live-chip ${isInMemory ? 'warning' : ''}`}
          style={isInMemory ? { background: 'rgba(234, 179, 8, 0.12)', borderColor: 'rgba(234, 179, 8, 0.3)', color: '#eab308' } : undefined}
          title={isMongoConnected ? 'All sessions are permanently persisted in MongoDB' : 'Running in resilient session mode; data held in memory'}
        >
          <span style={isInMemory ? { background: '#eab308' } : undefined} />
          {isMongoConnected ? 'System operational · MongoDB connected' : (isInMemory ? 'Session mode · In-memory (DB offline)' : 'System operational')}
        </div>
      </div>
      <div className="topbar-actions">
        <div className="search-box"><Search size={17} /><input placeholder="Search patients, sessions…" /></div>
        <button className="icon-button"><HelpCircle size={18} /></button>

        {/* Notifications Button & Dropdown */}
        <div className="notification-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="icon-button notification"
            onClick={() => setShowDropdown(!showDropdown)}
            aria-label={`Notifications (${unreadCount} unread)`}
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
          </button>

          {showDropdown && (
            <div className="notification-dropdown">
              <div className="dropdown-head">
                <strong>Notifications</strong>
                {unreadCount > 0 && (
                  <button type="button" className="mark-all-btn" onClick={handleMarkAllRead}>
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
              </div>

              <div className="dropdown-list">
                {notifications.length === 0 ? (
                  <div className="empty-notifs">No notifications yet</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`}>
                      <div className="notif-body">
                        <strong>{n.title}</strong>
                        <p>{n.message}</p>
                        <small>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(n.createdAt).toLocaleDateString()}</small>
                      </div>
                      {!n.read && (
                        <button
                          type="button"
                          className="mark-single-read-btn"
                          title="Mark as read"
                          onClick={(e) => handleMarkRead(n.id, e)}
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="profile-menu">
          <span className="avatar small">{(userName || 'R').replace(/^Dr\.?\s*/, '').charAt(0).toUpperCase()}</span>
          <span>{userName || 'Raj Kumar'}</span>
        </div>
        <button className="icon-button" onClick={onLogout} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
      </div>
    </header>
  );
}
