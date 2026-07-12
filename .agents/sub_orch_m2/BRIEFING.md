# BRIEFING — 2026-07-09T16:34:22+04:00

## Mission
Migrate the Hubqa project database from SQLite to PostgreSQL including schema design, index addition, extra model definition, and migration validation.

## 🔒 My Identity
- Archetype: Sub-orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\pc\Desktop\face bot\.agents\sub_orch_m2\
- Original parent: main agent
- Original parent conversation ID: 49cfd68c-a40c-4fc2-88a2-c54a7235e704

## 🔒 My Workflow
- **Pattern**: Project (Milestone level)
- **Scope document**: c:\Users\pc\Desktop\face bot\.agents\sub_orch_m2\SCOPE.md
1. **Decompose**: Decompose Milestone 2 into discrete phases/tasks that can be analyzed and implemented.
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: For our milestone, we run a direct loop of Explorer -> Worker -> Reviewer -> Challenger -> Auditor.
3. **On failure**:
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (last resort)
4. **Succession**: Self-succeed at 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Setup local PostgreSQL container and testing harness [done]
  2. Analyze database schema and design migration plan [done]
  3. Implement PostgreSQL schema migration (schema.prisma, indexes, new models) [done]
  4. Implement database seeding logic [done]
  5. Run migrations, validate, and verify client generation [done]
- **Current phase**: 4
- **Current focus**: Milestone Complete Handoff

## 🔒 Key Constraints
- Migrate SQLite to PostgreSQL using provider = "postgresql".
- Use native PG features (real enums, JSON columns).
- Add @@index on tenantId, platformId, triggerType, isActive, etc.
- Support broadcasts/campaigns, audit logging, webhook deduplication, password reset tokens, team roles, flow automation.
- Set up seeding logic.
- Create local PG container/script to run/test migrations and verify `npx prisma validate`.
- Follow sub-orchestrator procedure (Assess -> Decompose/Delegate -> Iteration Loop).
- Do not write code directly; delegate execution to subagents.
- Never reuse a subagent after it has delivered its handoff.

## Current Parent
- Conversation ID: 49cfd68c-a40c-4fc2-88a2-c54a7235e704
- Updated: not yet

## Key Decisions Made
- [TBD]

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_m2_1 | teamwork_preview_explorer | Probe local environment & Docker | completed | 19304dc3-8032-4830-86ea-4fa79ddf0869 |
| explorer_m2_2 | teamwork_preview_explorer | Design schema conversion | completed | 5341ebac-4460-4fe7-8406-1b260f8c3eaf |
| explorer_m2_3 | teamwork_preview_explorer | Design schema extensions and seeding | completed | 7dbe9cfc-5810-4f62-ad69-695502c53fae |
| worker_m2 | teamwork_preview_worker | Implement database migration & environment | completed | c76fb51e-15ed-4376-b0f9-0214bcc24532 |
| worker_m2_reopen | teamwork_preview_worker | Enforce PostgreSQL schema & enums | completed | 326cbf28-3597-4845-9a5b-7147d7b71dc4 |

## Succession Status
- Succession required: no
- Spawn count: 5 / 16
- Pending subagents: none
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: task-194
- Safety timer: none

## Artifact Index
- c:\Users\pc\Desktop\face bot\.agents\sub_orch_m2\ORIGINAL_REQUEST.md — Original user request
- c:\Users\pc\Desktop\face bot\.agents\sub_orch_m2\BRIEFING.md — Current briefing
