# Suggestions — Logic, Security & Authentication

> Generated from a full audit of the codebase on 2026-05-08.
> Findings are grouped by priority. Each item includes the relevant file,
> the exact problem, and a concrete fix.

---

## Priority 1 — Critical (Broken Functionality)

### 1.1 Password reset does not update Better Auth's credential store

**File:** `backend/src/auth.ts` — `POST /api/auth/reset-password`

The reset-password route updates `users.password_hash` (the legacy column) but **never updates `account.password`** — the column Better Auth actually reads when verifying a login. After an admin resets a user's password, that user cannot log in with the new password because Better Auth still reads the old hash from the `account` table.

**Fix:**

```ts
// After updating users.password_hash, also sync the Better Auth account row:
await query(
  `UPDATE account SET password = $1, "updatedAt" = NOW()
   WHERE "userId" = $2 AND "providerId" = 'credential'`,
  [hash, userId],
);
```

---

### 1.2 Seed accounts cannot log in via Better Auth

**File:** `backend/src/db/migrate.ts` — `seedDefaultAccounts()`

The seed function inserts rows into `users` but **never inserts a matching row into the `account` table**. Better Auth requires an `account` row with `providerId = 'credential'` to authenticate a user via email/password. Every seeded account (`admin@lab.com`, `user@lab.com`, `superadmin@lab.com`) will fail to log in.

**Fix:** After inserting each user, also insert into `account`:

```ts
const { rows: [u] } = await query(
  `INSERT INTO users (email, password_hash, role)
   VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id`,
  [account.email, hash, account.role],
);
if (u) {
  await query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'credential', $2, $3, NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    [u.id, u.id, hash],
  );
}
```

---

### 1.3 Account lockout is completely bypassed

**File:** `backend/src/auth.ts` — `recordLoginSuccess()` / `recordLoginFailure()`

Both functions are **defined but never called**. Login is now handled entirely by Better Auth's `/api/auth/sign-in/email` route, which has no knowledge of the custom `failed_login_count` / `locked_until` columns. The account lockout logic (threshold: 5 failures, 15-minute lockout) is therefore a no-op — it never triggers.

**Fix (Option A — recommended):** Use Better Auth's built-in rate limiting instead of custom lockout. Enable it in `better-auth.ts`:

```ts
rateLimit: {
  enabled: true,
  window: 15 * 60,  // 15 minutes
  max: 5,
  storage: "database",
},
```

**Fix (Option B):** Use a Better Auth `hooks.before` middleware on the `sign-in/email` endpoint to check the lockout before Better Auth processes the credential, and a `hooks.after` to call `recordLoginSuccess` / `recordLoginFailure` based on the result.

---

### 1.4 `createUser` is not atomic — partial writes leave broken accounts

**File:** `backend/src/auth.ts` — `createUser()`

The function first inserts into `users`, then into `account`. If the second query fails (e.g. a constraint violation), the user row exists but has no credential — the user cannot log in and cannot re-register (email already taken).

**Fix:** Wrap both inserts in a transaction:

```ts
import { getClient } from './config/database';

async function createUser(email: string, password: string, role: UserRole = 'user'): Promise<User> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows: [user] } = await client.query(
      `INSERT INTO users (email, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4) RETURNING id, email, role, created_at`,
      [email, hash, role, email.split('@')[0]],
    );
    await client.query(
      `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'credential', $2, $3, NOW(), NOW())`,
      [user.id, user.id, hash],
    );
    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

---

## Priority 2 — High (Security Vulnerabilities)

### 2.1 Origin/Host header spoofing bypasses CSRF for all auth routes

**File:** `backend/src/server.ts` lines 146–155

```ts
app.all("/api/auth/*", (req, res, next) => {
  req.headers.origin = "http://localhost:3001";  // ← overwrites real origin
  req.headers.host = "localhost:3001";
  delete req.headers["x-forwarded-host"];
  // ...
  next();
}, toNodeHandler(auth));
```

This middleware **unconditionally overwrites the `Origin` and `Host` headers** before handing the request to Better Auth. This completely disables Better Auth's built-in CSRF/origin check — a request from any origin (including malicious sites) will be accepted as if it came from `localhost:3001`.

This was added to fix a Vite proxy issue, but it is a critical security regression in production.

**Fix:** Only apply the header override in development:

```ts
app.all("/api/auth/*", (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    req.headers.origin = process.env.BETTER_AUTH_URL || "http://localhost:3001";
    req.headers.host = new URL(process.env.BETTER_AUTH_URL || "http://localhost:3001").host;
    delete req.headers["x-forwarded-host"];
    delete req.headers["x-forwarded-proto"];
    delete req.headers["x-forwarded-for"];
  }
  next();
}, toNodeHandler(auth));
```

A better long-term fix is to configure the Vite proxy to preserve the `Origin` header, or to add the backend URL as a trusted origin in Better Auth so no spoofing is needed.

---

### 2.2 Missing `BETTER_AUTH_SECRET` — session cookies can be forged

**File:** `backend/src/lib/better-auth.ts`

No `secret` is set in the config and no `BETTER_AUTH_SECRET` environment variable is defined. Without a secret, Better Auth falls back to an insecure default or generates one randomly on each server restart, which **invalidates all sessions on every restart** and is potentially predictable.

**Fix:** Add to your environment variables (Doppler or `.env`):

```bash
BETTER_AUTH_SECRET=<output of: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3001
```

Better Auth reads `BETTER_AUTH_SECRET` automatically from the environment — no code change is needed once the variable is set.

---

### 2.3 Weak hardcoded seed account passwords committed to source

**File:** `backend/src/db/migrate.ts` lines 448–452

```ts
const SEED_ACCOUNTS = [
  { email: 'superadmin@lab.com', password: 'superadmin1234', role: 'super_admin' },
  { email: 'admin@lab.com',      password: 'admin1234',      role: 'admin'       },
  { email: 'user@lab.com',       password: 'user1234',       role: 'user'        },
];
```

These passwords are trivially guessable and are committed to version control. Anyone with access to the repo knows the default credentials.

**Fix:**

1. Read seed credentials from environment variables instead:
   ```ts
   const SEED_ACCOUNTS = [
     { email: process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@lab.com',
       password: process.env.SEED_SUPERADMIN_PASSWORD,
       role: 'super_admin' },
     // ...
   ];
   ```
2. Throw (or skip seeding) if the password env vars are not set in production.
3. Force a password change on first login for all seed accounts.

---

### 2.4 `/api/run-migrations` endpoint is publicly accessible

**File:** `backend/src/server.ts` line 133

The migration endpoint has no authentication check. Any unauthenticated user or automated scanner can `GET /api/run-migrations` and trigger DDL operations against the production database.

**Fix (short-term):** Add a shared secret check:

```ts
app.get('/api/run-migrations', (req, res, next) => {
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}, async (req, res) => { /* ... */ });
```

**Fix (long-term):** Remove this HTTP endpoint entirely. Run migrations only at server startup (already done) or via a protected CLI script (`npx tsx src/db/migrate.ts`).

---

### 2.5 Auth rate limiter ceiling is far too high

**File:** `backend/src/server.ts` lines 101–107

```ts
max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 1000),
```

1000 requests per 15 minutes (≈ 1 per second) is not a meaningful brute-force defence for an authentication endpoint. A realistic maximum is 10–20 attempts per IP per window.

**Fix:**

```ts
max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
```

---

### 2.6 `crossSubDomainCookies` is always enabled

**File:** `backend/src/lib/better-auth.ts` lines 78–80

```ts
crossSubDomainCookies: { enabled: true }
```

On `localhost` there are no real subdomains, so this setting causes the `Domain=` cookie attribute to be set in ways that can break some browser flows. More importantly, in production this flag should only be used when you actually deploy across multiple subdomains with a shared parent domain.

**Fix:**

```ts
crossSubDomainCookies: {
  enabled: process.env.NODE_ENV === 'production' &&
           !!process.env.COOKIE_DOMAIN,
  domain: process.env.COOKIE_DOMAIN,
},
```

---

### 2.7 No password complexity policy

**File:** `backend/src/auth.ts` — `/register` and `/reset-password` routes

The only password validation is `password.length < 8`. There is no check for complexity (uppercase, number, symbol). An 8-character all-lowercase password is still weak.

**Fix:** Apply a minimum-complexity rule. For example:

```ts
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
if (!PASSWORD_REGEX.test(password)) {
  return res.status(400).json({
    error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number.',
  });
}
```

Apply the same rule in Better Auth's config via `emailAndPassword.password.validate`.

---

## Priority 3 — Medium (Logic & Data Integrity)

### 3.1 Password hash is stored in two places simultaneously

**File:** `backend/src/lib/better-auth.ts` (additionalFields), `backend/src/auth.ts` (reset-password)

`users.password_hash` (legacy column) and `account.password` (Better Auth column) hold the same bcrypt hash. Any code that updates one without updating the other creates a silent desync. The reset-password route already demonstrates this failure mode (see #1.1).

**Fix:** Designate a single source of truth. Better Auth reads `account.password`, so that column is canonical. Remove the `password` entry from `user.additionalFields` in `better-auth.ts` and stop writing to `users.password_hash` for new users. Retain the column for backward-compatibility if needed, but stop relying on it for auth.

---

### 3.2 First-admin bootstrap is vulnerable to a race condition

**File:** `backend/src/auth.ts` — `POST /api/auth/register`

```ts
const isFirst = (await userCount()) === 0;
```

If two simultaneous requests hit this endpoint when the table is empty, both will see `isFirst = true` and both will be inserted as admins. The email-uniqueness constraint will only block the exact same email — two different emails will both succeed.

**Fix:** Use a database-level advisory lock or a `SELECT ... FOR UPDATE` within a transaction to serialize the check-and-insert:

```ts
const client = await getClient();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(1)'); // app-wide lock
  const count = parseInt((await client.query('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL')).rows[0].count, 10);
  const isFirst = count === 0;
  // ... rest of logic using client, then COMMIT
} finally {
  await client.query('ROLLBACK').catch(() => {});
  client.release();
}
```

---

### 3.3 Soft-deleted users retain active Better Auth sessions

**File:** `backend/src/auth.ts` — `removeUser()` + `DELETE /api/auth/users/:id`

`removeUser()` sets `deleted_at` and `is_active = FALSE` on the `users` row, but does **not** invalidate the user's Better Auth sessions. A deleted user whose session cookie is still valid can continue making authenticated API calls until the session naturally expires (default 7 days).

**Fix:** After `removeUser()`, revoke all sessions for the deleted user:

```ts
await removeUser(req.params.id);
// Revoke all active Better Auth sessions for this user
await query(`DELETE FROM session WHERE "userId" = $1`, [req.params.id]);
```

---

### 3.4 `role` field is cast with `as any` throughout — no type safety

**Files:** `backend/src/auth.ts`, `backend/src/lib/better-auth.ts`, `frontend/src/context/AuthContext.tsx`

```ts
role: (session.user as any).role as "admin" | "user" | "super_admin"
```

Because Better Auth's session type does not know about the custom `role` field, it must be cast with `as any`. This defeats TypeScript's type checking — a typo in the field name would go undetected.

**Fix:** Extend Better Auth's type inference. In a declaration file (e.g. `backend/src/types/better-auth.d.ts`):

```ts
import { auth } from '../lib/better-auth';

