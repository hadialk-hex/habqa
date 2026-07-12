# Security Hardening Analysis and Strategy Report

## 1. Observation

Based on a read-only code review of the `face bot` repository, the following exact files, lines, and structures were observed:

### 1.1 Hardcoded JWT Secrets
*   **File**: `backend/src/auth/auth.module.ts` (Lines 11–14)
    ```typescript
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key-for-hubqa-change-in-production',
      signOptions: { expiresIn: '7d' }, // 7 days expiration for convenience
    }),
    ```
*   **File**: `backend/src/auth/strategies/jwt.strategy.ts` (Lines 9–13)
    ```typescript
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-key-for-hubqa-change-in-production',
    });
    ```
*   **Status**: A fallback hardcoded key is used when `process.env.JWT_SECRET` is undefined, presenting a major security risk if pushed to production.

### 1.2 Route Protection
*   **Backend**: `@UseGuards(JwtAuthGuard)` is applied at the class level on:
    *   `backend/src/channels/channels.controller.ts` (Line 5)
    *   `backend/src/dashboard/dashboard.controller.ts` (Line 5)
    *   `backend/src/inbox/inbox.controller.ts` (Line 5)
    *   `backend/src/rules/rules.controller.ts` (Line 5)
*   **Backend (Public)**: `JwtAuthGuard` is **not** used in:
    *   `backend/src/app.controller.ts` (Public hello endpoint)
    *   `backend/src/auth/auth.controller.ts` (Public authentication routes `/auth/login` and `/auth/register`)
    *   `backend/src/webhooks/webhooks.controller.ts` (Public webhook routes `/webhooks` for GET verification and POST event ingestion)
*   **Frontend**: `frontend/src/app/dashboard/layout.tsx` renders dashboard elements directly without any layout-level wrapper protecting sub-routes.
*   **AuthGuard Hook**: A client-side router guard is defined in `frontend/src/components/auth-guard.tsx` using the `useAuth()` state hook from `frontend/src/lib/auth-context.tsx`.

### 1.3 Rate Limiting
*   **Files**: `backend/package.json` and `backend/src/app.module.ts`
*   **Status**: Rate limiting is completely absent in the codebase. `@nestjs/throttler` is not listed in `dependencies` of `package.json`, and no guard or module is registered.

### 1.4 Webhook Signature Verification
*   **File**: `backend/src/webhooks/webhooks.controller.ts` (Lines 24–35)
    ```typescript
    @Post()
    async handleIncomingEvent(@Body() body: any, @Res() res: Response) {
      // Return 200 OK immediately to Meta to prevent timeouts
      res.status(HttpStatus.OK).send('EVENT_RECEIVED');
      
      // Process event asynchronously
      try {
        await this.webhooksService.handleIncomingEvent(body);
      } catch (error) {
        console.error('Error processing webhook:', error);
      }
    }
    ```
*   **Status**: The POST endpoint accepts all payloads immediately and does not check for the presence or validity of `X-Hub-Signature-256`. The payload body is parsed via NestJS default parsers, and `rawBody` is not configured in `backend/src/main.ts`.

### 1.5 CORS Restrictions
*   **File**: `backend/src/main.ts` (Line 11)
    ```typescript
    app.enableCors(); // allow frontend to connect
    ```
*   **Status**: CORS is enabled globally without origins constraints, exposing the API to cross-origin resource sharing exploits.

### 1.6 DTO Input Validation
*   **File**: `backend/src/main.ts` (Line 12) configures global pipes:
    ```typescript
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    ```
*   **File**: `backend/src/auth/dto/auth.dto.ts` defines and validates `RegisterDto` and `LoginDto` using `class-validator` decorators.
*   **Missing Validation**:
    *   `backend/src/channels/channels.controller.ts` (Line 16): `@Body() body: any` (lacks DTO type safety/validation).
    *   `backend/src/rules/rules.controller.ts` (Lines 16, 21): `@Body() body: any` (lacks DTO type safety/validation).

### 1.7 Encrypting Platform Access Tokens
*   **File**: `backend/prisma/schema.prisma` (Line 68):
    ```prisma
    accessToken   String?      // Encrypted token or System User Token
    ```
