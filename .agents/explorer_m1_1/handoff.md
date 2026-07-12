# Handoff Report: Milestone 1 - Security Hardening

## 1. Observation

Based on a read-only investigation of the workspace `c:\Users\pc\Desktop\face bot\`, the following files and code patterns were identified:

### 1.1 JWT Secret Storage
- **File**: `backend/src/auth/auth.module.ts`
  - **Line 12**: `secret: process.env.JWT_SECRET || 'super-secret-key-for-hubqa-change-in-production'`
- **File**: `backend/src/auth/strategies/jwt.strategy.ts`
  - **Line 12**: `secretOrKey: process.env.JWT_SECRET || 'super-secret-key-for-hubqa-change-in-production'`
- **File**: `backend/package.json`
  - Contains no `@nestjs/config` package.
- **File**: `backend/.env`
  - Contains only `DATABASE_URL="file:./dev.db"`. No `JWT_SECRET` is declared.

### 1.2 Frontend Dashboard Protection and Backend Guards
- **File**: `backend/src/channels/channels.controller.ts` (Line 5), `backend/src/dashboard/dashboard.controller.ts` (Line 5), `backend/src/inbox/inbox.controller.ts` (Line 5), and `backend/src/rules/rules.controller.ts` (Line 5) all utilize `@UseGuards(JwtAuthGuard)`.
- **File**: `backend/src/app.controller.ts`, `backend/src/auth/auth.controller.ts`, and `backend/src/webhooks/webhooks.controller.ts` do not use `JwtAuthGuard` (which is correct for authentication and webhooks endpoints).
- **File**: `frontend/src/components/auth-guard.tsx`
  - Defines a default export `AuthGuard` that handles loading and redirects to `/login` if `isAuthenticated` is false.
- **File**: `frontend/src/app/dashboard/layout.tsx`
  - Entirely lacks wrapping with `AuthGuard` or importing the `AuthGuard` component.

### 1.3 Rate Limiting
- **File**: `backend/package.json`
  - Lacks `@nestjs/throttler` in its dependencies.
- **File**: `backend/src/app.module.ts`
  - Lacks any rate-limiting configuration or `ThrottlerModule` imports.

### 1.4 Webhook Signature Validation
- **File**: `backend/src/main.ts`
  - Does not pass the `rawBody: true` option in `NestFactory.create(AppModule)`.
- **File**: `backend/src/webhooks/webhooks.controller.ts`
  - Line 24: `@Post() async handleIncomingEvent(@Body() body: any, @Res() res: Response)` processes incoming webhook POST events without any signature check.
- **File**: `backend/src/webhooks/webhooks.service.ts`
  - Line 10: `verifyWebhook(mode: string, token: string, challenge: string): string` verifies the webhook subscription using a hardcoded token `const VERIFY_TOKEN = 'hubqa_secure_verify_token_2026';`.

### 1.5 CORS Limitation
- **File**: `backend/src/main.ts`
  - Line 11: `app.enableCors();` allows all origins by default (no arguments passed).

### 1.6 DTO Validation
- **File**: `backend/src/main.ts`
  - Line 12: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));` is active, meaning global pipe validation is enabled.
- **File**: `backend/src/channels/channels.controller.ts`
  - Line 16: `async addConnection(@Request() req: any, @Body() body: any)` receives body as `any`, bypassing validation.
- **File**: `backend/src/rules/rules.controller.ts`
  - Line 16: `async createRule(@Request() req: any, @Body() body: any)` receives body as `any`.
  - Line 21: `async updateRule(@Request() req: any, @Param('id') id: string, @Body() body: any)` receives body as `any`.
- **Directory**: `backend/src/channels` and `backend/src/rules` do not contain any DTO definition files.

### 1.7 Access Token Encryption
- **File**: `backend/prisma/schema.prisma`
  - Line 68: `accessToken   String?      // Encrypted token or System User Token` under the `PlatformConnection` model.
