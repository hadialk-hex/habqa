## 2026-07-11T10:24:55Z
You are the fresh Backend API Worker (worker_6) for Milestone 3 (M3_API_Completeness) of Hubqa.
Your working directory is: c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen6\. Please create this directory if it doesn't exist.
Write your progress updates to c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen6\progress.md and your final handoff report to c:\Users\pc\Desktop\face bot\.agents\worker_m3_gen6\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your objective is to fix the final subscriber tags arrays and team invitation endpoints according to the Victory Auditor requirements.

Tasks to perform:
1. Update `backend/prisma/schema.prisma`:
   - Change `provider` in `datasource db` from `"sqlite"` to `"postgresql"`.
   - Update `tags` in `Subscriber` model to `String[]` (native string array for PostgreSQL).
   - Generate the Prisma Client using `npx prisma generate` (or direct CLI command).
   - Update `backend/test/setup.ts`: Since the provider is now `postgresql`, ensure the E2E setup correctly runs against PostgreSQL without crashing or falling back to sqlite. Look at lines 15-58 of `backend/test/setup.ts` and ensure it handles PostgreSQL database URL correctly.
2. Refactor `backend/src/subscribers/subscribers.service.ts`:
   - Update `create` and `update` methods to store tags directly as native `String[]` arrays instead of JSON-stringifying them.
   - Update the search filter in `findAll` to search using PostgreSQL's array operator: `{ tags: { has: search } }` instead of `{ tags: { contains: search } }`.
   - Eliminate any JSON.parse or string conversion facades for tags when returning subscribers.
3. Refactor `backend/src/team/team.service.ts`:
   - In `inviteMember`, update the validation. Currently, it checks if a user is a member of this tenant. You must also check if the user exists *globally* in the system (`prisma.user.findUnique` by email), and if they are a registered user in the platform, or have an active platform-wide invitation, throw a `ConflictException` (409) or `BadRequestException` (400) to satisfy the test expectations.
4. Verify Build and Run Tests:
   - Run `npm run build` and verify compilation succeeds.
   - Run `npm run test:e2e` to verify all 15 test suites pass cleanly.
   - Provide a detailed handoff report when done.
