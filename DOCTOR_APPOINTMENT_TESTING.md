# NeuroGuard AI — Doctor Appointment System Testing Guide

## 1. Testing Framework & Philosophy

The Doctor Appointment System uses Node.js’s built-in native test runner (`node:test` and `node:assert/strict`) for backend integration and security tests, and Vite for production build verification.

- **No Mocks in Integration:** Tests run against real HTTP listeners instantiated on ephemeral ports via `app.listen(0)` with real HTTP requests via `fetch()`.
- **Zero Hallucination Policy:** Every test case verifies genuine response codes, status transitions, and data integrity.

---

## 2. Test Execution Commands

### 2.1. Run Backend Test Suite
```bash
# From workspace root
npm --prefix backend test
```
*Current test count: **96 tests passing across 11 test suites** (0 failures).*

### 2.2. Run Frontend Production Build & Bundle Verification
```bash
# From workspace root
npm --prefix frontend run build
```
*Verifies all React 19 JSX components, CSS styles, and Lucide icon imports compile cleanly without errors.*

---

## 3. Test Suite Inventory

### Suite A: `backend/test/appointments.test.js` (20 Integration Tests)
1. **Doctor Discovery Listing & Filters:** Verifies full list retrieval, search by name (`Priya`), specialization filtering (`Neurology`), and city filtering (`Mumbai`).
2. **Discrete Slot Generation:** Validates slot intervals, automatic exclusion of break hours (`13:00 - 14:00`), and rejection of past dates.
3. **In-Person Booking Workflow:** Verifies successful creation of pending appointment with full clinic location metadata.
4. **Double Booking Prevention:** Rejects duplicate booking attempt on the same slot with `409 Conflict`.
5. **Caregiver Authorized Booking:** Verifies authorized caregiver can book for patient `user-raj`.
6. **Caregiver Unauthorized Block:** Rejects booking attempt by unlinked caregiver with `403 Forbidden`.
7. **Patient Appointments Retrieval:** Validates patient can only retrieve their own appointments.
8. **Doctor Appointments Retrieval:** Validates doctor retrieves clinic visits scheduled with them.
9. **Doctor Confirmation:** Validates status transition from `pending` to `confirmed`.
10. **Role Protection:** Rejects patient attempt to mark appointment as `completed` with `403 Forbidden`.
11. **Doctor Isolation:** Rejects Doctor B attempting to modify Doctor A's appointment with `403 Forbidden`.
12. **Rescheduling:** Atomically moves appointment to new slot; cancels old appointment with audit reference.
13. **Recovery Report Preview:** Compiles authentic assessment history and baseline metrics.
14. **Recovery Report Sharing:** Explicitly authorizes doctor to view recovery metrics.
15. **Doctor Report Access & Audit:** Doctor views report; verifies action is recorded in `accessAuditLog`.
16. **IDOR Report Protection:** Unrelated doctor is blocked with `403 Forbidden`.
17. **Patient Revocation:** Patient revokes access; subsequent doctor view attempts yield `403 Forbidden`.
18. **In-App Notifications:** Validates notification generation and marking as read (`read: true`).
19. **Doctor Availability Management:** Doctor blocks custom slot (`16:00`); slot is immediately unavailable.
20. **Concurrency Simulation:** Simultaneous concurrent bookings of the same slot permit exactly one winner (`201 Created` vs `409 Conflict`).

### Suite B: `backend/test/appointmentSecurity.test.js` (10 Security Tests)
1. **S1 (Unauthenticated Access):** Returns `401 Unauthorized` when token is missing.
2. **S2 (Tampered Token):** Returns `401 Unauthorized` on corrupted JWTs.
3. **S3 (Vertical Privilege Escalation):** Patients cannot access clinician availability configuration (`403 Forbidden`).
4. **S4 (Horizontal Privilege Escalation / IDOR):** Patients cannot view other patients' appointments (`403 Forbidden`).
5. **S5 (Caregiver Isolation):** Unlinked caregivers cannot access unrelated patient appointments (`403 Forbidden`).
6. **S6 (Doctor Isolation):** Clinicians cannot confirm or modify appointments of other doctors (`403 Forbidden`).
7. **S7 (State Tampering):** Patients cannot mark visits as completed (`403 Forbidden`).
8. **S8 (Input Validation):** Rejects malformed dates and past dates with `400 Bad Request`.
9. **S9 (Non-Existent Entities):** Rejects bookings for non-existent doctor IDs with `404 Not Found`.
10. **S10 (Report IDOR & Revocation):** Verifies unauthorized doctors are blocked and revoked reports cannot be viewed.

---

## 4. End-to-End Browser Verification Walkthrough

To verify the system interactively:

1. **Start Backend:**
   ```bash
   cd backend && npm run dev
   ```
   *Runs on `http://localhost:5000`.*

2. **Start Frontend:**
   ```bash
   cd frontend && npm run dev
   ```
   *Runs on `http://localhost:5173`.*

3. **Step-by-Step Flow:**
   - Sign in as Patient using demo account `raj@neuroguard.demo` / `patient123`.
   - Click **Doctor Appointments** in the sidebar.
   - Search for "Priya" or filter by "Neurorehabilitation".
   - Click **Book In-Person Visit** on Dr. Priya Nair's card.
   - Select a date and an available time slot; optionally enter a reason; click **Confirm Appointment**.
   - Check **My Appointments** tab — the visit appears as `PENDING`.
   - Click **Share Recovery Report** — review the report preview and check the consent box.
   - Click **Sign Out** in the topbar.
   - Sign in as Doctor using demo account `priya@neuroguard.demo` / `doctor123`.
   - Notice the notification badge on the bell icon in the topbar.
   - Click **Clinic Appointments** in the sidebar.
   - Click **Confirm Visit** on Raj Kumar's booking request.
   - Click **Inspect Report** to view Raj's genuine functional recovery report with baseline deviations.
