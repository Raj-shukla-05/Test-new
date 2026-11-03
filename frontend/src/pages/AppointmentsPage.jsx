import React, { useState, useEffect } from 'react';
import {
  Search, Filter, MapPin, Building2, Calendar, Clock, Stethoscope,
  IndianRupee, AlertCircle, CheckCircle2, ChevronRight, X, FileText,
  RefreshCw, ShieldCheck, UserCheck, LoaderCircle, Phone
} from 'lucide-react';
import { api } from '../lib/api';
import BookingModal from '../components/BookingModal';
import RescheduleModal from '../components/RescheduleModal';
import ShareReportModal from '../components/ShareReportModal';
import RecoveryReportModal from '../components/RecoveryReportModal';

const SPECIALIZATIONS = [
  'All',
  'Neurology',
  'Physical Medicine and Rehabilitation',
  'Physiotherapy',
  'Occupational Therapy',
  'Speech and Language Therapy',
  'Neurorehabilitation',
];

export default function AppointmentsPage({ user, onToast }) {
  const [activeTab, setActiveTab] = useState('find'); // 'find', 'appointments', 'reports'
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [doctorsList, setDoctorsList] = useState([]);
  const [appointmentsList, setAppointmentsList] = useState([]);
  const [sharedReportsList, setSharedReportsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [reschedulingAppointment, setReschedulingAppointment] = useState(null);
  const [sharingAppointment, setSharingAppointment] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [cancellingAppointment, setCancellingAppointment] = useState(null);
  const [cancelReason, setCancelReason] = useState('Scheduling conflict');
  const [actionBusy, setActionBusy] = useState(false);

  // Fetch doctors catalog
  const loadDoctors = async () => {
    try {
      const res = await api.doctors({
        search: search.trim() || undefined,
        specialization: selectedSpecialty !== 'All' ? selectedSpecialty : undefined,
        city: selectedCity !== 'All' ? selectedCity : undefined,
      });
      setDoctorsList(res.doctors || []);
    } catch (err) {
      setError(err.message || 'Failed to load doctors catalog.');
    }
  };

  // Fetch patient appointments
  const loadAppointments = async () => {
    try {
      const res = await api.myAppointments();
      setAppointmentsList(res.appointments || []);
    } catch (err) {
      console.warn('Error loading appointments:', err.message);
    }
  };

  // Fetch patient shared reports
  const loadSharedReports = async () => {
    try {
      const res = await api.mySharedReports();
      setSharedReportsList(res.reports || []);
    } catch (err) {
      console.warn('Error loading shared reports:', err.message);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDoctors(), loadAppointments(), loadSharedReports()]).finally(() => {
      setLoading(false);
    });
  }, [selectedSpecialty, selectedCity]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadDoctors();
  };

  const handleBookingSuccess = (newApt) => {
    setBookingDoctor(null);
    onToast?.(`In-person visit requested for ${newApt.date} at ${newApt.startTime}.`);
    loadAppointments();
    setActiveTab('appointments');
  };

  const handleRescheduleSuccess = (updatedApt) => {
    setReschedulingAppointment(null);
    onToast?.(`Appointment successfully rescheduled to ${updatedApt.date} at ${updatedApt.startTime}.`);
    loadAppointments();
  };

  const handleShareSuccess = () => {
    setSharingAppointment(null);
    onToast?.('Recovery report successfully authorized and shared with doctor.');
    loadAppointments();
    loadSharedReports();
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancellingAppointment) return;
    setActionBusy(true);

    try {
      await api.cancelAppointment(cancellingAppointment.id, cancelReason);
      setCancellingAppointment(null);
      setCancelReason('Scheduling conflict');
      onToast?.('Appointment cancelled successfully.');
      loadAppointments();
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRevokeReport = async (shareId) => {
    if (!window.confirm('Are you sure you want to revoke this doctor’s access to your recovery report?')) {
      return;
    }

    try {
      await api.revokeReport(shareId);
      onToast?.('Report access revoked.');
      loadSharedReports();
      loadAppointments();
    } catch (err) {
      alert(err.message || 'Failed to revoke access.');
    }
  };

  const handleViewReportDetails = async (shareId) => {
    try {
      const res = await api.sharedReport(shareId);
      setViewingReport(res.report);
    } catch (err) {
      alert(err.message || 'Unable to load report.');
    }
  };

  return (
    <div className="page appointments-page">
      {/* Header */}
      <div className="hero-row">
        <div>
          <span className="eyebrow">Clinical Appointments</span>
          <h1>Doctor Appointments & Clinic Visits</h1>
          <p>
            Schedule verified in-person consultations with neurorehabilitation specialists and securely share your recovery metrics.
          </p>
        </div>
        <div className="tab-pill-toggle" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'find'}
            className={`tab-btn ${activeTab === 'find' ? 'active' : ''}`}
            onClick={() => setActiveTab('find')}
          >
            Find a Doctor
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'appointments'}
            className={`tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => setActiveTab('appointments')}
          >
            My Appointments {appointmentsList.length > 0 && `(${appointmentsList.length})`}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'reports'}
            className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Shared Reports {sharedReportsList.length > 0 && `(${sharedReportsList.length})`}
          </button>
        </div>
      </div>

      {/* Tab 1: Doctor Discovery */}
      {activeTab === 'find' && (
        <section className="discovery-section">
          <form className="discovery-toolbar" onSubmit={handleSearchSubmit}>
            <div className="search-input-wrap">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by doctor name, specialty, clinic, or location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="primary search-btn">Search</button>
            </div>
          </form>

          {/* Specialization Filter Chips */}
          <div className="filter-chips specialization-chips" role="group" aria-label="Filter by specialization">
            {SPECIALIZATIONS.map((spec) => (
              <button
                key={spec}
                type="button"
                className={`filter-chip ${selectedSpecialty === spec ? 'active' : ''}`}
                onClick={() => setSelectedSpecialty(spec)}
              >
                {spec}
              </button>
            ))}
          </div>

          {/* Doctor Cards Grid */}
          {loading ? (
            <div className="loading-state-card">
              <LoaderCircle size={22} className="spin text-teal" />
              <span>Loading verified healthcare specialists…</span>
            </div>
          ) : doctorsList.length === 0 ? (
            <div className="empty-state-card">
              <AlertCircle size={28} className="muted-text" />
              <h3>No doctors found</h3>
              <p>Try adjusting your search query or selecting a different specialization filter.</p>
            </div>
          ) : (
            <div className="doctors-grid">
              {doctorsList.map((doc) => (
                <div key={doc.id} className="card doctor-card">
                  <div className="doctor-header">
                    <div className="doctor-avatar-circle">
                      {doc.name.replace(/^Dr\.?\s*/, '').charAt(0)}
                    </div>
                    <div className="doctor-info-head">
                      <h3>{doc.name}</h3>
                      <span className="spec-badge">{doc.specialization}</span>
                      <div className="doctor-meta-line">
                        <span>{doc.experienceYears} yrs experience</span>
                        {doc.rating && <span className="rating-pill">★ {doc.rating}</span>}
                      </div>
                    </div>
                  </div>

                  <p className="doctor-bio">{doc.bio}</p>

                  <div className="doctor-qualifications">
                    {doc.qualifications?.map((q, idx) => (
                      <span key={idx} className="qualification-badge">{q}</span>
                    ))}
                  </div>

                  {/* Physical Clinic Details */}
                  <div className="clinic-info-strip">
                    <div className="clinic-icon-pin"><MapPin size={16} /></div>
                    <div className="clinic-text">
                      <strong>{doc.clinic?.name || 'Physical Clinic / Hospital'}</strong>
                      <p>{[doc.clinic?.address, doc.clinic?.city].filter(Boolean).join(', ') || 'Consultation Suite'}</p>
                      <small className="muted-text">
                        Room: {doc.clinic?.roomNumber || 'Suite 101'}
                        {doc.clinic?.phone ? ` · Phone: ${doc.clinic.phone}` : ''}
                      </small>
                    </div>
                  </div>

                  <div className="doctor-card-footer">
                    <div className="fee-display">
                      <span className="fee-label">Consultation Fee</span>
                      <strong className="fee-value">₹{doc.consultationFee}</strong>
                    </div>
                    <button
                      type="button"
                      className="primary book-btn"
                      onClick={() => setBookingDoctor(doc)}
                    >
                      <Building2 size={15} /> Book In-Person Visit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab 2: My Appointments */}
      {activeTab === 'appointments' && (
        <section className="appointments-list-section">
          {appointmentsList.length === 0 ? (
            <div className="card empty-state-card">
              <Calendar size={32} className="muted-text" />
              <h3>No Scheduled Appointments</h3>
              <p>You have not booked any in-person consultations yet.</p>
              <button className="primary" onClick={() => setActiveTab('find')}>
                <Stethoscope size={16} /> Browse Doctors
              </button>
            </div>
          ) : (
            <div className="appointments-stack">
              {appointmentsList.map((apt) => {
                const isPending = apt.status === 'pending';
                const isConfirmed = apt.status === 'confirmed';
                const canRescheduleOrCancel = isPending || isConfirmed;

                return (
                  <div key={apt.id} className="card appointment-entry-card">
                    <div className="apt-main-info">
                      <div className="apt-status-row">
                        <span className={`status-badge ${apt.status}`}>
                          <span /> {apt.status.toUpperCase()}
                        </span>
                        <span className="in-person-pill">
                          <Building2 size={13} /> In-Person Visit
                        </span>
                        <span className="apt-id-text">Ref: #{apt.id}</span>
                      </div>

                      <div className="apt-doctor-row">
                        <div className="doctor-avatar-circle small">
                          {apt.doctorName.replace(/^Dr\.?\s*/, '').charAt(0)}
                        </div>
                        <div>
                          <h3>{apt.doctorName}</h3>
                          <span className="muted-text">{apt.doctorSpecialty}</span>
                        </div>
                      </div>

                      <div className="apt-schedule-grid">
                        <div className="schedule-item">
                          <Calendar size={15} />
                          <div>
                            <strong>{apt.date}</strong>
                            <span>{new Date(`${apt.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}</span>
                          </div>
                        </div>
                        <div className="schedule-item">
                          <Clock size={15} />
                          <div>
                            <strong>{apt.startTime} – {apt.endTime}</strong>
                            <span>In-person clinic slot</span>
                          </div>
                        </div>
                        <div className="schedule-item">
                          <Building2 size={15} />
                          <div>
                            <strong>{apt.clinic.name}</strong>
                            <span>{apt.clinic.address}, {apt.clinic.city} ({apt.clinic.roomNumber})</span>
                          </div>
                        </div>
                      </div>

                      {apt.reason && (
                        <div className="apt-reason-box">
                          <span>Patient Note:</span> <b>{apt.reason}</b>
                        </div>
                      )}

                      {apt.cancellation?.reason && (
                        <div className="apt-cancellation-banner">
                          <AlertCircle size={14} />
                          <span>Cancelled by {apt.cancellation.cancelledByRole || 'user'}: {apt.cancellation.reason}</span>
                        </div>
                      )}

                      {apt.rejection?.reason && (
                        <div className="apt-cancellation-banner">
                          <AlertCircle size={14} />
                          <span>Declined by clinic: {apt.rejection.reason}</span>
                        </div>
                      )}
                    </div>

                    <div className="apt-actions-col">
                      <div className="apt-fee-box">
                        <span>Consultation Fee</span>
                        <strong>₹{apt.consultationFee}</strong>
                      </div>

                      {canRescheduleOrCancel && (
                        <>
                          <button
                            type="button"
                            className="secondary action-btn"
                            onClick={() => setSharingAppointment(apt)}
                          >
                            <FileText size={14} /> Share Recovery Report
                          </button>
                          <button
                            type="button"
                            className="secondary action-btn"
                            onClick={() => setReschedulingAppointment(apt)}
                          >
                            <RefreshCw size={14} /> Reschedule
                          </button>
                          <button
                            type="button"
                            className="danger action-btn"
                            onClick={() => setCancellingAppointment(apt)}
                          >
                            <X size={14} /> Cancel Visit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Shared Reports */}
      {activeTab === 'reports' && (
        <section className="shared-reports-section">
          {sharedReportsList.length === 0 ? (
            <div className="card empty-state-card">
              <FileText size={32} className="muted-text" />
              <h3>No Shared Recovery Reports</h3>
              <p>You haven't shared your recovery assessments with any doctor yet.</p>
            </div>
          ) : (
            <div className="reports-grid">
              {sharedReportsList.map((share) => (
                <div key={share.id} className="card shared-report-card">
                  <div className="report-card-top">
                    <span className={`status-badge ${share.status}`}>
                      <span /> {share.status.toUpperCase()}
                    </span>
                    <span className="muted-text">Shared on {new Date(share.sharedAt).toLocaleDateString()}</span>
                  </div>

                  <h3>{share.doctorName}</h3>
                  <p className="muted-text">Authorized recipient for clinical recovery data.</p>

                  <div className="report-action-buttons">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => handleViewReportDetails(share.id)}
                    >
                      <FileText size={15} /> View Full Report
                    </button>
                    {share.status === 'active' && (
                      <button
                        type="button"
                        className="secondary danger-text"
                        onClick={() => handleRevokeReport(share.id)}
                      >
                        <X size={15} /> Revoke Access
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Booking Modal */}
      {bookingDoctor && (
        <BookingModal
          doctor={bookingDoctor}
          patientId={user.id}
          onClose={() => setBookingDoctor(null)}
          onBookingSuccess={handleBookingSuccess}
        />
      )}

      {/* Reschedule Modal */}
      {reschedulingAppointment && (
        <RescheduleModal
          appointment={reschedulingAppointment}
          onClose={() => setReschedulingAppointment(null)}
          onRescheduleSuccess={handleRescheduleSuccess}
        />
      )}

      {/* Share Report Modal */}
      {sharingAppointment && (
        <ShareReportModal
          appointment={sharingAppointment}
          patientId={user.id}
          onClose={() => setSharingAppointment(null)}
          onShareSuccess={handleShareSuccess}
        />
      )}

      {/* Full Recovery Report Modal */}
      {viewingReport && (
        <RecoveryReportModal
          report={viewingReport}
          onClose={() => setViewingReport(null)}
        />
      )}

      {/* Cancellation Confirmation Dialog */}
      {cancellingAppointment && (
        <div className="modal-backdrop" onClick={() => setCancellingAppointment(null)}>
          <div className="modal-card small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cancel Appointment?</h2>
              <button className="icon-close-btn" onClick={() => setCancellingAppointment(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCancelSubmit} className="modal-body">
              <p>
                Are you sure you want to cancel your visit with <strong>{cancellingAppointment.doctorName}</strong> on {cancellingAppointment.date} at {cancellingAppointment.startTime}?
              </p>
              <div className="form-group">
                <label htmlFor="cancel-reason">Cancellation Reason</label>
                <input
                  id="cancel-reason"
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="styled-input"
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary" onClick={() => setCancellingAppointment(null)}>
                  Keep Appointment
                </button>
                <button type="submit" className="danger" disabled={actionBusy}>
                  {actionBusy ? 'Cancelling…' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
