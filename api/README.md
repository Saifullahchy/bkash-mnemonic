# API

REST API for the offer site and the admin panel.
Node + Express 5 + MongoDB (Mongoose) + Zod, TypeScript strict.

## Run locally

```bash
node ../scripts/setup-env.mjs   # once: creates the env files with generated secrets
npm install
npm run db:up             # MongoDB 8.2 + Redis in Docker
npm run seed              # demo campaigns + Terms (idempotent)
npm run dev               # http://localhost:4000
```

| Script                                           | What it does                                                   |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `npm test`                                       | Unit + integration tests (in-memory MongoDB with real indexes) |
| `npm run lint` / `typecheck` / `format`          | Quality gates                                                  |
| `npm run build` && `npm start`                   | Production build / run                                         |
| `npm run db:indexes [-- --drop]`                 | Create schema indexes (deploy step; prod has autoIndex off)    |
| `TEST_REDIS_URL=redis://localhost:6379 npm test` | Also run the real-Redis rate-limit test                        |

## Production checklist

Environment variables, secrets and the Render deployment: see the [main README](../README.md).

The API refuses to boot in production with an unsafe config (http/localhost origins,
shared secrets, `COOKIE_SECURE=false`, rate limits off) and logs warnings for the rest.

- **`PROXY_SECRET`**, the same in api, web and admin: browsers reach the API through those servers,
  which pass the visitor's IP along. Without it every visitor looks like one address.
- **`TRUST_PROXY`** = number of proxies in front (usually 1). With 0 behind a load balancer,
  every request shares one IP and per-IP limits / subnet caps stop working.
- **`REDIS_URL`** when running more than one instance, so rate limits are shared. If Redis
  goes down, limits fail open (logged) and the DB-backed counting rules still apply.
- **`npm run db:indexes`** on every deploy that changes indexes, before traffic shifts.
- **Probes:** `/health` (liveness) and `/ready` (MongoDB up; Redis status reported).
- **Timeouts:** request 30 s, headers 15 s, keep-alive 65 s (longer than a typical 60 s LB idle timeout).
- **`SMTP_URL`** for scheduled reports, otherwise they go to `MAIL_OUTBOX_DIR`.
- **`IMAGEKIT_PRIVATE_KEY`** to store uploads on ImageKit (needed with more than one instance or
  an ephemeral disk). `npm run images:migrate` moves earlier local uploads over. Set
  `IMAGE_REMOTE_PATTERNS` in web and admin so they may load images from ImageKit.
- Remove `SEED_ADMIN_PASSWORD` from the environment after creating the first admin.

**Load test (Nov 2026, laptop, one API process, MongoDB 8.2 in Docker):** `POST /v1/track/open`
with every request a valid open from a new browser and IP: ~900 req/s, p50 49 ms, p99 148 ms,
0 errors; link and campaign counters matched the stored opens exactly. 1,000 simultaneous
opens from one browser on one link counted exactly once.

## Endpoints (v1)

| Method | Path                | Notes                                             |
| ------ | ------------------- | ------------------------------------------------- |
| GET    | `/health`, `/ready` | Liveness / readiness (DB) probes                  |
| GET    | `/v1/campaigns`     | Live offers for the home page                     |
| GET    | `/v1/campaigns/:id` | Live or ended offer (drafts/scheduled → 404)      |
| GET    | `/v1/stats/public`  | `peopleSharingToday` (Asia/Dhaka day, cached 60s) |
| GET    | `/v1/content/terms` | Current Terms & Conditions                        |

Admin API (`/v1/admin`, admin session cookie; changes need role `admin`): auth, campaigns CRUD + media,
dashboard, campaign leaderboard + announce winners, participants (list/detail/disqualify/reinstate),
share-link moderation (void opens, clear flag) and an on-demand suspicious-link scan
(also runs every 10 minutes in-process — see `src/jobs/scheduler.ts`).

Responses: `{ success: true, data, meta? }` or `{ success: false, error: { code, message, details?, requestId } }`.

## Architecture

```
src/
  config/        env (zod-validated, fail-fast), logger (pino), db
  core/          errors, http envelope/cache/schemas, utils (clock, ttlCache, time)
  middlewares/   httpLogger(request id), security(helmet/cors), rateLimiter factory,
                 validate(zod), errorHandler/notFound
  modules/<feature>/  model → repository → service → controller → routes (+ schema, dto, domain)
  routes/v1.ts   mounts feature routers
  container.ts   composition root (constructor injection; tests inject a fixed clock)
  app.ts         builds the Express app (no I/O) · server.ts boots DB, listens, graceful shutdown
```

Rules: controllers only translate HTTP ↔ service; services hold business rules; only repositories touch Mongoose.
Campaign `scheduled/live/ended` is derived from dates (`campaign.domain.ts`), never stored.
Unique-open dedup is enforced by partial unique indexes on `LinkOpen` (phase 4).
