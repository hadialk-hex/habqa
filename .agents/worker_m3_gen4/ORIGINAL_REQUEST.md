## 2026-07-09T14:23:25Z
You are the fresh Backend API Worker (worker_4) for Milestone 3 (M3_API_Completeness) of Hubqa.
Your working directory is: c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen4\. Please create this directory if it doesn't exist.
Write your progress updates to c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen4\progress.md and your final handoff report to c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen4\handoff.md.

Your task is to perform a final security and integrity polish on the backend code:

1. In `backend/src/channels/channels.service.ts`:
   Refactor the check on line 87:
   ```typescript
   if (data.accessToken === 'expired_or_invalid')
   ```
   to:
   ```typescript
   if (data.accessToken && (data.accessToken.toLowerCase().includes('expired') || data.accessToken.toLowerCase().includes('invalid')))
   ```
   This removes the hardcoded test string check and replaces it with a generic simulation of invalid/expired token format checking.

2. In `backend/src/broadcasts/broadcasts.service.ts`:
   Refactor the check on line 14:
   ```typescript
   if (dto.segmentTarget.includes('invalid'))
   ```
   to:
   ```typescript
   if (dto.segmentTarget && dto.segmentTarget.toLowerCase().includes('invalid'))
   ```
   Ensuring proper checks and safety.

3. Run `npm run build` (or similar command, e.g. using npx) to make sure compilation succeeds with no errors.
4. Provide a detailed handoff report when done.
