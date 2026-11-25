# bkash-mnemonic

A share-to-win campaign platform. Visitors pick an offer, get a personal link, share it with
friends, and the top sharer wins the prize.

| Folder            | What it is                                | Stack                                          | Local URL             |
| ----------------- | ----------------------------------------- | ---------------------------------------------- | --------------------- |
| [`web/`](web)     | Offer site for visitors                   | Next.js 16, React 19, Tailwind                 | http://localhost:3000 |
| [`admin/`](admin) | Admin panel (campaigns, winners, exports) | Next.js 16, React 19, Tailwind                 | http://localhost:3002 |
| [`api/`](api)     | REST API, background jobs                 | Node 22, Express 5, MongoDB, Redis, TypeScript | http://localhost:4000 |
| `scripts/`        | Env file and secret generator             |                                                |                       |

Outside services: **MongoDB** (Atlas or self-hosted), **ImageKit** (uploaded images) and, when the
API runs on more than one instance, **Redis**.

**Contents:** [How it fits together](#how-it-fits-together) ·
[Run locally](#run-locally) · [Environment variables](#environment-variables) ·
[Generate secrets and the salt](#generate-secrets-and-the-salt) ·
[Deploy](#deploy) ·
[Handover checklist](#handover-checklist) · [Troubleshooting](#troubleshooting)

## How it fits together

```
Browser ──► web   /api/v1/*  ──┐
                               ├──►  api  ──►  MongoDB, Redis, ImageKit
Browser ──► admin /api/v1/*  ──┘
```

Browsers never call the API directly. They call `/api/v1/*` on the site they are on, and that
server forwards the request. Cookies therefore belong to the web or admin host, so login works
wherever the three services run, even on unrelated domains.

Since every request now reaches the API from the web or admin server, those servers pass the
visitor's IP along and prove who they are with `PROXY_SECRET`. The API ignores the IP without it.

## Run locally

You need **Node.js 22**, **npm** and **Docker** (for MongoDB and Redis).

```bash
git clone https://github.com/Saifullahchy/bkash-mnemonic.git
cd bkash-mnemonic
node scripts/setup-env.mjs
```

The script creates `api/.env`, `web/.env.local` and `admin/.env.local` with freshly generated
secrets. It never overwrites existing files.

Then start each part in its own terminal:

```bash
# 1. API
cd api
npm install
npm run db:up      # MongoDB + Redis in Docker
npm run seed       # demo campaigns, terms and the first admin
npm run dev        # http://localhost:4000
```

```bash
# 2. Offer site
cd web
npm install
npm run dev        # http://localhost:3000
```

```bash
# 3. Admin panel
cd admin
npm install
npm run dev        # http://localhost:3002
```

Sign in to the admin panel with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `api/.env`.

Checks before pushing:

```bash
cd api   && npm run typecheck && npm run lint && npm test
cd web   && npm run typecheck && npm run lint
cd admin && npm run typecheck && npm run lint
```

## Environment variables

Templates are committed as `.env.example`. Real files are git-ignored: **never commit them**.

| File               | Template             |
| ------------------ | -------------------- |
| `api/.env`         | `api/.env.example`   |
| `web/.env.local`   | `web/.env.example`   |
| `admin/.env.local` | `admin/.env.example` |

To create them by hand instead of with the script:

```bash
cp api/.env.example api/.env
cp web/.env.example web/.env.local
cp admin/.env.example admin/.env.local
```

and then fill in the secrets as described in the next section.

### api

| Variable                                  | Required      | Secret | What it is                                                                                     |
| ----------------------------------------- | ------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                             | yes           | yes    | MongoDB connection string, with the database name                                              |
| `SESSION_SECRET`                          | yes           | yes    | Signs participant sessions (32+ characters)                                                    |
| `ADMIN_SESSION_SECRET`                    | yes           | yes    | Signs admin sessions (32+, different from the others)                                          |
| `OPEN_TOKEN_SECRET`                       | yes           | yes    | Signs the single-use token that counts a link open (32+, different)                            |
| `FINGERPRINT_SALT`                        | yes           | yes    | Salt for device and network hashes (16+)                                                       |
| `PROXY_SECRET`                            | in production | yes    | Shared by api, web and admin (32+, same value in all three)                                    |
| `IMAGEKIT_PRIVATE_KEY`                    | in production | yes    | ImageKit → Developer options → API keys → private key. Empty locally = images go to local disk |
| `IMAGEKIT_URL_ENDPOINT`                   | no            | no     | ImageKit URL endpoint                                                                          |
| `IMAGEKIT_FOLDER`                         | no            | no     | ImageKit folder for uploads (`offer-finder`)                                                   |
| `STORAGE_DRIVER`                          | no            | no     | `imagekit` or `local`; empty = ImageKit when its key is set                                    |
| `CORS_ORIGINS`                            | yes           | no     | Web and admin URLs, comma-separated                                                            |
| `PUBLIC_SITE_URL`                         | yes           | no     | Offer site URL; share links are built from it                                                  |
| `REDIS_URL`                               | no            | yes    | Shared rate limits; empty = in memory (one instance only)                                      |
| `TRUST_PROXY`                             | no            | no     | Number of proxies in front of the API: `0` locally, usually `1` hosted                         |
| `SMTP_URL`, `MAIL_FROM`                   | no            | yes    | Scheduled email reports; empty = written to `outbox/`                                          |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | local only    | yes    | Admin created by `npm run seed`                                                                |
| `COOKIE_DOMAIN`                           | no            | no     | Leave empty                                                                                    |

Session lengths and rate limits have sensible defaults; see `api/.env.example`.

### web and admin

| Variable                | Required      | Secret | What it is                                                                              |
| ----------------------- | ------------- | ------ | --------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`  | yes           | no     | Offer site URL. Read **at build time**: redeploy after changing it                      |
| `API_URL`               | yes           | no     | API address ending in `/v1`. Only used by the server                                    |
| `PROXY_SECRET`          | in production | yes    | Same value as in the API                                                                |
| `CLIENT_IP_HEADER`      | in production | no     | Header with the visitor's IP ([how to choose](#3-environment-variables)); empty locally |
| `IMAGE_REMOTE_PATTERNS` | yes           | no     | Image hosts that may be loaded. Rebuild after changing it                               |

Anything starting with `NEXT_PUBLIC_` is visible in the browser. Never put a secret in one.

## Generate secrets and the salt

Five values must be long, random and **different from each other**: `SESSION_SECRET`,
`ADMIN_SESSION_SECRET`, `OPEN_TOKEN_SECRET`, `FINGERPRINT_SALT` and `PROXY_SECRET`. The API
refuses to start when one is too short, and in production when session secrets are reused.

All five at once:

```bash
node scripts/setup-env.mjs --print
```

A single value, with Node:

```bash
node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))'
```

or with OpenSSL:

```bash
openssl rand -base64 48
```

Use separate values for local, test and production.

What happens if you change one later:

| Variable               | Effect of changing it                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`       | Every participant is logged out                                                                               |
| `ADMIN_SESSION_SECRET` | Every admin is logged out                                                                                     |
| `OPEN_TOKEN_SECRET`    | Share pages open at that moment don't count; reloading them works                                             |
| `FINGERPRINT_SALT`     | Past devices are no longer recognised, so **repeat opens can count again**. Don't change it during a campaign |
| `PROXY_SECRET`         | Must change in api, web and admin together, then redeploy all three                                           |

The salt is mixed into every device and network hash before storing it, so raw IP addresses are
never saved and the stored hashes can't be reversed by guessing.

## Deploy

The three services run on any host that offers Node.js 22 or Docker: a VPS, a container platform or
a managed Node host. Each service is independent and gets its own address:

| Service | Example address             | Public? | Listens on            | Health check                           |
| ------- | --------------------------- | ------- | --------------------- | -------------------------------------- |
| web     | `https://example.com`       | yes     | `PORT` (default 3000) | `/healthz`                             |
| admin   | `https://admin.example.com` | yes     | `PORT` (default 3002) | `/healthz`                             |
| api     | `https://api.example.com`   | no need | `PORT` (default 4000) | `/health`, and `/ready` (database too) |

Only web and admin need to be reachable by visitors. If the host has a private network, keep the
API on it and use its internal address in `API_URL`.

### 1. Database

Any MongoDB 7 or newer works. With MongoDB Atlas:

1. Create a cluster in the region closest to the API.
2. **Database Access:** add a user with a generated password and the _Read and write_ role.
3. **Network Access:** allow the API server's outbound IP addresses.
4. **Connect → Drivers:** copy the connection string and add the database name before the `?`:

   ```
   mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/offer_finder?retryWrites=true&w=majority
   ```

   Percent-encode special characters in the password.

### 2. Images

Copy the **private key** from ImageKit → Developer options → API keys. To use another ImageKit
account, also change `IMAGEKIT_URL_ENDPOINT` (api) and `IMAGE_REMOTE_PATTERNS` (web and admin).

### 3. Environment variables

Set these on each service, with your own addresses. Generate the secrets with
`node scripts/setup-env.mjs --print`.

**api**

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://…
PUBLIC_SITE_URL=https://example.com
CORS_ORIGINS=https://example.com,https://admin.example.com
SESSION_SECRET=…
ADMIN_SESSION_SECRET=…
OPEN_TOKEN_SECRET=…
FINGERPRINT_SALT=…
PROXY_SECRET=…
IMAGEKIT_PRIVATE_KEY=…
TRUST_PROXY=1
# only with several API instances
REDIS_URL=redis://…
# only for scheduled email reports
SMTP_URL=smtps://…
```

**web and admin**

```
NEXT_PUBLIC_SITE_URL=https://example.com
API_URL=https://api.example.com/v1
# same value as in the API
PROXY_SECRET=…
# see below
CLIENT_IP_HEADER=…
IMAGE_REMOTE_PATTERNS=https://ik.imagekit.io/yyzpkkigy/**
```

`NEXT_PUBLIC_SITE_URL`, `API_URL` and `IMAGE_REMOTE_PATTERNS` are needed **while building and while
running** (the Docker images below keep their build values).

**`CLIENT_IP_HEADER`** names the header that holds the visitor's IP. Unique opens and rate limits
depend on it, so choose the one your proxy always sets itself:

| In front of web and admin | Value                                                        |
| ------------------------- | ------------------------------------------------------------ |
| Cloudflare                | `cf-connecting-ip`                                           |
| nginx                     | `x-real-ip`, with `proxy_set_header X-Real-IP $remote_addr;` |
| One other load balancer   | leave empty (the last `X-Forwarded-For` address is used)     |
| A CDN and a load balancer | the CDN's own client-IP header                               |

Never use a header that a visitor can send through unchanged: they could fake their address. Keep
web and admin reachable only through that proxy.

### 4. Build and start

**With Node.js**

| Service | Folder  | Build                                   | Before each release                | Start       |
| ------- | ------- | --------------------------------------- | ---------------------------------- | ----------- |
| api     | `api`   | `npm ci --include=dev && npm run build` | `node dist/scripts/syncIndexes.js` | `npm start` |
| web     | `web`   | `npm ci --include=dev && npm run build` |                                    | `npm start` |
| admin   | `admin` | `npm ci --include=dev && npm run build` |                                    | `npm start` |

`syncIndexes` creates missing database indexes. It is required before the first start: the unique
indexes are what stop an open from being counted twice. Use a process manager (systemd, pm2 or the
host's own) so services restart by themselves.

**With Docker**

```bash
docker build -t offer-api api
docker build -t offer-web web \
  --build-arg NEXT_PUBLIC_SITE_URL=https://example.com \
  --build-arg API_URL=https://api.example.com/v1 \
  --build-arg IMAGE_REMOTE_PATTERNS='https://ik.imagekit.io/yyzpkkigy/**'
docker build -t offer-admin admin \
  --build-arg NEXT_PUBLIC_SITE_URL=https://example.com \
  --build-arg API_URL=https://api.example.com/v1 \
  --build-arg IMAGE_REMOTE_PATTERNS='https://ik.imagekit.io/yyzpkkigy/**'

docker run --rm --env-file api.env offer-api node dist/scripts/syncIndexes.js
docker run -d --restart unless-stopped --env-file api.env   -p 4000:4000 offer-api
docker run -d --restart unless-stopped --env-file web.env   -p 3000:3000 offer-web
docker run -d --restart unless-stopped --env-file admin.env -p 3002:3002 offer-admin
```

In `--env-file` files, write values without quotes and put no comment after a value.

### 5. Domains and HTTPS

Point each domain at its service and serve it over **HTTPS**: session cookies are only sent over
HTTPS, and the API refuses to start in production with non-HTTPS addresses. Leave `COOKIE_DOMAIN`
empty.

When an address changes, update `PUBLIC_SITE_URL` and `CORS_ORIGINS` (api), and
`NEXT_PUBLIC_SITE_URL` and `API_URL` (web and admin), then rebuild web and admin.

### 6. Create the first admin

Run this once from your computer against the production database. It asks for the values so they
don't end up in your shell history:

```bash
cd api
npm install
read -rs "MONGODB_URI?MongoDB connection string: "; echo
read -rs "ADMIN_PASSWORD?Admin password (12+ characters): "; echo
export MONGODB_URI ADMIN_PASSWORD
ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" npm run admin:create
unset MONGODB_URI ADMIN_PASSWORD
```

That is zsh (macOS). In bash use `read -rsp "MongoDB connection string: " MONGODB_URI` instead. It
needs a local `api/.env` (see [Run locally](#run-locally)), and the database must allow your
computer's IP. On the server itself, `node dist/scripts/createAdmin.js` does the same.

Don't run `npm run seed` against production: it is demo data.

### 7. Check the deployment

- [ ] `/ready` on the API answers `"status":"ready"`
- [ ] The offer site loads and shows no error page
- [ ] You can sign in to the admin panel
- [ ] Uploading a banner shows it on the offer site, with an `ik.imagekit.io` address
- [ ] Terms & Conditions are written in the admin panel
- [ ] A share link opened from **two different networks** (Wi-Fi and mobile data) counts twice.
      If it doesn't, check `CLIENT_IP_HEADER` and `PROXY_SECRET`

The API runs background jobs every few minutes, so don't let its host put it to sleep.

## Handover checklist

For passing the project to another developer:

1. **GitHub:** add them to this repository.
2. **Hosting, database, ImageKit:** invite them to each account. Don't share your own login.
3. **Secrets:** they create their own local ones with `node scripts/setup-env.mjs`. Share
   production values only if needed, through a password manager; never by chat, email or git.
4. **Admin panel:** create an admin account for them (`npm run admin:create`). To block an
   account, set `isActive` to `false` in the `admins` collection; it takes effect immediately.
5. **When someone leaves:** remove their access, replace the database password and the ImageKit
   private key, and rotate the session secrets and `PROXY_SECRET`
   (see [what each change does](#generate-secrets-and-the-salt)).

Read next: [`api/README.md`](api/README.md) for the API's architecture, scripts and endpoints.

## Troubleshooting

| Problem                                                  | Likely cause                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| API stops with "Invalid environment configuration"       | A required variable is missing or too short; the message names it                 |
| API stops with "Unsafe production configuration"         | An address isn't public https, or two secrets are the same                        |
| API can't connect to MongoDB                             | The database doesn't allow the server's IP, or the password isn't percent-encoded |
| "We couldn't load the offers"                            | `API_URL` is wrong or lacks `/v1`, or the API is asleep or down                   |
| Admin login returns to the login page                    | `COOKIE_DOMAIN` is set (leave it empty), or `API_URL` is wrong on admin           |
| Images don't show                                        | Their host isn't in `IMAGE_REMOTE_PATTERNS`; redeploy after changing it           |
| "ImageKit rejected the API key"                          | `IMAGEKIT_PRIVATE_KEY` is missing, wrong, or the public key                       |
| Share links point to the wrong address                   | `PUBLIC_SITE_URL` on the API                                                      |
| "Too many requests" for everyone, or opens stop counting | `PROXY_SECRET` differs between services, or `CLIENT_IP_HEADER` isn't set          |
| Email reports aren't sent                                | `SMTP_URL` is empty, or the host blocks outgoing SMTP                             |
