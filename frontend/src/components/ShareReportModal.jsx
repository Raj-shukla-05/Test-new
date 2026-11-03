import React, { useState, useEffect } from 'react';
import { X, FileText, CheckCircle2, AlertCircle, LoaderCircle, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

export default function ShareReportModal({ appointment, patientId, onClose, onShareSuccess }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.previewReport(patientId)
      .then((res) => setPreview(res.report))
      .catch((err) => setError(err.message || 'Unable to generate report preview.'))
      .finally(() => setLoading(false));
  }, [patientId]);

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!consentChecked) {
      setError('Please check the authorization box to consent to sharing.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await api.shareReport({
        doctorId: appointment.doctorId,
        appointmentId: appointment.id,
        patientId,
      });
      onShareSuccess(res.share);
    } catch (err) {
      setError(err.message || 'Failed to share report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2 id="share-modal-title">Share Recovery Report with Doctor</h2>
            <span className="muted-text">Recipient: {appointment.doctorName} ({appointment.doctorSpecialty})</span>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleShareSubmit} className="modal-body scrollable">
          {error && (
            <div className="alert-banner error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="slots-loading-state">
              <LoaderCircle size={18} className="spin" /> Generating current recovery report preview…
            </div>
          ) : preview ? (
            <div className="report-preview-summary-card">
              <h4>Report Snapshot to be Shared</h4>
              <div className="summary-row">
                <span>Patient:</span>
                <strong>{preview.patient.name} (Age: {preview.patient.age || '—'})</strong>
              </div>
              <div className="summary-row">
                <span>Recorded Sessions:</span>
                <strong>{preview.summary.totalAssessments} completed assessments</strong>
              </div>
              <div className="summary-row">
                <span>Current Recovery Score:</span>
                <strong>{preview.summary.currentScore !== null ? `${preview.summary.currentScore}/100` : '—'}</strong>
              </div>
              <div className="summary-row">
                <span>Baseline Score:</span>
                <strong>{preview.summary.baselineScore !== null ? `${preview.summary.baselineScore}/100` : '—'}</strong>
              </div>
              <div className="summary-row">
                <span>Status:</span>
                <span className={`status-badge ${preview.summary.overallStatus || 'stable'}`}>
                  <span /> {String(preview.summary.overallStatus || 'stable').toUpperCase()}
                </span>
              </div>
            </div>
          ) : null}

          {/* Explicit Consent Checkbox */}
          <div className="consent-checkbox-row">
            <input
              type="checkbox"
              id="report-consent"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              required
            />
            <label htmlFor="report-consent">
              I explicitly authorize <strong>{appointment.doctorName}</strong> to view my NeuroGuard assessment history, movement scores, and baseline trends for in-person clinical review. I can revoke access at any time.
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary large" disabled={!consentChecked || submitting}>
              {submitting ? (
                <>
                  <LoaderCircle size={15} className="spin" /> Authorizing…
                </>
              ) : (
                <>
                  <FileText size={15} /> Authorize & Share Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
