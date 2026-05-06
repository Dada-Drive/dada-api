# DADA Backend — Rebuild Roadmap

**Stack:** Node.js · TypeScript · Express.js · Sequelize · PostgreSQL · Redis · Socket.IO · BullMQ · Docker  
**Target:** Production-ready ride-sharing backend serving Android (Kotlin) + iOS (Swift) clients  
**Scale:** 0–5,000 concurrent users · 1–3 developers  
**Currency:** TND (Tunisian Dinar) · DECIMAL(10,2)

---

## Phase 1: Project Scaffolding & Config (3–4 days)

### Goals
- Establish TypeScript project with strict compilation, linting, and formatting
- Define directory structure mirroring the 3-layer architecture
- Configure environment management for dev/staging/prod
- Set up Docker + docker-compose for local development (Node, PostgreSQL, Redis)
- Create base Express server with graceful shutdown
- Set up Swagger (OpenAPI 3.0) for API documentation and mobile team integration
- Add upload configuration placeholder (multer + config for Phase 5)

### Tasks
- [ ] Initialize Node.js project: `npm init`, install TypeScript, ts-node-dev
- [ ] Configure `tsconfig.json` with strict mode, path aliases (`@/config`, `@/services`, `@/models`, etc.)
- [ ] Install and configure ESLint (typescript-eslint) + Prettier with pre-commit hooks (husky + lint-staged)
- [ ] Create directory structure:
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
- [ ] Create `.env.example` with all required variables (see Phase 4 for full list)
- [ ] Create `src/config/validateEnv.ts` — crash on missing required env vars at startup
- [ ] Create `Dockerfile` (multi-stage: build with `node:20-alpine`, copy compiled JS, production deps only)
- [ ] Create `docker-compose.yml`: app (with hot-reload volume), PostgreSQL 16, Redis 7
- [ ] Create `docker-compose.test.yml`: isolated PostgreSQL + Redis for test runs
- [ ] Implement `src/server.ts` with:
  - HTTP server creation
  - Startup sequence: validate env → connect DB → connect Redis → init Firebase → start listening
  - `SIGTERM`/`SIGINT` handlers: stop accepting connections → drain in-flight requests → close DB pool → close Redis → exit 0
  - Unhandled rejection / uncaught exception handlers (log + exit 1)
- [ ] Create `src/app.ts` with:
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
- [ ] Install `swagger-jsdoc` + `swagger-ui-express`
- [ ] Create `src/config/swagger.ts` — OpenAPI 3.0 spec config (title, version, servers, scans route files for JSDoc annotations)
- [ ] Mount Swagger UI at `/docs` (development and staging only, gated behind `NODE_ENV !== 'production'`)
- [ ] Expose spec JSON at `GET /api/spec.json` for programmatic access (mobile teams, Postman import, openapi-generator)
- [ ] Add `@openapi` JSDoc annotation to health route as working example pattern
- [ ] All future routes (Phase 5+) must include `@openapi` JSDoc annotations for Swagger

#### Upload Configuration (Placeholder for Phase 5)
- [ ] Install `multer` as runtime dependency
- [ ] Create `src/config/uploadConfig.ts` with constants: `MAX_FILE_SIZE` (5MB), `ALLOWED_MIME_TYPES` (image/jpeg, image/png, image/webp), `MAX_FILES_PER_REQUEST` (5), `UPLOAD_DIR`
- [ ] Add `uploads/` to `.gitignore`

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

## Phase 2: Database & Sequelize (5–7 days)

### Goals
- Initialize Sequelize with TypeScript and migration-based schema management
- Define all 14 models preserving the exact schema from the current database
- Establish all associations (1:1, 1:N, M:N)
- Add ALL missing indexes and constraints identified in the audit
- Create seed data for development

### Tasks

#### Sequelize Setup
- [ ] Install `sequelize`, `sequelize-cli`, `sequelize-typescript`, `pg`, `pg-hstore`
- [ ] Create `src/config/db.ts`: Sequelize instance with connection pool (min: 2, max: 10), SSL config (`rejectUnauthorized: true` in production), query logging via Winston, retry logic
- [ ] Create `.sequelizerc` pointing to TypeScript-compatible paths
- [ ] Configure Sequelize CLI for TypeScript migrations

#### Model Definitions (14 models)
- [ ] `User` — id (UUID, PK), full_name, email (unique, nullable), phone (unique), password_hash, role (ENUM: rider/driver/admin/pending), avatar_url, google_id (nullable), is_verified, is_active, created_at, updated_at
- [ ] `DriverProfile` — user_id (UUID, FK → users, 1:1), license_number, license_expiry, cin, cin_delivered_at, cin_photo_front, cin_photo_back, license_photo_front, license_photo_back, is_approved, is_online, rating (DECIMAL 3,2), total_rides, last_lat (DECIMAL 10,8), last_lng (DECIMAL 11,8), created_at, updated_at
- [ ] `Vehicle` — id (UUID, PK), driver_id (FK → driver_profiles, 1:1), make, model, year, plate_number (unique), color, vehicle_type (ENUM: economy/premium/van), doors, seats, photo_front, photo_side, photo_back, is_active, created_at, updated_at
- [ ] `Ride` — id (UUID, PK), rider_id (FK → users), driver_id (FK → users, nullable), passenger_name, passenger_phone, vehicle_type (ENUM), status (ENUM: pending/offered/accepted/in_progress/completed/cancelled), pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, distance_km, estimated_minutes, calculated_fare, final_fare, is_shared, shared_seats_available, commission_rate, commission_amount, scheduled_at, expires_at, started_at, arrived_at, approached_notified, completed_at, cancelled_by, cancel_reason, created_at, updated_at
  - **ADD:** `CHECK (commission_rate BETWEEN 0 AND 100)`
- [ ] `RideOffer` — id (UUID, PK), ride_id (FK → rides), driver_id (FK → users), status (ENUM: pending/accepted/rejected/expired), offered_fare, created_at, updated_at
- [ ] `RideStop` — id (UUID, PK), ride_id (FK → rides), address, lat, lng, order_index, arrived_at, left_at, wait_minutes, created_at
- [ ] `SharedRidePassenger` — id (UUID, PK), primary_ride_id (FK → rides), passenger_ride_id (FK → rides), rider_id (FK → users), pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, estimated_fare, final_fare, pickup_order, dropoff_order, picked_up_at, dropped_off_at, status (ENUM: pending/confirmed/picked_up/dropped_off/cancelled), created_at
- [ ] `Rating` — id (UUID, PK), ride_id (FK → rides, unique), rider_id (FK → users), driver_id (FK → users), score, comment, created_at
  - **ADD:** `CHECK (score BETWEEN 1 AND 5)`
- [ ] `Wallet` — id (UUID, PK), owner_id (FK → users), balance (DECIMAL 10,2), currency (default 'TND'), status (ENUM: active/suspended/closed), created_at, updated_at
  - **ADD:** `CHECK (balance >= 0)`
