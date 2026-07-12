# Handoff Report: E2E Testing Strategy for Auth Guard, Rate Limiting, CORS, and Password Reset

This handoff details the investigation findings and recommended testing strategies for Explorer 3 on the E2E Testing Track.

---

## 1. Observation

We investigated the backend codebase and observed the following:

- **Auth Guard Usage**:
  `backend/src/dashboard/dashboard.controller.ts` uses `@UseGuards(JwtAuthGuard)` at the class level:
  ```typescript
  @UseGuards(JwtAuthGuard)
  @Controller('dashboard')
  export class DashboardController {
  ```
  Additionally, `ChannelsController` (`channels.controller.ts`), `RulesController` (`rules.controller.ts`), and `InboxController` (`inbox.controller.ts`) all use the same class-level guard configuration, while `WebhooksController` does not.

- **CORS Configuration**:
  `backend/src/main.ts` configures CORS using `app.enableCors()` with no parameters:
  ```typescript
  async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors(); // allow frontend to connect
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(process.env.PORT ?? 3001);
  }
  ```

- **Rate Limiting**:
  - No rate limiting dependencies exist in `backend/package.json`.
  - No `ThrottlerModule` imports exist in `backend/src/app.module.ts`.
  - Search of `backend/src` for the term "throttler" or "rate" yielded no results.

- **Password Reset**:
  - `backend/src/auth/auth.controller.ts` only implements `register` and `login` endpoints:
    ```typescript
    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() dto: RegisterDto) {
      return this.authService.register(dto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginDto) {
      return this.authService.login(dto);
    }
    ```
  - `backend/prisma/schema.prisma` does not have any schema definitions for password reset tokens.

---

## 2. Logic Chain

1. **AuthGuard**: Since `JwtAuthGuard` is already declared and applied to dashboard/channels/rules/inbox controllers, the E2E test suite can immediately test route protection by sending requests with missing or invalid headers, expecting `401 Unauthorized`.
2. **CORS**: Because the current `app.enableCors()` call does not enforce origin checks, any custom CORS validation tests will fail until CORS is configured to read from an origin list (e.g. from env vars). A CORS testing suite must send the `Origin` header and verify if the response returns matching `Access-Control-Allow-Origin` values.
3. **Rate Limiting**: Because there is no rate limiting in the codebase currently, the E2E tests cannot verify throttling yet. To verify rate limiting (15 attempts/10s returning 429) without introducing test flakiness or slow-running tests in CI, the throttler parameters must be configurable via environment variables (so that test suites can override them to low values like 3 attempts). The E2E test will call the endpoint in a loop and expect the subsequent call to return `429 Too Many Requests`.
4. **Password Reset**: Since neither the endpoints nor the schema are implemented, we cannot run testing on password resets directly. The proposed design involves:
   - Creating a `PasswordResetToken` table in Prisma.
   - Injecting a mocked `MailerService` in the test setup.
   - Using the Prisma client directly in E2E tests to retrieve the generated reset token from the DB.
   - Firing the full sequence: request reset -> fetch token from DB -> reset password -> attempt login with new password.

---

## 3. Caveats

- **Mock Mailer Service**: The strategy assumes that a dedicated mailer provider exists in the backend (`MailerService`) which can be overridden in the NestJS testing container during test compile. If the email dispatch is implemented using inline calling patterns without a provider class, override mocking will be harder and will require modules mocking (such as Jest or MSW).
- **SQLite Database Isolation**: Since E2E tests query the database directly to inspect tokens, it is critical that the test runner executes migrations/seeding on a separate test database (e.g., `test.db`) rather than modifying the development database `dev.db`.

---

## 4. Conclusion

We recommend a Jest + Supertest E2E testing suite structure that combines:
- Custom test-environment overrides for throttler limits to keep tests fast.
- Explicit `Origin` header assertions for CORS testing.
- Direct database inspection to fetch generated password reset tokens, bypassing the need for a live mail transport server.
- Detailed implementation and test code designs are documented in `c:\Users\pc\Desktop\face bot\.agents\explorer_m1_3\analysis.md`.

---

## 5. Verification Method

To verify the observations:
1. Open and inspect `backend/src/main.ts` to confirm `app.enableCors()` configuration.
2. Open `backend/src/dashboard/dashboard.controller.ts` to check `JwtAuthGuard` decorator configuration.
3. Open `backend/prisma/schema.prisma` and check that the `User` and `Tenant` models exist but there are no models for password reset.
4. Ensure E2E tests run successfully by executing:
   ```powershell
   cd backend
   npm run test:e2e
   ```
