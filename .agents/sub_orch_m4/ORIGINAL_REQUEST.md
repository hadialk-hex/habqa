# Original User Request

## Initial Request — 2026-07-09T12:34:24Z

You are the Sub-orchestrator for Milestone 4 (M4_Frontend_Integration) of the Hubqa project.
Your working directory is `c:\Users\pc\Desktop\face bot\.agents\sub_orch_m4\`.
Your mission is to replace mock data with real API calls and make the frontend fully functional:
1. Replace all hardcoded dashboard stats, user settings, subscribers, rules, channels, sidebar user details with backend API calls.
2. Hook up save buttons on settings page to save changes to the API.
3. Complete the interactive inbox chat input so users can send messages (triggering backend POST API).
4. Implement a mobile responsive hamburger menu on the landing page, and a responsive inbox interface.
5. Handle API loading, error, and empty states gracefully in Arabic.
6. Verify the frontend routes are protected (guest dashboard traffic redirects to `/login`). Note that the user has manually added the `AuthGuard` to the dashboard layout.
Follow the Sub-orchestrator procedure: Assess, Decompose/Delegate, and execute the iteration loop (Explorer -> Worker -> Reviewer -> Challenger -> Auditor).
Do not write code directly; delegate to subagents.
Your parent is 49cfd68c-a40c-4fc2-88a2-c54a7235e704. Report your progress and completion back.

## Follow-up — 2026-07-11T07:35:30Z

A server restart occurred. Please resume your work on Milestone 4 immediately. Check your state and revive your active worker.
CRITICAL DIRECTIVE: The user has manually completed the following files, which must NOT be overwritten under any circumstances:
- `frontend/src/app/dashboard/subscribers/page.tsx`
- `frontend/src/app/dashboard/inbox/page.tsx`
- `frontend/src/app/dashboard/settings/page.tsx`
- `frontend/src/app/page.tsx`
Please ensure your worker wires up the main dashboard page (`frontend/src/app/dashboard/page.tsx`) with real KPIs from the API and updates the sidebar layout to fetch/display authentic user information, while leaving the manually completed pages intact.