- [ ] `WalletTransaction` — id (UUID, PK), wallet_owner_id (FK → users), type (ENUM: topup_manual/topup_online/commission/ride_earning/withdrawal), amount (DECIMAL 10,2), status (ENUM: pending/completed/failed/refunded), reference_id, description, created_at
  - **ADD:** `UNIQUE (reference_id)` where reference_id is not null
- [ ] `OtpCode` — id (UUID, PK), phone, code_hash, attempts, is_used, expires_at, created_at
- [ ] `RefreshToken` — id (UUID, PK), user_id (FK → users), token, expires_at, created_at
- [ ] `DeviceToken` — id (UUID, PK), user_id (FK → users), token, platform (ENUM: ios/android), updated_at

#### Associations
- [ ] `User.hasOne(DriverProfile, { foreignKey: 'user_id' })`
- [ ] `User.hasOne(Wallet, { foreignKey: 'owner_id' })`
- [ ] `User.hasMany(Ride, { as: 'ridesAsRider', foreignKey: 'rider_id' })`
- [ ] `User.hasMany(Ride, { as: 'ridesAsDriver', foreignKey: 'driver_id' })`
- [ ] `User.hasMany(RefreshToken, { foreignKey: 'user_id' })`
- [ ] `User.hasMany(DeviceToken, { foreignKey: 'user_id' })`
- [ ] `User.hasMany(WalletTransaction, { foreignKey: 'wallet_owner_id' })`
- [ ] `DriverProfile.hasOne(Vehicle, { foreignKey: 'driver_id' })`
- [ ] `DriverProfile.belongsTo(User, { foreignKey: 'user_id' })`
- [ ] `Ride.hasMany(RideOffer, { foreignKey: 'ride_id' })`
- [ ] `Ride.hasMany(RideStop, { foreignKey: 'ride_id' })`
- [ ] `Ride.hasMany(SharedRidePassenger, { as: 'sharedPassengers', foreignKey: 'primary_ride_id' })`
- [ ] `Ride.hasOne(Rating, { foreignKey: 'ride_id' })`
- [ ] `Ride.belongsTo(User, { as: 'rider', foreignKey: 'rider_id' })`
- [ ] `Ride.belongsTo(User, { as: 'driver', foreignKey: 'driver_id' })`
- [ ] `RideOffer.belongsTo(Ride, { foreignKey: 'ride_id' })`
- [ ] `RideOffer.belongsTo(User, { as: 'driver', foreignKey: 'driver_id' })`

#### Indexes (from audit + new)
- [ ] `rides(status, expires_at)` — used by `findAvailableForDriver`
- [ ] `rides(rider_id, status)` — used by rider's ride history
- [ ] `rides(driver_id, status)` — used by driver's ride history
- [ ] `ride_offers(ride_id, status)` — used by offer queries per ride
- [ ] `ride_offers(driver_id, status)` — used to check if driver has active rides
- [ ] `wallet_transactions(reference_id)` — used by topup confirmation idempotency
- [ ] `wallet_transactions(wallet_owner_id, created_at)` — used by transaction history
- [ ] `driver_profiles(is_online, is_approved)` partial index — used by nearby driver query
- [ ] `otp_codes(phone, is_used, expires_at)` — used by OTP verification
- [ ] `refresh_tokens(user_id)` — used by token cleanup
- [ ] `refresh_tokens(token)` — used by token lookup
- [ ] `device_tokens(user_id)` — used by notification sends

#### Migrations & Seeds
- [ ] Generate Sequelize CLI migrations for all 14 tables (sequential, timestamped)
- [ ] Each migration includes both `up` and `down` functions
- [ ] Create seeders: admin user, 5 test riders, 3 test drivers with profiles + vehicles, sample rides in various states, wallet transactions
- [ ] Add npm scripts: `migrate`, `migrate:undo`, `seed`, `seed:undo`

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

## Phase 3: Core Infrastructure (3–4 days)

### Goals
- Build the shared utility layer that all other modules depend on
- Establish consistent error handling, response formatting, logging, and validation patterns
- Eliminate try-catch boilerplate with `asyncHandler`
- Add request correlation IDs for traceability

### Tasks

#### Error Handling
- [ ] Create `src/utils/AppError.ts`:
  ```typescript
  class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;        // machine-readable: 'RIDE_NOT_FOUND'
    readonly isOperational: boolean;
    readonly details?: Record<string, unknown>;
  }
  ```
- [ ] Define error code constants in `src/types/errorCodes.ts` — organized by domain:
  - Auth: `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `ACCOUNT_SUSPENDED`, `ACCOUNT_NOT_FOUND`
  - OTP: `OTP_EXPIRED`, `OTP_INVALID`, `OTP_MAX_ATTEMPTS`, `OTP_RATE_LIMITED`
  - Ride: `RIDE_NOT_FOUND`, `RIDE_INVALID_STATUS`, `RIDE_ALREADY_ACCEPTED`, `RIDE_EXPIRED`, `RIDE_OUTSIDE_BOUNDS`
  - Wallet: `INSUFFICIENT_BALANCE`, `WALLET_SUSPENDED`, `DUPLICATE_TRANSACTION`, `INVALID_AMOUNT`
  - Driver: `DRIVER_NOT_APPROVED`, `DRIVER_OFFLINE`, `DRIVER_NOT_FOUND`, `VEHICLE_NOT_FOUND`
  - General: `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `RATE_LIMITED`, `INTERNAL_ERROR`

#### Response Helpers
- [ ] Create `src/utils/responseHelpers.ts`:
  - `sendSuccess(res, data, statusCode = 200)` → `{ success: true, data }`
  - `sendCreated(res, data)` → 201 + `{ success: true, data }`
  - `sendNoContent(res)` → 204, empty body
  - `sendPaginated(res, data, meta)` → `{ success: true, data, meta: { total, page, limit, pages } }`
  - `sendError(res, error)` → `{ success: false, error: { code, message, details? } }`

#### Async Handler
- [ ] Create `src/utils/asyncHandler.ts` — wraps async controller functions, catches thrown errors, passes to `next()`

#### Logger
- [ ] Create `src/utils/logger.ts`:
  - Winston with daily rotation (`winston-daily-rotate-file`)
  - JSON format in production, colorized console in development
  - Log levels: error, warn, info, http, debug
  - Correlation ID attached to every log entry via `cls-hooked` or `AsyncLocalStorage`
  - 30-day retention on log files
  - No `console.log` anywhere in codebase

#### Correlation ID Middleware
- [ ] Create `src/middlewares/correlationId.ts`:
  - Read `X-Request-ID` header or generate UUID
  - Set on response header
  - Store in `AsyncLocalStorage` for logger access
  - Available to all downstream code via `getCorrelationId()`

#### Validation Middleware
- [ ] Create `src/middlewares/validate.ts`:
  - Wrapper around express-validator's `validationResult`
  - Returns `{ success: false, error: { code: 'VALIDATION_ERROR', message, details: { field, message }[] } }`
  - Input length limits: default 500 chars max on all text fields
  - Remove Joi dependency entirely
  - Remove MongoDB-style `$`/`.` sanitization (irrelevant for PostgreSQL)

