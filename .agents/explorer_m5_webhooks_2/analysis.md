# Analysis Report: WhatsApp Webhook Event Processing & Reliability

## Executive Summary
This report analyzes WhatsApp webhook event processing, signature validation, database schema requirements, and webhook deduplication for the Hubqa platform. Currently, the WhatsApp webhook implementation does not parse media messages or process status updates (messages are hardcoded to `TEXT` and status webhooks are ignored). Furthermore, there is no active deduplication mechanism implemented in the codebase despite database support, and E2E tests pass due to weak assertions (only checking `200 OK`).

---

## 1. WhatsApp Message Parsing (`webhooks.service.ts`)
In `backend/src/webhooks/webhooks.service.ts`, `processWhatsAppMessage` parses incoming payloads. However, there are significant gaps in how text/media messages and status updates are processed:

### Gaps and Vulnerabilities
- **Hardcoded Type**: The code saves every message with `messageType: 'TEXT'`.
- **No Media Support**: When a media payload (e.g., `image`, `video`, `audio`, `document`, `sticker`) is received, `message.text` is undefined, resulting in an empty string (`''`) for `content`.
- **Status Updates Ignored**: Inbound webhooks also deliver status updates (`value.statuses`). The method exits early (`if (!contact || !message) return;`), silently ignoring all status updates (e.g., delivered, read, failed).

### Code Analysis (`webhooks.service.ts` lines 42-65)
```typescript
  private async processWhatsAppMessage(value: any) {
    const contact = value.contacts?.[0];
    const message = value.messages?.[0];
    if (!contact || !message) return; // Exits early on status updates!

    const phoneId = value.metadata?.phone_number_id;
    // ... connection resolution ...

    const waId = contact.wa_id || message.from;
    const name = contact.profile?.name || waId;
    const content = message.text?.body || ''; // Only handles text messages!
```

---

## 2. Signature Validation Logic (`webhooks.controller.ts`)
The signature validation uses `X-Hub-Signature-256` signed with the `APP_SECRET` to verify payloads. 

### Observations
- **Implementation Status**: The logic is correctly implemented using `crypto.timingSafeEqual` and `req.rawBody` (with NestJS configured for `rawBody: true` in `main.ts`).
- **TimingSafeEqual Error Handling**: Because `crypto.timingSafeEqual` throws an error if buffer lengths mismatch, the code wraps the check in a `try-catch` block:
  ```typescript
  let isMatch = false;
  try {
    isMatch = crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'hex'),
      Buffer.from(expectedHash, 'hex'),
    );
  } catch {
    isMatch = false;
  }
  ```
  This is secure, but performing a pre-comparison check on length (e.g., `Buffer.byteLength(signatureHash, 'hex') !== Buffer.byteLength(expectedHash, 'hex')`) would avoid unnecessary exception throwing.

---

## 3. Database Schema Requirements (Prisma)
To fully support WhatsApp webhooks (especially status updates), the Prisma schema (`backend/prisma/schema.prisma`) requires modifications.

### Current Models vs. Needed Fields
| Model | Current Schema | Required Fields / Modifications | Purpose |
|---|---|---|---|
| **Message** | `id`, `conversationId`, `direction`, `content`, `messageType`, `metaData`, `createdAt` | `externalId String? @unique`<br>`status String?`<br>`failureReason String?` | Maps webhook status updates (using `wamid`) to the sent/outbound message. |
| **CampaignRecipient** | `id`, `campaignId`, `customerId`, `customerName`, `status`, `errorMessage`, `sentAt`, `deliveredAt`, `readAt` | `externalMessageId String? @unique` | Links status updates back to specific campaign execution recipients. |
| **Subscriber** | `id`, `tenantId`, `name`, `phone`, `email`, `tags`, `notes`, `createdAt`, `updatedAt` | `@@unique([tenantId, phone])` (optional but recommended) | Avoids duplicate subscriber creation under race conditions. |

---

## 4. Webhook Deduplication Mechanism
A `WebhookDeduplication` table exists in `schema.prisma` but **is not integrated** anywhere in `webhooks.controller.ts` or `webhooks.service.ts`.

### Current Risk
- If Meta retries a webhook (e.g., due to a temporary network timeout or delay in our processing), the system will:
  1. Insert duplicate messages in the database.
  2. Duplicate auto-reply executions (sending multiple messages to the user).
  3. Increment dashboard analytics counters multiple times.

### Proposed Deduplication Strategy
1. **Extract Unique Event ID**:
   - **WhatsApp Incoming Message**: `message.id` (e.g., `wamid.XXX`).
   - **WhatsApp Status Update**: `status.id` (e.g., `wamid.XXX`).
   - **Facebook/Instagram Comment**: `change.value.comment_id`.
   - **Facebook/Instagram Message**: `change.value.message.mid`.
