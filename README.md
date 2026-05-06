# DADA API

Production-ready ride-sharing backend serving Android (Kotlin) and iOS (Swift) clients.

**Stack:** Node.js 20+ &middot; TypeScript (strict) &middot; Express 5 &middot; Sequelize &middot; PostgreSQL 16 &middot; Redis 7 &middot; Socket.IO &middot; BullMQ &middot; Docker

---

## Prerequisites

- **Node.js** >= 20.0.0
- **Docker** and **Docker Compose** (for PostgreSQL and Redis)
- **npm** (comes with Node.js)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/dada-api.git
cd dada-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the values. For local development, the defaults in `.env.example` work with the Docker Compose setup below.

### 4. Start PostgreSQL and Redis

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL 16** on port `5432` (user: `dada`, password: `dada`, database: `dada`)
- **Redis 7** on port `6379`

Verify they're healthy:

```bash
docker-compose ps
```

### 5. Run the development server

```bash
npm run dev
```

The server starts on `http://localhost:3000` with hot-reload enabled.

### 6. Verify it works

```bash
# Health check
curl http://localhost:3000/health

# Swagger UI (open in browser)
open http://localhost:3000/docs/

# OpenAPI spec JSON
curl http://localhost:3000/api/spec.json
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot-reload (ts-node-dev) |
| `npm run build` | Compile TypeScript to `dist/` with path alias rewriting |
| `npm start` | Run compiled production build (`node dist/server.js`) |
| `npm run lint` | Run ESLint on all source files |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format all source files with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm test` | Run test suite (Jest) |

---

## Project Structure

```
src/
├── config/          # Environment, database, Redis, Swagger, upload config
│   ├── index.ts     # Central typed config object (ONLY file reading process.env)
│   ├── validateEnv.ts
│   ├── swagger.ts
│   └── uploadConfig.ts
├── controllers/     # HTTP request handlers (thin — parse request, call service, send response)
├── services/        # Business logic (transactions, calculations, rules)
├── models/          # Sequelize model definitions and associations
├── routes/          # Express route definitions with validation chains and OpenAPI JSDoc
├── middlewares/     # Auth, validation, rate limiting, error handling, correlation ID
├── sockets/         # Socket.IO namespaces and event handlers
├── jobs/            # BullMQ queue definitions and workers
├── types/           # Shared TypeScript types, enums, interfaces
├── utils/           # AppError, asyncHandler, logger, pagination helpers
├── migrations/      # Sequelize CLI migrations (timestamped)
├── seeders/         # Development seed data
├── app.ts           # Express app setup and middleware chain
└── server.ts        # Entry point: HTTP server, graceful shutdown
```

**Architecture:** 3-layer (Controllers → Services → Models). Controllers never contain business logic. Services never access `req`/`res`. Models never import services.

---

## Environment Variables

Copy `.env.example` to `.env`. All variables:

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | `development`, `staging`, or `production` |
| `PORT` | Yes | `3000` | Server port |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Staging/Prod | — | PostgreSQL connection string |
| `DB_SSL` | No | `false` | Enable SSL (`true` in production) |
| `DB_POOL_MIN` | No | `2` | Minimum connection pool size |
| `DB_POOL_MAX` | No | `10` | Maximum connection pool size |

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Staging/Prod | — | Redis connection string |

### Authentication (JWT)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Staging/Prod | — | Access token signing secret (min 256-bit) |
| `JWT_EXPIRES_IN` | No | `15m` | Access token expiry |
| `REFRESH_TOKEN_SECRET` | Staging/Prod | — | Refresh token signing secret |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `30d` | Refresh token expiry |

### Google OAuth

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | No | — | Web client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Web client secret |
| `GOOGLE_ANDROID_CLIENT_ID` | No | — | Android client ID |
| `GOOGLE_IOS_CLIENT_ID` | No | — | iOS client ID |

### OTP Providers

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VONAGE_API_KEY` | No | — | Vonage API key (WhatsApp OTP) |
| `VONAGE_API_SECRET` | No | — | Vonage API secret |
| `VONAGE_WHATSAPP_FROM` | No | — | WhatsApp sender number |
| `EASYSENDSMS_API_KEY` | No | — | EasySendSMS API key (SMS fallback) |
| `OTP_SENDER` | No | `DadaDrive` | SMS sender name |
| `OTP_EXPIRES_IN` | No | `5` | OTP expiry in minutes |
| `OTP_MAX_ATTEMPTS` | No | `3` | Max verification attempts per code |

### Firebase (FCM Push Notifications)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FCM_PROJECT_ID` | No | — | Firebase project ID |
| `FCM_CLIENT_EMAIL` | No | — | Firebase service account email |
| `FCM_PRIVATE_KEY` | No | — | Firebase private key |

### Flouci Payment

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FLOUCI_APP_TOKEN` | No | — | Flouci app token |
| `FLOUCI_APP_SECRET` | No | — | Flouci app secret |

### HERE Maps

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HERE_API_KEY` | No | — | HERE Maps API key |

### CORS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ALLOWED_ORIGINS` | Yes | — | Comma-separated allowed origins |

### Observability

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | No | — | Sentry error tracking DSN |
| `LOG_LEVEL` | Yes | `info` | `error`, `warn`, `info`, `http`, `debug` |

---

## Docker

### Local Development (databases only)

```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Stop
docker-compose down

# Stop and remove volumes (reset data)
docker-compose down -v
```

### Test Databases (isolated)

```bash
# Start test PostgreSQL (port 5433) + test Redis (port 6380)
docker-compose -f docker-compose.test.yml up -d

# Run tests
npm test

# Stop
docker-compose -f docker-compose.test.yml down
```

### Production Build

```bash
# Build the Docker image
docker build -t dada-api .

# Run the container
docker run -p 3000:3000 --env-file .env dada-api
```

---

## API Documentation

Swagger UI is available in development and staging at:

```
http://localhost:3000/docs/
```

The raw OpenAPI 3.0 spec is available at:

```
http://localhost:3000/api/spec.json
```

Mobile teams can import this spec into Postman or use `openapi-generator` to auto-generate Kotlin/Swift data classes.

Swagger UI is disabled in production (`NODE_ENV=production`).

---

## Code Quality

- **TypeScript strict mode** — no `any`, explicit return types, strict null checks
- **ESLint** — enforces no-console, import ordering, async/await patterns
- **Prettier** — consistent formatting
- **Husky + lint-staged** — pre-commit hooks run ESLint + Prettier on staged files
- **Conventional Commits** — `feat(scope):`, `fix(scope):`, `chore:`, etc.

---

## Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals:

1. Stops accepting new connections
2. Drains in-flight requests
3. Closes database and Redis connections (when configured)
4. Exits cleanly with code 0

If connections aren't drained within 10 seconds, forces exit with code 1.

---

## Currency

All monetary values use **TND (Tunisian Dinar)** stored as `DECIMAL(10,2)` in the database. Wallet balance can never go below zero (enforced by both application logic and database `CHECK` constraint).

---

## License

ISC