#### Shared Types
- [ ] Create `src/types/` directory:
  - `enums.ts` — RideStatus, UserRole, VehicleType, WalletTransactionType, OtpChannel, etc. as TypeScript enums or discriminated unions
  - `pagination.ts` — `PaginationQuery`, `PaginationMeta` interfaces
  - `express.d.ts` — extend Express `Request` with `user`, `requestId`
  - `common.ts` — `ApiResponse<T>`, `PaginatedResponse<T>`, `ErrorResponse` interfaces

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

## Phase 4: Authentication & Authorization (4–5 days)

### Goals
- Implement JWT-based authentication with access/refresh token pattern
- Add token blacklist in Redis for immediate revocation
- Build OTP system with WhatsApp + SMS fallback
- Implement Google OAuth 2.0 flow
- Harden all auth endpoints with rate limiting

### Tasks

#### JWT System
- [ ] Create `src/utils/jwt.ts`:
  - `generateAccessToken(payload: { userId, role })` → 15min expiry, signed with `JWT_SECRET`
  - `generateRefreshToken(payload: { userId })` → 30d expiry, signed with `REFRESH_TOKEN_SECRET`
  - `verifyAccessToken(token)`, `verifyRefreshToken(token)` — return decoded payload or throw
- [ ] Create `src/config/redis.ts` — Redis client with reconnection logic, event handlers
- [ ] Implement token blacklist in Redis:
  - On logout: `SET blacklist:{jti} 1 EX {remainingTTL}`
  - On `protect` middleware: check blacklist before token validation
  - On password change: blacklist all existing tokens for that user

#### Auth Middleware
- [ ] Create `src/middlewares/auth.ts`:
  - `protect`: extract Bearer token → check Redis blacklist → verify JWT → fetch user from cache/DB → attach to `req.user` → reject if `is_active === false`
  - `restrictTo(...roles: UserRole[])`: check `req.user.role` against allowed roles
  - User lookup: check Redis cache first (5min TTL), fall back to DB query
  - Cache invalidation: clear on profile update, role change, suspension

#### Auth Service & Controller
- [ ] Create `src/services/authService.ts`:
  - `register(data)` → validate uniqueness → hash password (bcrypt, 12 rounds) → create user + wallet in transaction → generate tokens
  - `login(phone, password)` → find user → verify password → generate tokens → store refresh token
  - `refreshToken(token)` → verify → check not revoked → generate new pair → revoke old refresh token
  - `logout(userId, token)` → blacklist access token in Redis → delete refresh token from DB
  - `changePassword(userId, oldPassword, newPassword)` → verify old → hash new → update → blacklist all tokens
  - `resetPasswordWithOtp(phone, code, newPassword)` → verify OTP → update password → blacklist tokens
- [ ] Create `src/controllers/authController.ts` — thin HTTP handlers calling authService
- [ ] Create `src/routes/authRoutes.ts` with validation chains

#### Password Validation
- [ ] Minimum 8 characters
- [ ] At least 1 uppercase letter, 1 lowercase letter, 1 digit
- [ ] Express-validator custom chain reusable across register + change password

#### Google OAuth
- [ ] Create `src/services/googleAuthService.ts`:
  - Accept Google ID token from client
  - Verify via `google-auth-library` with web/Android/iOS client IDs
  - Extract email, name, picture
  - Find or create user (link google_id, handle email conflicts)
  - Generate JWT tokens
- [ ] Create `src/controllers/googleAuthController.ts`
- [ ] Route: `POST /api/v1/auth/google`

#### OTP System
- [ ] Create `src/services/otpService.ts`:
  - Generate 6-digit code → hash with bcrypt → store in `otp_codes`
  - Rate limiting: 3 per phone per hour, 100 global per minute
  - Phone format validation: 8–15 digits, valid country code patterns
  - Delivery: try WhatsApp (Vonage) first → fallback to SMS (EasySendSMS)
  - Verification: hash comparison, max 3 attempts, 5min expiry, mark used
- [ ] Create `src/services/providers/vonageWhatsappProvider.ts`
- [ ] Create `src/services/providers/easySendSmsProvider.ts`
- [ ] Create `src/controllers/otpController.ts`

#### Rate Limiting
- [ ] Create `src/middlewares/rateLimiter.ts`:
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

### Deliverables
- Complete auth flow: register → login → refresh → logout → change password
- Google OAuth endpoint
- OTP send/verify with dual-provider delivery
- Redis-backed rate limiting on all auth endpoints
- Redis token blacklist for immediate revocation

### Checkpoint
- Register → login → access protected route → refresh token → logout → access denied
- Rate limit: 11th login attempt in 15min returns 429
- OTP: send → verify → authenticate; 4th attempt on same code returns error
- Google OAuth: valid ID token returns JWT; invalid token returns 401
- Blacklisted token rejected immediately (not after 15min expiry)
- Password change invalidates all previous tokens

### Commit Strategy
- `feat(auth): add JWT generation, verification, and Redis blacklist`
- `feat(auth): add protect and restrictTo middleware with Redis user cache`
- `feat(auth): add register, login, refresh, logout, change-password`
- `feat(auth): add Google OAuth 2.0 authentication`
- `feat(auth): add OTP system with WhatsApp + SMS fallback`
- `feat(auth): add Redis-backed rate limiting on all auth routes`

---

## Phase 5: API Layer — CRUD Modules (7–10 days)

### Goals
- Rebuild all REST endpoints under `/api/v1/` prefix
- Add pagination, filtering, sorting, and field selection on all list endpoints
- Ensure all routes have proper validation chains
- Keep controllers thin — HTTP handling only

### Tasks

#### API Versioning
- [ ] Mount all routes under `/api/v1/` in `app.ts`
- [ ] API version header: `X-API-Version: v1`

#### User Module
- [ ] `src/services/userService.ts` — getProfile, updateProfile (name, email, avatar), updatePhone, setRole, deactivateAccount
- [ ] `src/controllers/userController.ts`
- [ ] `src/routes/userRoutes.ts`:
  - `GET /api/v1/users/me` — get own profile
  - `PATCH /api/v1/users/me` — update profile
  - `DELETE /api/v1/users/me` — deactivate account
  - `PATCH /api/v1/users/me/role` — set role
  - `PATCH /api/v1/users/me/phone` — update phone

