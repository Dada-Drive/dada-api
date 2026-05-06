# DADA Backend — Engineering Rules

**Stack:** Node.js · TypeScript · Express.js · Sequelize · PostgreSQL · Redis · Socket.IO · BullMQ  
**Enforced from:** Day 1 of rebuild  
**Audience:** Every developer contributing to this codebase

---

## 1. Coding Standards

### TypeScript Configuration
- **Strict mode enabled** — `strict: true` in `tsconfig.json` (includes `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `noImplicitReturns`)
- **No `any` type** — use `unknown` with type narrowing, or define a proper interface. The only exception: third-party library types that genuinely require `any` (wrap them in typed adapters)
- **Explicit return types** on all exported functions and all service/controller methods
- **`async/await` only** — no `.then()` chains, no raw callback patterns
- **No `console.log`** — use the Winston logger (`logger.info`, `logger.error`, `logger.warn`, `logger.debug`). Every log statement must include context (correlation ID attached automatically)
- **No `var`** — use `const` by default, `let` only when reassignment is needed

### Naming Conventions
| Element | Convention | Example |
|---------|-----------|---------|
| Variables, functions | camelCase | `rideService`, `calculateFare()` |
| Classes, interfaces, types | PascalCase | `RideService`, `WalletTransaction`, `ApiResponse<T>` |
| Enums | PascalCase (name), PascalCase (members) | `RideStatus.InProgress` |
| Constants | UPPER_SNAKE_CASE | `MAX_OTP_ATTEMPTS`, `FARE_CONFIG` |
| Files | camelCase | `rideService.ts`, `walletModel.ts` |
| Test files | `*.test.ts` | `rideService.test.ts` |
| Directories | lowercase | `controllers/`, `services/`, `models/` |
| Database columns | snake_case | `created_at`, `driver_id`, `is_active` |
| API endpoints | kebab-case | `/shared-rides`, `/ride-stops` |
| Error codes | UPPER_SNAKE_CASE | `RIDE_NOT_FOUND`, `INSUFFICIENT_BALANCE` |

### Code Quality
- **ESLint + Prettier** enforced via husky pre-commit hooks — code that doesn't pass lint does not get committed
- **Max file length: 300 lines** — if a file exceeds this, split by responsibility (e.g., separate validation logic from business logic)
- **No dead code** — remove commented-out code, unused imports, unreachable branches
- **No magic numbers** — extract to named constants in config or at module top
- **Prefer discriminated unions** for state modeling:
  ```typescript
  type RideResult = 
    | { status: 'success'; ride: Ride }
    | { status: 'expired'; rideId: string }
    | { status: 'already_accepted'; acceptedBy: string };
  ```
- **Branded types for IDs** (optional but recommended):
  ```typescript
  type UserId = string & { readonly __brand: 'UserId' };
  type RideId = string & { readonly __brand: 'RideId' };
  ```

### Import Order
1. Node.js built-ins (`path`, `crypto`)
2. External packages (`express`, `sequelize`)
3. Internal aliases (`@/services`, `@/models`)
4. Relative imports (`./helpers`)
5. Type-only imports last

---

## 2. Architecture Rules

### 3-Layer Architecture

```
Controller (HTTP Layer)
    │  Receives request, validates input, calls service, sends response
    │  NEVER contains business logic
    ▼
Service (Business Logic Layer)
    │  Orchestrates operations, enforces rules, manages transactions
    │  NEVER accesses req/res objects
    ▼
Model (Data Access Layer)
    │  Sequelize model definitions, scopes, hooks
    │  NEVER contains business logic
```

### Layer Rules

**Controllers:**
- Parse request parameters, body, query, headers
- Call exactly one service method per request (exceptions: batch operations)
- Use `asyncHandler` wrapper — never write try-catch
- Call `sendSuccess`, `sendCreated`, `sendPaginated`, or `sendError` — never `res.json()` directly
- Do NOT import models — only services
- Do NOT contain conditionals based on business rules
- Do NOT call other controllers

**Services:**
- Contain all business logic: validation beyond input format, authorization rules, state transitions, calculations
- Accept typed parameters — never `req`, `res`, or `next`
- Return domain objects or throw `AppError`
- Own database transactions (BEGIN/COMMIT/ROLLBACK happen here)
- May call other services (but no circular dependencies)
- Do NOT import Express types
- Do NOT send HTTP responses
- Do NOT emit socket events inside transactions (emit after commit)

**Models:**
- Sequelize model definitions: columns, types, constraints, associations
- Model scopes for reusable query patterns
- Model hooks for auto-computed fields only (e.g., `updated_at`)
- Do NOT contain business logic
- Do NOT import services

### Dependency Direction
```
controllers → services → models
     ↓            ↓
   middlewares   utils
     ↓
   types (shared, no dependencies)
```

No circular dependencies. If service A needs service B and B needs A, extract the shared logic into a new service C.

### File Organization
- One file = one concern (one controller, one service, one model)
- Group by domain module, not by layer:
  ```
  src/services/rideService.ts      ← Ride business logic
  src/controllers/rideController.ts ← Ride HTTP handlers
  src/models/Ride.ts               ← Ride model definition
  src/routes/rideRoutes.ts         ← Ride route definitions
  ```
- Shared code in `src/utils/`, `src/types/`, `src/config/`
- Never hardcode values — use `src/config/` for all configurable parameters

---

## 3. Database Rules

### Transactions
- **ALL multi-step mutations** must run inside explicit Sequelize transactions
- **Financial operations** (wallet credits, debits, commission): use `SERIALIZABLE` isolation level + `lock: Transaction.LOCK.UPDATE` (equivalent to `SELECT ... FOR UPDATE`)
- **Never modify wallet balance** outside a transaction
- Wrap with `sequelize.transaction()` — pass the transaction object to every query inside the block:
  ```typescript
  await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (t) => {
    const wallet = await Wallet.findOne({ where: { owner_id: userId }, lock: t.LOCK.UPDATE, transaction: t });
    // ... mutations ...
  });
  ```

### Required Transactional Operations
| Operation | Isolation Level | Row Lock |
|-----------|----------------|----------|
| `confirmOnlineTopUp` | SERIALIZABLE | FOR UPDATE on wallet_transactions row |
| `completeRide` (fare + commission + wallet) | SERIALIZABLE | FOR UPDATE on wallet row |
| `acceptRide` (create offer) | READ COMMITTED | FOR UPDATE on ride row |
| `pickDriver` (accept + reject + update) | READ COMMITTED | FOR UPDATE on ride row |
| `register` (user + wallet) | READ COMMITTED | None (new rows) |
| `submitRating` + driver avg update | READ COMMITTED | FOR UPDATE on driver_profiles row |
| `adminTopup` | SERIALIZABLE | FOR UPDATE on wallet row |

### Migrations
- **Sequelize CLI migrations only** — never use `sequelize.sync()` or `sync({ alter: true })` in any environment
- Every migration has both `up` and `down` functions
- Destructive migrations (drop column, drop table) require explicit team approval
- Migrations run automatically in CI before tests
- Never modify a migration that has been applied to staging or production — create a new one

### Indexes
- Every foreign key column gets an index
- Every column used in `WHERE` clauses on frequently-called queries gets an index
- Composite indexes: most selective column first
- Partial indexes for filtered queries (e.g., `WHERE is_online = true AND is_approved = true`)
- Name indexes descriptively: `idx_rides_status_expires_at`

### Constraints
- `CHECK (balance >= 0)` on wallets — absolute financial safety net
- `UNIQUE` on `wallet_transactions.reference_id` WHERE NOT NULL — idempotency guarantee
- `CHECK (score BETWEEN 1 AND 5)` on ratings
- `CHECK (commission_rate BETWEEN 0 AND 100)` on rides
- Use database constraints as the last line of defense — application code is the first

### Soft Delete
- Use `deleted_at` (nullable TIMESTAMP) column where records should be preserved (users, drivers)
- Sequelize `paranoid: true` on applicable models
- Hard delete for ephemeral data (OTP codes, expired tokens)

---

## 4. API Design Rules

### URL Structure
- All routes under `/api/v1/` prefix
- Resource-oriented URLs: nouns, not verbs
- Plural resource names: `/rides`, `/users`, `/wallets`
- Nested resources for parent-child: `/rides/:id/stops`, `/rides/:id/offers`
- Actions as sub-resources when CRUD doesn't fit: `/rides/:id/accept`, `/rides/:id/cancel`

### HTTP Methods
| Method | Usage | Response Code |
|--------|-------|---------------|
| GET | Read resource(s) | 200 |
| POST | Create resource or trigger action | 201 (create) or 200 (action) |
| PATCH | Partial update | 200 |
| PUT | Full replacement (rarely used) | 200 |
| DELETE | Remove resource | 204 |

### Response Format

**Success (single resource):**
```json
{
  "success": true,
  "data": { "id": "...", "status": "..." }
}
```

**Success (collection with pagination):**
```json
{
  "success": true,
  "data": [{ "id": "..." }, { "id": "..." }],
  "meta": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "RIDE_NOT_FOUND",
    "message": "The requested ride does not exist",
    "details": {}
  }
}
```

### Pagination
- Query params: `?page=1&limit=20`
- Defaults: page 1, limit 20
- Maximum limit: 100 (reject higher values)
- Response includes `meta.total`, `meta.page`, `meta.limit`, `meta.pages`
- Every list endpoint MUST be paginated — no unbounded queries

### Filtering & Sorting
- Filter via query params: `?status=completed&role=driver`
- Sort via query params: `?sort=created_at:desc`
- Whitelist allowed filter/sort fields per endpoint — reject unknown fields
- Multiple sort fields: `?sort=status:asc,created_at:desc`

### Field Selection
- `?fields=id,status,fare` returns only specified fields
- Always return `id` regardless of field selection
- Whitelist allowed fields — never expose internal columns

### Input Validation
- Validate ALL inputs at the route level using express-validator chains
- Validation runs BEFORE the request reaches the controller
- Text fields: max 500 characters default (configurable per field)
- Phone numbers: 8–15 digits, valid patterns
- UUIDs: validate format before database lookup
- Enums: validate against allowed values
- Coordinates: lat -90 to 90, lng -180 to 180
- Amounts: positive numbers, max 2 decimal places

### Security in Responses
- NEVER return `password_hash` in any response
- NEVER return raw tokens (refresh tokens visible only at issuance)
- NEVER return internal error details in production (log them, return generic message)
- Strip `__v`, internal audit fields from responses
- Sanitize user-generated content in responses (XSS prevention)

### Backward Compatibility
- Never remove or rename response fields in a version — add new fields, deprecate old ones
- Never change response field types (string → number)
- New required request fields = new API version
- Document breaking changes in changelog

---

## 5. Security Rules

### Authentication
- JWT access tokens: 15-minute expiry, signed with `JWT_SECRET`
- JWT refresh tokens: 30-day expiry, signed with `REFRESH_TOKEN_SECRET`
- Access token contains: `{ userId, role, jti, iat, exp }` — minimal claims
- `jti` (JWT ID): unique per token, used for blacklisting
- Token blacklist in Redis with TTL matching remaining token lifetime
- Password change, account suspension, explicit logout → blacklist all active tokens

### Password Security
- Hashing: bcrypt with 12 salt rounds (never change to lower)
- Minimum 8 characters, 1 uppercase, 1 lowercase, 1 digit
- Never log passwords, even partially
- Never return password_hash in any API response
- Rate limit login attempts: 10 per 15 minutes per IP

### Input Security
- Parameterized queries only (Sequelize handles this — never use raw SQL with string interpolation)
- Input length limits on ALL text fields (max 500 chars default)
- Request body size limit: 1MB (10MB for image upload endpoints only)
- No MongoDB-style sanitization (`$`, `.` removal) — irrelevant for PostgreSQL and breaks legitimate input

### File Upload Security
- **Server-side processing only** — clients upload to the backend, NOT directly to cloud storage
- **MIME type validation** using file magic bytes (not just the `Content-Type` header or file extension)
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp` only — reject everything else
- **Max file size**: 5MB per file, configurable via `src/config/uploadConfig.ts`
- **Max files per request**: 5
- **Filename sanitization**: strip path traversal (`../`), special characters, null bytes — generate a UUID-based filename server-side
- **No execution risk**: uploaded files stored outside `src/` and `dist/`, never served directly by Express (use cloud URLs or a dedicated static route with `Content-Type: application/octet-stream`)
- **Rate limiting**: max 10 uploads per user per hour
- **Storage**: local disk in development (`uploads/` directory), S3/Cloudinary in production (configurable via `UPLOAD_STORAGE` env var)
- **Cleanup**: delete orphaned uploads (e.g., if user updates avatar, delete the old one)