2. **Check & Persist**:
   ```typescript
   const existing = await prisma.webhookDeduplication.findUnique({
     where: { eventId: uniqueEventId }
   });
   if (existing) {
     this.logger.log(`Duplicate event ${uniqueEventId} skipped.`);
     return;
   }
   await prisma.webhookDeduplication.create({
     data: {
       eventId: uniqueEventId,
       platform,
       tenantId: connection?.tenantId,
       expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h TTL
     }
   });
   ```

---

## 5. E2E Test Gaps & Weak Assertions
Both `webhooks.e2e-spec.ts` and `cross-feature.e2e-spec.ts` contain critical verification gaps. They pass successfully because they only assert that the HTTP endpoint returns `200 OK`, without verifying database state or side-effects.

### Gaps in `webhooks.e2e-spec.ts`
1. **WhatsApp Media Event Webhook Test**:
   - **Test**: `should process WhatsApp media event webhook (Tier 1)`
   - **Gap**: Checks only `expect(200)`. In reality, the backend saves the message as a `TEXT` message with an empty content string (`''`). The test fails to assert that the saved message has `messageType: 'IMAGE'` and that its metadata contains the correct media reference.
2. **WhatsApp Status Update Webhook Test**:
   - **Test**: `should process WhatsApp message status update webhook (Tier 1)`
   - **Gap**: Checks only `expect(200)`. Because the code exits early on status updates, **no database update occurs**. The test passes because the endpoint successfully responds with `200 OK` ignoring the payload.
3. **Webhook Deduplication Test**:
   - **Test**: `should verify webhook deduplication of duplicate request ID (Tier 1)`
   - **Gap**: Sends the same payload twice with `x-request-id` and asserts both return `200`. Since there is no deduplication logic, both requests are fully processed as separate events, creating duplicate records in the database. The test fails to verify that the duplicate was actually ignored/deduplicated.

---

## 6. Implementation Strategy (Proposed Snippets)

### A. Improved `processWhatsAppMessage` (Handling Media & Status Updates)
```typescript
  private async processWhatsAppMessage(value: any) {
    // 1. Handle Status Updates
    if (value.statuses && value.statuses.length > 0) {
      for (const statusObj of value.statuses) {
        const messageId = statusObj.id;
        const newStatus = statusObj.status.toUpperCase(); // DELIVERED, READ, FAILED
        const errors = statusObj.errors;

        // Update outbound message
        await this.prisma.message.updateMany({
          where: { externalId: messageId },
          data: {
            status: newStatus,
            metaData: JSON.stringify(statusObj),
          },
        });

        // Update campaign recipient if applicable
        await this.prisma.campaignRecipient.updateMany({
          where: { externalMessageId: messageId },
          data: {
            status: newStatus,
            errorMessage: errors ? JSON.stringify(errors) : null,
            deliveredAt: newStatus === 'DELIVERED' || newStatus === 'READ' ? new Date() : undefined,
            readAt: newStatus === 'READ' ? new Date() : undefined,
          },
        });
      }
      return;
    }

    const contact = value.contacts?.[0];
    const message = value.messages?.[0];
    if (!contact || !message) return;

    // ... resolve platform connection ...

    // 2. Parse Message Type and Media
    const messageType = message.type.toUpperCase(); // TEXT, IMAGE, VIDEO, AUDIO, DOCUMENT, STICKER
    let content = '';
    
    if (messageType === 'TEXT') {
      content = message.text?.body || '';
    } else if (messageType === 'IMAGE') {
      content = message.image?.caption || '';
    } else if (messageType === 'VIDEO') {
      content = message.video?.caption || '';
    } else if (messageType === 'DOCUMENT') {
      content = message.document?.filename || message.document?.caption || '';
    }

    // ... subscriber and conversation creation ...

    // 3. Save Message with external ID and correct type
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content: content,
        messageType: messageType,
        externalId: message.id, // Save wamid
        metaData: JSON.stringify(message),
      },
    });
  }
```

### B. Suggested Deduplication Check in `handleIncomingEvent`
```typescript
  async handleIncomingEvent(body: any) {
    // 1. Extract Unique ID based on platform
    let eventId: string | null = null;
    let platform = '';

    if (body.object === 'page' || body.object === 'instagram') {
      const change = body.entry?.[0]?.changes?.[0];
      if (change?.value) {
        eventId = change.value.comment_id || change.value.message?.mid;
        platform = body.object.toUpperCase();
      }
    } else if (body.object === 'whatsapp_business_account') {
      const change = body.entry?.[0]?.changes?.[0]?.value;
      if (change) {
        eventId = change.messages?.[0]?.id || change.statuses?.[0]?.id;
        platform = 'WHATSAPP';
      }
    }

    // 2. Apply deduplication if unique ID is resolved
    if (eventId) {
      const isDuplicate = await this.prisma.webhookDeduplication.findUnique({
        where: { eventId },
      });
      if (isDuplicate) {
        this.logger.log(`Duplicate event ${eventId} from ${platform} ignored.`);
        return;
      }
      await this.prisma.webhookDeduplication.create({
        data: {
          eventId,
          platform,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours expiration
        },
      });
    }

    // 3. Continue processing...
  }
```
