# NeuroGuard AI — Doctor Appointment System API Reference

All protected endpoints require an `Authorization` header containing a valid JWT:
```http
Authorization: Bearer <token>
```

---

## 1. Doctor Discovery & Profile APIs

### 1.1. List Doctors (Discovery Catalog)
`GET /api/doctors`
- **Auth:** Public / Optional
- **Query Parameters:**
  - `search` (string): Keyword matching doctor name, specialization, clinic name, or address.
  - `specialization` (string): Filters by clinical specialty (e.g. `Neurology`, `Physiotherapy`).
  - `city` (string): Filters by clinic metro location (e.g. `Mumbai`).
- **Response (200 OK):**
```json
{
  "total": 4,
  "doctors": [
    {
      "id": "doc-priya",
      "userId": "doctor-priya",
      "name": "Dr. Priya Nair",
      "specialization": "Neurorehabilitation",
      "qualifications": ["MBBS", "MD - PMR", "Fellowship in Neurorehabilitation"],
      "experienceYears": 14,
      "consultationFee": 1200,
      "bio": "Specialist in post-stroke motor recovery and hemiplegic arm rehabilitation.",
      "clinic": {
        "name": "Apex Neurorehabilitation Center",
        "address": "Plot 42, Hill Road, Bandra West",
        "city": "Mumbai",
        "roomNumber": "OPD Suite 204",
        "phone": "+91 22 2640 1199"
      },
      "rating": 4.9
    }
  ]
}
```

### 1.2. Get Doctor Profile
`GET /api/doctors/:doctorId`
- **Response (200 OK):** `{ "doctor": { ... } }`
- **Errors:** `404 Not Found` if doctor does not exist.

### 1.3. Get Available In-Person Slots
`GET /api/doctors/:doctorId/availability?date=YYYY-MM-DD`
- **Query:** `date` (required, format: `YYYY-MM-DD`). Rejects past dates with `400 Bad Request`.
- **Response (200 OK):**
```json
{
  "doctor": { "id": "doc-priya", "name": "Dr. Priya Nair", "clinic": { ... } },
  "date": "2026-11-15",
  "isWorkingDay": true,
  "slots": [
    { "startTime": "09:00", "endTime": "09:30", "available": true, "unavailableReason": null },
    { "startTime": "13:00", "endTime": "13:30", "available": false, "unavailableReason": "Clinic Break" },
    { "startTime": "14:00", "endTime": "14:30", "available": false, "unavailableReason": "Reserved" }
  ]
}
```

### 1.4. Update Doctor Profile
`PATCH /api/doctors/profile`
- **Auth:** `doctor` role only.
- **Request Body:**
```json
{
  "consultationFee": 1300,
  "bio": "Updated clinical bio statement.",
  "clinic": {
    "name": "Apex Neuro Clinic",
    "roomNumber": "Suite 205",
    "phone": "+91 22 2640 2200"
  }
}
```
- **Response (200 OK):** `{ "doctor": { ... } }`

### 1.5. Configure Working Availability
`PUT /api/doctors/availability`
- **Auth:** `doctor` role only.
- **Request Body:**
```json
{
  "workingDays": [1, 2, 3, 4, 5],
  "dayStartTime": "09:00",
  "dayEndTime": "17:00",
  "slotDurationMinutes": 30,
  "breakStartTime": "13:00",
  "breakEndTime": "14:00",
  "unavailableDates": ["2026-12-25"]
}
```

### 1.6. Block Custom Time Slot
`POST /api/doctors/availability/block`
- **Auth:** `doctor` role only.
- **Request Body:**
```json
{
  "date": "2026-11-20",
  "startTime": "15:00",
  "endTime": "16:00",
  "reason": "Case Conference"
}
```
- **Response (201 Created):** `{ "blockedSlot": { ... } }`

### 1.7. Unblock Time Slot
`DELETE /api/doctors/availability/block/:blockId`
- **Auth:** `doctor` role only.
- **Response (200 OK):** `{ "ok": true, "message": "Blocked slot removed" }`

---

## 2. Appointment Booking & Lifecycle APIs

### 2.1. Book In-Person Appointment
`POST /api/appointments`
- **Auth:** `patient` or `caregiver` role. Rate-limited (15 req/min).
- **Request Body:**
```json
{
  "doctorId": "doc-priya",
  "date": "2026-11-20",
  "startTime": "10:00",
  "reason": "Hemiplegic arm stiffness assessment",
  "patientId": "user-raj"
}
```
*Note: `patientId` is required when a caregiver books on behalf of an authorized patient.*
- **Response (201 Created):**
```json
{
  "appointment": {
    "id": "apt-1762140000000-abc12",
    "patientId": "user-raj",
    "patientName": "Raj Kumar",
    "doctorId": "doc-priya",
    "doctorName": "Dr. Priya Nair",
    "doctorSpecialty": "Neurorehabilitation",
    "clinic": {
      "name": "Apex Neurorehabilitation Center",
      "address": "Plot 42, Hill Road, Bandra West",
      "city": "Mumbai",
      "roomNumber": "OPD Suite 204",
      "phone": "+91 22 2640 1199"
    },
    "date": "2026-11-20",
    "startTime": "10:00",
    "endTime": "10:30",
    "status": "pending",
    "consultationFee": 1200,
    "reason": "Hemiplegic arm stiffness assessment",
    "bookedBy": { "userId": "user-raj", "role": "patient", "name": "Raj Kumar" }
  }
}
```
- **Error Codes:**
  - `400 Bad Request`: Past date, invalid time format, or clinic closed.
  - `403 Forbidden`: Caregiver not authorized for the requested patient.
  - `409 Conflict`: Slot already reserved or concurrent collision.