### Network Security
- CORS: restricted to `ALLOWED_ORIGINS` environment variable — no wildcards in production
- Helmet: enabled with default configuration (HSTS, X-Frame-Options, X-Content-Type-Options, etc.)
- Database SSL: `rejectUnauthorized: true` in production — no exceptions
- Rate limiting on ALL auth endpoints (Redis-backed for multi-instance consistency)
- `X-Powered-By` header removed

### Secrets Management
- All secrets in `.env` — never hardcoded in source
- `.env` is in `.gitignore` — never committed
- `.env.example` contains all keys with empty values and documentation
- Production secrets managed via hosting platform's secret manager (Railway, etc.)
- Rotate JWT secrets periodically (plan for zero-downtime rotation)

### OTP Security
- 6-digit codes, bcrypt-hashed before storage
- 5-minute expiry
- Max 3 verification attempts per code
- Max 3 OTP sends per phone per hour
- Global rate limit: 100 OTP sends per minute (prevent SMS bombing)
- Validate phone format strictly before sending (prevent cost attacks)

---

## 6. Error Handling Rules

### AppError
- ALL operational errors (user input, business rule violations, not found) use `AppError`:
  ```typescript
  throw new AppError('Insufficient wallet balance', 400, 'INSUFFICIENT_BALANCE');
  ```
