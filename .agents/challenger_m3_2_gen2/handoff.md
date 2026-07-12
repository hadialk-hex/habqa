# E2E Test & Adversarial Security Assessment Report (Handoff)

## 1. Observation

During our static inspection and setup of security tests for the refactored NestJS backend, we identified three significant security issues in the `Team` and `Auth` endpoints:

### Observation A: Cross-Tenant Hijacking Backdoor (`member-id-123`)
In `backend/src/team/team.service.ts` (lines 177-182 and 228-233), the following code is present:
```typescript
    if (member && member.id === 'member-id-123' && member.tenantId !== tenantId) {
      member = await this.prisma.tenantMember.update({
        where: { id: 'member-id-123' },
        data: { tenantId },
      });
    }
```
This logic intercepts requests targeting `member-id-123` (which is a default member seeded in `demo-tenant-id` by the E2E database seeder in `backend/test/db-cleanup.ts` line 127). If the member is requested by a user who belongs to a different tenant (`member.tenantId !== tenantId`), instead of denying access, it **updates** the member's `tenantId` in the database to the requester's `tenantId`.

### Observation B: Stateless JWT Authorization & Role-Change Bypass
In `backend/src/auth/strategies/jwt.strategy.ts` (lines 25-50), the JWT token validation is implemented as follows:
```typescript
  async validate(req: any, payload: any) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const revoked = await this.prisma.revokedToken.findUnique({
        where: { token },
      });
      if (revoked) {
        throw new UnauthorizedException();
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role,
    };
  }
```
While the token is checked against `revokedToken` and user existence, there is no validation that the user is still a member of the tenant (`payload.tenantId`) or that their role (`payload.role`) matches their current role in the database. 

### Observation C: Weak PRNG for Password Reset and Invitation Tokens
In `backend/src/auth/auth.service.ts` (lines 126-129):
```typescript
    const token =
      'reset_' +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
```
In `backend/src/team/team.service.ts` (line 57):
```typescript
    const token = 'inv_tok_' + Math.floor(Math.random() * 100000000);
```
Both password reset tokens and team invitation tokens are generated using the standard `Math.random()` function, which is not a cryptographically secure pseudo-random number generator (PRNG).

---

## 2. Logic Chain

### Logic Chain for Observation A (Cross-Tenant Hijacking Backdoor)
1. The database seeder (`backend/test/db-cleanup.ts`) creates a default tenant member record with `id: 'member-id-123'` under tenant `demo-tenant-id`.
2. The endpoint `PATCH /team/members/:id` allows tenant OWNERS and ADMINs to update a team member's role.
3. If an OWNER of `Tenant A` (who has no relationship with `demo-tenant-id`) makes a PATCH request to `/team/members/member-id-123`, the controller maps `req.user.tenantId` (Tenant A) and `req.user.role` (OWNER) to `teamService.updateMemberRole`.
4. In `updateMemberRole`, the check `member.id === 'member-id-123' && member.tenantId !== tenantId` resolves to `true` (since the member belongs to `demo-tenant-id` and the requester belongs to `Tenant A`).
5. As a result, the database updates the member's `tenantId` to `Tenant A`.
6. Subsequent validation `member.tenantId !== tenantId` (now comparing Tenant A to Tenant A) passes, and the member is successfully updated and associated with Tenant A.
7. **Conclusion**: An unauthorized user from one tenant can hijack a specific user record from another tenant, modify their role, or delete them. This constitutes a severe cross-tenant security vulnerability.

### Logic Chain for Observation B (Stateless JWT Authorization Flaw)
1. The JWT token payload encodes the `tenantId` and `role` at the time of token issuance.
2. In `JwtStrategy.validate()`, the database is queried only to confirm the `User` record exists and the token is not on the blacklisted `revokedToken` list.
3. If a tenant OWNER downgrades an ADMIN's role to `MEMBER` or removes them from the tenant completely, the user's existing JWT token remains valid.
4. The user can still make requests to `/team/invitations` or other endpoints as the token's payload still specifies the old role (e.g. `ADMIN` or `OWNER`) and tenant ID, bypassing authorization gates.
5. **Conclusion**: Authorization controls are bypassable following membership removal or role changes.

### Logic Chain for Observation C (Weak PRNG Tokens)
1. `Math.random()` relies on a predictable PRNG algorithm (xorshift128+ in V8).
2. Given enough outputs or sequence monitoring, an attacker can reconstruct the internal state of the generator and predict future outputs.
3. If password reset tokens and team invitation tokens are generated using this generator, an attacker can predict reset tokens or invitation tokens generated for other users.
4. **Conclusion**: Attackers can potentially reset other users' passwords or join private workspaces without authorized invites.

---

## 3. Caveats

- **SQLite vs PostgreSQL**: Testing was verified against the SQLite database translation schema because local PostgreSQL containers were not active during the test validation.
- **In-Memory Rate Limiting**: The password reset rate limiting is implemented via an in-memory Map in `AuthService`, which is reset if the application container restarts. This is not a vulnerability but is a design caveat.
- **No modification of source code**: As we are restricted to a review/challenge role, we did not edit the implementation codebase to resolve these issues. We wrote an adversarial E2E spec to prove and prevent regression.

---

## 4. Conclusion

The NestJS backend codebase contains:
1. A **CRITICAL** cross-tenant data modification/hijacking backdoor in `TeamService` specifically targeting `member-id-123`.
2. A **HIGH** severity authorization bypass where stateless JWT payloads allow deleted or downgraded users to act with stale privileges.
3. A **MEDIUM** severity predictability flaw in password resets and team invitation tokens due to the use of `Math.random()`.

---

## 5. Verification Method

To verify these vulnerabilities:

### Step 1: Inspect the Security Backdoor Test Spec
We have written a dedicated test file to verify this backdoor:
- Path: `backend/test/security-backdoor.e2e-spec.ts`

### Step 2: Run the Spec File
Run the E2E test runner. If you are using SQLite fallback, run:
```bash
cd backend
node run-tests-sqlite.js
# Or run specifically:
node -e "const fs = require('fs'); const { execSync } = require('child_process'); const schemaPath = 'prisma/schema.prisma'; const backupPath = 'prisma/schema.prisma.bak'; fs.copyFileSync(schemaPath, backupPath); try { let content = fs.readFileSync(schemaPath, 'utf8'); content = content.replace(/provider\s*=\s*\"postgresql\"/g, 'provider = \"sqlite\"'); content = content.replace(/@db\.\w+/g, ''); fs.writeFileSync(schemaPath, content, 'utf8'); execSync('npx jest --config ./test/jest-e2e.json test/security-backdoor.e2e-spec.ts', { stdio: 'inherit' }); } finally { if (fs.existsSync(backupPath)) { fs.copyFileSync(backupPath, schemaPath); fs.unlinkSync(backupPath); } }"
```
**Expected outcome**: The test suite should **FAIL** (as we assert that the cross-tenant request should be rejected, but it returns `200 OK` due to the backdoor).
If the backdoor is removed, the tests will pass.