#### Driver Module
- [ ] `src/services/driverService.ts` — createProfile, updateProfile, getProfile, registerVehicle, updateVehicle, getVehicle, toggleOnlineStatus, updateLocation, getNearbyDrivers (with bounding box pre-filter)
- [ ] `src/controllers/driverController.ts`
- [ ] `src/routes/driverRoutes.ts`:
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
- [ ] `src/services/rideService.ts` — calculateFare, requestRide, getMyRides, getAvailableRides, getScheduledRides, getRideDetails, getRideOffers (business logic deferred to Phase 6)
- [ ] `src/controllers/rideController.ts`
- [ ] `src/routes/rideRoutes.ts`:
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
- [ ] `src/services/rideStopService.ts`
- [ ] `src/controllers/rideStopController.ts`
- [ ] `src/routes/rideStopRoutes.ts`:
  - `GET /api/v1/rides/:id/stops` — get all stops
  - `POST /api/v1/rides/:id/stops` — add stop(s)
  - `PATCH /api/v1/rides/:id/stops/:stopId/arrive` — mark arrival
  - `PATCH /api/v1/rides/:id/stops/:stopId/leave` — mark departure

#### Shared Rides Module
- [ ] `src/services/sharedRideService.ts`
- [ ] `src/controllers/sharedRideController.ts`
- [ ] `src/routes/sharedRideRoutes.ts`:
  - `GET /api/v1/shared-rides/available` — find available shared rides
  - `POST /api/v1/shared-rides/:id/join` — join shared ride
  - `GET /api/v1/shared-rides/:id/passengers` — get passengers
  - `PATCH /api/v1/shared-rides/:id/passengers/:passengerId/pickup` — mark picked up
  - `PATCH /api/v1/shared-rides/:id/passengers/:passengerId/dropoff` — mark dropped off
  - `DELETE /api/v1/shared-rides/:id/leave` — leave shared ride

#### Wallet Module
- [ ] `src/services/walletService.ts` — getBalance, getTransactions (paginated), initiateOnlineTopup, confirmTopup, adminTopup (business logic hardened in Phase 6)
- [ ] `src/controllers/walletController.ts`
- [ ] `src/routes/walletRoutes.ts`:
  - `GET /api/v1/wallet` — get balance
  - `GET /api/v1/wallet/transactions` — transaction history (paginated)
  - `POST /api/v1/wallet/topup/online` — initiate Flouci payment
  - `POST /api/v1/wallet/topup/confirm` — confirm online topup
  - `POST /api/v1/wallet/topup/manual` — admin manual topup

#### Rating Module
- [ ] `src/services/ratingService.ts`
- [ ] `src/controllers/ratingController.ts`
- [ ] `src/routes/ratingRoutes.ts`:
  - `POST /api/v1/ratings/rides/:rideId` — submit rating
  - `GET /api/v1/ratings/rides/:rideId` — get ride rating
  - `GET /api/v1/ratings/drivers/:driverId` — get driver ratings (paginated)

#### Admin Module
- [ ] `src/services/adminService.ts`
- [ ] `src/controllers/adminController.ts`
- [ ] `src/routes/adminRoutes.ts`:
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
- [ ] `src/controllers/vehicleCatalogController.ts`
- [ ] `src/routes/vehicleCatalogRoutes.ts`:
  - `GET /api/v1/vehicles/makes` — vehicle makes
  - `GET /api/v1/vehicles/models/:make` — models for make
- [ ] `src/routes/metaRoutes.ts`:
  - `GET /api/v1/meta/vehicle-types` — vehicle type enums

#### Notification Routes
- [ ] `src/routes/notificationRoutes.ts`:
  - `POST /api/v1/notifications/token` — register device token
  - `DELETE /api/v1/notifications/token` — unregister token

#### File Upload Module (Server-Side)
- [ ] Create `src/middlewares/upload.ts`:
  - Multer middleware factory using config from `src/config/uploadConfig.ts`
  - Disk storage for local dev (writes to `uploads/` directory)
  - Memory storage option for cloud streaming (S3/Cloudinary in production)
  - Server-side MIME type validation (not just extension — use file magic bytes)
  - File size enforcement: 5MB per file, max 5 files per request
  - Sanitize filenames (strip path traversal, special characters)
  - Return standardized error via `AppError` on validation failure
- [ ] Create `src/services/uploadService.ts`:
  - `uploadImage(file, folder)` — process and store a single image
  - `uploadImages(files, folder)` — process and store multiple images
  - `deleteImage(fileKey)` — delete stored image
  - Local storage in development (disk), cloud storage in production (S3/Cloudinary — configurable via env)
  - Return file URL/key on success
- [ ] Create `src/controllers/uploadController.ts`
- [ ] Create `src/routes/uploadRoutes.ts`:
  - `POST /api/v1/upload/avatar` — upload user avatar (1 file, max 2MB)
  - `POST /api/v1/upload/document` — upload driver documents (CIN, license photos, up to 4 files, max 5MB each)
  - `POST /api/v1/upload/vehicle` — upload vehicle photos (up to 3 files, max 5MB each)
  - All upload endpoints require authentication
  - Body parser limit: 10MB on upload routes only (overrides global 1MB)
- [ ] Add upload-related env vars to `.env.example`:
  ```
  UPLOAD_STORAGE=local          # local | s3 | cloudinary
  UPLOAD_S3_BUCKET=
  UPLOAD_S3_REGION=
  UPLOAD_CLOUDINARY_CLOUD=
  UPLOAD_CLOUDINARY_KEY=
  UPLOAD_CLOUDINARY_SECRET=
  ```
- [ ] Add `@openapi` JSDoc annotations to all upload routes for Swagger documentation

#### Swagger Route Documentation
- [ ] Ensure ALL routes created in Phase 5 include `@openapi` JSDoc annotations
- [ ] Define reusable OpenAPI component schemas in `src/config/swagger.ts` or JSDoc:
  - `ErrorResponse`, `PaginatedResponse`, `SuccessResponse`
  - Request body schemas per endpoint
  - Auth bearer security scheme definition
- [ ] Verify Swagger UI at `/docs` shows all endpoints with request/response examples

#### Pagination Utility
- [ ] Create `src/utils/pagination.ts`:
  - Parse `?page=1&limit=20` from query params (defaults: page 1, limit 20, max 100)
  - Return `{ offset, limit }` for Sequelize queries
  - Build `PaginationMeta` from Sequelize `count` result

#### Filtering & Sorting
- [ ] Parse `?sort=created_at:desc` and `?status=completed&role=driver`
- [ ] Whitelist allowed sort/filter fields per endpoint
- [ ] Apply as Sequelize `where` and `order` options

### Deliverables
- All REST endpoints from the current API, rebuilt under `/api/v1/`
- Every list endpoint returns paginated responses with `meta`
- All routes have express-validator validation chains
- Request body size limited to 1MB (10MB for upload endpoints)
- Server-side file upload with multer: validation, size limits, MIME checking
- All routes documented with `@openapi` JSDoc annotations visible in Swagger UI

### Checkpoint
- All endpoints respond with correct status codes and response format
- Pagination works: `?page=2&limit=5` returns correct page with meta
- Validation rejects bad input with field-level errors
- Protected routes reject unauthenticated requests with 401
- Role-restricted routes reject unauthorized users with 403
- Upload: valid image accepted, oversized file rejected, wrong MIME rejected, no path traversal possible
- Swagger UI at `/docs` shows all endpoints with schemas and examples

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

---