- **File**: `backend/src/channels/channels.service.ts`
  - Line 15-24: `addConnection` stores `data.accessToken` directly in plain text:
    ```typescript
    accessToken: data.accessToken,
    ```
- **File**: `backend/src/dashboard/dashboard.service.ts`
  - Queries `platformConnection` only for counting active connections (does not access the `accessToken` field).

---

## 2. Logic Chain

1. **JWT Secret Env Migration**:
   - Because the fallbacks are hardcoded, a compromised fallback key endangers JWT validation security.
   - Installing `@nestjs/config` enables standard configuration management in NestJS. Using `ConfigModule.forRoot({ isGlobal: true })` exposes `ConfigService` globally.
   - Since `JwtModule.register()` runs during module initialization, `process.env` might not be loaded yet in some test contexts. Using `JwtModule.registerAsync()` ensures `ConfigService` is resolved asynchronously after configuration is fully loaded.
   - For `JwtStrategy`, injecting `ConfigService` into the constructor allows passing `configService.get('JWT_SECRET')` safely into the `super()` call since parameters are evaluated before `super` executes.

2. **Frontend & Backend Dashboard Security**:
   - The backend controllers handling secure business logic (`ChannelsController`, `DashboardController`, `InboxController`, `RulesController`) are correctly protected using `@UseGuards(JwtAuthGuard)`.
   - On the Next.js frontend, wrapping all `/dashboard` nested routes in `AuthGuard` prevents unauthenticated users from seeing the dashboard shell and layout components, maintaining UI state security.

3. **Rate Limiting**:
   - Web application security standards recommend limiting authentication attempts to prevent brute force.
   - Installing `@nestjs/throttler` and configuring a throttler (limit 15, TTL 10 seconds) in `AppModule` provides rate limiting.
   - Applying `ThrottlerGuard` specifically to `AuthController` (or `/auth/login` endpoint) avoids rate-limiting normal backend calls while hardening authentication endpoints.

4. **Webhook Signature Validation**:
   - Facebook/WhatsApp webhooks are public endpoints and can be spoofed without signature validation.
   - In NestJS, extracting the raw payload buffer requires passing `{ rawBody: true }` to `NestFactory.create()`. This registers the raw body on `request.rawBody`.
   - The header `X-Hub-Signature-256` contains the signature in `sha256=<signature_hex>` format.
   - Computing the HMAC-SHA256 signature of the `req.rawBody` buffer using the `FB_APP_SECRET` and comparing it to the signature in the header using `crypto.timingSafeEqual` prevents timing attacks and ensures the request originated from Meta.

5. **CORS Restriction**:
   - Allowing all origins is a security vulnerability in production (e.g. cross-site request forgery or unauthorized data reads).
   - In `main.ts`, resolving `ConfigService` via `app.get(ConfigService)` allows us to read a comma-separated list of origins `ALLOWED_ORIGINS` from the environment and supply them to `app.enableCors()`.

6. **DTO Validation**:
   - Because the backend controllers for channels and rules receive parameters as `any`, the global `ValidationPipe` is ineffective for these endpoints.
   - Creating typed DTO classes with `class-validator` decorators and assigning them as types in the `@Body()` arguments of controllers immediately enforces validation schema and strips unexpected fields (via `whitelist: true`).

7. **Database Access Token Encryption**:
   - Access tokens for external platforms (Facebook/WhatsApp) are sensitive credentials. In the event of a database compromise, storing them in plain text exposes all connected accounts.
   - Using AES-256-GCM (Authenticated Encryption with Associated Data) with a 32-byte key derived from `DB_ENCRYPTION_KEY` provides secure encryption, integrity verification, and prevents replay attacks (via a random 12-byte IV).
   - Implementing this at the service level in `ChannelsService` secures the write process during connection creation and allows stripping/masking the token when returning connection lists to the frontend UI, minimizing the exposure of sensitive tokens.

---

## 3. Caveats

