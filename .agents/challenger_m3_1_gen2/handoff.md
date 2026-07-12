# Handoff Report — Challenger 1 (Gen 2)

## 1. Observation
We observed the following code fragments and system characteristics during the review of the NestJS backend:

1. **JWT Auth Strategy trusts token payload without verification**:
   - **File**: `backend/src/auth/strategies/jwt.strategy.ts` (Lines 44-50):
     ```typescript
     return {
       id: payload.sub,
       email: payload.email,
       tenantId: payload.tenantId,
       role: payload.role,
     };
     ```
   - The token verification process only checks if the user exists in the database but does not verify whether the user still belongs to `payload.tenantId` or still possesses the role `payload.role`.

2. **Team invitation endpoint trusts JWT role parameter**:
   - **File**: `backend/src/team/team.controller.ts` (Line 30):
     ```typescript
     return this.teamService.inviteMember(req.user.tenantId, req.user.role, dto);
     ```
   - **File**: `backend/src/team/team.service.ts` (Lines 26-28):
     ```typescript
     if (inviterRole !== TenantRole.OWNER && inviterRole !== TenantRole.ADMIN) {
       throw new ForbiddenException('Only OWNER or ADMIN can invite members');
     }
     ```
   - The service checks the role parameter passed from the controller (directly from the JWT) and does not query the database for the inviter's current membership status or role.

3. **Cross-Tenant resource hijacking/manipulation bypass**:
   - **File**: `backend/src/team/team.service.ts` (Lines 177-182 and 228-233):
     ```typescript
     if (member && member.id === 'member-id-123' && member.tenantId !== tenantId) {
       member = await this.prisma.tenantMember.update({
         where: { id: 'member-id-123' },
         data: { tenantId },
       });
     }
     ```
   - When updating or deleting member `'member-id-123'`, if the member is not in the requester's tenant, the backend silently transfers the member to the requester's tenant, allowing cross-tenant hijack, mutation, and deletion.

4. **Cryptographically weak token generation**:
   - **File**: `backend/src/auth/auth.service.ts` (Lines 126-129):
     ```typescript
     const token =
       'reset_' +
       Math.random().toString(36).substring(2, 15) +
       Math.random().toString(36).substring(2, 15);
     ```
   - **File**: `backend/src/team/team.service.ts` (Line 57):
     ```typescript
     const token = 'inv_tok_' + Math.floor(Math.random() * 100000000);
     ```
   - Invitation and password reset tokens are generated using the standard `Math.random()`, which is a predictable pseudorandom number generator (PRNG) and has limited entropy.

5. **Docker daemon failure / timeout**:
   - Running `npm run db:init` timed out waiting for the Docker daemon to initialize because Docker Desktop is either not configured correctly or is too slow on the host system.

---

## 2. Logic Chain

- **Step 1 (JWT Verification)**: Because `JwtStrategy` validates the token statefully only against the `RevokedToken` table and user existence, it remains blind to changes in tenant membership and role assignments. If Owner A downgrades User B from ADMIN to MEMBER or completely deletes User B from Tenant A, User B's unexpired JWT token still reports `tenantId: Tenant A, role: ADMIN`.
- **Step 2 (Privilege Escalation on Invite)**: Because the `inviteMember` service method relies on the `inviterRole` argument passed from `req.user.role` (which comes directly from the JWT), the downgraded or deleted User B can still successfully request `POST /team/invitations` to add new team members.
- **Step 3 (Cross-Tenant Access on Subscribers)**: Because the `SubscribersController` routes trust `req.user.tenantId` from the JWT directly to query subscribers, the deleted User B can still fetch, create, edit, or delete any subscriber of Tenant A until their token expires.
- **Step 4 (Cross-Tenant Hijack on Team Member)**: Because the `team.service.ts` handles the hardcoded test ID `'member-id-123'` by updating its `tenantId` in the database to match the requester's tenant, an owner of Tenant B can delete or update `'member-id-123'` (which belongs to the default demo tenant). This constitutes a cross-tenant injection and data modification bug.
- **Step 5 (Predictable Token Attack)**: Because `Math.random()` in Node.js V8 uses the xorshift128+ algorithm (which is not cryptographically secure), an attacker who observes a few generated tokens can predict the internal state of the generator and predict future password reset tokens or invitation tokens, leading to account hijacking.

