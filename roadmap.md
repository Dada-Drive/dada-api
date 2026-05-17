# DADA Backend — Rebuild Roadmap

**Stack:** Node.js · TypeScript · Express.js · Sequelize · PostgreSQL · Redis · Socket.IO · BullMQ · Docker  
**Target:** Production-ready ride-sharing backend serving Android (Kotlin) + iOS (Swift) clients  
**Scale:** 0–5,000 concurrent users · 1–3 developers  
**Currency:** TND (Tunisian Dinar) · DECIMAL(10,2)

> **Status (2026-05-14):** Phases 1–12 are complete. Phase 13 was inserted after the mobile redesign to cover the negotiation-based pricing flow and service categories — schema-changing features that must land before production hardening. The original "CI/CD & Production Hardening" phase has been renumbered to Phase 14 as the final production-readiness gate.

---

## Phase 1: Project Scaffolding & Config

### Goals
- Establish TypeScript project with strict compilation, linting, and formatting
- Define directory structure mirroring the 3-layer architecture
- Configure environment management for dev/staging/prod
- Set up Docker + docker-compose for local development (Node, PostgreSQL, Redis)
- Create base Express server with graceful shutdown
- Set up Swagger (OpenAPI 3.0) for API documentation and mobile team integration
- Add upload configuration placeholder (multer + config for Phase 5)

### Tasks
- [x] Initialize Node.js project: `npm init`, install TypeScript, ts-node-dev
- [x] Configure `tsconfig.json` with strict mode, path aliases (`@/config`, `@/services`, `@/models`, etc.)
- [x] Install and configure ESLint (typescript-eslint) + Prettier with pre-commit hooks (husky + lint-staged)
- [x] Create directory structure:
  ```
  src/
  ├── config/          # db.ts, redis.ts, firebase.ts, fareConfig.ts, validateEnv.ts
  ├── controllers/     # HTTP request handlers
  ├── services/        # Business logic
  ├── models/          # Sequelize model definitions
  ├── routes/          # Express route definitions
  ├── middlewares/     # auth, validation, rateLimiter, errorHandler, correlationId
  ├── sockets/         # Socket.IO namespaces and handlers
  ├── jobs/            # BullMQ job processors
  ├── types/           # Shared TypeScript types, enums, interfaces
  ├── utils/           # AppError, asyncHandler, responseHelpers, jwt, logger
  ├── migrations/      # Sequelize CLI migrations
  ├── seeders/         # Development seed data
  ├── app.ts           # Express app setup, middleware mounting, route registration
  └── server.ts        # Entry point: HTTP server, graceful shutdown, startup sequence
  ```
- [x] Create `.env.example` with all required variables (see Phase 4 for full list)
- [x] Create `src/config/validateEnv.ts` — crash on missing required env vars at startup
- [x] Create `Dockerfile` (multi-stage: build with `node:20-alpine`, copy compiled JS, production deps only)
- [x] Create `docker-compose.yml`: app (with hot-reload volume), PostgreSQL 16, Redis 7
- [x] Create `docker-compose.test.yml`: isolated PostgreSQL + Redis for test runs
- [x] Implement `src/server.ts` with:
  - HTTP server creation
  - Startup sequence: validate env → connect DB → connect Redis → init Firebase → start listening
  - `SIGTERM`/`SIGINT` handlers: stop accepting connections → drain in-flight requests → close DB pool → close Redis → exit 0
  - Unhandled rejection / uncaught exception handlers (log + exit 1)
- [x] Create `src/app.ts` with:
  - Helmet (security headers)
  - CORS (restricted to `ALLOWED_ORIGINS` from env)
  - Morgan (structured request logging)
  - JSON body parser with 1MB size limit
  - URL-encoded parser
  - Correlation ID middleware
  - Swagger UI at `/docs` (gated behind `NODE_ENV !== 'production'`)
  - Route mounting (placeholder)
  - 404 handler
  - Global error handler

#### Swagger / OpenAPI Documentation
- [x] Install `swagger-jsdoc` + `swagger-ui-express`
- [x] Create `src/config/swagger.ts` — OpenAPI 3.0 spec config (title, version, servers, scans route files for JSDoc annotations)
- [x] Mount Swagger UI at `/docs` (development and staging only, gated behind `NODE_ENV !== 'production'`)
- [x] Expose spec JSON at `GET /api/spec.json` for programmatic access (mobile teams, Postman import, openapi-generator)
- [x] Add `@openapi` JSDoc annotation to health route as working example pattern
- [x] All future routes (Phase 5+) must include `@openapi` JSDoc annotations for Swagger

#### Upload Configuration (Placeholder for Phase 5)
- [x] Install `multer` as runtime dependency
- [x] Create `src/config/uploadConfig.ts` with constants: `MAX_FILE_SIZE` (5MB), `ALLOWED_MIME_TYPES` (image/jpeg, image/png, image/webp), `MAX_FILES_PER_REQUEST` (5), `UPLOAD_DIR`
- [x] Add `uploads/` to `.gitignore`

### Deliverables
- `package.json` with all base dependencies and scripts (`dev`, `build`, `start`, `lint`, `format`, `test`)
- `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`
- `Dockerfile`, `docker-compose.yml`, `docker-compose.test.yml`
- `.env.example` with all keys documented
- Running Express server that responds to `GET /health` with `{ status: "ok" }`
- Swagger UI accessible at `/docs` with OpenAPI 3.0 spec
- Spec JSON available at `GET /api/spec.json` for mobile teams
- Upload config placeholder in `src/config/uploadConfig.ts`
- `docker-compose up` starts all services successfully

### Checkpoint
- `npm run build` compiles without errors
- `npm run lint` passes
- `docker-compose up` brings up app + PostgreSQL + Redis
- `curl localhost:3000/health` returns 200
- `curl localhost:3000/docs/` returns Swagger UI
- `curl localhost:3000/api/spec.json` returns valid OpenAPI JSON
- `curl localhost:3000/nonexistent` returns 404 with `{ success: false, error: { code: "NOT_FOUND" } }`
- Sending `SIGTERM` to the process logs clean shutdown message and exits 0

### Commit Strategy
- `chore: initialize TypeScript project with strict config`
- `chore: add directory structure and utility stubs`
- `feat: add base Express server with health check and graceful shutdown`
- `feat: add Swagger UI at /docs with OpenAPI 3.0 config`
- `chore: add ESLint, Prettier, and pre-commit hooks`
- `chore: add Docker and docker-compose setup`

---

## Phase 2: Database & Sequelize

### Goals
- Initialize Sequelize with TypeScript and migration-based schema management
- Define all 14 models preserving the exact schema from the current database
- Establish all associations (1:1, 1:N, M:N)
- Add ALL missing indexes and constraints identified in the audit
- Create seed data for development

### Tasks

#### Sequelize Setup
- [x] Install `sequelize`, `sequelize-cli`, `pg`, `pg-hstore` (plain Sequelize v6 with `Model.init()` + `InferAttributes` — no decorators)
- [x] Create `src/models/index.ts`: Sequelize instance with connection pool (min: 2, max: 10), SSL config (`rejectUnauthorized: true` in production), query logging via Winston
- [x] Create `.sequelizerc` pointing to TypeScript-compatible paths
- [x] Create `src/config/database.js` for Sequelize CLI config

#### Model Definitions (14 models)
- [x] `User` — id (UUID, PK), full_name, email (unique, nullable), phone (unique), password_hash, role (ENUM: rider/driver/admin/pending), avatar_url, google_id (nullable), is_verified, is_active, deleted_at (paranoid), created_at, updated_at
- [x] `DriverProfile` — id (UUID, PK), user_id (FK → users, 1:1), license_number, license_expiry, cin, cin_delivered_at, cin_photo_front, cin_photo_back, license_photo_front, license_photo_back, is_approved, is_online, rating (DECIMAL 3,2), total_rides, last_lat (DECIMAL 10,8), last_lng (DECIMAL 11,8), last_seen_at, deleted_at (paranoid), created_at, updated_at
- [x] `Vehicle` — id (UUID, PK), driver_id (FK → driver_profiles, 1:1), make, model, year, plate_number (unique), color, vehicle_type (ENUM: economy/premium/van), doors, seats, photo_front, photo_side, photo_back, is_active, created_at, updated_at
- [x] `Ride` — id (UUID, PK), rider_id (FK → users), driver_id (FK → users, nullable), passenger_name, passenger_phone, vehicle_type (ENUM), status (ENUM: pending/offered/accepted/in_progress/completed/cancelled), pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, distance_km, estimated_minutes, calculated_fare, final_fare, is_shared, shared_seats_available, commission_rate, commission_amount, scheduled_at, expires_at, started_at, arrived_at, approached_notified, completed_at, cancelled_by, cancel_reason, created_at, updated_at
  - **ADDED:** `CHECK (commission_rate BETWEEN 0 AND 100)`
- [x] `RideOffer` — id (UUID, PK), ride_id (FK → rides), driver_id (FK → users), status (ENUM: pending/accepted/rejected/expired), offered_fare, created_at, updated_at
  - **ADDED:** `UNIQUE(ride_id, driver_id)`
- [x] `RideStop` — id (UUID, PK), ride_id (FK → rides), address, lat, lng, order_index, arrived_at, left_at, wait_minutes, created_at
  - **ADDED:** `UNIQUE(ride_id, order_index)`
- [x] `SharedRidePassenger` — id (UUID, PK), primary_ride_id (FK → rides), passenger_ride_id (FK → rides), rider_id (FK → users), pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, estimated_fare, final_fare, pickup_order, dropoff_order, picked_up_at, dropped_off_at, status (ENUM: pending/confirmed/picked_up/dropped_off/cancelled), created_at, updated_at
  - **ADDED:** `UNIQUE(primary_ride_id, rider_id)`
- [x] `Rating` — id (UUID, PK), ride_id (FK → rides, unique), rider_id (FK → users), driver_id (FK → users), score, comment, created_at
  - **ADDED:** `CHECK (score BETWEEN 1 AND 5)`
- [x] `Wallet` — id (UUID, PK), owner_id (FK → users, unique), balance (DECIMAL 12,2), currency (default 'TND'), status (ENUM: active/suspended/closed), created_at, updated_at
  - **ADDED:** `CHECK (balance >= 0)`
- [x] `WalletTransaction` — id (UUID, PK), wallet_owner_id (FK → users), type (ENUM: topup_manual/topup_online/commission/ride_earning/withdrawal), amount (DECIMAL 12,2), status (ENUM: pending/completed/failed/refunded), reference_id, description, created_at
  - **ADDED:** `UNIQUE (reference_id) WHERE reference_id IS NOT NULL` (partial unique)
  - **ADDED:** `CHECK (amount > 0)`