- Constructor: `(message: string, statusCode: number, code: string, details?: Record<string, unknown>)`
- `isOperational: true` — distinguishes from programmer errors

### asyncHandler
- Every controller method is wrapped in `asyncHandler`:
  ```typescript
  router.post('/rides', asyncHandler(rideController.requestRide));
  ```
- `asyncHandler` catches rejected promises and passes to `next(error)`
- Controllers never have try-catch blocks

### Centralized Error Handler
- Single error handling middleware in `app.ts` — the ONLY place HTTP error responses are sent
- Handles:
  - `AppError` (operational) → send error code, message, status code
  - `SequelizeValidationError` → 400 with field details
  - `SequelizeUniqueConstraintError` → 409 with constraint details
  - Unknown errors → log full error + stack trace, send generic 500 with correlation ID
- In production: never expose stack traces, database error messages, or internal details

### Error Classification
| Type | Example | Action |
|------|---------|--------|
| Operational (expected) | Invalid input, not found, unauthorized | Return appropriate HTTP error |
| Programmer error (bug) | TypeError, null reference, assertion failure | Log + alert + crash (process manager restarts) |
| External service failure | FCM down, Flouci timeout | Retry via queue, return 502/503 to client |

### Error Logging
- Operational errors: `logger.warn` with error code, message, user context
- Programmer errors: `logger.error` with full stack trace, then `process.exit(1)`
- External failures: `logger.error` with service name, response status, latency
- All error logs include correlation ID for request tracing

