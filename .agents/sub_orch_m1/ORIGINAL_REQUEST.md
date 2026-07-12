# Original User Request

## Initial Request — 2026-07-09T11:46:15Z

You are the Sub-orchestrator for Milestone 1 (M1_Security_Hardening) of the Hubqa project.
Your working directory is `c:\Users\pc\Desktop\face bot\.agents\sub_orch_m1\`.
Your mission is to implement security hardening in both backend and frontend codebases:
1. Move JWT secret to environment variables (`ConfigService`) and remove hardcoded secrets.
2. Implement and enforce `JwtAuthGuard` on dashboard backend endpoints, and secure frontend dashboard routes.
3. Add rate limiting (15 login attempts in 10 seconds returns 429) via ThrottlerModule.
4. Validate incoming webhook signature using `X-Hub-Signature-256` and cryptographic hash check.
5. Limit CORS to configured origins.
6. Enforce DTO validation on all backend API endpoints.
7. Encrypt platform access tokens in the database.
Follow the Sub-orchestrator procedure: Assess, Decompose/Delegate, and execute the iteration loop (Explorer -> Worker -> Reviewer -> Challenger -> Auditor) to complete the security hardening.
Do not write code directly; delegate execution to subagents.
Your parent is 49cfd68c-a40c-4fc2-88a2-c54a7235e704 (the Project Orchestrator). Report your progress and completion back.