- **Dotenv vs ConfigService**: NestJS `ConfigService` handles env vars asynchronously and cleanly. However, for `main.ts`, we must extract the provider using `app.get(ConfigService)` since `bootstrap()` runs synchronously outside the NestJS dependency injection container lifecycle.
- **SQLite Support**: Prisma Client Extensions are fully supported in SQLite. However, if using SQLite, encryption/decryption at the service level is simpler and less prone to compilation or TypeScript typing overhead.
- **Webhook Raw Body Size**: Large webhook bodies are handled well, but the raw body parser is memory-based. If payloads become extremely large, standard memory limits apply.

---

## 4. Conclusion

A concrete security hardening strategy is fully designed and structured across the 7 requested tasks. It requires no code base structural changes, but relies on:
1. Installing `@nestjs/config` and `@nestjs/throttler`.
2. Updating `backend/src/main.ts` (CORS restriction, `rawBody: true`).
3. Securing `frontend/src/app/dashboard/layout.tsx` (wrapping in `AuthGuard`).
4. Implementing DTO validation and token encryption in the backend.

The implementation details are provided below as a step-by-step guideline.

### 4.1 Step-by-Step Implementation Strategy

#### Task 1: JWT Secret Environment Migration
1. Install `@nestjs/config`:
   ```bash
   npm install @nestjs/config
   ```
2. Update `backend/src/app.module.ts`:
   ```typescript
   import { ConfigModule } from '@nestjs/config';

   @Module({
     imports: [
       ConfigModule.forRoot({ isGlobal: true }),
       // ... other modules
     ]
   })
   ```
3. Update `backend/src/auth/auth.module.ts` to load the JWT secret dynamically:
   ```typescript
   import { ConfigModule, ConfigService } from '@nestjs/config';
   // ...
   @Module({
     imports: [
       PassportModule,
       JwtModule.registerAsync({
         imports: [ConfigModule],
         inject: [ConfigService],
         useFactory: async (configService: ConfigService) => ({
           secret: configService.get<string>('JWT_SECRET'),
           signOptions: { expiresIn: '7d' },
         }),
       }),
     ],
     providers: [AuthService, JwtStrategy],
     // ...
   })
   ```
4. Update `backend/src/auth/strategies/jwt.strategy.ts`:
   ```typescript
   import { ConfigService } from '@nestjs/config';
   // ...
   @Injectable()
   export class JwtStrategy extends PassportStrategy(Strategy) {
     constructor(
       private prisma: PrismaService,
       private configService: ConfigService,
     ) {
       super({
         jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
         ignoreExpiration: false,
         secretOrKey: configService.get<string>('JWT_SECRET'),
       });
     }
     // ...
   }
   ```
5. Add `JWT_SECRET=your_super_secure_secret_key_here` to `backend/.env`.

#### Task 2: Securing Frontend Dashboard Routes
1. Update `frontend/src/app/dashboard/layout.tsx` to wrap the layout in `AuthGuard`:
   ```typescript
   import AuthGuard from "@/components/auth-guard";
   // ...
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
             {/* ... header and children ... */}
           </SidebarInset>
         </SidebarProvider>
       </AuthGuard>
     );
   }
   ```

#### Task 3: Rate Limiting
1. Install `@nestjs/throttler`:
   ```bash
   npm install @nestjs/throttler
   ```
2. Configure `ThrottlerModule` in `backend/src/app.module.ts`:
   ```typescript
   import { ThrottlerModule } from '@nestjs/throttler';

   @Module({
     imports: [
       ThrottlerModule.forRoot([{
         ttl: 10000, // 10 seconds in milliseconds (v5+)
         limit: 15,
       }]),
       // ... other modules
     ]
   })
   ```
3. Apply `ThrottlerGuard` to `backend/src/auth/auth.controller.ts`:
   ```typescript
   import { ThrottlerGuard } from '@nestjs/throttler';
   import { UseGuards } from '@nestjs/common';

   @UseGuards(ThrottlerGuard)
   @Controller('auth')
   export class AuthController {
     // ... register and login routes are now protected
   }
   ```