- [x] `OtpCode` — id (UUID, PK), phone, code_hash, attempts, is_used, expires_at, created_at
- [x] `RefreshToken` — id (UUID, PK), user_id (FK → users), token (unique), expires_at, created_at
- [x] `DeviceToken` — id (UUID, PK), user_id (FK → users), token, platform (ENUM: ios/android), created_at, updated_at
  - **ADDED:** `UNIQUE(user_id, platform)`

#### Associations
- [x] `User.hasOne(DriverProfile, { foreignKey: 'userId', as: 'driverProfile' })`
- [x] `User.hasOne(Wallet, { foreignKey: 'ownerId', as: 'wallet' })`
- [x] `User.hasMany(Ride, { as: 'ridesAsRider', foreignKey: 'riderId' })`
- [x] `User.hasMany(Ride, { as: 'ridesAsDriver', foreignKey: 'driverId' })`
- [x] `User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' })`
- [x] `User.hasMany(DeviceToken, { foreignKey: 'userId', as: 'deviceTokens' })`
- [x] `User.hasMany(WalletTransaction, { foreignKey: 'walletOwnerId', as: 'transactions' })`
- [x] `DriverProfile.hasOne(Vehicle, { foreignKey: 'driverId', as: 'vehicle' })`
- [x] `DriverProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' })`
- [x] `Ride.hasMany(RideOffer, { foreignKey: 'rideId', as: 'offers' })`
- [x] `Ride.hasMany(RideStop, { foreignKey: 'rideId', as: 'stops' })`
- [x] `Ride.hasMany(SharedRidePassenger, { as: 'sharedPassengers', foreignKey: 'primaryRideId' })`
- [x] `Ride.hasOne(Rating, { foreignKey: 'rideId', as: 'rating' })`
- [x] `Ride.belongsTo(User, { as: 'rider', foreignKey: 'riderId' })`
- [x] `Ride.belongsTo(User, { as: 'driver', foreignKey: 'driverId' })`
- [x] `RideOffer.belongsTo(Ride, { foreignKey: 'rideId', as: 'ride' })`
- [x] `RideOffer.belongsTo(User, { as: 'driver', foreignKey: 'driverId' })`

#### Indexes (from audit + new)
- [x] `rides(status, expires_at)` — used by `findAvailableForDriver`
- [x] `rides(rider_id, status)` — used by rider's ride history
- [x] `rides(driver_id, status)` — used by driver's ride history
- [x] `rides(status) WHERE is_shared = true` — shared ride matching (partial)
- [x] `rides(scheduled_at) WHERE status = 'pending' AND scheduled_at IS NOT NULL` — scheduled activation (partial)
- [x] `ride_offers(ride_id, status)` — used by offer queries per ride
- [x] `ride_offers(driver_id, status)` — used to check if driver has active rides
- [x] `wallet_transactions(reference_id) WHERE NOT NULL` — used by topup confirmation idempotency (partial unique)
- [x] `wallet_transactions(wallet_owner_id, created_at)` — used by transaction history
- [x] `driver_profiles(is_online, is_approved) WHERE is_online = true AND is_approved = true` — nearby driver query (partial)
- [x] `otp_codes(phone, is_used, expires_at)` — used by OTP verification
- [x] `refresh_tokens(user_id)` — used by token cleanup
- [x] `refresh_tokens(token)` — unique constraint from table creation
- [x] `device_tokens(user_id)` — used by notification sends
- [x] `ratings(driver_id, created_at)` — driver rating history
- [x] `users(email) WHERE email IS NOT NULL` — partial unique
- [x] `users(google_id) WHERE google_id IS NOT NULL` — partial unique

#### Migrations & Seeds
- [x] Generate 16 Sequelize CLI migrations for all tables, indexes, and constraints (sequential, timestamped, JS)
- [x] Each migration includes both `up` and `down` functions
- [x] Create 4 seeders: 10 users (admin + 5 riders + 3 drivers + 1 pending), 3 driver profiles + vehicles, 10 wallets, 5 rides in various states + offers + stops + rating + transactions
- [x] Add npm scripts: `db:migrate`, `db:migrate:undo`, `db:migrate:undo:all`, `db:seed`, `db:seed:undo`, `db:reset`

### Deliverables
- 14 Sequelize model files in `src/models/`
- `src/models/index.ts` — model initialization and association setup
- 14+ migration files in `src/migrations/`
- 2–3 seeder files in `src/seeders/`
- All indexes and constraints applied via migrations

### Checkpoint
- `npx sequelize-cli db:migrate` runs all migrations without error
- `npx sequelize-cli db:seed:all` populates dev data
- `npx sequelize-cli db:migrate:undo:all` cleanly rolls back
- Verify constraints: inserting a wallet with `balance = -1` fails; inserting a rating with `score = 6` fails; inserting a duplicate `reference_id` fails
- TypeScript compiles all models without errors

### Commit Strategy
- `feat(db): add Sequelize config and connection setup`
- `feat(db): add User, DriverProfile, Vehicle models with associations`
- `feat(db): add Ride, RideOffer, RideStop, SharedRidePassenger models`
- `feat(db): add Wallet, WalletTransaction, Rating models with constraints`
- `feat(db): add OtpCode, RefreshToken, DeviceToken models`
- `feat(db): add all missing indexes from audit`
- `feat(db): add development seed data`

---

## Phase 3: Core Infrastructure

### Goals
- Build the shared utility layer that all other modules depend on
- Establish consistent error handling, response formatting, logging, and validation patterns
- Eliminate try-catch boilerplate with `asyncHandler`
- Add request correlation IDs for traceability

### Tasks

#### Error Handling
- [x] Create `src/utils/AppError.ts` — operational error class with statusCode, code, isOperational, details (Phase 1)
- [x] Define error code constants in `src/types/errorCodes.ts` — 6 domains (AUTH, OTP, RIDE, WALLET, DRIVER, GENERAL), `as const` objects with `{ code, status, message }`, `appError()` factory function, `ErrorCode` union type

#### Response Helpers
- [x] Create `src/utils/responseHelpers.ts` — `sendSuccess`, `sendCreated`, `sendNoContent`, `sendPaginated` (success paths only; errors handled by centralized errorHandler middleware)

#### Async Handler
- [x] Create `src/utils/asyncHandler.ts` — wraps async controllers, catches → next() (Phase 1)

#### Logger
- [x] Create `src/utils/logger.ts` — Winston with AsyncLocalStorage correlation IDs, daily rotation (30-day retention, 20MB max), JSON prod / colorized dev (Phase 1)

#### Correlation ID Middleware
- [x] Create `src/middlewares/correlationId.ts` — reads X-Request-ID or generates UUID, stores in AsyncLocalStorage, sets response header (Phase 1)

#### Validation Middleware
- [x] Create `src/middlewares/validate.ts` — runs express-validator chains, returns `{ success: false, error: { code: 'VALIDATION_ERROR', details: [{ field, message }] } }`
- [x] Create `src/validators/common.ts` — reusable chains: `uuidParam`, `phoneField`, `coordinateFields`, `paginationParams`, `enumField`, `textField` (500 char default), `amountField` (positive, max 2 decimals)

#### Shared Types
- [x] Create `src/types/enums.ts` — 9 TypeScript enums matching PostgreSQL ENUM types (Phase 2)
- [x] Create `src/types/pagination.ts` — `PaginationQuery`, `PaginationMeta`, `PaginatedQueryOptions` interfaces + `parsePagination()` helper
- [x] Create `src/types/express.d.ts` — extends Express Request with `requestId: string` and `user?: { userId, role: UserRole }` (Phase 1, typed role in Phase 3)
- [x] Create `src/types/common.ts` — `ApiResponse<T>`, `PaginatedResponse<T>`, `ErrorResponse` generic interfaces

### Deliverables
- `src/utils/AppError.ts`, `asyncHandler.ts`, `responseHelpers.ts`, `logger.ts`
- `src/middlewares/correlationId.ts`, `validate.ts`
- `src/types/` with all shared type definitions
- `src/types/errorCodes.ts` with all machine-readable error codes

### Checkpoint
- Throwing `new AppError('Not found', 404, 'RIDE_NOT_FOUND')` in any controller returns standardized error JSON
- Correlation ID appears in response headers and log entries
- Validation errors return field-level error details
- `asyncHandler` properly catches async errors without manual try-catch
- TypeScript compiles with strict mode, no `any` types

### Commit Strategy
- `feat(core): add AppError class with machine-readable error codes`
- `feat(core): add async handler and response helpers`
- `feat(core): add Winston logger with daily rotation and correlation IDs`
- `feat(core): add validation middleware and shared types`

---

## Phase 4: Authentication & Authorization

### Goals
- Implement JWT-based authentication with access/refresh token pattern
- Add token blacklist in Redis for immediate revocation
- Build OTP system with WhatsApp + SMS fallback
- Implement Google OAuth 2.0 flow
- Harden all auth endpoints with rate limiting
- Set up test infrastructure and write auth tests

### Tasks

