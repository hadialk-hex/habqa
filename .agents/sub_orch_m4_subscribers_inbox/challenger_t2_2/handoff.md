# Handoff Report: Milestone 4 Subscribers & Inbox Upgrade Challenger

## 1. Observation
During the adversarial verification of Tasks 1 to 5 for Milestone 4, I analyzed the backend implementation and tests and observed the following:

1. **Deadlock in E2E Tests**: When running tests concurrently or while database locks exist, postgres throws the following deadlock exception:
   ```
   ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "40P01", message: "deadlock detected", severity: "ERROR", detail: Some("Process 9882 waits for RowExclusiveLock on relation 33756 of database 32769; blocked by process 9874.\nProcess 9874 waits for AccessExclusiveLock on relation 33710 of database 32769; blocked by process 9882."), column: None, hint: Some("See server log for query details.") }), transient: false })
   ```
2. **In-Memory Tag Loading**: In `backend/src/subscribers/subscribers.service.ts` (lines 124-134), the `findUniqueTags` method retrieves all subscribers of a tenant into memory:
   ```typescript
   async findUniqueTags(tenantId: string) {
     const subscribers = await this.prisma.subscriber.findMany({
       where: { tenantId },
       select: { tags: true },
     });
     const tagsSet = new Set<string>();
     subscribers.forEach((sub) => {
       sub.tags.forEach((tag) => tagsSet.add(tag));
     });
     return Array.from(tagsSet);
   }
   ```
3. **Ambiguous Conversation Resolution**: In `backend/src/subscribers/subscribers.service.ts` (lines 169-191), `getConversationHistory` uses a loose `OR` matching strategy that includes matching on the subscriber's name:
   ```typescript
   if (subscriber.name) {
     conditions.push({ customerName: subscriber.name });
   }
   const conversation = await this.prisma.conversation.findFirst({
     where: {
       tenantId,
       OR: conditions,
     },
   });
   ```
4. **Pagination Fallback Logic**: In `backend/src/subscribers/subscribers.controller.ts` (lines 39-42), validation blocks negative page/limit, but if page or limit is evaluated as falsy (such as negative or non-numeric values), they resolve to `undefined`. In the service, this makes pagination check `page !== undefined && limit !== undefined` fail, falling back to query and return all subscribers in an unpaginated array.

---

## 2. Logic Chain
1. **Deadlock**: Concurrent Jest execution on the same database container results in parallel table lock requests (e.g. `TRUNCATE` which gets an `AccessExclusiveLock` and `CREATE` which gets a `RowExclusiveLock`), causing transaction blockages and PostgreSQL deadlocks.
2. **OOM Vulnerability**: Because `findUniqueTags` does not aggregate tags at the database level, fetching a massive number of subscriber rows into the Node.js memory heap creates high CPU load and leads directly to Out of Memory (OOM) crashes under high scaling (e.g. 500k+ subscribers).
3. **Data Leak Vulnerability**: By matching conversations via name fallback (`customerName: subscriber.name`) in `getConversationHistory`, any subscriber that shares a common name with another will match the first conversation in that tenant, resulting in cross-subscriber private data exposure.
4. **API Limit Vulnerability**: Lacking an upper-bound check in paginated subscriber searches means client requests with large limit parameters (e.g. `limit=1000000`) will bypass safety defaults and trigger massive database scans.

---

## 3. Caveats
- Concurrency testing was simulated via analyzing SQL locks and transaction logs rather than running heavy automated concurrent load testing, due to network/tool environment constraints (user approval timeout).
- Verification assumed the database provider is PostgreSQL (production default) or SQLite (testing fallback).

---

## 4. Conclusion
The backend implementation for Milestone 4 is functional for happy paths but has significant scalability and security flaws:
1. **GET /subscribers/tags** presents a Denial of Service (OOM) threat.
2. **GET /subscribers/:id/conversation** presents a customer data isolation/privacy breach risk due to name collisions.
3. **GET /subscribers** has a pagination boundary logic vulnerability where invalid params cause a fallback that returns the full subscriber list.

---

## 5. Verification Method
1. **Adversarial Spec File**: Run the newly added adversarial test suite to verify boundary edge cases and tenant isolation:
   ```bash
   cd backend
   npm run test:e2e -- test/milestone4-adversarial.e2e-spec.ts --runInBand
   ```
2. **Inspect Spec Results**: Review the `challenge.md` report located in the challenger directory:
   `c:\Users\pc\Desktop\face bot\.agents\sub_orch_m4_subscribers_inbox\challenger_t2_2\challenge.md`