#### Task 4: Webhook Signature Verification
1. Enable `rawBody` in `backend/src/main.ts`:
   ```typescript
   const app = await NestFactory.create(AppModule, { rawBody: true });
   ```
2. Update `backend/src/webhooks/webhooks.controller.ts` to extract the signature and raw body:
   ```typescript
   import { Controller, Get, Post, Body, Query, Res, Req, Headers, HttpStatus } from '@nestjs/common';
   import { Request, Response } from 'express';
   // ...
   @Post()
   async handleIncomingEvent(
     @Req() req: Request & { rawBody?: Buffer },
     @Headers('x-hub-signature-256') signatureHeader: string,
     @Res() res: Response
   ) {
     const isValid = this.webhooksService.verifySignature(req.rawBody, signatureHeader);
     if (!isValid) {
       return res.status(HttpStatus.FORBIDDEN).send('Invalid signature');
     }

     res.status(HttpStatus.OK).send('EVENT_RECEIVED');
     try {
       await this.webhooksService.handleIncomingEvent(req.body);
     } catch (error) {
       console.error('Error processing webhook:', error);
     }
   }
   ```
3. Implement `verifySignature` in `backend/src/webhooks/webhooks.service.ts`:
   ```typescript
   import * as crypto from 'crypto';
   import { ConfigService } from '@nestjs/config';

   @Injectable()
   export class WebhooksService {
     constructor(
       private prisma: PrismaService,
       private configService: ConfigService,
     ) {}

     verifySignature(rawBody: Buffer, signatureHeader: string): boolean {
       if (!signatureHeader || !rawBody) return false;

       const parts = signatureHeader.split('=');
       if (parts.length !== 2 || parts[0] !== 'sha256') return false;

       const expectedSignature = parts[1];
       const appSecret = this.configService.get<string>('FB_APP_SECRET');
       if (!appSecret) {
         this.logger.error('FB_APP_SECRET not set');
         return false;
       }

       const computedSignature = crypto
         .createHmac('sha256', appSecret)
         .update(rawBody)
         .digest('hex');

       const expectedBuffer = Buffer.from(expectedSignature, 'hex');
       const computedBuffer = Buffer.from(computedSignature, 'hex');

       if (expectedBuffer.length !== computedBuffer.length) return false;
       return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
     }

     verifyWebhook(mode: string, token: string, challenge: string): string {
       const verifyToken = this.configService.get<string>('FB_VERIFY_TOKEN') || 'hubqa_secure_verify_token_2026';
       if (mode && token && mode === 'subscribe' && token === verifyToken) {
         return challenge;
       }
       throw new Error('Verification failed');
     }
   }
   ```

#### Task 5: CORS Limitation
1. Update `backend/src/main.ts` to configure origins dynamically:
   ```typescript
   import { ConfigService } from '@nestjs/config';
   
   async function bootstrap() {
     const app = await NestFactory.create(AppModule, { rawBody: true });
     const configService = app.get(ConfigService);
     
     const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS')
       ?.split(',')
       .map(o => o.trim()) || ['http://localhost:3000'];

     app.enableCors({
       origin: allowedOrigins,
       credentials: true,
     });
     
     // ... rest of main.ts
   }
   ```

#### Task 6: Enforce DTO Validation
1. Create `backend/src/channels/dto/channels.dto.ts`:
   ```typescript
   import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

   export enum PlatformType {
     FACEBOOK_PAGE = 'FACEBOOK_PAGE',
     INSTAGRAM = 'INSTAGRAM',
     WHATSAPP = 'WHATSAPP'
   }

   export class AddConnectionDto {
     @IsEnum(PlatformType, { message: 'المنصة غير صالحة' })
     @IsNotEmpty({ message: 'المنصة مطلوبة' })
     platform: PlatformType;

     @IsString()
     @IsNotEmpty({ message: 'معرف المنصة مطلوب' })
     platformId: string;

     @IsString()
     @IsNotEmpty({ message: 'الاسم مطلوب' })
     name: string;

     @IsString()
     @IsOptional()
     accessToken?: string;
   }
   ```