## Phase 6: Critical Business Logic — Wallet & Rides (5–7 days)

### Goals
- Fix ALL race conditions and financial bugs identified in the audit
- Implement ride lifecycle as a proper state machine with validated transitions
- Ensure all multi-step mutations run inside database transactions
- Add idempotency for payment operations
- Guarantee wallet balance never goes negative

### Tasks

#### Ride State Machine
- [ ] Create `src/types/rideStateMachine.ts`:
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
- [ ] All ride status updates call `validateTransition` before proceeding

#### Wallet Operations (Transaction-Safe)
- [ ] **`confirmOnlineTopUp`** — FIX DOUBLE-SPEND:
  ```
  BEGIN SERIALIZABLE
    SELECT * FROM wallet_transactions WHERE reference_id = $1 FOR UPDATE
    IF status === 'completed' → return already-confirmed (idempotent)
    Verify with Flouci API
    UPDATE wallets SET balance = balance + $amount WHERE owner_id = $userId
    UPDATE wallet_transactions SET status = 'completed' WHERE id = $txId
  COMMIT
  ```
- [ ] **`completeRide`** — FIX NEGATIVE BALANCE:
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
- [ ] **`adminTopup`** — wrap in transaction with daily limit check

#### Ride Operations (Transaction-Safe)
- [ ] **`acceptRide`** — FIX CONCURRENT ACCEPTANCE:
  ```
  BEGIN
    SELECT * FROM rides WHERE id = $rideId AND status IN ('pending', 'offered') FOR UPDATE
    IF no row → throw RIDE_ALREADY_ACCEPTED or RIDE_NOT_FOUND
    INSERT ride_offer (driver_id, ride_id, status: 'pending')
    UPDATE rides SET status = 'offered' WHERE status = 'pending'
  COMMIT
  ```
- [ ] **`pickDriver`** — FIX NON-TRANSACTIONAL:
  ```
  BEGIN
    SELECT * FROM rides WHERE id = $rideId FOR UPDATE
    UPDATE ride_offers SET status = 'accepted' WHERE id = $offerId
    UPDATE ride_offers SET status = 'rejected' WHERE ride_id = $rideId AND id != $offerId
    UPDATE rides SET status = 'accepted', driver_id = $driverId
  COMMIT
  ```
- [ ] **`register`** — wrap user creation + wallet creation in transaction
- [ ] **`submitRating`** — wrap rating insert + driver average recalculation in transaction

#### Idempotency
- [ ] `UNIQUE` constraint on `wallet_transactions.reference_id` (already in Phase 2 migration)
- [ ] Create `src/middlewares/idempotency.ts`:
  - Read `Idempotency-Key` header on mutation requests
  - Check Redis: `GET idempotency:{key}`
  - If exists: return cached response
  - If not: process request → store response in Redis with 24h TTL
  - Apply to: `POST /wallet/topup/confirm`, `POST /rides`, `POST /rides/:id/accept`

#### Fare Calculation
- [ ] Create `src/config/fareConfig.ts`:
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
- [ ] Fare calculation: `max(BASE_FARE + (minutes * PRICE_PER_MINUTE) + (stop_minutes * PRICE_PER_STOP_MINUTE), MIN_FARE)`

#### Cancellation Logic
- [ ] Track `cancelled_by` (rider/driver/system) and `cancel_reason`
- [ ] Driver cancellation after acceptance: flag for admin review
- [ ] System cancellation: rides pending > 10 minutes

### Deliverables
- All wallet operations wrapped in SERIALIZABLE transactions with row locks
- Ride lifecycle enforced via state machine with validated transitions
- Idempotency middleware with Redis caching
- No operation modifies wallet balance outside a transaction
- Negative balance impossible at both DB and application level

### Checkpoint
- **Concurrent topup test**: fire 10 simultaneous `confirmTopup` with same `payment_id` → wallet credited exactly once
- **Concurrent ride accept**: fire 5 simultaneous `acceptRide` for same ride → exactly one offer created, others get `RIDE_ALREADY_ACCEPTED`
- **Negative balance test**: complete ride with commission exceeding balance → rejected, balance unchanged
- **State machine test**: attempt `complete` on `pending` ride → `RIDE_INVALID_STATUS`
- **Idempotency test**: same `Idempotency-Key` twice → second returns cached response, no duplicate side effects

### Commit Strategy
- `feat(rides): add ride status state machine with validated transitions`
- `fix(wallet): wrap confirmOnlineTopUp in SERIALIZABLE transaction with FOR UPDATE`
- `fix(wallet): add negative balance protection (CHECK constraint + WHERE guard)`
- `fix(rides): wrap pickDriver in transaction (offer accept + reject others + ride update)`
- `fix(rides): add FOR UPDATE lock on acceptRide to prevent concurrent acceptance`
- `feat(wallet): add completeRide with transactional fare, commission, and wallet update`
- `feat(api): add idempotency middleware with Redis caching`

---

## Phase 7: Redis & Caching (3–4 days)

### Goals
- Implement driver geospatial indexing for fast nearby driver queries
- Add caching for frequently accessed data
- Centralize rate limiting state in Redis (shared across instances)
- Implement JWT blacklist with automatic TTL expiry

### Tasks

#### Redis Client
- [ ] Create `src/config/redis.ts`:
  - Connection with automatic reconnect (exponential backoff)
  - Event logging: connect, error, reconnecting
  - Health check method: `PING`
  - Graceful disconnect on shutdown

#### Geospatial Driver Indexing
- [ ] Create `src/services/redisGeoService.ts`:
  - `updateDriverLocation(driverId, lat, lng)`:
    - `GEOADD drivers:online {lng} {lat} {driverId}`
    - Also store metadata: `HSET driver:{driverId}:meta vehicle_type, rating, name`
  - `removeDriver(driverId)`:
    - `ZREM drivers:online {driverId}`
    - `DEL driver:{driverId}:meta`
  - `getNearbyDrivers(lat, lng, radiusKm, vehicleType?)`:
    - `GEOSEARCH drivers:online FROMLONLAT {lng} {lat} BYRADIUS {radiusKm} km ASC`
    - Filter by vehicle_type from metadata hash
    - Return with distances
  - Update driver set on online/offline toggle

#### Caching Layers
- [ ] User session cache:
  - Key: `user:{userId}`
  - TTL: 5 minutes
  - Set: on successful auth middleware lookup
  - Invalidate: on profile update, role change, suspension, password change
- [ ] Fare estimate cache:
  - Key: `fare:{distance_bucket}:{duration_bucket}` (round to nearest km/min)
  - TTL: 1 hour
  - Reduces DB/calculation load for common routes
- [ ] Driver profile cache:
  - Key: `driver:{userId}:profile`
  - TTL: 10 minutes
  - Invalidate on profile update

#### JWT Blacklist
- [ ] Key: `blacklist:{tokenJTI}`
- [ ] TTL: remaining token lifetime (max 15min for access tokens)
- [ ] Check in `protect` middleware before JWT verification

