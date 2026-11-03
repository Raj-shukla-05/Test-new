import React, { useState, useEffect } from 'react';
import {
  X, Calendar, Clock, MapPin, Building2, AlertCircle, Check, LoaderCircle,
  Stethoscope, IndianRupee, ShieldCheck
} from 'lucide-react';
import { api } from '../lib/api';

export default function BookingModal({ doctor, patientId, onClose, onBookingSuccess }) {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [slotsData, setSlotsData] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch doctor slots whenever selectedDate or doctor changes
  useEffect(() => {
    if (!doctor || !selectedDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    setError('');

    api.doctorAvailability(doctor.id, selectedDate)
      .then((data) => {
        setSlotsData(data);
      })
      .catch((err) => {
        setError(err.message || 'Unable to load slots for this date.');
        setSlotsData(null);
      })
      .finally(() => setLoadingSlots(false));
  }, [doctor, selectedDate]);

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Please select an available appointment time slot.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await api.bookAppointment({
        doctorId: doctor.id,
        patientId,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        reason: reason.trim(),
      });

      onBookingSuccess(res.appointment);
    } catch (err) {
      setError(err.message || 'Booking failed. This slot may have just been reserved.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!doctor) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="booking-modal-title">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="in-person-tag">
              <Building2 size={13} /> IN-PERSON CLINICAL VISIT ONLY
            </span>
            <h2 id="booking-modal-title">Book In-Person Appointment</h2>
            <span className="muted-text">with {doctor.name} · {doctor.specialization}</span>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close booking modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleBookingSubmit} className="modal-body scrollable">
          {error && (
            <div className="alert-banner error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Physical Clinic Location Information */}
          <div className="clinic-location-box">
            <div className="clinic-icon-bubble">
              <MapPin size={20} />
            </div>
            <div className="clinic-details">
              <strong>{doctor.clinic?.name || 'NeuroGuard Partner Clinic'}</strong>
              <p>{[doctor.clinic?.address, doctor.clinic?.city].filter(Boolean).join(', ') || 'Clinic address provided upon booking'}</p>
              <div className="clinic-meta-row">
                <span>Room / Suite: <b>{doctor.clinic?.roomNumber || 'Suite 101'}</b></span>
                <span>Phone: <b>{doctor.clinic?.phone || 'On file'}</b></span>
                <span>Fee: <b className="text-teal">₹{doctor.consultationFee}</b></span>
              </div>
            </div>
          </div>

          {/* Date Picker */}
          <div className="form-group">
            <label htmlFor="appointment-date">
              <Calendar size={15} /> Select Consultation Date
            </label>
            <input
              id="appointment-date"
              type="date"
              min={today}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
              className="styled-input"
            />
          </div>

          {/* Slots Section */}
          <div className="form-group">
            <label>
              <Clock size={15} /> Available In-Person Slots ({selectedDate})
            </label>

            {loadingSlots ? (
              <div className="slots-loading-state">
                <LoaderCircle size={18} className="spin" /> Checking clinician schedule…
              </div>
            ) : !slotsData?.isWorkingDay ? (
              <div className="slots-empty-state">
                <AlertCircle size={18} />
                <span>{slotsData?.reason || 'Doctor has no scheduled clinics on this date.'}</span>
              </div>
            ) : slotsData.slots.length === 0 ? (
              <div className="slots-empty-state">
                <span>No available consultation slots on this date.</span>
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

          {/* Reason for Visit */}
          <div className="form-group">
            <label htmlFor="visit-reason">Reason for Visit / Symptoms (Optional)</label>
            <textarea
              id="visit-reason"
              rows={3}
              placeholder="e.g. Follow-up stroke evaluation, hemiplegic arm stiffness, spasticity check…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              className="styled-textarea"
            />
          </div>

          {/* Booking Summary Card */}
          {selectedSlot && (
            <div className="booking-summary-card">
              <h4>Consultation Summary</h4>
              <div className="summary-row">
                <span>Doctor:</span>
                <strong>{doctor.name} ({doctor.specialization})</strong>
              </div>
              <div className="summary-row">
                <span>Date & Time:</span>
                <strong>{selectedDate} at {selectedSlot.startTime} – {selectedSlot.endTime}</strong>
              </div>
              <div className="summary-row">
                <span>Consultation Fee:</span>
                <strong>₹{doctor.consultationFee} (Payable at clinic desk)</strong>
              </div>
              <div className="summary-row">
                <span>Type:</span>
                <span className="badge-in-person">In-Person Hospital Visit</span>
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary large" disabled={!selectedSlot || submitting}>
              {submitting ? (
                <>
                  <LoaderCircle size={15} className="spin" /> Confirming Booking…
                </>
              ) : (
                <>
                  <Check size={16} /> Confirm Appointment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