*   **File**: `backend/src/channels/channels.service.ts` (Lines 15–25):
    ```typescript
    async addConnection(tenantId: string, data: { platform: any, platformId: string, name: string, accessToken?: string }) {
      return this.prisma.platformConnection.create({
        data: {
          tenantId,
          platform: data.platform,
          platformId: data.platformId,
          name: data.name,
          accessToken: data.accessToken,
        },
      });
    }
    ```
*   **Status**: Access tokens are stored in plaintext. There is no cryptographic encryption applied during db writes or decryption on db reads.

---

## 2. Logic Chain

1.  **JWT Secret Security**: Using a hardcoded fallback secret makes local testing vulnerable to leakage and creates an implicit vulnerability in staging/production setups if configuration keys are misconfigured. It is essential to enforce the retrieval of the JWT secret through configuration utilities, making configuration injection native to NestJS rather than reading directly from global `process.env`.
2.  **Dashboard Route Protection**: Although the backend is secured by `JwtAuthGuard` at the controller levels, the frontend Next.js application does not prevent unauthenticated users from entering the `/dashboard/*` page layout. Unauthenticated users see structural UI components (sidebar, header, empty tables) before page requests fail. Wrapping the entire root dashboard layout in the client-side `AuthGuard` component ensures proper client-side route redirection before rendering elements.
3.  **Brute-Force Vulnerability**: Lacking rate limiting means malicious actors can query `/auth/login` arbitrarily. Using `@nestjs/throttler` bound to the authentication endpoints provides deterministic defense against brute-force attacks.
4.  **Meta Webhook Authentication**: Webhooks are vulnerable to spoofing and denial-of-service unless verified. Meta signs incoming payloads using the App Secret with the HMAC-SHA256 signature passed in the `X-Hub-Signature-256` header. Because JSON parsers alter the spacing of raw payloads, accessing the raw request body buffer is necessary to correctly compute the signature hash.
5.  **CORS Access Controls**: Allowing any origin (`*`) allows arbitrary external scripts in a browser environment to make requests against user sessions. Limiting CORS to verified origins matching the environment configuration prevents cross-site request leakage.
6.  **DTO Input Integrity**: Global validation pipes only discard unwholesome attributes if endpoints explicitly use annotated DTO objects. Using `@Body() body: any` on endpoints in `ChannelsController` and `RulesController` completely bypasses input sanitization, potentially allowing invalid schemas or database injection errors.
7.  **Database Credential Storage**: Database access compromises expose API integration tokens. Encrypting tokens via AES-256-GCM (Authenticated Encryption) before saving to SQLite mitigates the impact of credential leakage. Utilizing Prisma's Client Extensions makes this encryption and decryption process transparent to service invocations, eliminating duplicate decryption logic across the codebase.

---

## 3. Caveats

*   **SQLite Limitations**: SQLite does not support native enums. The database layout uses string types, so validation at the NestJS DTO layer is the primary defense against invalid domain parameters.
*   **Next.js Client Components**: Wrapping Next.js Layout in `AuthGuard` converts it to a client-side component (due to the `'use client'` directive in `AuthGuard`). Since layout features such as notifications and search are client-interactive, this fits the client-side architecture but must be noted.
*   **HMAC Keys**: The App Secret for Webhook Signature verification must be configured separately from the Prisma token encryption key.
*   **Prisma Client Extension Scope**: When using Prisma Client Extensions (`$extends`), you must ensure that all services inject the extended Prisma client instance rather than the base instance to trigger transparent encryption/decryption.

---

## 4. Conclusion & Concrete Strategy

