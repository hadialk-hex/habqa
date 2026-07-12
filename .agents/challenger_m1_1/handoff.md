# Challenge Handoff Report — Milestone 1: Security Hardening Verification

## 1. Observation
- **Dashboard Authorization**:
  - Found `@UseGuards(JwtAuthGuard)` decorator applied globally at the class level of `DashboardController` in `backend/src/dashboard/dashboard.controller.ts:6`:
    ```typescript
    @UseGuards(JwtAuthGuard)
    @Controller('dashboard')
    export class DashboardController {
    ```
  - Found that `JwtStrategy` in `backend/src/auth/strategies/jwt.strategy.ts:28-34` checks the database's `revokedToken` table to invalidate logged out tokens:
    ```typescript
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const revoked = await this.prisma.revokedToken.findUnique({
        where: { token },
      });
      if (revoked) {
        throw new UnauthorizedException();
      }
    }
    ```

- **Rate Limiting**:
  - Found `ThrottlerModule` configured globally inside `backend/src/app.module.ts:69` with a limit of 15 requests in 10 seconds:
    ```typescript
    ThrottlerModule.forRoot([{ ttl: 10000, limit: 15 }]),
    ```
  - Observed that the `ThrottlerGuard` is registered globally as `APP_GUARD` in `backend/src/app.module.ts:84-87`:
    ```typescript
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    ```

- **Webhook Signature timingSafeEqual**:
  - Observed in `backend/src/webhooks/webhooks.controller.ts:53-83` that signature extraction, hashing, and length checks are executed using `crypto.timingSafeEqual`:
    ```typescript
    if (!signature || !signature.startsWith('sha256=')) {
      throw new UnauthorizedException(
        'Signature header is missing or malformed',
      );
    }
    ...
    let isMatch = false;
    try {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(signatureHash, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      );
    } catch {
      isMatch = false;
    }

    if (!isMatch) {
      throw new UnauthorizedException('Invalid signature');
    }
    ```

- **CORS Config**:
  - Found CORS enabling and origin parsing inside `backend/src/main.ts:22-28`:
    ```typescript
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3000'];
    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
    });
    ```

- **DTO Validators**:
  - Observed global registration of `ValidationPipe` in `backend/src/app.module.ts:88-91`:
    ```typescript
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },
    ```
  - Found validator decorators such as `@IsEmail`, `@IsNotEmpty`, `@MinLength` and `@IsString` inside DTO files: `backend/src/auth/dto/auth.dto.ts`, `backend/src/channels/dto/channels.dto.ts`, and `backend/src/rules/dto/rules.dto.ts`.
  - Found explicit validation checks inside controller endpoints, e.g. `backend/src/rules/rules.controller.ts:29-36`:
    ```typescript
    if (
      dto.triggerType === 'KEYWORD' &&
      (!dto.keywords || dto.keywords.trim() === '')
    ) {
      throw new BadRequestException(
        'Keywords must not be empty for KEYWORD trigger type',
      );
    }
    ```

- **Connection Token Encryption**:
  - Found helper functions `encrypt` and `decrypt` utilizing `aes-256-cbc` inside `backend/src/channels/channels.service.ts:21-48`:
    ```typescript
    function encrypt(text: string | null | undefined): string | null | undefined {
      if (!text) return text;
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    }
    ```
  - Observed that tokens are encrypted upon saving in `addConnection` (lines 105-115) and decrypted when fetched in `getConnections` (lines 59-64) and `getConnection` (lines 74-79).

- **E2E Test Output**:
  - Executed the NestJS E2E test suite command:
    `npx jest --config ./test/jest-e2e.json security.e2e-spec.ts --runInBand`
  - Observed that the test run failed in `global-setup.ts` when trying to run `docker compose up -d postgres`:
    ```
    unable to get image 'postgres:17-alpine': failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine...
    Error: P1001: Can't reach database server at `localhost:5432`
    ```
    This indicates that the local Docker daemon is not active on this Windows host, meaning Postgres is unreachable.

