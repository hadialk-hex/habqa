# Backend Mocking Strategy Analysis for E2E Testing

## 1. Executive Summary
This document analyzes the current state of the backend modules (`webhooks`, `rules`, `inbox`) in the Hubqa project with respect to their interactions with Meta APIs (Facebook Graph API and WhatsApp Cloud API). It evaluates three external API mocking strategies for E2E tests: **NestJS Provider Overrides**, **Jest module mocks**, and a **Separate local mock HTTP server**. 

We recommend a **NestJS Provider Override** strategy as the primary architecture for E2E tests, combined with defining clean interface contracts for communication. Additionally, we provide exact mock payloads for incoming webhook events and outgoing responses to guide the E2E implementation.

---

## 2. Current Module Analysis
An investigation of the NestJS backend codebase (`backend/src`) reveals the following current state of interactions with Meta APIs:

### 2.1 Webhooks Module (`webhooks/`)
* **Verification (GET `/webhooks`)**:
  * Verifies verification tokens sent by Meta during subscription setup.
  * Validates query parameters: `hub.mode === 'subscribe'` and `hub.verify_token === 'hubqa_secure_verify_token_2026'`.
  * Returns the `hub.challenge` string on success, or throws an error (403 Forbidden).
* **Incoming Events (POST `/webhooks`)**:
  * Currently handles page (Facebook) and Instagram objects (`body.object === 'page'` or `'instagram'`).
  * Iterates through `entry` and `changes` to find comments (`change.field === 'feed'` or `'comments'`).
  * Extracts metadata: `postId`, `commentText`, `senderId`, `pageId`.
* **Rule Execution & Priority Engine**:
  * Retrieves active rules (`PrismaService.autoReplyRule`) sorted by priority.
  * Searches for a matching rule (exact `postId` match + keyword, or global match + keyword, or catch-all).
  * Executes the rule:
    * **Public reply**: Currently contains only a logger stub (`// Here you would call Facebook Graph API: POST /{comment_id}/comments`).
    * **Private DM**: Currently contains only a logger stub (`// Here you would call Facebook Graph API: POST /{page_id}/messages` or `/me/messages`).
* **WhatsApp Cloud API Integration**:
  * WhatsApp integration is currently *not implemented*. There is no controller route for `/webhooks/whatsapp` or handling of `object === 'whatsapp_business_account'`. When implemented, it will require receiving inbound messages and making outbound POST requests to `https://graph.facebook.com/v19.0/{phone-number-id}/messages`.

### 2.2 Rules Module (`rules/`)
* Contains standard CRUD operations for configuration in the database (`AutoReplyRule` table).
* Does not make external HTTP calls directly, but rules configured here drive the matching logic inside the `webhooks` module.

### 2.3 Inbox Module (`inbox/`)
* Serves REST endpoints to retrieve conversations and messages.
* When inbound events are received or outbound automatic/manual replies are dispatched, messages are logged with a `direction` (`INBOUND` / `OUTBOUND`) and `messageType` (`TEXT` / `IMAGE` / `COMMENT`) in the database.
* Manual outbound replies (sent by human agents via the chat UI) will require outgoing HTTP requests to the Facebook Graph API or WhatsApp Cloud API in the future.

---

## 3. Evaluation of Mocking Strategies
During E2E testing, making actual HTTP requests to the Facebook Graph API or WhatsApp Cloud API is impossible and undesirable (leads to flaky tests, requires credentials, incurs rate limits, and breaks in offline/CI environments). Here is an evaluation of the three mocking approaches:

### 3.1 Option 1: NestJS Provider Overrides (Recommended)
* **How it works**: Define a dedicated client provider interface (e.g. `MetaClientService` or separate `FacebookClientService` / `WhatsAppClientService`). During E2E tests using `@nestjs/testing`, override the real client with a mock object using:
  ```typescript
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(FacebookClientService)
    .useValue(mockFacebookClient)
    .compile();
  ```
* **Pros**:
  * Native to NestJS testing utilities.
  * Fast, in-memory mock resolution (no network overhead).
  * Simple and robust assertions using Jest spies (e.g. `expect(mockFacebookClient.sendCommentReply).toHaveBeenCalledWith(...)`).
  * Easily simulates specific failures (e.g. invalid tokens, rate limit exceptions) on a per-test basis.
* **Cons**:
  * Does not test the raw HTTP serialization (headers, URL construction) of the outgoing API calls.

### 3.2 Option 2: Jest Module Mocks / Interceptors (e.g., `msw` or `nock`)
* **How it works**: Use a library like Mock Service Worker (MSW) or Nock to intercept HTTP requests made to `https://graph.facebook.com` in-process.
* **Pros**:
  * Asserts the exact HTTP level details (headers, URL parameters, payloads).
  * Does not require changing NestJS provider registrations.
* **Cons**:
  * Native `fetch` mocking in Node.js 18+ can be brittle and complex to configure compared to standard Axios mocking.
  * Hiding network logic behind library-specific interceptors adds test boilerplate.

### 3.3 Option 3: Separate Local Mock HTTP Server
* **How it works**: Run a separate lightweight HTTP server (e.g. Express or WireMock) on a local port (e.g. `http://localhost:4000`) and configure the backend's base URL environment variables to point to it.
* **Pros**:
  * Completely decoupled from the application context.
  * Tests the entire network stack (timeouts, actual HTTP connection).
* **Cons**:
  * Port conflicts during parallel test execution.
  * Complex lifecycle management (starting and stopping the process).
  * Hard to dynamically adjust mock behaviors *per test case* without exposing an administrative mock endpoint.

---