#### Test Infrastructure (One-Time Setup)
- [x] Install `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `nock`
- [x] Create `jest.config.ts`: TypeScript support, path aliases (`@/` mapping), test match pattern (`**/__tests__/**/*.test.ts`), 30s timeout
- [x] Create `src/tests/setup.ts`: connect to test DB (`docker-compose.test.yml`, port 5433), run migrations, cleanup between suites
- [x] Create `src/tests/helpers/auth.ts`: `getAuthToken(userId, role)` — generates valid JWT for test requests
- [x] Create `src/tests/helpers/factories.ts`: `createTestUser(overrides?)`, `createTestDriver(overrides?)`, `createTestWallet(userId, balance?)`
- [x] Update scripts: `"test": "jest"`, `"test:watch": "jest --watch"`, `"test:coverage": "jest --coverage"`

#### JWT System
- [x] Create `src/services/jwtService.ts`:
  - `generateAccessToken(payload: { userId, role })` → 15min expiry, signed with `JWT_SECRET`
  - `generateRefreshToken(payload: { userId })` → 30d expiry, signed with `REFRESH_TOKEN_SECRET`
  - `verifyAccessToken(token)`, `verifyRefreshToken(token)` — return decoded payload or throw
- [x] Create `src/config/redis.ts` — Redis client with reconnection logic, event handlers
- [x] Implement token blacklist in Redis:
  - On logout: `SET blacklist:{jti} 1 EX {remainingTTL}`
  - On `protect` middleware: check blacklist before token validation
  - On password change: blacklist all existing tokens for that user

#### Auth Middleware
- [x] Create `src/middlewares/auth.ts`:
  - `protect`: extract Bearer token → check Redis blacklist → verify JWT → fetch user from cache/DB → attach to `req.user` → reject if `is_active === false`
  - `restrictTo(...roles: UserRole[])`: check `req.user.role` against allowed roles
  - User lookup: check Redis cache first (5min TTL), fall back to DB query
  - Cache invalidation: clear on profile update, role change, suspension

#### Auth Service & Controller
- [x] Create `src/services/authService.ts`:
  - `register(data)` → validate uniqueness → hash password (bcrypt, 12 rounds) → create user + wallet in transaction → generate tokens
  - `login(phone, password)` → find user → verify password → generate tokens → store refresh token
  - `refreshToken(token)` → verify → check not revoked → generate new pair → revoke old refresh token
  - `logout(userId, token)` → blacklist access token in Redis → delete refresh token from DB
  - `changePassword(userId, oldPassword, newPassword)` → verify old → hash new → update → blacklist all tokens
  - `resetPasswordWithOtp(phone, code, newPassword)` → verify OTP → update password → blacklist tokens
- [x] Create `src/controllers/authController.ts` — thin HTTP handlers calling authService
- [x] Create `src/routes/authRoutes.ts` with validation chains

#### Password Validation
- [x] Minimum 8 characters
- [x] At least 1 uppercase letter, 1 lowercase letter, 1 digit
- [x] Express-validator custom chain reusable across register + change password

#### Google OAuth
- [x] Create `src/services/googleAuthService.ts`:
  - Accept Google ID token from client
  - Verify via `google-auth-library` with web/Android/iOS client IDs
  - Extract email, name, picture
  - Find or create user (link google_id, handle email conflicts)
  - Generate JWT tokens
- [x] Google auth handler integrated in `src/controllers/authController.ts`
- [x] Route: `POST /api/v1/auth/google`

#### OTP System
- [x] Create `src/services/otpService.ts`:
  - Generate 6-digit code → hash with bcrypt → store in `otp_codes`
  - Rate limiting: 3 per phone per hour, 100 global per minute
  - Phone format validation: 8–15 digits, valid country code patterns
  - Delivery: try WhatsApp (Vonage) first → fallback to SMS (EasySendSMS)
  - Verification: hash comparison, max 3 attempts, 5min expiry, mark used
- [x] Create `src/services/providers/vonageWhatsappProvider.ts`
- [x] Create `src/services/providers/easySendSmsProvider.ts`
- [x] OTP handlers integrated in `src/controllers/authController.ts`

#### Rate Limiting
- [x] Create `src/middlewares/rateLimiter.ts`:
  - Redis-backed store (`rate-limit-redis`)
  - Global: 100,000 requests per 15min per IP
  - Auth login: 10 per 15min per IP
  - Auth refresh: 30 per 15min per IP
  - OTP send: 3 per hour per phone + 100 per minute global
  - Custom response format matching `sendError` structure

#### Environment Variables (auth-related)
```
JWT_SECRET, JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET, REFRESH_TOKEN_EXPIRES_IN=30d
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID
EASYSENDSMS_API_KEY, OTP_SENDER, OTP_EXPIRES_IN=5, OTP_MAX_ATTEMPTS=3
VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_WHATSAPP_FROM
ALLOWED_ORIGINS (comma-separated)
REDIS_URL
```

#### Phase 4 Tests
- [x] `src/services/__tests__/authService.test.ts`:
  - Register with valid data → user + wallet created
  - Register with existing phone → 409 conflict
  - Login with correct password → tokens returned
  - Login with wrong password → 401
  - JWT refresh → new token pair, old refresh invalidated
  - Logout → token blacklisted, subsequent requests rejected
  - Password change → all existing tokens invalidated
- [x] `src/services/__tests__/otpService.test.ts`:
  - Send OTP → code generated and stored
  - Verify correct code → succeeds
  - Verify wrong code → attempt incremented
  - Exceed max attempts → locked
  - Expired code → rejected
- [x] `src/middlewares/__tests__/auth.test.ts`:
  - `protect` — valid token → req.user populated
  - `protect` — expired token → 401
  - `protect` — blacklisted token → 401
  - `restrictTo` — correct role → passes; wrong role → 403
- [x] `src/middlewares/__tests__/rateLimiter.test.ts`:
  - Exceed limit → 429 with Retry-After header
- [x] `src/middlewares/__tests__/validate.test.ts`:
  - Invalid input → 400 with field-level errors
  - Valid input → passes through
- [x] Mock external APIs with nock: Google OAuth, Vonage, EasySendSMS

### Deliverables
- Complete auth flow: register → login → refresh → logout → change password
- Google OAuth endpoint
- OTP send/verify with dual-provider delivery
- Redis-backed rate limiting on all auth endpoints
- Redis token blacklist for immediate revocation
- Test infrastructure (Jest, Supertest, helpers, factories)
- Auth test suite passing against isolated test database

### Checkpoint
- Register → login → access protected route → refresh token → logout → access denied
- Rate limit: 11th login attempt in 15min returns 429
- OTP: send → verify → authenticate; 4th attempt on same code returns error
- Google OAuth: valid ID token returns JWT; invalid token returns 401
- Blacklisted token rejected immediately (not after 15min expiry)
- Password change invalidates all previous tokens
- `npm test` passes all auth tests with zero failures

### Commit Strategy
- `feat(auth): add JWT generation, verification, and Redis blacklist`
- `feat(auth): add protect and restrictTo middleware with Redis user cache`
- `feat(auth): add register, login, refresh, logout, change-password`
- `feat(auth): add Google OAuth 2.0 authentication`
- `feat(auth): add OTP system with WhatsApp + SMS fallback`
- `feat(auth): add Redis-backed rate limiting on all auth routes`
- `test(auth): add test infrastructure (Jest, helpers, factories)`
- `test(auth): add auth service, OTP, and middleware tests`
- Tests must pass before each commit (`npm test`)

---

## Phase 5: API Layer — CRUD Modules

### Goals
- Rebuild all REST endpoints under `/api/v1/` prefix
- Add pagination, filtering, sorting, and field selection on all list endpoints
- Ensure all routes have proper validation chains
- Keep controllers thin — HTTP handling only

### Tasks

#### API Versioning
- [x] Mount all routes under `/api/v1/` in `app.ts`
- [x] API version header: `X-API-Version: v1`

#### User Module
- [x] `src/services/userService.ts` — getProfile, updateProfile (name, email, avatar), updatePhone, setRole, deactivateAccount
- [x] `src/controllers/userController.ts`
- [x] `src/routes/userRoutes.ts`:
  - `GET /api/v1/users/me` — get own profile
  - `PATCH /api/v1/users/me` — update profile
  - `DELETE /api/v1/users/me` — deactivate account
  - `PATCH /api/v1/users/me/role` — set role
  - `PATCH /api/v1/users/me/phone` — update phone

#### Driver Module
- [x] `src/services/driverService.ts` — createProfile, updateProfile, getProfile, registerVehicle, updateVehicle, getVehicle, toggleOnlineStatus, updateLocation, getNearbyDrivers (with bounding box pre-filter)
- [x] `src/controllers/driverController.ts`
- [x] `src/routes/driverRoutes.ts`:
  - `GET /api/v1/driver/profile` — get driver profile (driver)
  - `POST /api/v1/driver/profile` — create driver profile
  - `PATCH /api/v1/driver/profile` — update driver profile
  - `GET /api/v1/driver/vehicle` — get vehicle
  - `POST /api/v1/driver/vehicle` — register vehicle
  - `PATCH /api/v1/driver/vehicle` — update vehicle
  - `PATCH /api/v1/driver/status` — toggle online/offline
  - `PATCH /api/v1/driver/location` — update GPS location
  - `GET /api/v1/driver/nearby` — find nearby drivers (rider)

#### Ride Module
- [x] `src/services/rideService.ts` — calculateFare, requestRide, getMyRides, getAvailableRides, getScheduledRides, getRideDetails, getRideOffers (business logic deferred to Phase 6)
- [x] `src/controllers/rideController.ts`
- [x] `src/routes/rideRoutes.ts`:
  - `GET /api/v1/rides/fare` — calculate fare estimate
  - `POST /api/v1/rides` — request new ride
  - `GET /api/v1/rides/my` — get user's rides (paginated)
  - `GET /api/v1/rides/available` — get available rides for driver (paginated)
  - `GET /api/v1/rides/scheduled` — get scheduled rides
  - `GET /api/v1/rides/:id` — get ride details
  - `GET /api/v1/rides/:id/offers` — get offers for ride
  - `POST /api/v1/rides/:id/accept` — driver accepts ride
  - `POST /api/v1/rides/:id/refuse` — driver refuses ride
  - `PATCH /api/v1/rides/:id/arrive` — driver arrives at pickup
  - `PATCH /api/v1/rides/:id/start` — start ride
  - `PATCH /api/v1/rides/:id/complete` — complete ride
  - `PATCH /api/v1/rides/:id/cancel` — cancel ride

#### Ride Stops Module
- [x] `src/services/rideStopService.ts`
- [x] `src/controllers/rideStopController.ts`
- [x] `src/routes/rideStopRoutes.ts`:
  - `GET /api/v1/rides/:id/stops` — get all stops
  - `POST /api/v1/rides/:id/stops` — add stop(s)
  - `PATCH /api/v1/rides/:id/stops/:stopId/arrive` — mark arrival
  - `PATCH /api/v1/rides/:id/stops/:stopId/leave` — mark departure

#### Shared Rides Module
- [x] `src/services/sharedRideService.ts`
- [x] `src/controllers/sharedRideController.ts`
- [x] `src/routes/sharedRideRoutes.ts`:
  - `GET /api/v1/shared-rides/available` — find available shared rides
  - `POST /api/v1/shared-rides/:id/join` — join shared ride
  - `GET /api/v1/shared-rides/:id/passengers` — get passengers
  - `PATCH /api/v1/shared-rides/:id/passengers/:passengerId/pickup` — mark picked up
  - `PATCH /api/v1/shared-rides/:id/passengers/:passengerId/dropoff` — mark dropped off
  - `DELETE /api/v1/shared-rides/:id/leave` — leave shared ride

#### Wallet Module
- [x] `src/services/walletService.ts` — getBalance, getTransactions (paginated), initiateOnlineTopup, confirmTopup, adminTopup (business logic hardened in Phase 6)
- [x] `src/controllers/walletController.ts`
- [x] `src/routes/walletRoutes.ts`:
  - `GET /api/v1/wallet` — get balance
  - `GET /api/v1/wallet/transactions` — transaction history (paginated)
  - `POST /api/v1/wallet/topup/online` — initiate Flouci payment
  - `POST /api/v1/wallet/topup/confirm` — confirm online topup
  - `POST /api/v1/wallet/topup/manual` — admin manual topup

#### Rating Module
- [x] `src/services/ratingService.ts`
- [x] `src/controllers/ratingController.ts`
- [x] `src/routes/ratingRoutes.ts`:
  - `POST /api/v1/ratings/rides/:rideId` — submit rating
  - `GET /api/v1/ratings/rides/:rideId` — get ride rating
  - `GET /api/v1/ratings/drivers/:driverId` — get driver ratings (paginated)

#### Admin Module
- [x] `src/services/adminService.ts`
- [x] `src/controllers/adminController.ts`
- [x] `src/routes/adminRoutes.ts`:
  - `GET /api/v1/admin/stats` — platform statistics
  - `GET /api/v1/admin/users` — list users (paginated, filterable)
  - `GET /api/v1/admin/users/:userId` — user details
  - `PATCH /api/v1/admin/users/:userId/deactivate` — suspend user
  - `PATCH /api/v1/admin/users/:userId/activate` — unsuspend
  - `GET /api/v1/admin/drivers` — list drivers
  - `GET /api/v1/admin/drivers/pending` — pending applications
  - `PATCH /api/v1/admin/drivers/:userId/approve` — approve driver
  - `PATCH /api/v1/admin/drivers/:userId/reject` — reject driver
  - `GET /api/v1/admin/rides` — all rides (paginated)
  - `GET /api/v1/admin/transactions` — all transactions (paginated)

#### Vehicle Catalog & Meta
- [x] `src/controllers/vehicleCatalogController.ts`
- [x] `src/routes/vehicleCatalogRoutes.ts`:
  - `GET /api/v1/vehicles/makes` — vehicle makes
  - `GET /api/v1/vehicles/models/:make` — models for make
- [x] `src/routes/metaRoutes.ts`:
  - `GET /api/v1/meta/vehicle-types` — vehicle type enums

#### Notification Routes
- [x] `src/routes/notificationRoutes.ts`:
  - `POST /api/v1/notifications/token` — register device token
  - `DELETE /api/v1/notifications/token` — unregister token

#### File Upload Module (Server-Side)
- [x] Create `src/middlewares/upload.ts`:
  - Multer middleware factory using config from `src/config/uploadConfig.ts`
  - Disk storage for local dev (writes to `uploads/` directory)
  - Memory storage option for cloud streaming (S3/Cloudinary in production)
  - Server-side MIME type validation (not just extension — use file magic bytes)
  - File size enforcement: 5MB per file, max 5 files per request
  - Sanitize filenames (strip path traversal, special characters)
  - Return standardized error via `AppError` on validation failure
- [x] Create `src/services/uploadService.ts`:
  - `uploadImage(file, folder)` — process and store a single image
  - `uploadImages(files, folder)` — process and store multiple images
  - `deleteImage(fileKey)` — delete stored image
  - Local storage in development (disk), cloud storage in production (S3/Cloudinary — configurable via env)
  - Return file URL/key on success
- [x] Create `src/controllers/uploadController.ts`
- [x] Create `src/routes/uploadRoutes.ts`:
  - `POST /api/v1/upload/avatar` — upload user avatar (1 file, max 2MB)
  - `POST /api/v1/upload/document` — upload driver documents (CIN, license photos, up to 4 files, max 5MB each)
  - `POST /api/v1/upload/vehicle` — upload vehicle photos (up to 3 files, max 5MB each)
  - All upload endpoints require authentication
  - Body parser limit: 10MB on upload routes only (overrides global 1MB)
- [x] Add upload-related env vars to `.env.example`:
  ```
  UPLOAD_STORAGE=local          # local | s3 | cloudinary
  UPLOAD_S3_BUCKET=
  UPLOAD_S3_REGION=
  UPLOAD_CLOUDINARY_CLOUD=
  UPLOAD_CLOUDINARY_KEY=
  UPLOAD_CLOUDINARY_SECRET=
  ```
- [x] Add `@openapi` JSDoc annotations to all upload routes for Swagger documentation

#### Swagger Route Documentation
- [x] Ensure ALL routes created in Phase 5 include `@openapi` JSDoc annotations
- [x] Define reusable OpenAPI component schemas in `src/config/swagger.ts` or JSDoc:
  - `ErrorResponse`, `PaginatedResponse`, `SuccessResponse`
  - Request body schemas per endpoint
  - Auth bearer security scheme definition
- [x] Verify Swagger UI at `/docs` shows all endpoints with request/response examples

#### Pagination Utility
- [x] Create `src/utils/pagination.ts`:
  - Parse `?page=1&limit=20` from query params (defaults: page 1, limit 20, max 100)
  - Return `{ offset, limit }` for Sequelize queries
  - Build `PaginationMeta` from Sequelize `count` result

#### Filtering & Sorting
- [x] Parse `?sort=created_at:desc` and `?status=completed&role=driver`
- [x] Whitelist allowed sort/filter fields per endpoint
- [x] Apply as Sequelize `where` and `order` options

#### Phase 5 Tests
- [x] Add to `src/tests/helpers/factories.ts`: `createTestRide(overrides?)`, `createTestRating(overrides?)`
- [x] `src/routes/__tests__/userRoutes.test.ts`: GET/PATCH profile, deactivate, role change
- [x] `src/routes/__tests__/driverRoutes.test.ts`: create/update profile, vehicle CRUD, toggle status, nearby query
- [x] `src/routes/__tests__/rideRoutes.test.ts`: fare estimate, request ride, get rides (pagination), ride details
- [x] `src/routes/__tests__/walletRoutes.test.ts`: get balance, transaction history (pagination)
- [x] `src/routes/__tests__/ratingRoutes.test.ts`: submit rating, get driver ratings
- [x] `src/routes/__tests__/adminRoutes.test.ts`: list users, approve/reject driver, stats
- [x] `src/routes/__tests__/uploadRoutes.test.ts`: valid image accepted, oversized rejected (413), wrong MIME rejected, unauthenticated rejected (401)
- [x] All tests verify: correct status codes, response format (`{ success, data, meta? }`), validation errors on bad input, auth enforcement (401/403)

### Deliverables
- All REST endpoints from the current API, rebuilt under `/api/v1/`
- Every list endpoint returns paginated responses with `meta`
- All routes have express-validator validation chains
- Request body size limited to 1MB (10MB for upload endpoints)
- Server-side file upload with multer: validation, size limits, MIME checking
- All routes documented with `@openapi` JSDoc annotations visible in Swagger UI
- Route integration test suite for all modules

### Checkpoint
- All endpoints respond with correct status codes and response format
- Pagination works: `?page=2&limit=5` returns correct page with meta
- Validation rejects bad input with field-level errors
- Protected routes reject unauthenticated requests with 401
- Role-restricted routes reject unauthorized users with 403
- Upload: valid image accepted, oversized file rejected, wrong MIME rejected, no path traversal possible
- Swagger UI at `/docs` shows all endpoints with schemas and examples
- `npm test` passes all tests (existing + new) with zero failures

### Commit Strategy
- `feat(api): add user module (profile, role, phone)`
- `feat(api): add driver module (profile, vehicle, location, nearby)`
- `feat(api): add ride module (request, lifecycle, offers)`
- `feat(api): add ride stops and shared rides modules`
- `feat(api): add wallet module (balance, transactions, topup)`
- `feat(api): add rating, admin, vehicle catalog, meta modules`
- `feat(api): add server-side file upload with multer (avatar, documents, vehicle photos)`
- `feat(api): add Swagger documentation for all routes`
- `feat(api): add pagination, filtering, and sorting utilities`
- `test(api): add route integration tests for all modules`
- Tests must pass before each commit (`npm test`)

---

## Phase 6: Critical Business Logic — Wallet & Rides

### Goals
- Fix ALL race conditions and financial bugs identified in the audit
- Implement ride lifecycle as a proper state machine with validated transitions
- Ensure all multi-step mutations run inside database transactions
- Add idempotency for payment operations
- Guarantee wallet balance never goes negative

### Tasks

#### Ride State Machine
- [x] Create `src/types/rideStateMachine.ts`:
  ```typescript
  const VALID_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
    pending:     ['offered', 'cancelled'],
    offered:     ['accepted', 'cancelled'],
    accepted:    ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed:   [],
    cancelled:   [],
  };
  
  function validateTransition(current: RideStatus, next: RideStatus): void {
    if (!VALID_TRANSITIONS[current].includes(next)) {
      throw new AppError(
        `Cannot transition from ${current} to ${next}`,
        400,
        'RIDE_INVALID_STATUS'
      );
    }
  }
  ```
- [x] All ride status updates call `validateTransition` before proceeding

#### Wallet Operations (Transaction-Safe)
- [x] **`confirmOnlineTopUp`** — FIX DOUBLE-SPEND:
  ```
  BEGIN SERIALIZABLE
    SELECT * FROM wallet_transactions WHERE reference_id = $1 FOR UPDATE
    IF status === 'completed' → return already-confirmed (idempotent)
    Verify with Flouci API
    UPDATE wallets SET balance = balance + $amount WHERE owner_id = $userId
    UPDATE wallet_transactions SET status = 'completed' WHERE id = $txId
  COMMIT
  ```
- [x] **`completeRide`** — FIX NEGATIVE BALANCE:
  ```
  BEGIN SERIALIZABLE
    SELECT * FROM wallets WHERE owner_id = $driverId FOR UPDATE
    Calculate fare, commission
    UPDATE wallets SET balance = balance + (fare - commission) WHERE owner_id = $driverId AND balance + (fare - commission) >= 0
    IF rowsAffected === 0 → throw INSUFFICIENT_BALANCE
    INSERT wallet_transaction (ride_earning)
    INSERT wallet_transaction (commission)
    UPDATE rides SET status = 'completed', final_fare, commission_amount, completed_at
  COMMIT
  ```
- [x] **`adminTopup`** — wrap in transaction with daily limit check

#### Ride Operations (Transaction-Safe)
- [x] **`acceptRide`** — FIX CONCURRENT ACCEPTANCE:
  ```
  BEGIN
    SELECT * FROM rides WHERE id = $rideId AND status IN ('pending', 'offered') FOR UPDATE
    IF no row → throw RIDE_ALREADY_ACCEPTED or RIDE_NOT_FOUND
    INSERT ride_offer (driver_id, ride_id, status: 'pending')
    UPDATE rides SET status = 'offered' WHERE status = 'pending'
  COMMIT
  ```
- [x] **`pickDriver`** — FIX NON-TRANSACTIONAL:
  ```
  BEGIN
    SELECT * FROM rides WHERE id = $rideId FOR UPDATE
    UPDATE ride_offers SET status = 'accepted' WHERE id = $offerId
    UPDATE ride_offers SET status = 'rejected' WHERE ride_id = $rideId AND id != $offerId
    UPDATE rides SET status = 'accepted', driver_id = $driverId
  COMMIT
  ```
- [ ] **`register`** — wrap user creation + wallet creation in transaction (deferred: already transactional in authService)
- [ ] **`submitRating`** — wrap rating insert + driver average recalculation in transaction (deferred: Phase 9 rating worker)

#### Idempotency
- [x] `UNIQUE` constraint on `wallet_transactions.reference_id` (already in Phase 2 migration)
- [x] Create `src/middlewares/idempotency.ts`:
  - Read `Idempotency-Key` header on mutation requests
  - Check Redis: `GET idempotency:{key}`
  - If exists: return cached response
  - If not: process request → store response in Redis with 24h TTL
  - Apply to: `POST /wallet/topup/confirm`, `POST /rides`, `POST /rides/:id/accept`

#### Fare Calculation
- [x] Create `src/config/fareConfig.ts`:
  ```typescript
  export const FARE_CONFIG = {
    BASE_FARE: 1.5,           // TND
    PRICE_PER_MINUTE: 0.5,    // TND
    PRICE_PER_STOP_MINUTE: 0.2, // TND per minute at stops
    COMMISSION_RATE: 10,      // percent
    MIN_FARE: 3.0,            // TND
    LOW_WALLET_THRESHOLD: 5.0,// TND
  } as const;
  ```
- [x] Fare calculation: `max(BASE_FARE + (minutes * PRICE_PER_MINUTE) + (stop_minutes * PRICE_PER_STOP_MINUTE), MIN_FARE)`

#### Cancellation Logic
- [x] Track `cancelled_by` (rider/driver/system) and `cancel_reason`
- [x] Driver cancellation after acceptance: flag for admin review
- [ ] System cancellation: rides pending > 10 minutes (deferred: Phase 9 ride expiration worker)

#### Phase 6 Tests (MOST IMPORTANT)
- [x] `src/services/__tests__/walletService.test.ts`:
  - `confirmOnlineTopUp` — single confirmation credits wallet correctly
  - `confirmOnlineTopUp` — 10 concurrent confirmations (Promise.all) → wallet credited exactly once
  - `confirmOnlineTopUp` — already completed → idempotent success
  - `completeRide` — fare calculation and commission deduction correct
  - `completeRide` — commission would exceed balance → rejected, balance unchanged
  - Wallet balance never goes below 0
- [x] `src/services/__tests__/rideService.test.ts`:
  - Happy path: request → offer → accept → start → complete
  - 5 concurrent acceptRide → exactly one succeeds, others get `RIDE_ALREADY_ACCEPTED`
  - State machine: every valid transition works; every invalid transition throws `RIDE_INVALID_STATUS`
  - Cancellation at each stage
  - Fare calculation with stops
- [x] `src/middlewares/__tests__/idempotency.test.ts`:
  - Same Idempotency-Key twice → cached response, no duplicate side effects
- [x] Mock Flouci API with nock

### Deliverables
- All wallet operations wrapped in SERIALIZABLE transactions with row locks
- Ride lifecycle enforced via state machine with validated transitions
- Idempotency middleware with Redis caching
- No operation modifies wallet balance outside a transaction
- Negative balance impossible at both DB and application level
- Concurrent wallet and ride tests proving correctness

### Checkpoint
- **Concurrent topup test**: fire 10 simultaneous `confirmTopup` with same `payment_id` → wallet credited exactly once
- **Concurrent ride accept**: fire 5 simultaneous `acceptRide` for same ride → exactly one offer created, others get `RIDE_ALREADY_ACCEPTED`
- **Negative balance test**: complete ride with commission exceeding balance → rejected, balance unchanged
- **State machine test**: attempt `complete` on `pending` ride → `RIDE_INVALID_STATUS`
- **Idempotency test**: same `Idempotency-Key` twice → second returns cached response, no duplicate side effects
- `npm test` passes all tests (existing + new) with zero failures

### Commit Strategy
- `feat(rides): add ride status state machine with validated transitions`
- `fix(wallet): wrap confirmOnlineTopUp in SERIALIZABLE transaction with FOR UPDATE`
- `fix(wallet): add negative balance protection (CHECK constraint + WHERE guard)`
- `fix(rides): wrap pickDriver in transaction (offer accept + reject others + ride update)`
- `fix(rides): add FOR UPDATE lock on acceptRide to prevent concurrent acceptance`
- `feat(wallet): add completeRide with transactional fare, commission, and wallet update`
- `feat(api): add idempotency middleware with Redis caching`
- `test(wallet): add concurrent topup and negative balance tests`
- `test(rides): add lifecycle, concurrent acceptance, and state machine tests`
- Tests must pass before each commit (`npm test`)

---

## Phase 7: Redis & Caching

### Goals
- Implement driver geospatial indexing for fast nearby driver queries
- Add caching for frequently accessed data
- Centralize rate limiting state in Redis (shared across instances)
- Implement JWT blacklist with automatic TTL expiry

### Tasks

#### Redis Client
- [x] Create `src/config/redis.ts`:
  - Connection with automatic reconnect (exponential backoff)
  - Event logging: connect, error, reconnecting
  - Health check method: `PING` (added `pingRedis()`)
  - Graceful disconnect on shutdown
  - *Note: redis.ts already existed from Phase 4; Phase 7 added `pingRedis()` for health checks*

#### Geospatial Driver Indexing
- [x] Create `src/services/redisGeoService.ts`:
  - `updateDriverLocation(driverId, lat, lng)`:
    - `GEOADD drivers:online {lng} {lat} {driverId}`
    - Also store metadata: `HSET driver:{driverId}:meta vehicle_type, rating, name`
    - Metadata TTL: 120s (heartbeat refresh)
  - `removeDriver(driverId)`:
    - `ZREM drivers:online {driverId}`
    - `DEL driver:{driverId}:meta`
  - `getNearbyDrivers(lat, lng, radiusKm, vehicleType?)`:
    - `GEOSEARCH drivers:online FROMLONLAT {lng} {lat} BYRADIUS {radiusKm} km ASC COUNT 50 WITHDIST WITHCOORD`
    - Pipeline batch metadata lookup + filter by vehicle_type
    - Stale driver filtering + lazy cleanup (ZREM expired entries)
    - Return with distances, sorted ASC
  - Update driver set on online/offline toggle
  - Integrated into `driverService.ts`: toggleOnlineStatus, updateLocation, getNearbyDrivers
  - SQL bounding-box fallback when Redis unavailable

#### Caching Layers
- [x] User session cache:
  - Key: `user:{userId}`
  - TTL: 5 minutes
  - Set: on successful auth middleware lookup
  - Invalidate: on profile update, role change, suspension, password change
  - *Note: Already implemented in Phase 4 (jwtService.ts); left untouched*
- [x] Fare estimate cache:
  - Key: `fare:{vehicleType}:{distBucket}:{minBucket}` (round to nearest 0.5km/1min)
  - TTL: 1 hour
  - Implemented in `rideService.calculateFare` using `cacheService`
- [x] Driver profile cache:
  - Key: `driver:{userId}:profile`
  - TTL: 10 minutes
  - Invalidate on profile update, vehicle update, toggle online, rating update
  - Implemented in `driverService.getProfile` using `cacheService`

#### JWT Blacklist
- [x] Key: `bl:jti:{jti}` and `bl:user:{userId}`
- [x] TTL: remaining token lifetime (max 15min for access tokens)
- [x] Check in `protect` middleware before JWT verification
- *Note: Already implemented in Phase 4 (jwtService.ts); left untouched*

#### Rate Limiting Store
- [x] Configure `rate-limit-redis` store connected to shared Redis instance
- [x] All rate limiters share state across Node.js instances
- *Note: Already implemented in Phase 4 (rateLimiter.ts); left untouched*

#### Phase 7 Tests
- [x] `src/services/__tests__/redisGeoService.test.ts` (12 tests):
  - Add 100 drivers → search radius 5km → returns sorted by distance
  - Filter by vehicle type (economy, premium, van)
  - Remove driver → no longer in results
  - Stale driver filtering and lazy cleanup
  - Metadata TTL refresh
  - Coordinate and metadata field verification
- [x] `src/services/__tests__/cacheService.test.ts` (8 tests):
  - Cache hit: round-trip JSON data correctly
  - Cache miss returns null
  - Cache invalidation: del removes entry
  - Pattern delete removes matching keys
  - TTL expiry works
  - Fail-open on invalid JSON
- [x] JWT blacklist: blacklisted token immediately rejected
  - *Note: Already tested in Phase 4 (jwtService.test.ts); left untouched*

### Deliverables
- `src/services/redisGeoService.ts` — geospatial driver management
- `src/services/cacheService.ts` — generic cache get/set/invalidate
- Redis-backed rate limiting, JWT blacklist, session cache
- Health check includes Redis connectivity
- Redis service test suite

### Checkpoint
- `GEOADD` + `GEOSEARCH`: add 100 drivers → search radius 5km → returns sorted by distance
- Cache hit: second `protect` call for same user returns from Redis (check logs)
- Cache invalidation: update profile → next `protect` fetches from DB
- Blacklisted JWT immediately rejected
- Rate limiter state persists across app restarts (Redis-backed)
- `npm test` passes all tests (existing + new) with zero failures

### Commit Strategy
- `feat(redis): add Redis client with reconnection logic`
- `feat(redis): add geospatial driver indexing (GEOADD/GEOSEARCH)`
- `feat(redis): add user session cache and fare estimate cache`
- `feat(redis): migrate JWT blacklist and rate limiters to Redis store`
- `test(redis): add geospatial, cache, and blacklist tests`
- Tests must pass before each commit (`npm test`)

---

## Phase 8: Socket.IO Real-Time

### Goals
- Replace polling-based updates with event-driven communication
- Implement Socket.IO with Redis adapter for horizontal scaling
- Authenticate all socket connections via JWT
- Create namespaces for riders and drivers with room-based ride sessions

### Tasks

#### Socket.IO Setup
- [x] Install `socket.io`, `@socket.io/redis-adapter`, `socket.io-client` (dev) — added `socketTypes.ts` with typed event maps, `createRedisClient()` factory in `redis.ts`, `socket` config section in `config/index.ts`
- [x] Create `src/sockets/socketServer.ts` — attaches to HTTP server, configures Redis adapter with dedicated pub/sub clients, registers auth + handler per namespace, starts periodic token expiry checker, exports `getIO()` singleton + `shutdownSocketServer()`
- [x] Create `src/sockets/socketAuth.ts` — `createSocketAuthMiddleware(allowedRoles)` mirrors HTTP auth exactly (verifyAccessToken → isBlacklisted → getCachedUser/DB → role gate → attach socket.data → auto-join personal room → auto-rejoin active ride room), `startTokenExpiryCheck()` disconnects expired/blacklisted sockets every 5 min

#### Namespaces & Rooms
- [x] Create `src/sockets/handlers/riderHandlers.ts` (`/riders`) — on connect: join `rider:{userId}` room, log connection/disconnection. Riders only receive events, no client→server events
- [x] Create `src/sockets/handlers/driverHandlers.ts` (`/drivers`) — handles `location:update` (validate coords, update Redis geo immediately, debounce DB writes to 10s, broadcast to ride room if active ride) and `driver:status` (delegates to `driverService.toggleOnlineStatus`), with ack-based responses

#### Ride Room Events
- [x] Create `src/sockets/emitter.ts` — `emitToUser()`, `emitToRideRoom()`, `emitToNearbyDrivers()`, `joinRideRoom()`, `leaveRideRoom()`. All emit to both `/riders` and `/drivers` namespaces. Tracks active rides via `active_ride:{userId}` Redis key (24h TTL safety net). Gracefully degrades when Socket.IO not initialized
- [x] Integrated emitter into `rideService.ts` — 9 events across 7 lifecycle methods: `ride:new_request` (requestRide → nearby drivers), `ride:new_offer` (acceptRide → rider), `ride:accepted` + `ride:offer_rejected` (pickDriver → driver + rejected), `ride:driver_arrived` (arriveAtPickup → rider), `ride:status_changed` (startRide → room), `ride:completed` (completeRide → room + leave), `ride:cancelled` (cancelRide → room + leave)
- [x] All socket emissions happen OUTSIDE database transactions (after commit)
- [x] `ride:driver_location` emitted from driverHandlers.ts location:update handler to /riders namespace ride room

#### Fallback
- [x] HTTP polling endpoints remain available — no HTTP routes were removed or changed
- [x] Socket.IO configured with `transports: ['websocket', 'polling']` — automatic fallback

#### Phase 8 Tests (22 tests)
- [x] `src/sockets/__tests__/socketAuth.test.ts` (10 tests) — valid rider/driver connect, no token/malformed/blacklisted-jti/blacklisted-user/inactive reject, rider→/drivers rejected, driver→/riders rejected, auto-rejoin ride room
- [x] `src/sockets/__tests__/socketEvents.test.ts` (6 tests) — emitToUser rider/driver receive, emitToRideRoom both receive, non-participant excluded, emitToNearbyDrivers geo-targeted, joinRideRoom/leaveRideRoom Redis key lifecycle
- [x] `src/sockets/__tests__/locationUpdate.test.ts` (6 tests) — lat/lng validation, ack success, Redis geo update verified, ride room broadcast to rider, no broadcast without active ride

### Deliverables
- `src/sockets/` directory with server setup, auth, namespaces, and event handlers
- Real-time ride lifecycle events replacing polling
- Driver location streaming via socket
- Redis adapter for multi-instance broadcasting
- Socket auth and ride event test suite

### Checkpoint
- Two clients connect to `/riders` and `/drivers` namespaces with valid JWTs
- Driver emits `location:update` → rider in same ride room receives `ride:driver_location`
- Ride status change in service → both rider and driver receive `ride:status_changed`
- Invalid JWT on connection → socket rejected with error
- Redis adapter: events emitted from instance A received by clients on instance B
- `npm test` passes all tests (existing + new) with zero failures

### Commit Strategy
- `feat(sockets): add Socket.IO server with Redis adapter`
- `feat(sockets): add JWT authentication on socket connections`
- `feat(sockets): add rider and driver namespaces with room management`
- `feat(sockets): add ride lifecycle event emissions`
- `feat(sockets): add driver location streaming via socket`
- `test(sockets): add socket auth and ride event tests`
- Tests must pass before each commit (`npm test`)

---

## Phase 9: BullMQ Background Jobs

### Goals
- Replace cron-based scheduled tasks with BullMQ delayed jobs
- Move notification delivery, payment verification, and OTP sending to background queues
- Add retry logic with exponential backoff and dead letter queues
- Set up monitoring dashboard for development

### Tasks

#### Queue Infrastructure
- [x] Install `bullmq`, `@bull-board/express`, `@bull-board/api`, `firebase-admin`
- [x] Create `src/jobs/connection.ts` — BullMQ Redis factory (maxRetriesPerRequest: null)
- [x] Create `src/jobs/queues.ts` — 6 queue definitions (notification, payment-verification, ride-expiration, scheduled-ride-activation, otp-delivery, rating-recalculation)
- [x] Create `src/jobs/producers.ts` — thin enqueue helpers with try/catch guards
- [x] Create `src/jobs/index.ts` — init/shutdown orchestrator
- [x] Create `src/jobs/workers/` directory with 6 worker files
- [x] Extend `src/config/index.ts` with `jobs` and `firebase` sections

#### Notification Worker
- [x] Create `src/jobs/workers/notificationWorker.ts`:
  - Receive: `{ userId, title, body, data?, imageUrl? }`
  - Fetch device tokens, send via Firebase FCM
  - Retry: 3 attempts, exponential backoff (2s, 4s, 8s)
  - Remove invalid tokens on registration error

#### Payment Verification Worker
- [x] Create `src/jobs/workers/paymentVerificationWorker.ts`:
  - Receive: `{ transactionId, userId, flouciPaymentId }`
  - Call Flouci verify API → confirmTopup on SUCCESS, mark Failed on failure
  - Retry: 5 attempts, exponential backoff (5s–80s)

#### Ride Expiration Worker
- [x] Create `src/jobs/workers/rideExpirationWorker.ts`:
  - Delayed job (5 min), idempotent status check, transaction with row lock
  - Cancel ride, expire pending offers, emit socket events
  - Cancelled when ride is accepted via `cancelRideExpiration()`

#### Scheduled Ride Activation Worker
- [x] Create `src/jobs/workers/scheduledRideActivationWorker.ts`:
  - Delayed job (15 min before scheduledAt), notifies nearby drivers, enqueues fresh expiration

#### OTP Delivery Worker
- [x] Create `src/jobs/workers/otpDeliveryWorker.ts`:
  - WhatsApp first → SMS fallback, retry: 2 attempts
  - `otpService.sendOtp()` now returns immediately (non-blocking)

#### Rating Recalculation Worker
- [x] Create `src/jobs/workers/ratingRecalculationWorker.ts`:
  - AVG(score) from Rating table, updates DriverProfile.rating
  - Debounced: 5s delay deduplicates rapid ratings

#### Monitoring
- [x] Create `src/jobs/bullBoard.ts` — Bull Board dashboard
- [x] Mount at `/admin/queues` (protected by admin auth, non-production only)

#### Service Integration
- [x] `rideService.requestRide()` → enqueue ride expiration + scheduled activation
- [x] `rideService.pickDriver()` → cancel ride expiration
- [x] `rideService.cancelRide()` → cancel ride expiration
- [x] `otpService.sendOtp()` → enqueue OTP delivery (non-blocking)
- [x] `ratingService.submitRating()` → enqueue rating recalculation (removed inline AVG)

#### Phase 9 Tests
- [x] `src/jobs/__tests__/notificationWorker.test.ts`: FCM delivery, invalid token cleanup, retry on errors
- [x] `src/jobs/__tests__/paymentVerificationWorker.test.ts`: SUCCESS/FAILED/PENDING paths, idempotency
- [x] `src/jobs/__tests__/rideExpirationWorker.test.ts`: auto-cancel, idempotency, offered rides
- [x] `src/jobs/__tests__/otpDeliveryWorker.test.ts`: WhatsApp → SMS fallback, error propagation
- [x] `src/jobs/__tests__/ratingRecalculationWorker.test.ts`: AVG calculation, idempotency
- [x] `src/jobs/__tests__/producers.test.ts`: job payload, delay, jobId, cancel operations

### Deliverables
- `src/jobs/` directory with queue definitions and 6 workers
- All notification sends go through queue (not inline)
- Ride expiration via delayed jobs (no more cron)
- Scheduled ride activation via delayed jobs
- Bull Board dashboard at `/admin/queues`
- Worker test suite with mocked external APIs

### Checkpoint
- Create a ride → 10 minutes later, ride auto-cancelled (check DB)
- Send notification → appears in queue → delivered via FCM → marked complete
- Simulate FCM failure → job retried 3 times → moved to dead letter
- OTP delivery via queue → WhatsApp attempted → fallback to SMS on failure
- Bull Board shows all queues with pending/active/completed/failed counts
- `npm test` passes all tests (existing + new) with zero failures

### Commit Strategy
- `feat(jobs): add BullMQ queue infrastructure and worker setup`
- `feat(jobs): add notification worker with FCM delivery and retry logic`
- `feat(jobs): add ride expiration worker (replace cron)`
- `feat(jobs): add scheduled ride activation worker`
- `feat(jobs): add OTP delivery and payment verification workers`
- `feat(jobs): add Bull Board monitoring dashboard`
- `test(jobs): add worker tests with mocked external APIs`
- Tests must pass before each commit (`npm test`)

---

## Phase 10: Notifications System

### Goals
- Add persistent notification storage in database
- Implement dual delivery: persist to DB + send via FCM queue
- Build notification management API for clients
- Handle device token lifecycle

### Tasks

#### Notifications Table
- [x] Create migration for `notifications` table:
  - `id` UUID PK
  - `user_id` UUID FK → users
  - `type` VARCHAR — notification type enum
  - `title` VARCHAR
  - `body` TEXT
  - `data` JSONB — arbitrary payload (ride_id, etc.)
  - `is_read` BOOLEAN DEFAULT false
  - `created_at` TIMESTAMP
  - Index on `(user_id, is_read, created_at DESC)`

#### Notification Service
- [x] Create `src/services/notificationService.ts`:
  - `send(userId, { type, title, body, data })`:
    1. Insert into `notifications` table
    2. Enqueue to `notification` BullMQ queue for FCM delivery
  - `getNotifications(userId, page, limit)` — paginated, newest first
  - `markAsRead(userId, notificationId)` — verify ownership
  - `markAllAsRead(userId)`
  - `getUnreadCount(userId)`

#### Device Token Management
- [x] `registerToken(userId, token, platform)` — upsert device token
- [x] `refreshToken(userId, oldToken, newToken)` — update on FCM token refresh
- [x] `unregisterToken(userId)` — delete all tokens (logout)
- [x] Cleanup: remove tokens that FCM reports as invalid (in notification worker)

#### API Endpoints
- [x] `GET /api/v1/notifications` — paginated notification list
- [x] `GET /api/v1/notifications/unread-count` — unread count
- [x] `PATCH /api/v1/notifications/:id/read` — mark one as read
- [x] `POST /api/v1/notifications/read-all` — mark all as read
- [x] `POST /api/v1/notifications/token` — register device token
- [x] `DELETE /api/v1/notifications/token` — unregister token

#### Notification Types (from current system)
- [x] `new_ride_request` — new ride available for driver
- [x] `ride_accepted` — driver accepted ride
- [x] `ride_refused` — driver refused ride
- [x] `driver_approaching` — driver near pickup
- [x] `ride_expired` — no driver accepted
- [x] `ride_completed` — ride finished
- [x] `ride_cancelled` — ride cancelled
- [x] `wallet_low` — balance below 5 TND threshold
- [x] `wallet_suspended` — wallet suspended

#### Phase 10 Tests
- [x] `src/services/__tests__/notificationService.test.ts`:
  - Send → notification persisted in DB + enqueued for FCM
  - Get paginated notifications
  - Mark as read / mark all as read
  - Unread count
- [x] Device token: register, refresh, unregister

### Deliverables
- `notifications` table with migration
- Notification service with dual delivery (DB + FCM)
- Notification management API
- Device token CRUD
- Notification service test suite

### Checkpoint
- Complete a ride → notification appears in DB + delivered via FCM
- `GET /notifications` returns paginated results with unread count
- `PATCH /notifications/:id/read` marks notification, reduces unread count
- Register token → unregister on logout → no more pushes
- `npm test` passes all tests (existing + new) with zero failures

### Commit Strategy
- `feat(notifications): add notifications table and model`
- `feat(notifications): add notification service with dual delivery`
- `feat(notifications): add notification management API`
- `feat(notifications): add device token lifecycle management`
- `test(notifications): add notification service and device token tests`
- Tests must pass before each commit (`npm test`)

---

## Phase 11: Observability & Monitoring

### Goals
- Add error tracking with full context
- Create comprehensive health check endpoint
- Implement structured logging with request tracing
- Monitor slow queries

### Tasks

#### Sentry Integration
- [x] Install `@sentry/node`
- [x] Initialize in `server.ts` with:
  - DSN from environment
  - Release version from `package.json`
  - Environment tag (dev/staging/prod)
  - Performance tracing: sample 10% of requests
  - User context: attach `userId` when authenticated
  - Breadcrumbs: database queries, Redis operations, external API calls
- [x] Sentry error handler middleware (after routes, before global error handler)
- [x] Report non-fatal events:
  - Token refresh failures
  - FCM delivery failures
  - OTP delivery failures
  - Ride state machine violations

#### Health Check
- [x] Enhance `GET /health` → `GET /api/v1/health`:
  ```json
  {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 86400,
    "timestamp": "2026-05-06T12:00:00Z",
    "checks": {
      "database": { "status": "healthy", "latency": "2ms" },
      "redis": { "status": "healthy", "latency": "1ms" },
      "firebase": { "status": "healthy" }
    }
  }
  ```
- [x] Return 503 if any critical dependency is unhealthy
- [x] Add readiness probe endpoint: `GET /api/v1/health/ready`
- [x] Add liveness probe endpoint: `GET /api/v1/health/live`

#### Structured Logging
- [x] All log entries include: timestamp, level, message, correlationId, userId (if authenticated), route, method, statusCode, responseTime
- [x] Morgan integration: log every HTTP request as structured JSON
- [x] Sequelize query logging: log queries > 500ms as warnings
- [x] Daily log rotation: 30-day retention

#### Performance Monitoring
- [x] Log response times per route via middleware
- [x] Flag routes exceeding 1s response time
- [x] Sequelize hooks: log queries taking > 200ms

#### Phase 11 Tests
- [x] `src/routes/__tests__/healthRoutes.test.ts`:
  - All deps healthy → 200
  - Redis down → 503 with unhealthy status
- [x] Slow query logging: execute slow query → warning logged with query text and duration

### Deliverables
- Sentry integration capturing errors + performance traces
- Health check endpoint verifying DB, Redis, Firebase
- Structured JSON logs with correlation IDs
- Slow query monitoring
- Health check and logging test suite

### Checkpoint
- Throw error in controller → appears in Sentry dashboard with full context
- Stop Redis → health check returns 503 with Redis status "unhealthy"
- Make request → correlation ID in response header matches log entry
- Execute slow query → warning logged with query text and duration
- `npm test` passes all tests (existing + new) with zero failures

### Commit Strategy
- `feat(observability): add Sentry error tracking and performance monitoring`
- `feat(observability): add comprehensive health check with dependency probes`
- `feat(observability): add structured logging with correlation IDs`
- `perf(observability): add slow query detection and logging`
- `test(observability): add health check and logging tests`
- Tests must pass before each commit (`npm test`)

---

## Phase 12: E2E Integration Tests & Coverage

### Goals
- Write end-to-end flow tests that span multiple modules (auth → ride → wallet → rating)
- Enforce coverage thresholds across the codebase
- Verify no test duplication (unit/integration tests already written per phase)

### Tasks

#### End-to-End Flow Tests
- [x] `src/tests/e2e/riderFlow.test.ts`:
  - Register → verify OTP → request ride → driver accepts → complete → rate → wallet updated
- [x] `src/tests/e2e/driverFlow.test.ts`:
  - Register → create profile → submit vehicle → go online → accept ride → complete → earning in wallet
- [x] `src/tests/e2e/paymentFlow.test.ts`:
  - Initiate topup → confirm → balance updated → request ride → fare deducted

#### Coverage Enforcement
- [x] Set thresholds in `jest.config.ts`:
  ```
  services: 70%
  middlewares: 90%
  overall: 60%
  ```
- [x] Coverage reports: text (terminal) + lcov (CI)
- [x] `npm run test:coverage` enforces thresholds — fails CI if below

### Deliverables
- E2E test flows covering full rider, driver, and payment journeys
- Coverage thresholds enforced in jest.config.ts
- All external API calls mocked (no real API calls in any test)

### Checkpoint
- `npm test` passes all tests (unit + integration + e2e) with zero failures
- `npm run test:coverage` meets all thresholds
- E2E rider flow passes end-to-end
- E2E driver flow passes end-to-end

### Commit Strategy
- `test(e2e): add end-to-end integration test flows`
- `test: enforce coverage thresholds`
- Tests must pass before each commit (`npm test`)

---

## Phase 13: Negotiation Flow & Service Categories

### Goals
- Add `service_type` enum alongside `vehicle_type` to support multiple ride categories (taxi, covoiturage, cours_partage, vespa, services)
- Replace fixed-fare acceptance with an InDrive-inspired negotiation flow where drivers propose fares and riders choose from competing offers
- Implement per-offer expiration (30s validity), cooldown enforcement, and fare clamping — all server-side
- Defer the `services` category (mechanic/roadside) with a clean NOT_IMPLEMENTED guard (Option C)

### Tasks

#### Schema Additions
- [ ] Create migration: add `service_type` PostgreSQL ENUM (`taxi`, `covoiturage`, `cours_partage`, `vespa`, `services`)
- [ ] Add `service_type` column to `rides` table (NOT NULL, DEFAULT `'taxi'`), backfill existing rows
- [ ] Add `hide_estimate` BOOLEAN column to `rides` table (NOT NULL, DEFAULT `false`)
- [ ] Add `expires_at` TIMESTAMPTZ column to `ride_offers` table (nullable)
- [ ] Add `motorcycle` value to existing `vehicle_type` ENUM
- [ ] Create `driver_service_types` join table: `(id UUID PK, driver_id UUID FK, service_type ENUM, created_at)` with UNIQUE on `(driver_id, service_type)`
- [ ] Drop existing UNIQUE index on `(ride_id, driver_id)` in `ride_offers`
- [ ] Add partial unique index: `UNIQUE(ride_id, driver_id) WHERE status = 'pending'` — enforces at most one pending offer per driver per ride
- [ ] Add `ServiceType` enum to `src/types/enums.ts`
- [ ] Add `motorcycle` to `VehicleType` enum in `src/types/enums.ts`
- [ ] Add `serviceType` and `hideEstimate` fields to `Ride` model
- [ ] Add `expiresAt` field to `RideOffer` model
- [ ] Create `DriverServiceType` model with associations to `DriverProfile`

#### Fare Config Refactor
- [ ] Refactor `config.fare` to key by `service_type` instead of `vehicle_type`:
  ```typescript
  fare: {
    serviceTypes: {
      taxi:          { baseFare: 2.5, perKm: 1.2, perMin: 0.3 },
      covoiturage:   { baseFare: 2.0, perKm: 1.0, perMin: 0.25 },
      cours_partage: { baseFare: 1.5, perKm: 0.8, perMin: 0.2 },
      vespa:         { baseFare: 1.5, perKm: 0.9, perMin: 0.2 },
    },
    currency: 'TND',
  }
  ```
- [ ] Add constants to `FARE_CONFIG`: `OFFER_VALIDITY_SECONDS: 30`, `OFFER_COOLDOWN_SECONDS: 30`, `OFFER_FARE_TOLERANCE_TND: 1`
- [ ] Update `calculateFare()` to key by `serviceType` instead of `vehicleType`
- [ ] Update fare cache key pattern to use `serviceType`

#### Driver–Service Matching
- [ ] Add `serviceTypes` field to Redis driver metadata hash (comma-separated list of registered service types)
- [ ] Update `redisGeoService.getNearbyDrivers()` to accept optional `serviceType` filter, match against metadata
- [ ] Update `emitToNearbyDrivers()` to pass `serviceType` instead of `vehicleType`
- [ ] Add CRUD endpoints for driver service type registration: `POST /driver/service-types`, `GET /driver/service-types`, `DELETE /driver/service-types/:serviceType`
- [ ] Update `driverService.getNearbyDrivers()` SQL fallback to join `driver_service_types`
- [ ] Update `ride:new_request` emission to filter by `serviceType`

#### Negotiation Flow
- [ ] Update `acceptRide()` to accept `offeredFare` from request body (no longer hardcoded to `calculatedFare`)
- [ ] Add fare clamp validation: when `hide_estimate = false`, enforce `offeredFare ∈ [calculatedFare - 1, calculatedFare + 1]` TND
- [ ] Add open-fare validation: when `hide_estimate = true`, enforce `offeredFare > 0` only; return `calculatedFare` as `suggestedFare` hint in offer payload
- [ ] Set `RideOffer.expiresAt = NOW() + 30s` on offer creation
- [ ] Enqueue `offerExpirationWorker` delayed job (30s) on each offer creation
- [ ] Cancel offer expiration job when offer is accepted or rejected before expiry
- [ ] Add rider-refuse-offer endpoint: `POST /rides/:id/offers/:offerId/refuse` — sets offer to `Rejected`, sets Redis cooldown key
- [ ] Add new error codes: `NOT_IMPLEMENTED`, `OFFER_FARE_OUT_OF_RANGE`, `OFFER_COOLDOWN_ACTIVE`, `SERVICE_TYPE_MISMATCH`
- [ ] Update route validation for `POST /rides/:id/accept` to require `offeredFare` in body
- [ ] Update route validation for `POST /rides` to require `service_type`
- [ ] Validate driver's registered service types include ride's `service_type` on offer creation
- [ ] Guard `service_type = 'services'` in `requestRide()` — throw `AppError(501, 'NOT_IMPLEMENTED')`

#### Offer Expiration Worker + Cooldown
- [ ] Create `offerExpirationWorker`: BullMQ delayed job per offer (30s delay)
  - Idempotency: skip if offer no longer `Pending`
  - Set `RideOffer.status = Expired`
  - Set Redis cooldown key `cooldown:{driverId}:{rideId}` with 30s TTL
  - Emit `ride:offer_expired` to rider and driver
  - Send push notification to driver
- [ ] Add `enqueueOfferExpiration()` and `cancelOfferExpiration()` to `src/jobs/producers.ts`
- [ ] Add cooldown check in `acceptRide()`: `EXISTS cooldown:{driverId}:{rideId}` → throw `OFFER_COOLDOWN_ACTIVE` (429)
- [ ] Set cooldown key on rider refuse (same as expiration)

#### Socket Event Additions
- [ ] Add `ride:offer_expired` event type to `socketTypes.ts` with payload: `{ rideId, offerId, driverId }`
- [ ] Update `ride:new_request` payload to include `serviceType`
- [ ] Update `ride:new_offer` payload: include `suggestedFare` (when `hideEstimate = true`), `expiresAt`
- [ ] Add `NotificationType.OfferExpired` to notification enums

#### Services Category (Option C — Deferred)
- [ ] `service_type = 'services'` exists in ENUM but is rejected at request time with `NOT_IMPLEMENTED`
- [ ] Document in OpenAPI: `services` type returns 501 — "coming in a future release"

#### Test Additions
- [ ] Unit tests: fare clamp logic — valid range, out of range, hide_estimate variations
- [ ] Unit tests: cooldown check — blocked during cooldown, allowed after TTL expires
- [ ] Unit tests: offer expiration worker — expires pending offer, skips non-pending
- [ ] Integration tests: full negotiation flow — request ride → driver offers → rider refuses → cooldown → driver re-offers → rider accepts
- [ ] Integration tests: multiple drivers competing — three drivers offer, rider picks one, others rejected
- [ ] Integration tests: offer auto-expires after 30s, driver re-offers after cooldown
- [ ] Update E2E `riderFlow.test.ts` — add `service_type` to ride creation, `offeredFare` to accept
- [ ] Update E2E `driverFlow.test.ts` — register service types before offering, send `offeredFare`
- [ ] Update E2E `paymentFlow.test.ts` — ride creation input includes `service_type`

#### OpenAPI / Swagger Updates
- [ ] Document `service_type` field on ride creation and response schemas
- [ ] Document `hide_estimate` field on ride creation
- [ ] Document `offeredFare` as required body param on `POST /rides/:id/accept`
- [ ] Document new `POST /rides/:id/offers/:offerId/refuse` endpoint
- [ ] Document driver service type CRUD endpoints
- [ ] Document `services` type 501 behavior
- [ ] Update `ride:new_offer` socket event documentation with `expiresAt` and `suggestedFare`

#### Backfill Migration
- [ ] Backfill `service_type = 'taxi'` for all existing rides (handled by DEFAULT in column addition)
- [ ] Backfill `hide_estimate = false` for all existing rides (handled by DEFAULT)
- [ ] Seed default `driver_service_types` entries for existing drivers: map `vehicle_type` → `service_type` (economy/premium → taxi, van → taxi, motorcycle → vespa)

### Deliverables
- `service_type` enum on rides with fare config per service type
- Negotiation flow: drivers propose fares, riders see stacked offers, 30s per-offer validity
- Fare clamp enforcement: ±1 TND when estimate is visible, open pricing when hidden
- Per-(driver, ride) cooldown after refusal or expiration
- Offer expiration worker (BullMQ delayed jobs)
- `ride:offer_expired` socket event
- Driver service type registration (many-to-many)
- `motorcycle` vehicle type for vespa service
- `services` category guarded with NOT_IMPLEMENTED (Option C)
- Full test coverage for negotiation, clamp, cooldown, and expiration logic

### Checkpoint
- `npm test` passes all tests including new negotiation flow tests
- Fare clamp rejects out-of-range offers with `OFFER_FARE_OUT_OF_RANGE`
- Cooldown blocks re-offers within 30s window
- Offer auto-expires after 30s, driver notified via socket and push
- Rider can refuse individual offers; driver enters cooldown
- `service_type = 'services'` returns 501
- `getNearbyDrivers` filters by `serviceType`
- E2E flows pass with updated inputs

### Commit Strategy
- `feat(schema): add service_type enum, hide_estimate, offer expires_at, driver_service_types`
- `refactor(fare): key fare config by service_type instead of vehicle_type`
- `feat(driver): add service type registration and matching in getNearbyDrivers`
- `feat(ride): implement negotiation flow with fare clamp and hide_estimate`
- `feat(ride): add offer expiration worker and cooldown enforcement`
- `feat(socket): add ride:offer_expired event and updated offer payloads`
- `feat(ride): guard services category with NOT_IMPLEMENTED (Option C)`
- `test(ride): add negotiation flow, fare clamp, cooldown, and expiration tests`
- `docs(api): update OpenAPI spec for negotiation flow and service categories`

---

## Phase 14: CI/CD & Production Hardening

### Goals
- Set up GitHub Actions pipeline for automated testing and deployment
- Optimize Docker build for production
- Enforce environment separation
- Document deployment process

### Tasks

#### GitHub Actions
- [ ] Create `.github/workflows/ci.yml`:
  ```yaml
  on: [push, pull_request]
  jobs:
    lint:
      - checkout → install → npm run lint
    test:
      - checkout → start PostgreSQL + Redis services → install → migrate → npm test
    build:
      - checkout → install → npm run build
  ```
- [ ] Create `.github/workflows/deploy-staging.yml`:
  - Trigger: push to `main`
  - Build Docker image → push to registry → deploy to staging
- [ ] Create `.github/workflows/deploy-production.yml`:
  - Trigger: manual (`workflow_dispatch`) with approval
  - Build Docker image → push to registry → deploy to production

#### Dockerfile (Production)
- [ ] Multi-stage build:
  ```dockerfile
  # Build stage
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build
  
  # Production stage
  FROM node:20-alpine
  WORKDIR /app
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  COPY package*.json ./
  USER node
  EXPOSE 3000
  HEALTHCHECK CMD curl -f http://localhost:3000/api/v1/health/live || exit 1
  CMD ["node", "dist/server.js"]
  ```
- [ ] `.dockerignore`: node_modules, src, tests, .git, .env

#### Environment Separation
- [ ] `.env.example` — complete list of all env vars with documentation
- [ ] `src/config/validateEnv.ts` — separate required vars per environment
- [ ] No `if (env === 'production')` branches — all behavior controlled via config values
- [ ] Database connection: SSL enforced in production, optional in development

#### Production Hardening
- [ ] Helmet configuration: CSP, HSTS, X-Frame-Options
- [ ] Request body size limit: 1MB default, 10MB for image upload endpoints
- [ ] Connection pool sizing: min 5, max 20 (configurable via env)
- [ ] Trust proxy (if behind Railway/load balancer): `app.set('trust proxy', 1)`
- [ ] Remove `X-Powered-By` header
- [ ] CORS: strict origin list from env, no wildcards in production

#### Database Management
- [ ] Migration script in CI: auto-run on deploy
- [ ] Backup strategy documentation
- [ ] Connection string with SSL parameters

#### Swagger / OpenAPI Validation in CI
- [ ] Add CI step to validate OpenAPI spec: start server → fetch `/api/spec.json` → validate with `swagger-cli validate`
- [ ] Ensure no undefined `$ref` errors, no missing schemas
- [ ] Extract spec JSON at build time for mobile teams: `npm run build:spec` → outputs `openapi.json`

#### Upload Security Hardening
- [ ] Ensure file uploads are only stored in `uploads/` (local) or cloud bucket (production) — never in `src/` or `dist/`
- [ ] Verify MIME types server-side using magic bytes (not just `Content-Type` header)
- [ ] Ensure no uploaded file can be executed (no `.js`, `.sh`, `.php` — reject non-image MIME types)
- [ ] Rate limit upload endpoints: max 10 uploads per user per hour

#### Documentation
- [ ] `README.md`: setup instructions, environment vars, local development, deployment
- [ ] `API.md`: endpoint overview (auto-generated from Swagger/OpenAPI spec)
- [ ] `CONTRIBUTING.md`: branch naming, commit conventions, PR process

### Deliverables
- GitHub Actions CI pipeline: lint → test → build on every PR
- Staging auto-deploy on merge to main
- Production manual deploy with approval gate
- Production-optimized Dockerfile
- Complete `.env.example` with all variables documented
- README with setup and deployment instructions

### Checkpoint
- PR opened → CI runs lint + tests + build automatically
- Merge to main → staging deploy triggers
- Docker image builds successfully with multi-stage build
- Health check passes in Docker container
- Production deploy requires manual approval

### Commit Strategy
- `ci: add GitHub Actions workflow for lint, test, and build`
- `ci: add staging auto-deploy workflow`
- `ci: add production deploy workflow with manual approval`
- `chore: optimize Dockerfile for production (multi-stage, non-root user)`
- `docs: add README, API documentation, and contributing guide`

---

## Phase Summary

| Phase | Dependencies | Testing |
|-------|-------------|---------|
| 1. Scaffolding & Config | None | Manual checkpoint only |
| 2. Database & Sequelize | Phase 1 | Manual checkpoint only |
| 3. Core Infrastructure | Phase 1 | Manual checkpoint only |
| 4. Authentication | Phases 2, 3 | **Test infra setup** + auth/OTP/middleware tests |
| 5. API Layer — CRUD | Phase 4 | Route integration tests for all modules |
| 6. Business Logic (Wallet & Rides) | Phase 5 | Concurrent wallet + ride state machine tests |
| 7. Redis & Caching | Phase 4 | Geospatial, cache, and blacklist tests |
| 8. Socket.IO Real-Time | Phases 6, 7 | Socket auth and ride event tests |
| 9. BullMQ Jobs | Phases 6, 7 | Worker tests with mocked external APIs |
| 10. Notifications | Phase 9 | Notification service and device token tests |
| 11. Observability | Phase 3 | Health check and logging tests |
| 12. E2E Tests & Coverage | Phase 10 | E2E flows + coverage enforcement |
| 13. Negotiation Flow & Service Categories | Phase 12 | Fare clamp, cooldown, offer expiration, negotiation E2E tests |
| 14. CI/CD & Hardening | Phase 13 | CI runs all tests automatically |

**Testing rule:** Every phase from 4 onward writes tests for what it builds. `npm test` must pass before every commit.

**Parallelism opportunities:**
- Phases 7 + 11 can start as soon as Phase 4 is complete
- Phases 8 + 9 can be worked in parallel after Phase 6
- Phase 13 tasks 1–3 (schema additions, fare config refactor, driver–service matching) can be parallelized
- Phase 14 cannot start until Phase 13 is complete (schema changes must land before production hardening)
