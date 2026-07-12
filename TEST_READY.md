# E2E Test Suite Ready

## Test Runner
- Command: `cd backend && npm run test:e2e -- --runInBand`
- Expected: All tests compile, execute sequentially, and pass with exit code 0 (once the backend endpoints are fully implemented by the development track).

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 60 | Happy-path coverage (5 tests for each of the 12 core features) |
| 2. Boundary & Corner | 60 | Boundary value analysis, input validation, rate limits, CORS rejects, security validations |
| 3. Cross-Feature | 10 | Pairwise interaction testing between core system features (Auth, Rules, Inbox, Webhooks, Broadcasts, Team) |
| 4. Real-World Application | 5 | Multi-step SaaS workflows, high-volume campaigns, support escalation, and compromise recovery scenarios |
| **Total** | **135** | |

## Feature Checklist
| Feature | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---------|:------:|:------:|:------:|:------:|
| Auth & Security | 5 | 5 | ✓ | ✓ |
| Password Reset & Profile | 5 | 5 | ✓ | ✓ |
| Channel Connections | 5 | 5 | ✓ | ✓ |
| Webhook Verification | 5 | 5 | ✓ | ✓ |
| WhatsApp Webhook | 5 | 5 | ✓ | ✓ |
| Comment-to-DM Automation | 5 | 5 | ✓ | ✓ |
| Interactive Inbox | 5 | 5 | ✓ | ✓ |
| Subscriber Management | 5 | 5 | ✓ | ✓ |
| Broadcasting | 5 | 5 | ✓ | ✓ |
| Team Management | 5 | 5 | ✓ | ✓ |
| Dashboard Analytics | 5 | 5 | ✓ | ✓ |
| Health Check & System | 5 | 5 | ✓ | ✓ |

## Test Suite Execution Details
- The test suite executes sequentially (`--runInBand`) using `jest` and `supertest` to prevent SQLite/PostgreSQL transactional locks.
- Database cleanups and seeding of a default enterprise tenant are run before every test case (`beforeEach`) in an isolated test database (automatically generated and pushed).
- Active Prisma schema provider is dynamically parsed from `schema.prisma` at runtime, enabling seamless transition between SQLite and PostgreSQL databases without environment lock-ins.
- External integrations (Facebook Graph API, WhatsApp Cloud API, SMTP/Mail dispatch) are cleanly mocked at the NestJS provider level or mocked in-process.