### Rules
- Never `catch(() => {})` — empty catch blocks are forbidden
- Never swallow errors silently — always log or propagate
- Never send notifications/socket events that might fail inside database transactions
- Never return internal error messages to clients in production
- Use Sentry `captureException` for all unexpected errors

---

## 7. Real-Time Rules (Socket.IO)

### Event Naming
- Format: `domain:action` — lowercase, colon-separated
- Examples: `ride:status_changed`, `ride:offer`, `location:update`, `driver:approaching`
- Never use generic names like `message`, `update`, or `data`

### Authentication
- Every socket connection MUST authenticate via JWT in handshake:
  ```typescript
  const socket = io('/riders', { auth: { token: 'Bearer ...' } });
  ```
- Server validates JWT on connection — reject with error if invalid/expired/blacklisted
- Attach user data to `socket.data.user` — available in all event handlers
- Periodic token check: disconnect sockets with expired tokens (check every 5 minutes)

### Data Safety
- Never broadcast sensitive data — filter payload per recipient
- Driver location updates visible only to: the driver, the matched rider (in active ride room)
- Ride offers visible only to the requesting rider
- Financial data (wallet balance, transaction amounts) never sent via socket — fetch via HTTP

### Rooms
- User personal room: `user:{userId}` — for targeted notifications
- Ride room: `ride:{rideId}` — driver + rider join when ride is accepted
- Driver joins ride room on acceptance, leaves on completion/cancellation
- Rider joins ride room on driver assignment, leaves on completion/cancellation

