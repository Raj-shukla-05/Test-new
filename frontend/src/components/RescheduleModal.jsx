import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, Check, LoaderCircle, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

export default function RescheduleModal({ appointment, onClose, onRescheduleSuccess }) {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [slotsData, setSlotsData] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('Patient requested rescheduling');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!appointment || !selectedDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    setError('');

    api.doctorAvailability(appointment.doctorId, selectedDate)
      .then(setSlotsData)
      .catch((err) => {
        setError(err.message || 'Unable to load slots.');
        setSlotsData(null);
      })
      .finally(() => setLoadingSlots(false));
  }, [appointment, selectedDate]);

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Please select an available new time slot.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await api.rescheduleAppointment(appointment.id, {
        newDate: selectedDate,
        newStartTime: selectedSlot.startTime,
        reason: reason.trim(),
      });
      onRescheduleSuccess(res.appointment);
    } catch (err) {
      setError(err.message || 'Rescheduling failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!appointment) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="reschedule-modal-title">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2 id="reschedule-modal-title">Reschedule In-Person Visit</h2>
            <span className="muted-text">Current: {appointment.date} at {appointment.startTime} with {appointment.doctorName}</span>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleRescheduleSubmit} className="modal-body scrollable">
          {error && (
            <div className="alert-banner error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="new-date"><Calendar size={15} /> Select New Consultation Date</label>
            <input
              id="new-date"
              type="date"
              min={today}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
              className="styled-input"
            />
          </div>

          <div className="form-group">
            <label><Clock size={15} /> Choose New Slot ({selectedDate})</label>
            {loadingSlots ? (
              <div className="slots-loading-state">
                <LoaderCircle size={18} className="spin" /> Loading available slots…
              </div>
            ) : !slotsData?.isWorkingDay ? (
              <div className="slots-empty-state">
                <AlertCircle size={18} />
                <span>{slotsData?.reason || 'Doctor has no scheduled clinics on this date.'}</span>
              </div>
            ) : (
              <div className="slots-grid">
                {slotsData.slots.map((slot) => {
                  const isSelected = selectedSlot?.startTime === slot.startTime;
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      disabled={!slot.available}
                      className={`slot-pill ${isSelected ? 'selected' : ''} ${!slot.available ? 'disabled' : ''}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      <span className="slot-time">{slot.startTime}</span>
                      {!slot.available && (
                        <small className="slot-status-label">{slot.unavailableReason || 'Unavailable'}</small>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reschedule-reason">Reason for Rescheduling</label>
            <input
              id="reschedule-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="styled-input"
              required
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary large" disabled={!selectedSlot || submitting}>
              {submitting ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />} Confirm Reschedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