2. Update `ChannelsController` to enforce `AddConnectionDto`:
   ```typescript
   import { AddConnectionDto } from './dto/channels.dto';
   // ...
   @Post()
   async addConnection(@Request() req: any, @Body() dto: AddConnectionDto) {
     return this.channelsService.addConnection(req.user.tenantId, dto);
   }
   ```
3. Create `backend/src/rules/dto/rules.dto.ts`:
   ```typescript
   import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsBoolean, IsArray } from 'class-validator';

   export enum TriggerType {
     KEYWORD = 'KEYWORD',
     ANY_COMMENT = 'ANY_COMMENT',
     STORY_MENTION = 'STORY_MENTION'
   }

   export enum MatchType {
     EXACT = 'EXACT',
     CONTAINS = 'CONTAINS',
     AI_SEMANTIC = 'AI_SEMANTIC'
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

     @IsEnum(TriggerType, { message: 'نوع المشغل غير صالح' })
     @IsNotEmpty({ message: 'نوع المشغل مطلوب' })
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
     @IsString({ each: true })
     @IsOptional()
     replyMedia?: string[];

     @IsString()
     @IsOptional()
     privateText?: string;

     @IsArray()
     @IsString({ each: true })
     @IsOptional()
     privateMedia?: string[];

     @IsInt()
     @IsOptional()
     priority?: number;

     @IsBoolean()
     @IsOptional()
     isActive?: boolean;
   }

   export class UpdateRuleDto {
     @IsString()
     @IsOptional()
     connectionId?: string;

     @IsString()
     @IsOptional()
     postId?: string;

     @IsString()
     @IsOptional()
     name?: string;

     @IsEnum(TriggerType)
     @IsOptional()
     triggerType?: TriggerType;

     @IsString()
     @IsOptional()
     keywords?: string;

     @IsEnum(MatchType)
     @IsOptional()
     matchType?: MatchType;

     @IsString()
     @IsOptional()
     replyText?: string;

     @IsArray()
     @IsString({ each: true })
     @IsOptional()
     replyMedia?: string[];

     @IsString()
     @IsOptional()
     privateText?: string;

     @IsArray()
     @IsString({ each: true })
     @IsOptional()
     privateMedia?: string[];

     @IsInt()
     @IsOptional()
     priority?: number;

     @IsBoolean()
     @IsOptional()
     isActive?: boolean;
   }
   ```
4. Update `RulesController` to use `CreateRuleDto` and `UpdateRuleDto`:
   ```typescript
   import { CreateRuleDto, UpdateRuleDto } from './dto/rules.dto';
   // ...
   @Post()
   async createRule(@Request() req: any, @Body() dto: CreateRuleDto) {
     return this.rulesService.create(req.user.tenantId, dto);
   }

   @Put(':id')
   async updateRule(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateRuleDto) {
     return this.rulesService.update(id, req.user.tenantId, dto);
   }
   ```

#### Task 7: Database Token Encryption
1. Create a utility helper `backend/src/utils/crypto.util.ts`:
   ```typescript
   import * as crypto from 'crypto';

   const ALGORITHM = 'aes-256-gcm';
   const IV_LENGTH = 12;

   export function encrypt(text: string, secretKey: string): string {
     // Ensure we get a 32-byte key by hashing the secretKey
     const key = crypto.createHash('sha256').update(secretKey).digest();
     const iv = crypto.randomBytes(IV_LENGTH);
     const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

     let encrypted = cipher.update(text, 'utf8', 'hex');
     encrypted += cipher.final('hex');

     const tag = cipher.getAuthTag().toString('hex');
     return `${iv.toString('hex')}:${encrypted}:${tag}`;
   }

   export function decrypt(encryptedData: string, secretKey: string): string {
     const parts = encryptedData.split(':');
     if (parts.length !== 3) {
       throw new Error('Invalid encrypted data format');
     }

     const key = crypto.createHash('sha256').update(secretKey).digest();
     const iv = Buffer.from(parts[0], 'hex');
     const encryptedText = parts[1];
     const tag = Buffer.from(parts[2], 'hex');

     const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
     decipher.setAuthTag(tag);

     let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
     decrypted += decipher.final('utf8');

     return decrypted;
   }
   ```