### 4.1. Point 1: Move JWT secret to Environment Variables & ConfigService
*   **Recommendation**: Install `@nestjs/config` (`npm install @nestjs/config`) to allow native configuration injection, config validation, and environmental mocking in tests.
*   **Implementation Steps**:
    1. Add `ConfigModule.forRoot({ isGlobal: true })` inside `AppModule`.
    2. Register `JwtModule` dynamically inside `AuthModule`:
       ```typescript
       import { ConfigService } from '@nestjs/config';

       JwtModule.registerAsync({
         inject: [ConfigService],
         useFactory: (configService: ConfigService) => {
           const secret = configService.get<string>('JWT_SECRET');
           if (!secret) {
             throw new Error('JWT_SECRET configuration is missing!');
           }
           return {
             secret,
             signOptions: { expiresIn: '7d' },
           };
         },
       })
       ```
    3. Refactor `JwtStrategy` constructor to inject `ConfigService`:
       ```typescript
       constructor(
         private prisma: PrismaService,
         configService: ConfigService,
       ) {
         super({
           jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
           ignoreExpiration: false,
           secretOrKey: configService.get<string>('JWT_SECRET'),
         });
       }
       ```

### 4.2. Point 2: Route Protection Enforcement
*   **Backend**: `JwtAuthGuard` is correctly applied on the class level on `ChannelsController`, `DashboardController`, `InboxController`, and `RulesController`. Keep public endpoints (`AppController`, `AuthController`, `WebhooksController`) open.
*   **Frontend**: Wrap children in `AuthGuard` in `frontend/src/app/dashboard/layout.tsx`:
   ```typescript
   import AuthGuard from "@/components/auth-guard"

   export default function DashboardLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return (
       <AuthGuard>
         <SidebarProvider>
           <AppSidebar />
           <SidebarInset>
             {/* Header and Child Content */}
             <div className="flex flex-1 flex-col gap-4 p-4 lg:p-8 animate-fade-in">
               {children}
             </div>
           </SidebarInset>
         </SidebarProvider>
       </AuthGuard>
     )
   }
   ```

### 4.3. Point 3: Implement Rate Limiting via ThrottlerModule
*   **Recommendation**: Install `@nestjs/throttler` (`npm install @nestjs/throttler`).
*   **Implementation Steps**:
    1. Import `ThrottlerModule` in `AppModule`:
       ```typescript
       import { ThrottlerModule } from '@nestjs/throttler';

       @Module({
         imports: [
           ThrottlerModule.forRoot([{
             name: 'loginLimit',
             ttl: 10000, // 10 seconds in milliseconds
             limit: 15,  // 15 attempts max
           }]),
           // other modules...
         ]
       })
       ```
    2. Bind the `ThrottlerGuard` specifically to the `AuthController` or its login route to prevent performance hits on general routes:
       ```typescript
       import { UseGuards } from '@nestjs/common';
       import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

       @Controller('auth')
       @UseGuards(ThrottlerGuard)
       export class AuthController {
         @Post('login')
         @Throttle({ loginLimit: { limit: 15, ttl: 10000 } })
         async login(...) { ... }
       }
       ```

### 4.4. Point 4: Webhook Signature Verification
*   **Step 1: NestJS Raw Body Activation**: Edit `backend/src/main.ts` to pass the `rawBody: true` option:
    ```typescript
    const app = await NestFactory.create(AppModule, { rawBody: true });
    ```
*   **Step 2: Signature Validation Utility**:
    Define a method inside `WebhooksService` or helper:
    ```typescript
    import { createHmac, timingSafeEqual } from 'crypto';

    verifySignature(rawBody: Buffer, signatureHeader: string, appSecret: string): boolean {
      if (!signatureHeader || !rawBody) return false;
      const parts = signatureHeader.split('=');
      if (parts.length !== 2 || parts[0] !== 'sha256') return false;

      const expectedSignature = parts[1];
      const actualSignature = createHmac('sha256', appSecret)
        .update(rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const actualBuffer = Buffer.from(actualSignature, 'hex');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }
      return timingSafeEqual(expectedBuffer, actualBuffer);
    }
    ```
