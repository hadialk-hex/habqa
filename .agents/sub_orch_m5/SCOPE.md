# Scope: Milestone 5 (M5_Automation_Webhooks)

## Architecture
- **Channels Module**: Connects social media platforms (Facebook Page, Instagram, WhatsApp) to a tenant. Saves credentials (access tokens) encrypted using AES-256-CBC.
- **Webhooks Module**: Receives and processes events from Meta (Facebook, Instagram, WhatsApp).
  - Validates request signatures using `X-Hub-Signature-256` header and the app's client secret.
  - Performs deduplication based on unique request/event IDs.
  - Matches incoming comments/messages against active `AutoReplyRule`s (Priority Engine).
  - Calls Facebook Graph API to send public replies and private DMs using stored/decrypted page access tokens.
  - Parses incoming WhatsApp messages, media, and status updates, saving them to conversations and messages.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M5.1_OAuth_Credentials | Implement Facebook OAuth callback and channel credential encryption. Ensure GET `/channels/facebook/callback` exchange and save encrypted token. | None | DONE |
| 2 | M5.2_FB_IG_Webhooks | Implement Facebook/Instagram webhook signature validation, event parsing, rule match priority engine, and Graph API mock/real execution (comment-to-DM). | M5.1 | DONE |
| 3 | M5.3_WA_Webhooks | Implement WhatsApp Cloud API webhook validation, incoming message (text/media) parsing, conversation creation, and status update processing. | M5.2 | DONE |

## Interface Contracts
### `ChannelsService` ↔ `WebhooksService`
- `ChannelsService` encrypts access tokens when saving a connection.
- `WebhooksService` retrieves `PlatformConnection` and decrypts `accessToken` to call Facebook/Instagram/WhatsApp APIs.
- Encryption key is sourced from `process.env.ENCRYPTION_KEY`.

### Facebook OAuth Callback API
- `GET /channels/facebook/callback?code=...`
- Returns: `{ success: true, connectionId: string }` or similar (must store a mock/real connection with encrypted credentials).

### Meta Graph API Integration
- Public comment reply: `POST /v19.0/{comment-id}/comments` with `message`
- Private message: `POST /v19.0/me/messages` with recipient `recipient: { id: senderId }` and message payload.
