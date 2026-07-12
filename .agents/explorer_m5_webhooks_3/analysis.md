# Analysis Report: NestJS Dependency Injection, Environment Variables, and Fetch Mocking

## 1. NestJS Controller Wiring & Dependency Injection
To inject `ChannelsService` into `WebhooksService`, the NestJS module configurations need to be updated.

### Current Setup
- `ChannelsModule` (`src/channels/channels.module.ts`):
  - Provides: `ChannelsService`
  - Controllers: `ChannelsController`
  - Exports: *None*
- `WebhooksModule` (`src/webhooks/webhooks.module.ts`):
  - Imports: `PrismaModule`
  - Provides: `WebhooksService`
  - Controllers: `WebhooksController`
  - Exports: *None*

### Required Changes
1. **Export `ChannelsService` from `ChannelsModule`**:
   Add `exports: [ChannelsService]` to `ChannelsModule`'s `@Module` metadata.
   ```typescript
   // src/channels/channels.module.ts
   import { Module } from '@nestjs/common';
   import { ChannelsService } from './channels.service';
   import { ChannelsController } from './channels.controller';

   @Module({
     providers: [ChannelsService],
     controllers: [ChannelsController],
     exports: [ChannelsService], // <--- Added export
   })
   export class ChannelsModule {}
   ```

2. **Import `ChannelsModule` into `WebhooksModule`**:
   Add `ChannelsModule` to the `imports` array in `WebhooksModule`'s `@Module` metadata.
   ```typescript
   // src/webhooks/webhooks.module.ts
   import { Module } from '@nestjs/common';
   import { WebhooksController } from './webhooks.controller';
   import { WebhooksService } from './webhooks.service';
   import { PrismaModule } from '../prisma/prisma.module';
   import { ChannelsModule } from '../channels/channels.module'; // <--- Import ChannelsModule

   @Module({
     imports: [PrismaModule, ChannelsModule], // <--- Added ChannelsModule to imports
     controllers: [WebhooksController],
     providers: [WebhooksService],
   })
   export class WebhooksModule {}
   ```

3. **Inject `ChannelsService` into `WebhooksService`**:
   Import `ChannelsService` in `webhooks.service.ts` and declare it in the constructor.
   ```typescript
   // src/webhooks/webhooks.service.ts
   import { Injectable, Logger } from '@nestjs/common';
   import { PrismaService } from '../prisma/prisma.service';
   import { ChannelsService } from '../channels/channels.service'; // <--- Import ChannelsService

   @Injectable()
   export class WebhooksService {
     private readonly logger = new Logger(WebhooksService.name);

     constructor(
       private prisma: PrismaService,
       private channelsService: ChannelsService, // <--- Inject ChannelsService
     ) {}
     
     // ...
   }
   ```

### Circular Dependency Check
*   `ChannelsService` constructor currently depends on `PrismaService` and `ConfigService`.
*   `WebhooksService` constructor depends on `PrismaService` and (newly) `ChannelsService`.
*   Neither `ChannelsService` nor `ChannelsController` imports or depends on `WebhooksService`.
*   Thus, injecting `ChannelsService` into `WebhooksService` introduces **no circular dependencies**.

### Transitive/Global Dependencies
- **`PrismaService`**: Registered in `PrismaModule` which is decorated with `@Global()`. It is globally available throughout the application once imported in the root module.
- **`ConfigService`**: Registered in `AppModule` via `ConfigModule.forRoot({ isGlobal: true })`, making it globally available.

---

## 2. Environment Variables Analysis
The application relies on several environmental variables for encryption, webhook verification, and API tokens. Below is an inventory of variables, how they are read, and testing implications.

