import React from 'react';
import { X, ShieldAlert, FileText, CheckCircle2, Activity, Calendar, Clock, User, HeartPulse } from 'lucide-react';

export default function RecoveryReportModal({ report, onClose }) {
  if (!report) return null;

  const data = report.reportData || report;
  const patient = data.patient || {};
  const summary = data.summary || {};
  const sessions = data.sessions || [];

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="report-badge"><FileText size={16} /> Patient Recovery Report</div>
            <h2 id="report-modal-title">{patient.name || 'Patient'} — Functional Recovery Profile</h2>
            <span className="muted-text">
              Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleDateString() : 'Recently'} · ID: {patient.id}
            </span>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close report">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body scrollable">
          {/* Clinical Non-Diagnostic Disclaimer */}
          <div className="clinical-notice-banner">
            <ShieldAlert size={18} className="notice-icon" />
            <div>
              <strong>Non-Diagnostic Rehabilitation Documentation</strong>
              <p>{data.clinicalDisclaimer || 'NeuroGuard AI functional monitoring report provided for clinical oversight. Does not replace professional clinical diagnosis.'}</p>
            </div>
          </div>

          {/* Recovery Overview Strip */}
          <div className="report-summary-strip">
            <div className="summary-metric-box">
              <span className="metric-label">Clinical Status</span>
              <div className={`status-badge ${summary.overallStatus || 'stable'}`}>
                <span /> {String(summary.overallStatus || 'stable').toUpperCase()}
              </div>
            </div>
            <div className="summary-metric-box">
              <span className="metric-label">Latest Score</span>
              <strong className="metric-val">{summary.currentScore !== null ? `${summary.currentScore}/100` : '—'}</strong>
            </div>
            <div className="summary-metric-box">
              <span className="metric-label">Personal Baseline</span>
              <strong className="metric-val">{summary.baselineScore !== null ? `${summary.baselineScore}/100` : '—'}</strong>
            </div>
            <div className="summary-metric-box">
              <span className="metric-label">Baseline Delta</span>
              <strong className={`metric-val ${Number(summary.percentageChange) >= 0 ? 'text-positive' : 'text-negative'}`}>
                {Number(summary.percentageChange) >= 0 ? `+${summary.percentageChange}%` : `${summary.percentageChange}%`}
              </strong>
            </div>
            <div className="summary-metric-box">
              <span className="metric-label">Total Completed</span>
              <strong className="metric-val">{summary.totalAssessments || sessions.length} sessions</strong>
            </div>
          </div>

          {/* Exercise Breakdown */}
          {summary.exerciseBreakdown && (
            <div className="report-section">
              <h3 className="section-title">Protocol Distribution</h3>
              <div className="protocol-tags-row">
                <div className="protocol-tag">
                  <strong>Arm Raise (Bilateral)</strong>
                  <span>{summary.exerciseBreakdown.arm_raise || 0} sessions</span>
                </div>
                <div className="protocol-tag">
                  <strong>Sit to Stand (Stability)</strong>
                  <span>{summary.exerciseBreakdown.sit_to_stand || 0} sessions</span>
                </div>
                <div className="protocol-tag">
                  <strong>Seated Reach (Kinematics)</strong>
                  <span>{summary.exerciseBreakdown.seated_reach || 0} sessions</span>
                </div>
              </div>
            </div>
          )}

          {/* Recorded Sessions History */}
          <div className="report-section">
            <h3 className="section-title">Recent Assessment Sessions (Genuine Measured Data)</h3>
            {sessions.length === 0 ? (
              <p className="empty-note">No recorded assessment sessions found for this patient.</p>
            ) : (
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Protocol</th>
                      <th>Score</th>
                      <th>Duration</th>
                      <th>Measured Metrics</th>
                      <th>Tracking Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="datetime-cell">
                            <Calendar size={13} />
                            <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                            <small>{new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                          </div>
                        </td>
                        <td>
                          <span className="protocol-badge">
                            {s.exerciseType === 'arm_raise' ? 'Arm Raise' : s.exerciseType === 'sit_to_stand' ? 'Sit-to-Stand' : 'Seated Reach'}
                          </span>
                        </td>
                        <td>
                          <strong className="score-cell">{s.score}/100</strong>
                        </td>
                        <td>{s.duration}s</td>
                        <td>
                          <div className="metrics-pill-list">
                            {s.metrics.movement !== undefined && <span>Mov: {Math.round(s.metrics.movement)}</span>}
                            {s.metrics.coordination !== undefined && <span>Coord: {Math.round(s.metrics.coordination)}</span>}
                            {s.metrics.balance !== undefined && <span>Bal: {Math.round(s.metrics.balance)}</span>}
                            {s.metrics.speech !== undefined && <span>Speech: {Math.round(s.metrics.speech)}</span>}
                          </div>
                        </td>
                        <td>
                          <span className="quality-pill">
                            <CheckCircle2 size={12} className="text-positive" />
                            {s.trackingQuality?.trackingRatio ? `${Math.round(s.trackingQuality.trackingRatio * 100)}% valid frames` : 'Verified'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Access Audit Information */}
          {report.accessAuditLog && report.accessAuditLog.length > 0 && (
            <div className="report-section audit-trail-box">
              <h4 className="audit-title"><Activity size={14} /> Authorization & Access Audit Trail</h4>
              <ul className="audit-list">
                {report.accessAuditLog.map((log, index) => (
                  <li key={index}>
                    <span className="audit-action">{log.action.toUpperCase()}</span> by Doctor ID {log.doctorId} on {new Date(log.accessedAt).toLocaleString()}
                    {log.ip ? ` (IP: ${log.ip})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="secondary" onClick={onClose}>Close Report</button>
        </div>
      </div>
    </div>
  );
}
