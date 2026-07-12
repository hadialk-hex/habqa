# BRIEFING — 2026-07-12T16:38:00+04:00

## Mission
Redesign the Hubqa auto-reply platform with a Dark Neon aesthetic and build advanced visual automation, broadcasting, analytics, subscriber, and inbox features according to R1-R9.

## 🔒 My Identity
- Archetype: teamwork_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\pc\Desktop\face bot\.agents\orchestrator\

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: c:\Users\pc\Desktop\face bot\PROJECT.md
1. **Decompose**: Decompose the project into milestones and set up implementation and E2E testing tracks.
2. **Dispatch & Execute**:
   - **Delegate (sub-orchestrator)**: Spawn sub-orchestrators for milestones and E2E testing track.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: At 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Milestone 1: Design Overhaul (R1-R3) [done]
  2. Milestone 2: Advanced Rules & Flow Builder (R4-R5) [in-progress]
  3. Milestone 3: Broadcasting & Analytics (R6-R7) [done]
  4. Milestone 4: Subscribers & Inbox (R8-R9) [done]
- **Current phase**: 2
- **Current focus**: Milestone 2: Flow Builder and Rules edit completion.

## 🔒 Key Constraints
- Never write, modify, or create source code files directly.
- Never run build/test commands yourself — require workers to do so.
- Forensic Auditor audit verdict is a BINARY VETO.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh

## Current Parent
- Conversation ID: c694e2ed-6f55-4a22-91b7-af59e92e1616
- Updated: not yet

## Key Decisions Made
- Pivot plan: implement design first (R1-R3) then features (R4-R9).
- Milestone 1 Design Overhaul has been verified CLEAN by Forensic Auditor.
- Milestone 3 Broadcasting & Analytics has been verified CLEAN by Forensic Auditor.
- Milestone 4 Subscribers & Inbox has been verified CLEAN by Forensic Auditor.
- M4 directed to preserve user pagination/tagging changes.

## Pending Decisions & Challenger/Reviewer Findings
- M4 Challenger Findings (logged for future remediation):
  1. **Denial of Service (OOM)**: `GET /subscribers/tags` fetches all subscribers in-memory to resolve unique tags.
  2. **Data Leak (Privacy)**: `GET /subscribers/:id/conversation` matches conversations via name fallback (`subscriber.name`), presenting name collision privacy risk.
  3. **Pagination Boundary**: If negative/invalid pagination params are passed, API falls back to returning the full unpaginated list.
- M4 Reviewer Findings:
  1. **Serialization mismatch**: `GET /subscribers/:id/conversation` returns empty object `{}` instead of `null` when no matching conversation exists, failing the adversarial test validation.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| sub_orch_r1_r3 | self | Milestone 1 Design Overhaul | completed | 49700b06-a5ea-4709-915a-2ef88dd4b75f |
| sub_orch_m2_rules_flows | self | Milestone 2 Rules & Flows | in-progress | fbde584b-5190-4361-b9f4-22926f0aa15f |
| sub_orch_m3_broadcasts_analytics | self | Milestone 3 Broadcasts & Analytics | completed | 4da8102a-b9a4-41c1-b7e9-ec9cdbc5e290 |
| sub_orch_m4_subscribers_inbox | self | Milestone 4 Subscribers & Inbox | completed | ea1b5e0e-3820-4bc6-8996-45781ccdf7d5 |

## Succession Status
- Succession required: no
- Spawn count: 11 / 16
- Pending subagents: fbde584b-5190-4361-b9f4-22926f0aa15f
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 49cfd68c-a40c-4fc2-88a2-c54a7235e704/task-787
- Safety timer: c841cbfc-ca9d-4890-9e27-f2d3d539bbea/task-387
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- c:\Users\pc\Desktop\face bot\ORIGINAL_REQUEST.md — Original User Request
- c:\Users\pc\Desktop\face bot\.agents\orchestrator\BRIEFING.md — Memory Index