#### Rate Limiting Store
- [ ] Configure `rate-limit-redis` store connected to shared Redis instance
- [ ] All rate limiters share state across Node.js instances

### Deliverables
- `src/services/redisGeoService.ts` — geospatial driver management
- `src/services/cacheService.ts` — generic cache get/set/invalidate
- Redis-backed rate limiting, JWT blacklist, session cache
- Health check includes Redis connectivity

### Checkpoint
- `GEOADD` + `GEOSEARCH`: add 100 drivers → search radius 5km → returns sorted by distance
- Cache hit: second `protect` call for same user returns from Redis (check logs)
- Cache invalidation: update profile → next `protect` fetches from DB
- Blacklisted JWT immediately rejected
- Rate limiter state persists across app restarts (Redis-backed)

### Commit Strategy
- `feat(redis): add Redis client with reconnection logic`
- `feat(redis): add geospatial driver indexing (GEOADD/GEOSEARCH)`
- `feat(redis): add user session cache and fare estimate cache`
- `feat(redis): migrate JWT blacklist and rate limiters to Redis store`

---

## Phase 8: Socket.IO Real-Time (5–7 days)

### Goals
- Replace polling-based updates with event-driven communication
- Implement Socket.IO with Redis adapter for horizontal scaling
- Authenticate all socket connections via JWT
- Create namespaces for riders and drivers with room-based ride sessions

### Tasks

#### Socket.IO Setup
- [ ] Install `socket.io`, `@socket.io/redis-adapter`
- [ ] Create `src/sockets/socketServer.ts`:
  - Attach to HTTP server
  - Configure Redis adapter for multi-instance pub/sub
  - CORS configuration matching Express
  - Connection logging
- [ ] Create `src/sockets/socketAuth.ts`:
  - JWT verification on connection (`socket.handshake.auth.token`)
  - Reject invalid/expired/blacklisted tokens
  - Attach user data to socket: `socket.data.user = { userId, role }`

#### Namespaces & Rooms
- [ ] Create `src/sockets/namespaces/riderNamespace.ts` (`/riders`):
  - On connect: join `rider:{userId}` room
  - Listen: `ride:request_status` — subscribe to ride updates
  - Listen: `ride:cancel` — rider cancels via socket
- [ ] Create `src/sockets/namespaces/driverNamespace.ts` (`/drivers`):
  - On connect: join `driver:{userId}` room
  - Listen: `location:update` — driver pushes GPS coordinates (replaces HTTP polling)
    - Validate coordinates (lat/lng bounds, accuracy)
    - Update Redis GeoSet
    - Update `driver_profiles.last_lat/last_lng` (debounced, every 10s to DB)
    - Broadcast to ride room if in active ride
  - Listen: `driver:status` — online/offline toggle

#### Ride Room Events
- [ ] Create `src/sockets/handlers/rideEvents.ts`:
  - When ride created: emit `ride:new` to nearby drivers (via Redis GeoSet lookup)
  - When offer made: emit `ride:offer` to rider's room
  - When driver accepted: emit `ride:accepted` to ride room
  - When status changes: emit `ride:status_changed` to ride room
  - When driver location updates during active ride: emit `ride:driver_location` to rider in ride room
  - When driver approaching (< 200m): emit `ride:driver_approaching` to rider
  - When ride completed: emit `ride:completed` to ride room
  - When ride cancelled: emit `ride:cancelled` to ride room

#### Integration with Services
- [ ] Create `src/sockets/emitter.ts` — centralized emit helper:
  - `emitToUser(userId, event, data)` — emit to user's personal room
  - `emitToRideRoom(rideId, event, data)` — emit to ride room
  - `emitToNearbyDrivers(lat, lng, radiusKm, event, data)` — broadcast to drivers in radius
  - Services call emitter after database mutations (AFTER transaction commit)
- [ ] Ensure socket emissions happen OUTSIDE database transactions (never inside `BEGIN/COMMIT`)

#### Fallback
- [ ] HTTP polling endpoints remain available for clients that haven't migrated to sockets
- [ ] Socket.IO `transports: ['websocket', 'polling']` — fallback to HTTP long-polling if WebSocket fails

### Deliverables
- `src/sockets/` directory with server setup, auth, namespaces, and event handlers
- Real-time ride lifecycle events replacing polling
- Driver location streaming via socket
- Redis adapter for multi-instance broadcasting

### Checkpoint
- Two clients connect to `/riders` and `/drivers` namespaces with valid JWTs
- Driver emits `location:update` → rider in same ride room receives `ride:driver_location`
- Ride status change in service → both rider and driver receive `ride:status_changed`
- Invalid JWT on connection → socket rejected with error
- Redis adapter: events emitted from instance A received by clients on instance B

### Commit Strategy
- `feat(sockets): add Socket.IO server with Redis adapter`
- `feat(sockets): add JWT authentication on socket connections`
- `feat(sockets): add rider and driver namespaces with room management`
- `feat(sockets): add ride lifecycle event emissions`
- `feat(sockets): add driver location streaming via socket`

---

## Phase 9: BullMQ Background Jobs (4–5 days)

### Goals
- Replace cron-based scheduled tasks with BullMQ delayed jobs
- Move notification delivery, payment verification, and OTP sending to background queues
- Add retry logic with exponential backoff and dead letter queues
- Set up monitoring dashboard for development

### Tasks

#### Queue Infrastructure
- [ ] Install `bullmq`
- [ ] Create `src/jobs/queues.ts` — queue definitions:
  - `notification` — FCM push delivery
  - `payment-verification` — Flouci webhook processing
  - `ride-expiration` — delayed job (10min after ride creation)
  - `scheduled-ride-activation` — delayed job (15min before scheduled time)
  - `otp-delivery` — async SMS/WhatsApp send
  - `rating-recalculation` — batch driver rating update
- [ ] Create `src/jobs/workers/` directory with one worker file per queue

#### Notification Worker
- [ ] Create `src/jobs/workers/notificationWorker.ts`:
  - Receive: `{ userId, type, title, body, data }`
  - Fetch device tokens for user
  - Send via Firebase FCM
  - Retry: 3 attempts, exponential backoff (1s, 4s, 16s)
  - On token delivery failure: remove invalid device token
  - Dead letter after 3 failures → log + Sentry alert

#### Payment Verification Worker
- [ ] Create `src/jobs/workers/paymentVerificationWorker.ts`:
  - Receive: `{ transactionId, paymentId, userId }`
  - Call Flouci API to verify payment status
  - On success: call `walletService.confirmOnlineTopUp()` (already transaction-safe from Phase 6)
  - Retry: 5 attempts with 30s backoff

#### Ride Expiration Worker
- [ ] Create `src/jobs/workers/rideExpirationWorker.ts`:
  - Delayed job: created when ride enters `pending` state, fires after 10 minutes
  - On fire: check if ride is still `pending` or `offered` → cancel with `cancelled_by: 'system'`
  - Emit `ride:expired` via Socket.IO
  - Send push notification to rider
  - Remove delayed job if ride is accepted before expiry