## 4. Proposed Testing Strategy & Architecture
We propose a **hybrid strategy** centered around **NestJS Provider Overrides** as the primary strategy for its speed, simplicity, and ease of assertion.

### 4.1 Recommended Architecture Steps
1. **Define Client Providers**: Create dedicated services for Meta API communication rather than writing inline `fetch` or `axios` calls in the business logic:
   * `FacebookClientService`: Handles `sendCommentReply(commentId, text, media)` and `sendPrivateMessage(recipientId, text, media)`.
   * `WhatsAppClientService`: Handles `sendWhatsAppMessage(toPhoneNumber, text)`.
2. **Inject in Business Logic**: Inject these services into the `WebhooksService` and `InboxService`.
3. **Mock in E2E Tests**: Use NestJS testing module overrides to swap them with Mock instances that capture parameters and allow assertion.
4. **Use Supertest for Inbound Webhooks**: Use Supertest to fire mock Meta payloads into `POST /webhooks` and assert that the correct client method was called.

### 4.2 Code-Level E2E Mocking Example
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FacebookClientService } from '../src/webhooks/facebook-client.service';

describe('Webhooks E2E - Auto Reply Flow', () => {
  let app: INestApplication;
  
  // Create a mock client
  const mockFacebookClient = {
    sendCommentReply: jest.fn().mockResolvedValue({ id: 'mock_reply_id' }),
    sendPrivateMessage: jest.fn().mockResolvedValue({ message_id: 'mock_msg_id' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FacebookClientService)
      .useValue(mockFacebookClient)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should match a rule and trigger a public comment reply', async () => {
    // 1. Seed target rule in database via Prisma (e.g. Keyword match "السعر")
    // ... Prisma seeding code ...

    // 2. Simulate incoming comment webhook
    const incomingWebhookPayload = {
      object: 'page',
      entry: [{
        id: 'PAGE_123',
        changes: [{
          field: 'feed',
          value: {
            item: 'comment',
            comment_id: 'COMMENT_789',
            post_id: 'PAGE_123_POST_456',
            from: { id: 'CUSTOMER_999' },
            message: 'كم السعر لو سمحت؟'
          }
        }]
      }]
    };

    await request(app.getHttpServer())
      .post('/webhooks')
      .send(incomingWebhookPayload)
      .expect(200);

    // 3. Assert that the Facebook client was called with correct data
    expect(mockFacebookClient.sendCommentReply).toHaveBeenCalledWith(
      'COMMENT_789',
      expect.stringContaining('السعر'), // Expected reply text from matching rule
      expect.any(Array)
    );
  });
});
```

---

## 5. Interface Contracts & Mock Payloads

To facilitate mocking, developers should use these exact payloads in their test fixtures:

### 5.1 Facebook Comments (Inbound Webhook)
* **Path**: `POST /webhooks`
* **Headers**: `X-Hub-Signature-256: sha256=<signature>` (for signature verification checks in E2E tests)
* **Payload**:
```json
{
  "object": "page",
  "entry": [
    {
      "id": "PAGE_ID_123",
      "time": 1720512345,
      "changes": [
        {
          "field": "feed",
          "value": {
            "item": "comment",
            "verb": "add",
            "comment_id": "COMMENT_ID_789",
            "parent_id": "POST_ID_456",
            "post_id": "PAGE_ID_123_POST_ID_456",
            "sender_name": "Customer Name",
            "from": {
              "id": "CUSTOMER_PSID_999",
              "name": "Customer Name"
            },
            "message": "هل هذا المنتج متوفر؟",
            "created_time": 1720512345
          }
        }
      ]
    }
  ]
}
```

### 5.2 Facebook Graph API Outbound Requests & Responses (Outbound Mocks)
* **Public Reply**:
  * **API Route**: `POST https://graph.facebook.com/v19.0/{comment_id}/comments`
  * **Auth**: `Authorization: Bearer <PAGE_ACCESS_TOKEN>`
  * **Response Mock**:
    ```json
    {
      "id": "REPLY_COMMENT_ID_111"
    }
    ```

* **Private Reply (DM)**:
  * **API Route**: `POST https://graph.facebook.com/v19.0/me/messages`
  * **Auth**: `Authorization: Bearer <PAGE_ACCESS_TOKEN>`
  * **Response Mock**:
    ```json
    {
      "recipient_id": "CUSTOMER_PSID_999",
      "message_id": "m_1234567890"
    }
    ```

### 5.3 WhatsApp Cloud API (Inbound Webhook)
* **Path**: `POST /webhooks/whatsapp`
* **Payload**:
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WABA_ID_123",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550000000",
              "phone_number_id": "PHONE_NUMBER_ID_456"
            },
            "contacts": [
              {
                "profile": { "name": "Customer Name" },
                "wa_id": "966500000000"
              }
            ],
            "messages": [
              {
                "from": "966500000000",
                "id": "wamid.HBgLOTY2NTAwMDAwMDAwFQIAERgSRDM2QTM5OUY3RTc2MDY2RDdFMAA=",
                "timestamp": "1720512345",
                "text": { "body": "تفاصيل الأسعار لو سمحت" },
                "type": "text"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### 5.4 WhatsApp Cloud API Outbound Requests & Responses (Outbound Mocks)
* **API Route**: `POST https://graph.facebook.com/v19.0/{phone-number-id}/messages`
* **Auth**: `Authorization: Bearer <WHATSAPP_SYSTEM_USER_TOKEN>`
* **Response Mock**:
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "966500000000",
      "wa_id": "966500000000"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgLOTY2NTAwMDAwMDAwFQIAERgSODBENTQxNjg1Rjg4OEM2MEU0AA="
    }
  ]
}
```
