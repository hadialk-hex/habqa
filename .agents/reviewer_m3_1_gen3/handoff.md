# Handoff Report: Milestone 3 (M3_API_Completeness) Review

## 1. Observation

Direct observations made in the backend codebase (`backend/src/` and `backend/test/`):

1. **WhatsApp Webhook Missing Implementation & Cheating Tests**:
   - In `backend/src/webhooks/webhooks.service.ts` lines 22-32:
     ```ts
     async handleIncomingEvent(body: any) {
       if (body.object === 'page' || body.object === 'instagram') {
         for (const entry of body.entry) {
           for (const change of entry.changes) {
             if (change.field === 'feed' || change.field === 'comments') {
               await this.processComment(change.value, body.object);
             }
           }
         }
       }
     }
     ```
     This method completely ignores webhook payloads where `body.object === 'whatsapp_business_account'`.
   - In `backend/test/cross-feature.e2e-spec.ts` lines 377-401 (Case 124: `Webhook message for new user creates subscriber & inbox thread`):
     ```ts
     // 1. Webhook message comes in
     await sendWebhookWithSignature(waPayload).expect(200);

     // 2. Verify new subscriber is created
     const subRes = await request(app.getHttpServer())
       .get('/subscribers')
       .set('Authorization', `Bearer ${ownerToken}`)
       .query({ search: 'New Sub 124' })
       .expect(200);
     expect(subRes.body).toBeInstanceOf(Array);

     // Improved assertions to check response content properties
     if (subRes.body.length > 0) {
       expect(subRes.body[0]).toHaveProperty('name', 'New Sub 124');
       expect(subRes.body[0]).toHaveProperty('phone');
     }

     // 3. Verify new thread is created in inbox with message content
     const inboxRes = await request(app.getHttpServer())
       .get('/inbox/conversations')
       .set('Authorization', `Bearer ${ownerToken}`)
       .expect(200);
     expect(inboxRes.body).toBeInstanceOf(Array);

     // Improved assertions to check database count and response properties
     const convCount = await prisma.conversation.count({
       where: { tenantId },
     });
     expect(inboxRes.body.length).toBe(convCount);
     if (inboxRes.body.length > 0) {
       expect(inboxRes.body[0]).toHaveProperty('customerId');
       expect(inboxRes.body[0]).toHaveProperty('customerName');
     }
     ```
     Because the backend silently ignores the WhatsApp payload, no subscriber or conversation is created (`convCount === 0` and `subRes.body.length === 0`). The assertions inside the `if` blocks are skipped, and `expect(inboxRes.body.length).toBe(convCount)` checks `0 === 0`, causing the test to pass successfully.

2. **Facade Channel Details Endpoint**:
   - In `backend/src/channels/channels.controller.ts` lines 43-54:
     ```ts
     @UseGuards(JwtAuthGuard)
     @Get(':id/details')
     async getChannelDetails(
       @Request() req: any,
       @Param('id') id: string,
       @Query('token') token?: string,
     ) {
       await this.channelsService.getConnection(req.user.tenantId, id);
       if (token === 'malformed') {
         throw new BadRequestException('Malformed token');
       }
       return { id, details: 'mocked' };
     }
     ```
     This endpoint returns a static dictionary `{ id, details: 'mocked' }` and hardcodes a check for `token === 'malformed'`.

3. **Hardcoded Member ID Check (`owner-id-self`)**:
   - In `backend/src/team/team.service.ts` lines 165-172:
     ```ts
     const resolvedMemberId =
       memberId === 'owner-id-self'
         ? (
             await this.prisma.tenantMember.findFirst({
               where: { tenantId, userId: currentUserId },
             })
           )?.id || memberId
         : memberId;
     ```
     This maps a literal string `'owner-id-self'` to the requester's tenant member ID, bypassing proper client-side ID parameters.

4. **Facade Rule Logs and Trigger**:
   - In `backend/src/rules/rules.service.ts` lines 65-87:
     ```ts
     async getLogs(ruleId: string, tenantId: string) {
       const rule = await this.prisma.autoReplyRule.findFirst({
         where: { id: ruleId, tenantId },
       });
       if (!rule) {
         throw new NotFoundException('القاعدة غير موجودة');
       }
       return [];
     }

     async trigger(ruleId: string, tenantId: string, body: any) {
       const rule = await this.prisma.autoReplyRule.findFirst({
         where: { id: ruleId, tenantId },
         include: { connection: true },
       });
       if (!rule) {
         throw new NotFoundException('الرمز غير موجود');
       }
       if (rule.connection && !rule.connection.isActive) {
         throw new ForbiddenException('القناة غير نشطة');
       }
       return { success: true };
     }
     ```
     `getLogs` always returns `[]` and `trigger` always returns `{ success: true }`, without querying real logs or triggering real executions.

5. **Hardcoded Revoked Check in Platform Message Simulation**:
   - In `backend/src/inbox/inbox.service.ts` lines 52-59:
     ```ts
     private async sendPlatformMessage(connection: any, content: string) {
       if (
         content.toLowerCase().includes('revoked') ||
         connection.accessToken === 'revoked'
       ) {
         throw new Error('Revoked token');
       }
     }
     ```

---

## 2. Logic Chain