#### Scheduled Ride Activation Worker
- [ ] Create `src/jobs/workers/scheduledRideActivationWorker.ts`:
  - Delayed job: created at ride scheduling time, fires 15 minutes before `scheduled_at`
  - On fire: transition ride from scheduled → pending
  - Notify nearby drivers via Socket.IO
  - This REPLACES the 1-minute cron job from the old codebase

#### OTP Delivery Worker
- [ ] Create `src/jobs/workers/otpDeliveryWorker.ts`:
  - Receive: `{ phone, code, channel }`
  - Try WhatsApp (Vonage) → fallback to SMS (EasySendSMS)
  - Retry: 2 attempts
  - Dead letter: log phone number + alert

#### Rating Recalculation Worker
- [ ] Create `src/jobs/workers/ratingRecalculationWorker.ts`:
  - Receive: `{ driverId }`
  - Calculate average rating from all ratings for driver
  - Update `driver_profiles.rating`
  - Debounce: if multiple ratings arrive in 5s window, process once

#### Monitoring
- [ ] Install `@bull-board/express`
- [ ] Mount at `/admin/queues` (protected by admin auth)
- [ ] Disable in production (or restrict to admin IPs)

### Deliverables
- `src/jobs/` directory with queue definitions and 6 workers
- All notification sends go through queue (not inline)
- Ride expiration via delayed jobs (no more cron)
- Scheduled ride activation via delayed jobs
- Bull Board dashboard at `/admin/queues`

### Checkpoint
- Create a ride → 10 minutes later, ride auto-cancelled (check DB)
- Send notification → appears in queue → delivered via FCM → marked complete
- Simulate FCM failure → job retried 3 times → moved to dead letter
- OTP delivery via queue → WhatsApp attempted → fallback to SMS on failure
- Bull Board shows all queues with pending/active/completed/failed counts

### Commit Strategy
- `feat(jobs): add BullMQ queue infrastructure and worker setup`
- `feat(jobs): add notification worker with FCM delivery and retry logic`
- `feat(jobs): add ride expiration worker (replace cron)`
- `feat(jobs): add scheduled ride activation worker`
- `feat(jobs): add OTP delivery and payment verification workers`
- `feat(jobs): add Bull Board monitoring dashboard`

---

## Phase 10: Notifications System (2–3 days)

### Goals
- Add persistent notification storage in database
- Implement dual delivery: persist to DB + send via FCM queue
- Build notification management API for clients
- Handle device token lifecycle

### Tasks

#### Notifications Table
- [ ] Create migration for `notifications` table:
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
- [ ] Create `src/services/notificationService.ts`:
  - `send(userId, { type, title, body, data })`:
    1. Insert into `notifications` table
    2. Enqueue to `notification` BullMQ queue for FCM delivery
  - `getNotifications(userId, page, limit)` — paginated, newest first
  - `markAsRead(userId, notificationId)` — verify ownership
  - `markAllAsRead(userId)`
  - `getUnreadCount(userId)`

#### Device Token Management
- [ ] `registerToken(userId, token, platform)` — upsert device token
- [ ] `refreshToken(userId, oldToken, newToken)` — update on FCM token refresh
- [ ] `unregisterToken(userId)` — delete all tokens (logout)
- [ ] Cleanup: remove tokens that FCM reports as invalid (in notification worker)

#### API Endpoints
- [ ] `GET /api/v1/notifications` — paginated notification list
- [ ] `GET /api/v1/notifications/unread-count` — unread count
- [ ] `PATCH /api/v1/notifications/:id/read` — mark one as read
- [ ] `POST /api/v1/notifications/read-all` — mark all as read
- [ ] `POST /api/v1/notifications/token` — register device token
- [ ] `DELETE /api/v1/notifications/token` — unregister token

#### Notification Types (from current system)
- [ ] `new_ride_request` — new ride available for driver
- [ ] `ride_accepted` — driver accepted ride
- [ ] `ride_refused` — driver refused ride
- [ ] `driver_approaching` — driver near pickup
- [ ] `ride_expired` — no driver accepted
- [ ] `ride_completed` — ride finished
- [ ] `ride_cancelled` — ride cancelled
- [ ] `wallet_low` — balance below 5 TND threshold
- [ ] `wallet_suspended` — wallet suspended

### Deliverables
- `notifications` table with migration
- Notification service with dual delivery (DB + FCM)
- Notification management API
- Device token CRUD

### Checkpoint
- Complete a ride → notification appears in DB + delivered via FCM
- `GET /notifications` returns paginated results with unread count
- `PATCH /notifications/:id/read` marks notification, reduces unread count
- Register token → unregister on logout → no more pushes

### Commit Strategy
- `feat(notifications): add notifications table and model`
- `feat(notifications): add notification service with dual delivery`
- `feat(notifications): add notification management API`
- `feat(notifications): add device token lifecycle management`

---

## Phase 11: Observability & Monitoring (2–3 days)

### Goals
- Add error tracking with full context
- Create comprehensive health check endpoint
- Implement structured logging with request tracing
- Monitor slow queries

### Tasks

#### Sentry Integration
- [ ] Install `@sentry/node`
- [ ] Initialize in `server.ts` with:
  - DSN from environment
  - Release version from `package.json`
  - Environment tag (dev/staging/prod)
  - Performance tracing: sample 10% of requests
  - User context: attach `userId` when authenticated
  - Breadcrumbs: database queries, Redis operations, external API calls
- [ ] Sentry error handler middleware (after routes, before global error handler)
- [ ] Report non-fatal events:
  - Token refresh failures
  - FCM delivery failures
  - OTP delivery failures
  - Ride state machine violations

#### Health Check
- [ ] Enhance `GET /health` → `GET /api/v1/health`:
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
- [ ] Return 503 if any critical dependency is unhealthy
- [ ] Add readiness probe endpoint: `GET /api/v1/health/ready`
- [ ] Add liveness probe endpoint: `GET /api/v1/health/live`

#### Structured Logging
- [ ] All log entries include: timestamp, level, message, correlationId, userId (if authenticated), route, method, statusCode, responseTime
- [ ] Morgan integration: log every HTTP request as structured JSON
- [ ] Sequelize query logging: log queries > 500ms as warnings
- [ ] Daily log rotation: 30-day retention

#### Performance Monitoring
- [ ] Log response times per route via middleware
- [ ] Flag routes exceeding 1s response time
- [ ] Sequelize hooks: log queries taking > 200ms

### Deliverables
- Sentry integration capturing errors + performance traces
- Health check endpoint verifying DB, Redis, Firebase
- Structured JSON logs with correlation IDs
- Slow query monitoring

### Checkpoint
- Throw error in controller → appears in Sentry dashboard with full context
- Stop Redis → health check returns 503 with Redis status "unhealthy"
- Make request → correlation ID in response header matches log entry
- Execute slow query → warning logged with query text and duration

