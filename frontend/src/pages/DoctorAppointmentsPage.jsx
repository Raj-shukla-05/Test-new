import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Building2, User, Check, X, AlertCircle,
  FileText, Settings, ShieldCheck, LoaderCircle, IndianRupee, MapPin, Plus
} from 'lucide-react';
import { api } from '../lib/api';
import RecoveryReportModal from '../components/RecoveryReportModal';

export default function DoctorAppointmentsPage({ doctor, onToast }) {
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule', 'availability', 'reports'
  const [appointments, setAppointments] = useState([]);
  const [sharedReports, setSharedReports] = useState([]);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);

  // Status filter for appointments list
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals / Dialogs
  const [rejectingApt, setRejectingApt] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('Doctor unavailable during this slot');
  const [selectedReport, setSelectedReport] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  // New Block Slot Form state
  const [blockDate, setBlockDate] = useState(new Date().toISOString().split('T')[0]);
  const [blockStartTime, setBlockStartTime] = useState('14:00');
  const [blockEndTime, setBlockEndTime] = useState('15:00');
  const [blockReason, setBlockReason] = useState('Clinical Conference');
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  // Load appointments, reports, and doctor profile
  const loadData = async () => {
    try {
      const [aptRes, repRes, docRes] = await Promise.all([
        api.doctorAppointments(),
        api.sharedReportsWithMe(),
        api.doctor(doctor?.id || 'doc-priya'),
      ]);
      setAppointments(aptRes.appointments || []);
      setSharedReports(repRes.reports || []);
      setDoctorProfile(docRes.doctor || null);
    } catch (err) {
      console.warn('Error fetching doctor data:', err.message);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [doctor]);

  const handleConfirm = async (aptId) => {
    setActionBusy(true);
    try {
      await api.confirmAppointment(aptId);
      onToast?.('Appointment confirmed successfully.');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to confirm appointment.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingApt) return;
    setActionBusy(true);
    try {
      await api.rejectAppointment(rejectingApt.id, rejectionReason);
      setRejectingApt(null);
      setRejectionReason('Doctor unavailable during this slot');
      onToast?.('Appointment request declined.');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to reject appointment.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleComplete = async (aptId) => {
    setActionBusy(true);
    try {
      await api.completeAppointment(aptId);
      onToast?.('Visit marked as completed.');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to complete appointment.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleNoShow = async (aptId) => {
    if (!window.confirm('Mark this patient visit as a No-Show?')) return;
    setActionBusy(true);
    try {
      await api.noShowAppointment(aptId);
      onToast?.('Marked as No-Show.');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to update appointment.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleBlockSlot = async (e) => {
    e.preventDefault();
    setBlockSubmitting(true);
    try {
      await api.blockDoctorSlot({
        date: blockDate,
        startTime: blockStartTime,
        endTime: blockEndTime,
        reason: blockReason,
      });
      onToast?.('Slot successfully blocked on schedule.');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to block slot.');
    } finally {
      setBlockSubmitting(false);
    }
  };

  const handleUnblockSlot = async (blockId) => {
    try {
      await api.unblockDoctorSlot(blockId);
      onToast?.('Slot unblocked.');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to unblock slot.');
    }
  };

  // Filtered appointments
  const filteredAppointments = appointments.filter((a) => {
    if (statusFilter === 'all') return true;
    return a.status === statusFilter;
  });

  return (
    <div className="page doctor-appointments-page">
      {/* Header */}
      <div className="hero-row">
        <div>
          <span className="eyebrow">Clinical Practice Oversight</span>
          <h1>In-Person Appointments & Clinic Schedule</h1>
          <p>
            Manage clinical visits at {doctorProfile?.clinic?.name || 'Clinic'}, review patient requests, configure slot availability, and inspect patient recovery reports.
          </p>
        </div>

        <div className="tab-pill-toggle" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'schedule'}
            className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            Clinic Visits ({appointments.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'availability'}
            className={`tab-btn ${activeTab === 'availability' ? 'active' : ''}`}
            onClick={() => setActiveTab('availability')}
          >
            Clinic Hours & Blocks
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'reports'}
            className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Shared Patient Reports ({sharedReports.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Clinic Schedule */}
      {activeTab === 'schedule' && (
        <section className="doctor-schedule-section">
          {/* Status Filter Chips */}
          <div className="filter-chips">
            {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((st) => (
              <button
                key={st}
                className={`filter-chip ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'all' ? 'All Visits' : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="card loading-state-card">
              <LoaderCircle size={22} className="spin text-teal" />
              <span>Loading appointment schedule…</span>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="card empty-state-card">
              <Calendar size={32} className="muted-text" />
              <h3>No Appointments in this view</h3>
              <p>There are no appointments matching '{statusFilter}'.</p>
            </div>
          ) : (
            <div className="appointments-stack">
              {filteredAppointments.map((apt) => {
                const isPending = apt.status === 'pending';
                const isConfirmed = apt.status === 'confirmed';

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

                      <div className="apt-patient-head">
                        <div className="patient-avatar-circle">
                          {apt.patientName.charAt(0)}
                        </div>
                        <div>
                          <h3>{apt.patientName}</h3>
                          <span className="muted-text">Patient ID: {apt.patientId} · Booked by {apt.bookedBy?.role || 'Patient'}</span>
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
                            <span>{apt.clinic.roomNumber || 'OPD Suite'}</span>
                          </div>
                        </div>
                        <div className="schedule-item">
                          <IndianRupee size={15} />
                          <div>
                            <strong>₹{apt.consultationFee}</strong>
                            <span>Payable at desk</span>
                          </div>
                        </div>
                      </div>

                      {apt.reason && (
                        <div className="apt-reason-box">
                          <span>Patient Notes:</span> <b>{apt.reason}</b>
                        </div>
                      )}

                      {apt.sharedReportId && (
                        <div className="shared-report-tag-box">
                          <FileText size={14} className="text-teal" />
                          <span>Patient shared a verified NeuroGuard recovery report for this visit.</span>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => {
                              api.sharedReport(apt.sharedReportId).then((res) => setSelectedReport(res.report));
                            }}
                          >
                            Inspect Report
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="apt-actions-col">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            className="primary action-btn"
                            disabled={actionBusy}
                            onClick={() => handleConfirm(apt.id)}
                          >
                            <Check size={15} /> Confirm Visit
                          </button>
                          <button
                            type="button"
                            className="danger action-btn"
                            disabled={actionBusy}
                            onClick={() => setRejectingApt(apt)}
                          >
                            <X size={15} /> Decline Request
                          </button>
                        </>
                      )}

                      {isConfirmed && (
                        <>
                          <button
                            type="button"
                            className="primary action-btn"
                            disabled={actionBusy}
                            onClick={() => handleComplete(apt.id)}
                          >
                            <Check size={15} /> Mark Completed
                          </button>
                          <button
                            type="button"
                            className="secondary action-btn"
                            disabled={actionBusy}
                            onClick={() => handleNoShow(apt.id)}
                          >
                            Mark No-Show
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

      {/* Tab 2: Clinic Hours & Blocked Slots */}
      {activeTab === 'availability' && (
        <section className="availability-management-section">
          <div className="dashboard-grid top-grid">
            {/* Clinic Info Summary */}
            <div className="card">
              <div className="card-head">
                <h3>Clinic Information & Schedule</h3>
              </div>
              <div className="clinic-profile-details">
                <p><strong>Clinic:</strong> {doctorProfile?.clinic?.name}</p>
                <p><strong>Physical Address:</strong> {doctorProfile?.clinic?.address}, {doctorProfile?.clinic?.city}</p>
                <p><strong>Room / Suite:</strong> {doctorProfile?.clinic?.roomNumber || 'Suite 101'}</p>
                <p><strong>Phone:</strong> {doctorProfile?.clinic?.phone}</p>
                <p><strong>Consultation Fee:</strong> ₹{doctorProfile?.consultationFee}</p>
                <p><strong>Working Days:</strong> Monday – Friday</p>
                <p><strong>Working Hours:</strong> {doctorProfile?.clinicHours || '09:00 - 17:00'}</p>
                <p><strong>Clinic Break:</strong> 13:00 – 14:00 (Break slots automatically excluded)</p>
              </div>
            </div>

            {/* Block Slot Form */}
            <div className="card">
              <div className="card-head">
                <h3>Block Clinical Slot / Time-Out</h3>
              </div>
              <p className="muted-text">Block off specific times for surgeries, rounds, or clinical conferences.</p>

              <form onSubmit={handleBlockSlot} className="block-slot-form">
                <div className="form-group">
                  <label htmlFor="block-date">Date</label>
                  <input
                    id="block-date"
                    type="date"
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    required
                    className="styled-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="block-start">Start Time</label>
                    <input
                      id="block-start"
                      type="time"
                      value={blockStartTime}
                      onChange={(e) => setBlockStartTime(e.target.value)}
                      required
                      className="styled-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="block-end">End Time</label>
                    <input
                      id="block-end"
                      type="time"
                      value={blockEndTime}
                      onChange={(e) => setBlockEndTime(e.target.value)}
                      required
                      className="styled-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="block-reason">Reason</label>
                  <input
                    id="block-reason"
                    type="text"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="e.g. Surgical Round, Case Conference"
                    required
                    className="styled-input"
                  />
                </div>

                <button type="submit" className="primary" disabled={blockSubmitting}>
                  <Plus size={15} /> Block Selected Slot
                </button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Tab 3: Shared Patient Reports */}
      {activeTab === 'reports' && (
        <section className="shared-reports-section">
          {sharedReports.length === 0 ? (
            <div className="card empty-state-card">
              <FileText size={32} className="muted-text" />
              <h3>No Shared Reports</h3>
              <p>No patients have explicitly shared recovery reports with your clinical account yet.</p>
            </div>
          ) : (
            <div className="reports-grid">
              {sharedReports.map((share) => (
                <div key={share.id} className="card shared-report-card">
                  <div className="report-card-top">
                    <span className="status-badge stable">
                      <span /> AUTHORIZED
                    </span>
                    <span className="muted-text">Shared {new Date(share.sharedAt).toLocaleDateString()}</span>
                  </div>

                  <h3>{share.patientName}</h3>
                  <p className="muted-text">
                    Patient ID: {share.patientId} · Status: {share.reportData?.summary?.overallStatus || 'Stable'}
                  </p>

                  <div className="report-action-buttons">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        api.sharedReport(share.id).then((res) => setSelectedReport(res.report));
                      }}
                    >
                      <FileText size={15} /> Inspect Recovery Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Reject Appointment Dialog */}
      {rejectingApt && (
        <div className="modal-backdrop" onClick={() => setRejectingApt(null)}>
          <div className="modal-card small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Decline Appointment Request?</h2>
              <button className="icon-close-btn" onClick={() => setRejectingApt(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRejectSubmit} className="modal-body">
              <p>
                Provide a clinical reason for declining <strong>{rejectingApt.patientName}</strong>'s request for {rejectingApt.date} at {rejectingApt.startTime}:
              </p>
              <div className="form-group">
                <label htmlFor="rejection-reason">Decline Reason</label>
                <input
                  id="rejection-reason"
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="styled-input"
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary" onClick={() => setRejectingApt(null)}>
                  Cancel
                </button>
                <button type="submit" className="danger" disabled={actionBusy}>
                  Decline Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recovery Report Modal */}
      {selectedReport && (
        <RecoveryReportModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}