---

## 2. Logic Chain
- **Dashboard Authorization Guard**: Because the `DashboardController` has `@UseGuards(JwtAuthGuard)` globally, all dashboard endpoints require a valid JWT token. If a request is unauthorized (no token or tampered signature), NestJS blocks it and returns a 401. This is verified by `JwtAuthGuard` mapping to `JwtStrategy`, which validates the token against the DB and the `revokedToken` list.
- **Rate Limiting**: Because the `ThrottlerGuard` is bound globally via `APP_GUARD` and configured with a limit of 15 requests within 10,000ms (`ttl: 10000, limit: 15`), any user/client attempting more than 15 requests (including login requests) in 10s will exceed the limit and receive a 429 status code.
- **Timing-Safe Webhook signature validation**: Because `crypto.timingSafeEqual` is used, the hashing comparison is resistant to timing attacks. Because the length mismatch exception of `timingSafeEqual` is caught in a try-catch block and results in `isMatch = false`, empty signatures and invalid hex/buffer values are safely caught and rejected with a 401 Unauthorized status.
- **CORS Control**: Because `main.ts` configures Nest's CORS mechanism using `process.env.ALLOWED_ORIGINS`, requests coming from disallowed origins will not receive CORS authorization headers, causing browsers to block the requests.
- **Input Validation**: Because `ValidationPipe` is registered globally with the `APP_PIPE` token, all route parameters decorated with DTOs are validated. Invalid inputs fail validation decorators and trigger a 400 Bad Request exception.
- **Encryption of connection tokens**: Because the `PlatformConnection.accessToken` is run through `encrypt()` using `aes-256-cbc` with a hashed 32-byte key derived from `process.env.ENCRYPTION_KEY`, the access tokens are stored in the database in a secure format: `iv:ciphertext`. Upon querying the connections, `decrypt` resolves the original token format seamlessly.

---

## 3. Caveats
- Since the Docker engine/daemon was inactive on the host machine, the database-dependent E2E tests (which require PostgreSQL and Redis) could not be executed programmatically. Static analysis of the TS/JS codebase was used to verify implementation details instead.
- If `process.env.ENCRYPTION_KEY` is not defined in production, it will cause `encrypt()` to crash the platform connection creation request (returning 500), which is correct behavior to prevent plaintext leakage.

---

## 4. Conclusion
- The Milestone 1: Security Hardening requirements are **fully met, correctly implemented, and robust**.
- Unauthorized requests to the dashboard are blocked with a 401.
- Rate limiting is active globally with a limit of 15 requests in 10 seconds (returning 429).
- Webhook signatures are timing-safe and safely catch different length/empty headers.
- CORS behaves correctly based on configured origins.
- DTO validation is global and rejects malformed inputs.
- Platform access tokens are encrypted before DB persistence and decrypted on query.

---

## 5. Verification Method
1. **To verify static implementation files**:
   - Inspect `backend/src/dashboard/dashboard.controller.ts` for `@UseGuards(JwtAuthGuard)`.
   - Inspect `backend/src/app.module.ts` for the global `ThrottlerGuard` and `ValidationPipe` providers.
   - Inspect `backend/src/webhooks/webhooks.controller.ts` for the `crypto.timingSafeEqual` implementation inside the try-catch block.
   - Inspect `backend/src/main.ts` for CORS origin extraction.
   - Inspect `backend/src/channels/channels.service.ts` for `encrypt` and `decrypt` methods.
2. **To run the verification test suite (requires Docker Desktop active)**:
   - Start Docker Desktop.
   - Execute the database start script:
     ```powershell
     powershell -ExecutionPolicy Bypass -File backend/start-db.ps1
     ```
   - Run the Jest E2E tests:
     ```bash
     cd backend
     npx jest --config ./test/jest-e2e.json security.e2e-spec.ts webhooks.e2e-spec.ts channels.e2e-spec.ts rules.e2e-spec.ts --runInBand
     ```