### Commit Strategy
- `feat(observability): add Sentry error tracking and performance monitoring`
- `feat(observability): add comprehensive health check with dependency probes`
- `feat(observability): add structured logging with correlation IDs`
- `perf(observability): add slow query detection and logging`

---

## Phase 12: Testing (5–7 days)

### Goals
- Set up Jest + Supertest with isolated test database
- Write priority tests that block launch (wallet, rides, auth)
- Achieve minimum coverage thresholds
- Mock all external APIs

### Tasks

#### Test Infrastructure
- [ ] Install `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `nock`
- [ ] Create `jest.config.ts` with TypeScript support, path aliases, coverage thresholds
- [ ] Create `src/tests/setup.ts`:
  - Connect to test database (from `docker-compose.test.yml`)
  - Run migrations
  - Seed base data (admin user, etc.)
  - Clear data between test suites (transaction rollback or truncate)
- [ ] Create `src/tests/helpers/`:
  - `createTestUser(overrides?)` — factory for user creation
  - `createTestDriver(overrides?)` — user + driver profile + vehicle
  - `createTestRide(overrides?)` — ride with pickup/dropoff
  - `getAuthToken(userId)` — generate valid JWT for test requests
  - `createTestWallet(userId, balance)` — wallet with initial balance

#### Priority 1 Tests (Block Launch)

##### Wallet Tests (`src/services/__tests__/walletService.test.ts`)
- [ ] `confirmOnlineTopUp` — single confirmation credits wallet correctly
- [ ] `confirmOnlineTopUp` — concurrent confirmations (Promise.all with 10 requests) → wallet credited exactly once
- [ ] `confirmOnlineTopUp` — already completed topup returns idempotent success
- [ ] `completeRide` — fare calculation and commission deduction correct
- [ ] `completeRide` — commission would exceed balance → rejected
- [ ] Wallet balance never goes below 0 (constraint test)
- [ ] Transaction history records all operations

##### Ride Tests (`src/services/__tests__/rideService.test.ts`)
- [ ] Happy path: request → offer → accept → pick → start → complete
- [ ] Concurrent acceptance: 5 drivers accept same ride → only one succeeds
- [ ] State machine: each valid transition works; each invalid transition throws `RIDE_INVALID_STATUS`
- [ ] Cancellation at each stage: pending, offered, accepted, in_progress
- [ ] Ride expiration: pending ride after 10 minutes → auto-cancelled
- [ ] Fare calculation with stops: base fare + time + stop wait time

##### Auth Tests (`src/services/__tests__/authService.test.ts`)
- [ ] Register with valid data → user + wallet created
- [ ] Register with existing phone → 409 conflict
- [ ] Login with correct password → tokens returned
- [ ] Login with wrong password → 401
- [ ] JWT refresh → new token pair, old refresh invalidated
- [ ] Logout → token blacklisted, subsequent requests rejected
- [ ] Password change → all existing tokens invalidated

##### OTP Tests (`src/services/__tests__/otpService.test.ts`)
- [ ] Send OTP → code generated and stored
- [ ] Verify correct code → authentication succeeds
- [ ] Verify wrong code → attempt incremented
- [ ] Exceed max attempts → code locked
- [ ] Expired code → rejected

##### Middleware Tests
- [ ] `protect` — valid token → req.user populated
- [ ] `protect` — expired token → 401
- [ ] `protect` — blacklisted token → 401
- [ ] `restrictTo` — correct role → passes; wrong role → 403
- [ ] Rate limiter — exceed limit → 429 with Retry-After header
- [ ] Validation — invalid input → 400 with field-level errors
- [ ] Idempotency — same key twice → cached response returned

#### Priority 2 Tests
- [ ] Shared rides: join, pickup/dropoff sequence, fare splitting
- [ ] Multi-stop rides: add stops, arrive/leave tracking, wait time calculation
- [ ] Driver nearby: geospatial query returns correct drivers within radius
- [ ] Admin: user management, driver approval/rejection, statistics
- [ ] Notifications: send + persist + FCM delivery (mocked)
- [ ] File upload: valid image accepted, oversized file rejected (413), wrong MIME type rejected (400), unauthenticated upload rejected (401)
- [ ] File upload: filename sanitization (path traversal attempts rejected)
- [ ] File upload: max files per request limit enforced

#### External API Mocking
- [ ] `nock` interceptors for:
  - Flouci payment verification
  - Firebase FCM send
  - Vonage WhatsApp send
  - EasySendSMS send
  - HERE Maps routing
  - Google OAuth token verification

#### Coverage Configuration
- [ ] Thresholds in `jest.config.ts`:
  ```
  models: 80%
  services: 70%
  middlewares: 90%
  overall: 60%
  ```
- [ ] Coverage reports: text (terminal) + lcov (CI)

### Deliverables
- Complete test suite for wallet, rides, auth, OTP, middleware
- Test helpers and factories
- External API mocks via nock
- Coverage meeting thresholds
- `npm test` runs all tests against isolated database

### Checkpoint
- `npm test` passes all tests
- Coverage report meets thresholds
- Concurrent wallet tests prove no double-spending
- Concurrent ride tests prove single acceptance
- All external API calls mocked (no real API calls in tests)

### Commit Strategy
- `test: add Jest + Supertest setup with test database`
- `test: add test helpers and factories`
- `test(wallet): add concurrent topup and negative balance tests`
- `test(rides): add lifecycle, concurrent acceptance, and state machine tests`
- `test(auth): add register, login, JWT, OTP tests`
- `test(middleware): add auth, validation, rate limiter, idempotency tests`
- `test: add shared rides and multi-stop edge case tests`

---

## Phase 13: CI/CD & Production Hardening (3–4 days)

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

| Phase | Duration | Dependencies |
|-------|----------|-------------|
| 1. Scaffolding & Config | 3–4 days | None |
| 2. Database & Sequelize | 5–7 days | Phase 1 |
| 3. Core Infrastructure | 3–4 days | Phase 1 |
| 4. Authentication | 4–5 days | Phases 2, 3 |
| 5. API Layer — CRUD | 7–10 days | Phase 4 |
| 6. Business Logic (Wallet & Rides) | 5–7 days | Phase 5 |
| 7. Redis & Caching | 3–4 days | Phase 4 |
| 8. Socket.IO Real-Time | 5–7 days | Phases 6, 7 |
| 9. BullMQ Jobs | 4–5 days | Phases 6, 7 |
| 10. Notifications | 2–3 days | Phase 9 |
| 11. Observability | 2–3 days | Phase 3 |
| 12. Testing | 5–7 days | Phase 6 |
| 13. CI/CD & Hardening | 3–4 days | Phase 12 |
| **Total** | **~52–70 days** | Sequential with some parallelism |

**Parallelism opportunities:**
- Phases 7 + 11 can start as soon as Phase 4 is complete
- Phases 8 + 9 can be worked in parallel after Phase 6
- Phase 12 testing can begin alongside Phase 8/9 development

**Realistic timeline for 1 developer:** 10–14 weeks  
**Realistic timeline for 2 developers:** 6–8 weeks