declare module 'better-auth' {
  interface UserAdditionalFields {
    role: 'super_admin' | 'admin' | 'user';
    is_active: boolean;
  }
}
```

Or use the recommended Better Auth approach:

```ts
// Use $Infer to derive the session user type from your auth config
type SessionUser = typeof auth.$Infer.Session.user;
```

---

### 3.5 `revokeSessions` is called with an `as any` type cast

**File:** `backend/src/auth.ts` line 354

```ts
await (auth.api.revokeSessions as any)({ headers: ..., body: { userId } });
```

The `as any` cast hides type errors and signals that the API call may not be using the correct signature. If the Better Auth API changes, this will silently break at runtime.

**Fix:** Use the correctly typed method. Better Auth's server-side API for revoking a specific user's sessions is:

```ts
await auth.api.revokeUserSessions({
  body: { userId },
  headers: fromNodeHeaders(req.headers),
});
```

Verify the exact method name against `auth.api` in your installed version of Better Auth.

---

## Priority 4 — Low (Code Quality & Cleanup)

### 4.1 Dead code: `recordLoginSuccess`, `recordLoginFailure`, `recordLoginEvent`

**File:** `backend/src/auth.ts` lines 94–137

These three functions are defined but **never called** anywhere in the codebase. They were meaningful when a custom `/login` route existed but are now unreachable because login is delegated to Better Auth.

**Action:** Either delete them (if the custom lockout logic is replaced by Better Auth's rate limiting — see #1.3) or wire them into Better Auth hooks if you want to keep the custom audit trail.

---

### 4.2 Orphaned legacy database tables

**File:** `backend/src/db/migrate.ts`

The following tables were created for the old JWT-based auth system and are now completely unused:

| Table | Migration | Purpose |
|---|---|---|
| `refresh_tokens` | 002 | JWT refresh token storage |
| `auth_sessions` | 009 | Custom session tracking |

Both tables take up space and can confuse future developers. They also have indexes that add write overhead.

**Action:** Add a migration (`015_drop_legacy_auth_tables`) to drop these tables:

```sql
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS refresh_tokens;
```

---

### 4.3 Unused `crypto` import in `better-auth.ts`

**File:** `backend/src/lib/better-auth.ts` line 5

```ts
import crypto from 'crypto';
```

This import is used only for `crypto.randomUUID()`. Since Node.js 18+, `crypto.randomUUID()` is available globally without an import.

**Fix:** Remove the import and change the usage to:

```ts
generateId: () => globalThis.crypto.randomUUID(),
// or simply:
generateId: () => crypto.randomUUID(), // still works without import in Node 18+
```

Or just remove the import since Node's global `crypto` is available.

---

### 4.4 Unused `bcrypt` import in `better-auth.ts`

**File:** `backend/src/lib/better-auth.ts` line 3

```ts
import bcrypt from 'bcryptjs';
```

`bcrypt` is used inline in the password config object — this import is actually used. However, Better Auth already handles bcrypt internally when you provide custom `hash`/`verify` functions. If you remove the `password` additionalField (see #3.1), you may be able to remove this import too depending on your final architecture.

---

### 4.5 `trustedOrigins` includes the backend server's own origin

**File:** `backend/src/lib/better-auth.ts` lines 16–18

```ts
"http://localhost:3001",
"http://127.0.0.1:3001"
```

The backend (`3001`) is listed as a trusted origin. Better Auth's `trustedOrigins` is intended for frontend origins that are allowed to make cross-origin requests. Including the backend itself is unnecessary and slightly broadens the trusted surface.

**Fix:** Remove the backend URLs from `trustedOrigins`. The list should only contain frontend origins:

```ts
trustedOrigins: [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
],
```

---

### 4.6 File comment header in `auth.ts` is outdated

**File:** `backend/src/auth.ts` lines 1–10

The section header still says `"2. Crypto helpers (bcrypt + JWT)"` and mentions `POST /login` — both are from the old JWT implementation which has been removed.

**Action:** Update the section list to reflect the current contents.

---

## Priority 5 — Enhancements & Missing Features

### 5.1 No self-service password reset ("Forgot Password")

Currently only admins can reset passwords via `POST /api/auth/reset-password`. Users who forget their password have no recovery path.

**Recommendation:** Enable Better Auth's built-in reset flow:

```ts
// In better-auth.ts
emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url }) => {
    await sendEmail({ to: user.email, subject: 'Reset your password', body: `Click here: ${url}` });
  },
},
```

Then expose the "Forgot password?" UI on the login page calling `authClient.forgetPassword({ email })`.

---

### 5.2 No email verification

New user accounts are created with `email_verified = FALSE` but no verification email is ever sent and no code path enforces that only verified accounts can log in.

**Recommendation:** Enable email verification in Better Auth:

```ts
emailVerification: {
  sendVerificationEmail: async ({ user, url }) => {
    await sendEmail({ to: user.email, subject: 'Verify your email', body: `Click here: ${url}` });
  },
  sendOnSignUp: true,
},
```

---

### 5.3 Session information is not surfaced to users

Users have no way to see or invalidate their own active sessions (e.g. "Sign out of all devices").

**Recommendation:** Add a "My Sessions" page that calls `authClient.listSessions()` and allows `authClient.revokeSession({ token })` for individual sessions.

---

### 5.4 No TOTP / two-factor authentication

For an application that handles privileged admin accounts, 2FA would significantly reduce the impact of a compromised password.

**Recommendation:** Add the Better Auth `twoFactor` plugin:

```ts
import { twoFactor } from "better-auth/plugins/two-factor";

plugins: [twoFactor()],
```

---

### 5.5 Audit log is only written for password resets

The `audit_log` table and `writeAuditLog()` function exist but are only called in the password-reset route. High-value events like user creation, user deletion, login failures, and role changes are not audited.

**Recommendation:** Call `writeAuditLog()` in every admin action (user create, user delete) and wire login success/failure events via Better Auth hooks.

---

*End of suggestions.*