2. Integrate in `backend/src/channels/channels.service.ts`:
   ```typescript
   import { encrypt } from '../utils/crypto.util';
   import { ConfigService } from '@nestjs/config';

   @Injectable()
   export class ChannelsService {
     constructor(
       private prisma: PrismaService,
       private configService: ConfigService
     ) {}

     async addConnection(tenantId: string, data: AddConnectionDto) {
       const dbKey = this.configService.get<string>('DB_ENCRYPTION_KEY');
       const encryptedToken = data.accessToken && dbKey 
         ? encrypt(data.accessToken, dbKey) 
         : data.accessToken;

       return this.prisma.platformConnection.create({
         data: {
           tenantId,
           platform: data.platform,
           platformId: data.platformId,
           name: data.name,
           accessToken: encryptedToken,
         },
       });
     }

     async getConnections(tenantId: string) {
       const connections = await this.prisma.platformConnection.findMany({
         where: { tenantId },
         orderBy: { createdAt: 'desc' },
       });

       // Mask token before returning it to the controller (never expose to UI client)
       return connections.map(conn => ({
         ...conn,
         accessToken: conn.accessToken ? '********' : null,
       }));
     }
     
     // Provide helper to get decrypted token for backend usage
     async getDecryptedToken(tenantId: string, id: string): Promise<string | null> {
       const conn = await this.prisma.platformConnection.findFirst({
         where: { id, tenantId },
       });
       if (!conn || !conn.accessToken) return null;

       const dbKey = this.configService.get<string>('DB_ENCRYPTION_KEY');
       if (!dbKey) throw new Error('DB_ENCRYPTION_KEY is not configured');

       return decrypt(conn.accessToken, dbKey);
     }
   }
   ```

---

## 5. Verification Method

To verify the correct execution and security posture of these hardening changes, the following checks should be run:

1. **Unit and Integration Tests**:
   - Run the NestJS unit/integration tests to ensure no regressions in auth routing or rules creation:
     ```bash
     npm run test
     ```
2. **E2E Validation of Authentication & Guards**:
   - Access the frontend dashboard path (`/dashboard`) without authentication. Verify the application shows the loading page and then immediately redirects to `/login`.
   - Send requests to `/channels` or `/rules` without a valid Bearer token. Verify that the response status is `401 Unauthorized`.
3. **Rate Limiting Verification**:
   - Execute a loop sending 16 consecutive login requests to `/auth/login` within 10 seconds. Verify that the 16th request returns a `429 Too Many Requests` status code.
4. **Webhook Signature & Verification Validation**:
   - Send a webhook subscription challenge validation request to GET `/webhooks` with correct query parameters. Verify it returns the challenge value.
   - Send a mock POST payload to `/webhooks` with a payload body and a computed signature in the `x-hub-signature-256` header. Confirm it returns `200 OK`.
   - Send the same payload with an incorrect signature. Verify it returns `403 Forbidden`.
5. **DTO Validation Check**:
   - Send a POST `/channels` request with missing fields (e.g. name or platformId) or incorrect enum value. Verify the response is `400 Bad Request` with structured error messages (Arabic translation strings).
6. **Token Encryption Database Inspection**:
   - Add a mock platform connection using the API (e.g., WhatsApp with a mock token `test_token_123`).
   - Query the SQLite database directly using Prisma Studio or sqlite CLI:
     ```bash
     npx prisma studio
     ```
   - Verify that the `accessToken` field is stored in an encrypted format (`iv:ciphertext:tag` or hex structure) rather than plain text.
