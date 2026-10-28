# START HERE — NeuroGuard Hackathon

1. Open this folder in VS Code.
2. In terminal A:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   npm run dev
   ```
3. In terminal B:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Open `http://localhost:5173`.
5. Test the patient flow: Overview → Today’s Check → Arm Raise → Start camera.
6. Test the judge flow: click `Load decline demo` → switch profile to caregiver → Patients.

For the camera demo, use Chrome/Edge on localhost and allow camera access. Keep your whole upper body in frame for Arm Raise.