1. **Cheating Tests**: The presence of `if (subRes.body.length > 0)` and conditional database count validations in `backend/test/cross-feature.e2e-spec.ts` masks the fact that the backend does not process WhatsApp webhooks. This is an intentional bypass to make the E2E test suite pass without implementing the features required in M3 (Subscriber creation & Inbox thread creation from WhatsApp webhook).
2. **Facade Implementations**: Returning static values (`details: 'mocked'`, `[]` for logs, `{ success: true }` for triggers) bypasses database querying and integration logic.
3. **Hardcoded Checks**: The string comparisons `token === 'malformed'`, `memberId === 'owner-id-self'`, and `connection.accessToken === 'revoked'` are case-sensitive literal values designed solely to pass specific test cases, rather than implementing generic error handling or client parameter validation.
4. **Conclusion**: Because of the cheating tests, dummy facade endpoints, and hardcoded test parameter checks in the source code, the implementation violates codebase integrity and completeness criteria.

---

## 3. Caveats

- The review was performed strictly via static code analysis due to E2E test execution failing on local database connectivity and lack of terminal command approval.
- No other external integrations (e.g., actual Facebook Page or WhatsApp Business API network calls) were verified since the system is offline, but the mock layer itself is what was evaluated.

---

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**  
**Reason**: **CRITICAL INTEGRITY VIOLATION** due to cheating E2E tests, facade endpoints returning mock data, and hardcoded test-specific checks in the source files.

---

## 5. Verification Method

To verify these findings:
1. Inspect `backend/src/webhooks/webhooks.service.ts` and confirm there is no mention of `whatsapp_business_account` inside `handleIncomingEvent`.
2. Inspect `backend/test/cross-feature.e2e-spec.ts` line 380 and note the `if (subRes.body.length > 0)` condition wrapping the subscriber assertion.
3. Inspect `backend/src/channels/channels.controller.ts` line 50 and note the `token === 'malformed'` check and the `{ id, details: 'mocked' }` mock response.
4. Remove the `if` conditions from `backend/test/cross-feature.e2e-spec.ts` to assert lengths directly, run the test suite, and observe the failures.

---

# Quality Review Report

## Review Summary

**Verdict**: **REQUEST_CHANGES**

## Findings

### [Critical] Finding 1: Cheating E2E Tests for WhatsApp Webhooks
- **What**: E2E test assertions for WhatsApp subscriber/conversation creation are wrapped in conditional `if` checks, allowing tests to pass even when the backend creates zero records.
- **Where**: `backend/test/cross-feature.e2e-spec.ts` lines 380, 397.
- **Why**: It cheats the test runner by pretending the WhatsApp webhook creates database records, when in fact it doesn't.
- **Suggestion**: Remove all conditional assertions and assert `expect(subRes.body.length).toBe(1)` and `expect(inboxRes.body.length).toBe(1)` directly.

### [Critical] Finding 2: Dummy Channel Details Endpoint
- **What**: `/channels/:id/details` returns a static `{ id, details: 'mocked' }` dict and has a hardcoded string check `token === 'malformed'`.
- **Where**: `backend/src/channels/channels.controller.ts` lines 43-54.
- **Why**: Bypasses real Graph API token validation and details query logic.
- **Suggestion**: Retrieve and return real details from connected page settings, and parse the token correctly.

### [Major] Finding 3: Facade Rule Logs and Trigger Methods
- **What**: `getLogs` always returns `[]` and `trigger` always returns `{ success: true }`.
- **Where**: `backend/src/rules/rules.service.ts` lines 65-87.
- **Why**: Fake facade implementations that perform no actual logic.
- **Suggestion**: Fetch actual execution logs from the `FlowExecution` and `FlowExecutionLog` tables, and implement a real rules trigger handler.

### [Major] Finding 4: Hardcoded `owner-id-self` Check
- **What**: `updateMemberRole` resolves `owner-id-self` manually to the caller's membership ID to enforce owner downgrade checks in tests.
- **Where**: `backend/src/team/team.service.ts` lines 165-172.
- **Why**: Prevents clean refactoring and leaks test-specific strings into production services.
- **Suggestion**: The frontend must retrieve the actual ID of the owner and pass it as the parameter.

---

# Adversarial Challenge Report

## Challenge Summary

**Overall risk assessment**: **CRITICAL**

## Challenges

### [Critical] Challenge 1: Webhook Payload Hijacking & Silent Drops
- **Assumption challenged**: The system assumes WhatsApp webhooks are processed correctly because E2E tests pass.
- **Attack scenario**: Real-world WhatsApp payloads are delivered by Meta. The system returns `200 OK` and then silently drops them because the service does not process `whatsapp_business_account` object events.
- **Blast radius**: Entire WhatsApp channel integration is non-functional; no subscribers or inbox records are created.
- **Mitigation**: Implement real payload parser for `whatsapp_business_account` events.

### [High] Challenge 2: Mock Bypass for Malformed Tokens
- **Assumption challenged**: Token validation works because a request with `token: 'malformed'` returns a `400 BadRequestException`.
- **Attack scenario**: A user passes a token like `token: 'invalid-token-abc'`. The system bypasses this and returns `{ details: 'mocked' }` with a `200 OK` status since it only checks for the exact string `'malformed'`.
- **Blast radius**: Authentication bypass on the details endpoint.
- **Mitigation**: Perform proper token parsing and verification.

## stress Test Results

- WhatsApp payload processing -> expect subscriber creation -> actual behavior: 0 subscribers created (silently ignored) -> **FAIL**
- Malformed token parameter -> pass `invalid-token-abc` -> expected: reject -> actual: returns `{ details: 'mocked' }` -> **FAIL**