### 2.2. Patient's Appointments
`GET /api/appointments/my`
- **Auth:** `patient` (returns own visits) or `caregiver` (returns authorized patients' visits).
- **Response (200 OK):** `{ "appointments": [ ... ] }`

### 2.3. Doctor's Clinic Appointments
`GET /api/appointments/doctor`
- **Auth:** `doctor` role only. Returns appointments scheduled with the authenticated clinician.
- **Response (200 OK):** `{ "appointments": [ ... ] }`

### 2.4. Appointment Detail
`GET /api/appointments/:appointmentId`
- **Auth:** Patient owner, authorized caregiver, or assigned doctor.
- **Errors:** `403 Forbidden` if an unauthorized user attempts access.

### 2.5. Confirm Appointment
`PATCH /api/appointments/:appointmentId/confirm`
- **Auth:** Assigned `doctor` only.
- **Response (200 OK):** `{ "appointment": { "status": "confirmed", ... } }`

### 2.6. Decline Appointment Request
`PATCH /api/appointments/:appointmentId/reject`
- **Auth:** Assigned `doctor` only.
- **Request Body:** `{ "reason": "Clinic at maximum capacity for morning block" }`
- **Response (200 OK):** `{ "appointment": { "status": "rejected", ... } }`

### 2.7. Cancel Appointment
`PATCH /api/appointments/:appointmentId/cancel`
- **Auth:** Patient, authorized caregiver, or attending doctor.
- **Request Body:** `{ "reason": "Patient fever" }`
- **Response (200 OK):** `{ "appointment": { "status": "cancelled", ... } }`

### 2.8. Reschedule Appointment
`PATCH /api/appointments/:appointmentId/reschedule`
- **Auth:** Patient, authorized caregiver, or attending doctor.
- **Request Body:**
```json
{
  "newDate": "2026-11-25",
  "newStartTime": "14:00",
  "reason": "Patient transport rescheduled"
}
```
- **Response (200 OK):** Returns the new created appointment; marks the old appointment as cancelled with reschedule metadata.

### 2.9. Mark Completed / No-Show
`PATCH /api/appointments/:appointmentId/complete`  
`PATCH /api/appointments/:appointmentId/no-show`
- **Auth:** Assigned `doctor` only. Allowed only from `confirmed` status.

---

## 3. NeuroGuard Recovery Report Sharing APIs

### 3.1. Preview Recovery Report
`GET /api/reports/preview`
- **Auth:** `patient` or authorized `caregiver`.
- **Response (200 OK):**
```json
{
  "report": {
    "patient": { "id": "user-raj", "name": "Raj Kumar", "age": 58 },
    "generatedAt": "2026-11-03T09:00:00.000Z",
    "clinicalDisclaimer": "NeuroGuard AI provides assistive functional monitoring...",
    "summary": {
      "overallStatus": "stable",
      "currentScore": 79,
      "baselineScore": 75,
      "percentageChange": 5.3,
      "totalAssessments": 7,
      "exerciseBreakdown": { "arm_raise": 7, "sit_to_stand": 0, "seated_reach": 0 }
    },
    "sessions": [ ... ]
  }
}
```

### 3.2. Authorize & Share Report
`POST /api/reports/share`
- **Auth:** `patient` or authorized `caregiver`.
- **Request Body:**
```json
{
  "doctorId": "doc-priya",
  "appointmentId": "apt-1762140000000-abc12"
}
```
- **Response (201 Created):** `{ "share": { "id": "share-...", "status": "active", ... } }`

### 3.3. Doctor View of Shared Reports
`GET /api/reports/shared-with-me`
- **Auth:** `doctor` role only. Returns reports shared with the authenticated doctor.

### 3.4. Retrieve Shared Report (With Audit Logging)
`GET /api/reports/shared/:shareId`
- **Auth:** Intended doctor recipient or owning patient.
- **Errors:**
  - `403 Forbidden`: User is an unrelated doctor (IDOR defense).
  - `403 Forbidden`: Patient has revoked access (`"Access to this recovery report has been revoked by the patient."`).

### 3.5. Revoke Report Access
`DELETE /api/reports/shares/:shareId`
- **Auth:** Owning patient or authorized caregiver only.
- **Response (200 OK):** `{ "message": "Report access successfully revoked", "report": { "status": "revoked" } }`

---

## 4. Notifications & Caregiver APIs

### 4.1. Get User Notifications
`GET /api/notifications`
- **Auth:** Any authenticated user. Returns up to 50 recent in-app notifications.

### 4.2. Mark Notification as Read
`PATCH /api/notifications/:id/read`
- **Response (200 OK):** `{ "notification": { "read": true, ... } }`

### 4.3. Mark All Notifications as Read
`POST /api/notifications/read-all`
- **Response (200 OK):** `{ "ok": true }`

### 4.4. Caregiver Patient Roster
`GET /api/caregivers/:id/patients`
- **Auth:** `caregiver` role (must match token userId) or authorized `doctor`.
- **Response (200 OK):** Returns authorized patients list with status and score summaries.