| Variable | Source Location | Read Method | Description |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | `auth.module.ts`, `jwt.strategy.ts` | `ConfigService.get('JWT_SECRET')` | Secret key used for signing/verifying JWTs |
| `ENCRYPTION_KEY` | `channels.service.ts` | `process.env.ENCRYPTION_KEY` | Secret used to encrypt/decrypt social tokens |
| `WEBHOOK_VERIFY_TOKEN` | `webhooks.service.ts` | `process.env.WEBHOOK_VERIFY_TOKEN` | Token to verify Meta webhook subscriptions |
| `APP_SECRET` | `webhooks.controller.ts`, `channels.service.ts` | `process.env.APP_SECRET`, `ConfigService.get('APP_SECRET')` | Facebook App Secret used for HMAC webhook signing |
| `DATABASE_URL` | `main.ts` | `process.env.DATABASE_URL` | Connection string for database |
| `PORT` | `main.ts` | `process.env.PORT` | Server listening port |
| `ALLOWED_ORIGINS` | `main.ts` | `process.env.ALLOWED_ORIGINS` | CORS configuration |
| `FACEBOOK_APP_ID` | `channels.service.ts` | `ConfigService.get('FACEBOOK_APP_ID')` | Facebook OAuth App ID |
| `FACEBOOK_APP_SECRET` | `channels.service.ts` | `ConfigService.get('FACEBOOK_APP_SECRET')` | Facebook OAuth App Secret (falls back to `APP_SECRET`) |
| `FACEBOOK_REDIRECT_URI` | `channels.service.ts` | `ConfigService.get('FACEBOOK_REDIRECT_URI')` | Facebook OAuth Redirect URI |
| `REDIS_HOST` | `app.module.ts` | `configService.get('REDIS_HOST')` | Host for CacheManager/BullMQ Redis |
| `REDIS_PORT` | `app.module.ts` | `configService.get('REDIS_PORT')` | Port for CacheManager/BullMQ Redis |
| `NODE_ENV` | `main.ts` | `process.env.NODE_ENV` | Determines environment mode (e.g. `production`) |

### Inconsistencies & Testing Implications
- **Read Methods Inconsistency**: The application reads variables using a mix of `process.env.VAR` and `ConfigService.get('VAR')`. For example, `ENCRYPTION_KEY` and `WEBHOOK_VERIFY_TOKEN` are accessed via `process.env`, whereas `JWT_SECRET` and `FACEBOOK_APP_ID` are accessed via `ConfigService`.
- **Testing Impact**: When writing unit or E2E tests, mock environment variables must be populated appropriately:
  - If a service reads directly from `process.env`, setting `process.env.VAR = 'mock'` in Jest is sufficient.
  - If a service reads via `ConfigService`, you must either ensure the Jest test loads config correctly or mock `ConfigService`'s `.get` method (or use `@nestjs/config` testing utilities).

---

## 3. Global `fetch` Usage and Mocking Strategy

### Usage of Global `fetch`
The native global `fetch` API (Node 18+) is used to communicate with Meta (Facebook Graph API):
1. **OAuth token exchange**: `https://graph.facebook.com/v18.0/oauth/access_token`
2. **Page accounts retrieval**: `https://graph.facebook.com/v18.0/me/accounts`
3. **Channel details query**: `https://graph.facebook.com/v19.0/{platformId}`
4. **Proposed automation**: Sending public replies and private DMs via Graph API endpoints (e.g. `POST /{comment-id}/comments`, `POST /v19.0/me/messages`).

### Testing & Mocking Strategy
Since `fetch` is a global function, it can be easily stubbed or mocked in tests using `jest.spyOn(global, 'fetch')`.

#### Recommended Test Implementation Pattern
```typescript
import { Test } from '@nestjs/testing';
import { ChannelsService } from '../src/channels/channels.service';

describe('Facebook Integration Mocking', () => {
  let channelsService: ChannelsService;

  beforeEach(async () => {
    // ...module setup...
  });

  it('should handle facebook integration with mocked fetch', async () => {
    // 1. Stub the global fetch call
    const mockFetch = jest.spyOn(global, 'fetch').mockImplementation((url: any) => {
      const urlStr = url.toString();
      
      if (urlStr.includes('oauth/access_token')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mocked_user_token' }),
        } as Response);
      }
      
      if (urlStr.includes('me/accounts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: 'page_123',
                name: 'My Test Page',
                access_token: 'page_token_abc',
              },
            ],
          }),
        } as Response);
      }

      return Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Not Mocked' }),
      } as Response);
    });

    try {
      // 2. Call service action that invokes fetch
      await channelsService.handleFacebookCallback('tenant-id', 'code-123');
      
      // 3. Assertions
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1, 
        expect.stringContaining('oauth/access_token')
      );
    } finally {
      // 4. Clean up mock to prevent leakage
      mockFetch.mockRestore();
    }
  });
});
```

### Safety and Cleanup Checklist
1. **Always wrap test execution in `try...finally`**: This ensures that `mockFetch.mockRestore()` is called even if assertions fail. Failure to restore can pollute global state and break other tests.
2. **Handle response type casing**: Cast the mock return values `as Response` or `as any` to satisfy TypeScript.
3. **Inspect URL arguments**: Check request methods and query parameters in `mockImplementation` if tests need to assert specific payloads.
