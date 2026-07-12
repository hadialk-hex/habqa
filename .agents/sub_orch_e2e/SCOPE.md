# Scope: E2E Test Suite Development

## Architecture
- **E2E Test Runner**: Jest + Supertest (running inside NestJS backend context or hitting a running server)
- **Mock Interfaces**: In-memory mocks or dynamic endpoints simulating Facebook Graph API, WhatsApp Cloud API, and SMTP/Email.
- **Test Categories**: Tier 1 (Feature Coverage), Tier 2 (Boundary & Corner Cases), Tier 3 (Cross-Feature Combinations), Tier 4 (Real-World Application Scenarios).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Test Architecture & Infra | Create test suite setup, mocking framework for Facebook Graph API / WhatsApp API / SMTP, and write `TEST_INFRA.md`. | None | PLANNED |
| 2 | Tier 1 Implementation | Write happy-path feature coverage tests (50+ tests covering Auth, Rules, Channels, Webhooks, Inbox, Subscribers, Broadcasts, Team, Analytics, Health/Rate Limit). | M1 | PLANNED |
| 3 | Tier 2 Implementation | Write boundary & corner cases (50+ tests covering security rules, invalid tokens, validation DTOs, signature failures, rate limiting blocks). | M2 | PLANNED |
| 4 | Tier 3 & 4 Implementation | Write cross-feature combinations (10+ tests) and real-world application scenarios (5+ tests). | M3 | PLANNED |
| 5 | Execution & TEST_READY.md | Run full test suite, verify execution against the backend (mocked out external dependencies), and write `TEST_READY.md`. | M4 | PLANNED |

## Interface Contracts
- **Test Environment Config**: Environment variables like `DATABASE_URL`, `JWT_SECRET`, `FB_APP_SECRET`, `SMTP_HOST`, etc.
- **Mock Graph API**: Mocks for `graph.facebook.com` calls (e.g. comment-to-DM calls).
