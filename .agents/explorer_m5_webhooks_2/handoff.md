# Webhooks Priority Engine & Matching Logic Investigation Handoff

## 1. Observation

In investigating the priority engine and rule-matching logic within the NestJS backend, the following direct observations were made:

*   **File Path**: `backend/src/webhooks/webhooks.service.ts`
    *   **Line 145-154**:
        ```typescript
        // Priority Engine: Find best matching rule
        // 1. Exact match with postId + keyword
        // 2. Exact match with postId + no keyword (catch-all for post)
        // 3. Global catch-all + keyword
        // 4. Global catch-all + no keyword

        const rules = await this.prisma.autoReplyRule.findMany({
          where: { isActive: true },
          orderBy: { priority: 'desc' }, // Order by user-defined priority
        });
        ```
    *   **Line 159-175**:
        ```typescript
        for (const rule of rules) {
          // Post validation
          if (rule.postId && rule.postId !== postId) continue;

          // Keyword validation
          if (rule.triggerType === 'KEYWORD') {
            const keywords = rule.keywords.split('،').map((k) => k.trim());
            const hasMatch = keywords.some((kw) => commentText.includes(kw));
            if (hasMatch) {
              matchedRule = rule;
              break; // Found highest priority match
            }
          } else if (rule.triggerType === 'ANY_COMMENT') {
            matchedRule = rule;
            break; // Match any comment
          }
        }
        ```
    *   **Line 137-141**:
        ```typescript
        const senderId = value.from?.id;
        const pageId =
          value.item === 'comment' ? value.post_id.split('_')[0] : null;

        if (!senderId || value.item !== 'comment') return;
        ```
    *   **Line 196-208**:
        ```typescript
        if (rule.replyText || publicMedia.length > 0) {
          this.logger.log(
            `Executing Public Reply: ${rule.replyText} | Media: ${publicMedia.length} items`,
          );
          // Here you would call Facebook Graph API: POST /{comment_id}/comments
        }

        if (rule.privateText || privateMedia.length > 0) {
          this.logger.log(
            `Executing Private DM: ${rule.privateText} | Media: ${privateMedia.length} items`,
          );
          // Here you would call Facebook Graph API: POST /{page_id}/messages
        }
        ```

*   **File Path**: `backend/test/cross-feature.e2e-spec.ts`
    *   **Line 497-556 (Test 127)**: Checks rule execution on comments, and expects `totalAutoReplies` in `dashboard/stats` to match:
        ```typescript
        const expectedReplies = await prisma.message.count({
          where: {
            direction: 'OUTBOUND',
            conversation: { tenantId },
          },
        });
        expect(statsAfterRes.body.totalAutoReplies).toBe(expectedReplies);
        ```

*   **File Path**: `backend/test/webhooks.e2e-spec.ts`
    *   Verifies verify webhook verification token GET requests, signature validation, deduplication check (using Request ID header) on `POST /webhooks`.

---

## 2. Logic Chain

Based on the observations, we deduce the following:

1.  **Instagram Early Exit Bug**:
    *   Line 141 returns early if `value.item !== 'comment'`.
    *   While Facebook webhook comments have `value.item === 'comment'`, Instagram comment payloads do not contain an `item` attribute.
    *   Therefore, Instagram comments will exit early and never match any rules.

2.  **Rule Sorting Priority Bug**:
    *   The Priority Engine doc-block specifies 4 structural tiers:
        1. Exact match with postId + keyword
        2. Exact match with postId + no keyword (catch-all for post)
        3. Global catch-all + keyword
        4. Global catch-all + no keyword
    *   The database query orders rules ONLY by `priority` (user-defined integer).
    *   Inside the loop, the first rule that meets the criteria is chosen via `break`.
    *   If a global catch-all rule (Tier 4) has `priority = 100` and a specific post keyword-matching rule (Tier 1) has `priority = 0`, the loop will select the global catch-all rule first and exit. This breaks the specificity hierarchy.

3.  **Missing Database States**:
    *   `executeRule` logs text but performs no database writes for the conversation thread, inbound comment message, outbound public reply message, or private DM message.
    *   Test 127 expects the total auto-reply metrics count to increment based on `OUTBOUND` messages in the database.
    *   Test 122 expects a new conversation to be registered in the inbox after triggering the rule.
    *   Without writing these database records, tests 122, 127, 131, 133, and 135 will fail or exhibit side-effects unless these writes are fully implemented.

---

## 3. Caveats

*   This investigation did not execute external Meta Graph API calls since E2E testing relies on mock objects.
*   We assume the Meta webhook payload structure for Instagram comments follows standard Graph API documentation (e.g. change field `comments` containing comment text directly).

---

## 4. Conclusion

A successful strategy must implement a **Specificity-First** rule sorting algorithm and persist all inbound and outbound messages to database models.

### Proposed Mapping Strategy
1.  **Instagram Payload Guard**: Update the early exit to check platform. Only enforce `value.item === 'comment'` if `platform === 'page'`.
2.  **Determine Page Connection**: Query the active `PlatformConnection` matching the incoming page/media ID to extract the connection and tenant ID.
3.  **Specificity Sorting**:
    *   Retrieve all active rules for the connection's tenant.
    *   Calculate matching rank:
        *   Rank 4: Specific Post + Keyword Match
        *   Rank 3: Specific Post + Catch-All (`ANY_COMMENT`)
        *   Rank 2: Global Rule + Keyword Match
        *   Rank 1: Global Rule + Catch-All
    *   Sort rules by Rank descending, then by user-defined `priority` descending, then by `createdAt` ascending.
4.  **Database Persistence**:
    *   Find/create the `Conversation` for the `connectionId` and `senderId`.
    *   Save the inbound comment as a `Message` with `direction: 'INBOUND'`.
    *   If a rule matches, save the public reply and/or private DM as a `Message` with `direction: 'OUTBOUND'`.
    *   Create an `AuditLog` entry with `action: 'RULE_TRIGGERED'` and `entityId: rule.id`.

---

## 5. Verification Method

To independently verify this strategy under Jest E2E tests:

1.  **Test Command**:
    *   Run tests sequentially using `--runInBand` to avoid SQLite write lock timeouts (`P1008` error):
        ```bash
        npx jest --config test/jest-e2e.json test/webhooks.e2e-spec.ts --runInBand
        ```
2.  **Add a Specificity Priority Test Case**:
    *   Create a test case in `test/webhooks.e2e-spec.ts` that seeds three rules:
        *   Rule 1 (Global Catch-All, Priority 100)
        *   Rule 2 (Specific Post Catch-All, Priority 50)
        *   Rule 3 (Specific Post + Keyword, Priority 0)
    *   Send a webhook comment that matches Rule 3's keyword and Post ID.
    *   Assert that Rule 3 is executed (by checking database messages or auditing logs) instead of the higher priority Rule 1 or Rule 2.
3.  **Inspect Logs & DB State**:
    *   Verify that `prisma.message.count` has increased by the number of outbound messages matching the rule's reply texts.
