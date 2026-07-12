## Challenge Summary

**Overall risk assessment**: MEDIUM

While the backend endpoints for Milestone 4 function correctly under standard happy-path scenarios, several architectural assumptions present risks under high load, scaling, or edge cases. The most notable risks are database query performance and potential data exposure from loose matching rules in conversation history retrieval, and server crash (OOM) on tag aggregation under high volume.

---

## Challenges

### [High] Challenge 1: Data Leak via Ambiguous Matching in Conversation History

- **Assumption challenged**: Assuming that conversation history logs resolved by matching phone, email, or customer name always belong to the querying subscriber.
- **Attack scenario**: A tenant has multiple subscribers with the name "محمد" (Mohamed) or "Alice". When retrieving conversation history via `GET /subscribers/:id/conversation`, the query performs a loose search matching on the name, phone, or email. Since it returns the first record found (`findFirst`), a subscriber may see private conversation logs belonging to another subscriber who happens to share the same name.
- **Blast radius**: High. Exposing private chat histories between team members and customers violates confidentiality and security policies.
- **Mitigation**: Strict identification. Tie conversations directly to the subscriber using a persistent foreign key `subscriberId` rather than searching with loose OR conditions (name, phone, email).

### [High] Challenge 2: Memory Exhaustion (OOM) on Tag Aggregation

- **Assumption challenged**: Assuming that loading all subscribers in memory to extract unique tags is safe and scalable.
- **Attack scenario**: The `GET /subscribers/tags` endpoint retrieves all subscribers (`findMany`) from the database just to extract their tags in memory via a JavaScript `Set`. In a system with 500k+ subscribers, this query will load huge datasets into Node.js heap memory, resulting in CPU spikes and an Out of Memory (OOM) crash.
- **Blast radius**: High. Causes complete backend server downtime (Denial of Service).
- **Mitigation**: Perform the distinct aggregation at the database level. For PostgreSQL, use a raw query or Prisma query to select distinct tags, such as `SELECT DISTINCT unnest(tags) FROM "Subscriber" WHERE "tenantId" = $1`.

### [Medium] Challenge 3: Unbounded Limit in Paginated Subscribers Search

- **Assumption challenged**: Assuming API consumers will always supply reasonable pagination limits.
- **Attack scenario**: A client makes a query like `GET /subscribers?page=1&limit=1000000`. Because there is no upper-bound validation on the `limit` query parameter, the NestJS server attempts to load a million records from the database, leading to high query latency and server resource exhaustion.
- **Blast radius**: Medium. Can be exploited by an attacker or malicious user to degrade API performance (DoS).
- **Mitigation**: Enforce a hard maximum limit on page sizes (e.g., `const parsedLimit = Math.min(limitNum, 100)`).

### [Low] Challenge 4: Concurrency / Race Conditions on Conversation Assignment

- **Assumption challenged**: Assuming that multiple agents will not conflict when assigning conversations.
- **Attack scenario**: Two support agents simultaneously assign a conversation to themselves. Because there is no concurrency control (optimistic/pessimistic lock) or checking of the current assignee status before updating, the second request silently overwrites the first one without alert or verification.
- **Blast radius**: Low. Causes confusion among support staff but does not compromise system integrity.
- **Mitigation**: Implement a check to ensure the conversation status hasn't changed or use optimistic lock versioning.

---

## Stress Test Results

- **Endpoint: GET /subscribers/tags**  
  - *Scenario*: Tenant has 100,000 subscribers, each with 2 tags.  
  - *Expected behavior*: API returns list of unique tags in < 100ms with constant memory usage.  
  - *Predicted behavior*: Memory usage spikes linearly with the number of subscribers; server execution exceeds 1.5s, risking Heap Out of Memory (OOM) under load.  
  - *Result*: **FAIL** (Scalability Bottleneck)

- **Endpoint: GET /subscribers**  
  - *Scenario*: Call API with `limit=1000000` or `page=-5&limit=invalid`.  
  - *Expected behavior*: Negative parameters are rejected or sanitized; limit is capped at a safe default (e.g., 50 or 100).  
  - *Actual behavior*: Negative or non-numeric pagination parameters fallback to unpaginated arrays (which returns ALL subscribers without pagination). Large limits are passed raw to the DB.  
  - *Result*: **FAIL** (Boundary Validation Vulnerability)

- **Endpoint: PATCH /inbox/conversations/:id/assign**  
  - *Scenario*: Assign conversation of Tenant A to a user of Tenant B.  
  - *Expected behavior*: API returns `400 Bad Request` or `404 Not Found` to enforce tenant isolation.  
  - *Actual behavior*: Service validates tenant membership correctly and throws a `BadRequestException` ("المستخدم ليس عضواً في هذا الفريق").  
  - *Result*: **PASS** (Tenant Isolation Validated)

- **Endpoint: GET /subscribers/:id/conversation**  
  - *Scenario*: Request history for subscriber where no conversation matches.  
  - *Expected behavior*: Returns `null` response under HTTP 200.  
  - *Actual behavior*: Correctly returns `null` without crashing.  
  - *Result*: **PASS** (Graceful Null Handling)

---

## Unchallenged Areas

- **Canned Responses (`GET /inbox/canned-responses`)** — Not tested under load due to lack of write paths / read-only nature of the endpoint in early milestone implementations.