### Emission Timing
- **Socket events MUST be emitted AFTER database transaction commits** — never inside `BEGIN/COMMIT`
- If transaction rolls back, the event must not be sent
- Pattern:
  ```typescript
  const result = await sequelize.transaction(async (t) => {
    // ... mutations ...
    return { ride, shouldNotify: true };
  });
  // Transaction committed — safe to emit
  if (result.shouldNotify) {
    socketEmitter.emitToRideRoom(result.ride.id, 'ride:status_changed', { status: result.ride.status });
  }
  ```

### Fallback
- Keep HTTP endpoints available for clients that haven't migrated to sockets
- Socket.IO configured with `transports: ['websocket', 'polling']` — automatic fallback
- Clients should implement reconnection with exponential backoff

---

## 8. Testing Rules

### General
- No PR merged without tests for new or changed logic
- Test file location: alongside source file (`rideService.ts` → `__tests__/rideService.test.ts`)
- Each test suite is self-contained — creates its own data, cleans up after
- Tests MUST NOT depend on execution order
- Tests MUST NOT call real external APIs — use `nock` for HTTP mocking

### Test Structure
- Use `describe` blocks grouped by method/feature
- Use `it` with descriptive names: `it('rejects ride completion when wallet balance insufficient')`
- Arrange → Act → Assert pattern
- One assertion focus per test (multiple `expect` calls are fine if testing one behavior)

### Financial Tests
- Test concurrent operations with `Promise.all` — this is mandatory for wallet and ride acceptance
- Verify exact amounts (use `toEqual`, not `toBeCloseTo` for TND amounts)
- Verify transaction records exist after operations
- Verify wallet balance never negative, even under concurrent load:
  ```typescript
  const results = await Promise.all(
    Array(10).fill(null).map(() => walletService.confirmOnlineTopUp(paymentId))
  );
  const wallet = await Wallet.findOne({ where: { owner_id: userId } });
  expect(wallet.balance).toEqual(originalBalance + topupAmount); // Exactly once
  ```

### Database in Tests
- Use separate database instance (from `docker-compose.test.yml`)
- Run migrations before test suite
- Clean data between suites: `TRUNCATE ... CASCADE` or transaction rollback
- Never test against production or staging databases

### Mocking Rules
- Mock external HTTP APIs with `nock` — verify request payloads in assertions
- Mock Redis in unit tests (use `ioredis-mock` or in-memory store)
- Do NOT mock Sequelize in service tests — test against real database
- Do NOT mock internal services in integration tests

### Coverage Thresholds
| Layer | Minimum Coverage |
|-------|-----------------|
| Models | 80% |
| Services | 70% |
| Middlewares | 90% |
| Controllers | 50% |
| Overall | 60% |

Coverage MUST NOT drop below thresholds on any PR. CI fails if thresholds are not met.

---

## 9. Git & Commit Rules