*   **Step 3: Controller Hook Integration**: Extract the raw body in `WebhooksController`:
    ```typescript
    import { Request } from 'express';
    import { Req, Headers, UnauthorizedException } from '@nestjs/common';

    @Post()
    async handleIncomingEvent(
      @Req() req: Request & { rawBody?: Buffer },
      @Headers('x-hub-signature-256') signature: string,
      @Res() res: Response
    ) {
      const appSecret = process.env.FACEBOOK_APP_SECRET || 'fallback-secret';
      
      if (!req.rawBody || !this.webhooksService.verifySignature(req.rawBody, signature, appSecret)) {
        throw new UnauthorizedException('Invalid Signature');
      }

      res.status(HttpStatus.OK).send('EVENT_RECEIVED');
      await this.webhooksService.handleIncomingEvent(req.body);
    }
    ```

### 4.5. Point 5: Limit CORS Origins
*   **Implementation Steps**:
    Configure `app.enableCors(...)` inside `backend/src/main.ts` using variables read from the environment:
    ```typescript
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'];

    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or postman)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    });
    ```

### 4.6. Point 6: Enforce DTO validation
*   **Step 1**: Define `ConnectChannelDto` in `backend/src/channels/dto/channel.dto.ts`:
    ```typescript
    import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

    export class ConnectChannelDto {
      @IsString()
      @IsNotEmpty()
      @IsIn(['FACEBOOK_PAGE', 'INSTAGRAM', 'WHATSAPP'], { 
        message: 'المنصة غير صالحة' 
      })
      platform: string;

      @IsString()
      @IsNotEmpty({ message: 'معرف المنصة مطلوب' })
      platformId: string;

      @IsString()
      @IsNotEmpty({ message: 'اسم القناة مطلوب' })
      name: string;

      @IsString()
      @IsOptional()
      accessToken?: string;
    }
    ```
*   **Step 2**: Apply to `ChannelsController`:
    ```typescript
    @Post()
    async addConnection(@Request() req: any, @Body() body: ConnectChannelDto) {
      return this.channelsService.addConnection(req.user.tenantId, body);
    }
    ```
*   **Step 3**: Define `CreateRuleDto` and `UpdateRuleDto` in `backend/src/rules/dto/rules.dto.ts`:
    ```typescript
    import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsBoolean, IsArray } from 'class-validator';

    export enum TriggerType {
      KEYWORD = 'KEYWORD',
      ANY_COMMENT = 'ANY_COMMENT',
      STORY_MENTION = 'STORY_MENTION',
    }

    export enum MatchType {
      EXACT = 'EXACT',
      CONTAINS = 'CONTAINS',
      AI_SEMANTIC = 'AI_SEMANTIC',
    }

    export class CreateRuleDto {
      @IsString()
      @IsOptional()
      connectionId?: string;

      @IsString()
      @IsOptional()
      postId?: string;

      @IsString()
      @IsNotEmpty({ message: 'اسم القاعدة مطلوب' })
      name: string;

      @IsEnum(TriggerType, { message: 'نوع المحفز غير صالح' })
      triggerType: TriggerType;

      @IsString()
      @IsOptional()
      keywords?: string;

      @IsEnum(MatchType, { message: 'نوع المطابقة غير صالح' })
      @IsOptional()
      matchType?: MatchType;

      @IsString()
      @IsOptional()
      replyText?: string;

      @IsArray()
      @IsOptional()
      replyMedia?: any[];

      @IsString()
      @IsOptional()
      privateText?: string;

      @IsArray()
      @IsOptional()
      privateMedia?: any[];

      @IsInt()
      @IsOptional()
      priority?: number;

      @IsBoolean()
      @IsOptional()
      isActive?: boolean;
    }

    export class UpdateRuleDto {
      // similar to CreateRuleDto but all properties marked @IsOptional()
    }
    ```
*   **Step 4**: Apply to `RulesController`:
    ```typescript
    @Post()
    async createRule(@Request() req: any, @Body() body: CreateRuleDto) {
      return this.rulesService.create(req.user.tenantId, body);
    }

    @Put(':id')
    async updateRule(
      @Request() req: any, 
      @Param('id') id: string, 
      @Body() body: UpdateRuleDto
    ) {
      return this.rulesService.update(id, req.user.tenantId, body);
    }
    ```