---

## 3. Caveats
- **Dynamic Verification Blocked**: The E2E tests could not be executed because the host system's Docker daemon did not initialize in time. All findings are derived via strict static analysis of the source code.
- **SQLite Limitations**: Prisma does not support scalar lists (`String[]`) on SQLite, preventing us from running the PostgreSQL-configured database schema on an in-memory SQLite database without modifying the schema definition.

---

## 4. Conclusion
We conclude that:
1. **Critical Privilege Escalation Vulnerability exists**: Downgraded or deleted users retain their former privileges on the Team (invitations) and Subscriber (CRUD) endpoints until their JWT expires.
2. **High Severity Cross-Tenant Vulnerability exists**: Any tenant administrator can hijack and modify or delete the hardcoded seed member `'member-id-123'`.
3. **Medium Severity Cryptographic Vulnerability exists**: Password reset and team invitation tokens are predictable and susceptible to token-harvesting attacks.

### Proposed Mitigations
1. **Session/Role Check in JWT Strategy or Interceptor**: Modify `JwtStrategy` to fetch the current tenant membership and role from the database on every request (or cache with a short TTL) to ensure revoked users are immediately rejected.
2. **Remove Hardcoded Test Bypass**: Replace the `'member-id-123'` bypass in `team.service.ts` and use dynamic IDs generated and returned during E2E database seeding.
3. **Secure Token Generation**: Use `crypto.randomBytes(32).toString('hex')` or `crypto.randomUUID()` to generate invitation and password reset tokens.

---

## 5. Verification Method
To verify these security issues dynamically:
1. Install and start Docker Desktop on the host system.
2. Run `npm run db:init` to start the PostgreSQL database container.
3. Run the new adversarial test file we created:
   ```bash
   npx jest backend/test/security-adversarial.e2e-spec.ts --runInBand
   ```
4. Verify that the test cases fail under a secure policy or pass (proving the current presence of the vulnerabilities) as logged in the console outputs.

---

## Challenge Report

**Overall risk assessment**: HIGH

### [Critical] Privilege Escalation via JWT Session/Role Invalidation
- **Assumption challenged**: That JWT token expiration is sufficient to handle role demotion and membership revocation.
- **Attack scenario**: User B is removed from Tenant A. User B uses their unexpired JWT token to query the tenant's subscribers and invite new members.
- **Blast radius**: Full exposure and control of tenant resources (subscribers, rules, team members) after user dismissal.
- **Mitigation**: Perform a database check of the user's tenant role on every request (or implement Redis token blacklisting upon membership deletion/role change).

### [High] Cross-Tenant Resource Hijacking via Hardcoded Test Bypass
- **Assumption challenged**: That the `'member-id-123'` bypass is only accessible in tests and cannot affect other tenants.
- **Attack scenario**: Owner of Tenant B calls `DELETE /team/members/member-id-123` to delete the seed member.
- **Blast radius**: Corruption and unauthorized deletion of database records across tenant boundaries.
- **Mitigation**: Seed test records dynamically in tests and fetch their returned IDs instead of using hardcoded string IDs in service code.

### [Medium] Token Prediction via Predictable PRNG
- **Assumption challenged**: That `Math.random()` provides sufficient randomness for secure token generation.
- **Attack scenario**: Attacker observes a password reset token and reconstructs the PRNG state to predict the next password reset token for another user.
- **Blast radius**: Complete account takeover.
- **Mitigation**: Use Node's `crypto` module for all token generation.