### Commit Messages
- **Conventional Commits** format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`
- Scope: module name in parentheses: `feat(wallet): add idempotency key support`
- Description: imperative mood, lowercase, no period at end
- Body (optional): explain WHY, not WHAT (the diff shows what)
- Footer: `BREAKING CHANGE:` if applicable

### Examples
```
feat(rides): add ride status state machine with validated transitions
fix(wallet): prevent double-spending on concurrent topup confirmations
refactor(auth): extract OTP rate limiting into dedicated middleware
test(wallet): add concurrent topup and negative balance tests
docs(api): add endpoint documentation for ride lifecycle
chore(deps): upgrade sequelize to 6.38.0
perf(drivers): add partial index for nearby driver query
ci: add GitHub Actions workflow for automated testing
```

### Branch Naming
- `feat/description` — new features
- `fix/description` — bug fixes
- `refactor/description` — code restructuring
- `test/description` — adding or fixing tests
- `chore/description` — tooling, dependencies, config
- Description: lowercase, hyphen-separated, brief

### Workflow
- `main` branch is protected — no direct pushes
- All changes via pull request
- PR requires: passing CI (lint + test + build), at least 1 review (when team > 1)
- **Squash merge** to main — clean linear history
- Delete feature branch after merge
- One logical change per commit — if a PR has multiple concerns, split it

### Tagging
- Semantic versioning: `v1.0.0`, `v1.1.0`, `v1.0.1`
- Tag production deployments: `git tag v1.0.0`
- Changelog updated with each version tag

---

## 10. Environment & Config Rules

### Environment Variables
- All configuration from environment variables — zero hardcoded values in source
- `src/config/validateEnv.ts` runs at startup — process crashes if required vars missing
- No optional variables with implicit defaults that change behavior silently — be explicit

### .env Structure
```bash
# Server
NODE_ENV=development          # development | staging | production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dada
DB_SSL=false                  # true in production (rejectUnauthorized: true)
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=                   # min 256-bit random string
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=         # different from JWT_SECRET
REFRESH_TOKEN_EXPIRES_IN=30d

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_ANDROID_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=

# OTP Providers
VONAGE_API_KEY=
VONAGE_API_SECRET=
VONAGE_WHATSAPP_FROM=
EASYSENDSMS_API_KEY=
OTP_SENDER=DadaDrive
OTP_EXPIRES_IN=5              # minutes
OTP_MAX_ATTEMPTS=3

# Firebase (FCM)
FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=

# Flouci Payment
FLOUCI_APP_TOKEN=
FLOUCI_APP_SECRET=

# HERE Maps
HERE_API_KEY=

# CORS
ALLOWED_ORIGINS=              # comma-separated: https://app.dadadrive.tn,https://admin.dadadrive.tn

# Sentry
SENTRY_DSN=

# Logging
LOG_LEVEL=info                # error | warn | info | http | debug
```

### Configuration Access
- Create typed config objects in `src/config/`:
  ```typescript
  // src/config/fareConfig.ts
  export const FARE_CONFIG = {
    BASE_FARE: 1.5,
    PRICE_PER_MINUTE: 0.5,
    // ...
  } as const;
  ```
- Never access `process.env` directly outside `src/config/` files
- Export typed config objects that services import

### Environment-Specific Behavior
- **No `if (process.env.NODE_ENV === 'production')` branches in application code**
- All environment differences expressed as configuration values:
  - `DB_SSL=true` vs `DB_SSL=false` (not `if (prod) ssl = true`)
  - `LOG_LEVEL=error` vs `LOG_LEVEL=debug` (not `if (dev) verbose()`)
  - `ALLOWED_ORIGINS=*` (dev) vs `ALLOWED_ORIGINS=https://app.dadadrive.tn` (prod)
- Exception: development-only debugging tools (Bull Board, Swagger UI) gated by `NODE_ENV !== 'production'`

### Docker Environment
- `docker-compose.yml` uses `.env` for local development
- CI uses GitHub Secrets injected as environment variables
- Production uses hosting platform's secret management
- Never bake environment variables into Docker images

---

## Appendix: Quick Reference

### Do
- Use TypeScript strict mode everywhere
- Wrap all mutations in transactions
- Lock rows with `FOR UPDATE` for financial operations
- Use `AppError` with machine-readable codes for all operational errors
- Test concurrent operations with `Promise.all`
- Emit socket events AFTER transaction commit
- Validate all inputs at the route level
- Log with correlation IDs
- Use Redis for caching, rate limiting, and geospatial queries

### Don't
- Use `any` type
- Use `console.log`
- Use `.then()` chains
- Use `sequelize.sync()` in any environment
- Write business logic in controllers
- Access `req`/`res` in services
- Hardcode configuration values
- Send sensitive data in error responses
- Skip transactions for multi-step database operations
- Emit socket events inside database transactions
- Write empty catch blocks
- Merge PRs without tests
- Push directly to main