### 4.7. Point 7: Encrypt Platform Access Tokens
*   **Step 1: Encryption Helpers**: Use AES-256-GCM (Authenticated Encryption). Deriving the key using SHA-256 ensures a 32-byte key is always used regardless of input length.
    ```typescript
    // crypto.util.ts
    import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

    const ALGORITHM = 'aes-256-gcm';
    const IV_LENGTH = 12;

    function getEncryptionKey(): Buffer {
      const secret = process.env.DATABASE_ENCRYPTION_KEY || 'default-secret-key-32-chars-long';
      return createHash('sha256').update(secret).digest();
    }

    export function encrypt(text: string): string {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    }

    export function decrypt(encryptedText: string): string {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) throw new Error('Invalid encryption payload format');
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    ```
*   **Step 2: Prisma Extension Mapping**:
    Apply a Client Extension inside `PrismaService` (in `backend/src/prisma/prisma.service.ts`):
    ```typescript
    import { PrismaClient } from '@prisma/client';
    import { encrypt, decrypt } from './crypto.util';

    export const extendedPrisma = new PrismaClient().$extends({
      query: {
        platformConnection: {
          async create({ args, query }) {
            if (args.data.accessToken) {
              args.data.accessToken = encrypt(args.data.accessToken);
            }
            return query(args);
          },
          async update({ args, query }) {
            if (args.data.accessToken && typeof args.data.accessToken === 'string') {
              args.data.accessToken = encrypt(args.data.accessToken);
            }
            return query(args);
          },
          async upsert({ args, query }) {
            if (args.create.accessToken) {
              args.create.accessToken = encrypt(args.create.accessToken);
            }
            if (args.update.accessToken && typeof args.update.accessToken === 'string') {
              args.update.accessToken = encrypt(args.update.accessToken);
            }
            return query(args);
          }
        }
      },
      result: {
        platformConnection: {
          accessToken: {
            needs: { accessToken: true },
            compute(connection) {
              if (!connection.accessToken) return null;
              try {
                return decrypt(connection.accessToken);
              } catch (e) {
                // Fallback for non-encrypted tokens during migration
                return connection.accessToken;
              }
            }
          }
        }
      }
    });
    ```

---

## 5. Verification Method

To independently verify the recommendations and future implementation:

1.  **Code inspection**:
    *   Inspect `backend/src/auth/auth.module.ts` and `backend/src/auth/strategies/jwt.strategy.ts` to ensure no hardcoded default string values are assigned.
    *   Verify the existence of `backend/src/channels/dto/channel.dto.ts` and `backend/src/rules/dto/rules.dto.ts` and their inclusion as payload parameters in controllers.
    *   Confirm `frontend/src/app/dashboard/layout.tsx` imports and encapsulates layout rendering within `AuthGuard`.
2.  **Functional Testing**:
    *   **Rate limit verification**: Query the login endpoint repeatedly with incorrect credentials:
        ```bash
        # Target endpoint: POST http://localhost:3001/auth/login
        # Expect 429 Too Many Requests response after 15 attempts within 10 seconds
        ```
    *   **CORS Verification**: Execute requests from invalid origins using curl to verify CORS headers are omitted/rejected:
        ```bash
        curl -i -H "Origin: http://unauthorized-domain.com" http://localhost:3001/dashboard/stats
        ```
    *   **Webhook Signature Verification**: Verify webhook validation fails when providing wrong signatures and succeeds when valid:
        ```bash
        # Expected: 401 Unauthorized for empty/invalid X-Hub-Signature-256 header.
        curl -i -X POST -H "X-Hub-Signature-256: sha256=invalid-signature" -H "Content-Type: application/json" -d '{"object":"page"}' http://localhost:3001/webhooks
        ```
    *   **Token Encryption**: Query SQLite database directly using Prisma Studio or sqlite3 CLI after saving a connection to verify `accessToken` is cryptographically encrypted in the table, but correctly decrypted when accessed via `ChannelsService`.
3.  **Run automated test suites**:
    *   Run E2E test scripts inside the `backend` folder to ensure regression coverage:
        ```bash
        npm run test:e2e
        ```
        *(Invalidation condition: Any failed test in Tier 1 or Tier 2).*
