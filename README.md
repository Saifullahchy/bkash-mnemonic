# bkash-mnemonic

A share-to-win campaign platform. Visitors pick an offer, get a personal link, share it with
friends, and the top sharer wins the prize.

| Folder            | What it is                                           | Stack                                          | Local URL             |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------- | --------------------- |
| [`web/`](web)     | Offer site for visitors                              | Next.js 16, React 19, Tailwind                 | http://localhost:3000 |
| [`admin/`](admin) | Admin panel (campaigns, winners, exports)            | Next.js 16, React 19, Tailwind                 | http://localhost:3002 |
| [`api/`](api)     | REST API, background jobs                            | Node 22, Express 5, MongoDB, Redis, TypeScript | http://localhost:4000 |
| `render.yaml`     | Everything Render needs to deploy the three services |                                                |                       |
| `scripts/`        | Env file and secret generator                        |                                                |                       |

Outside services: **MongoDB Atlas** (database in production), **ImageKit** (uploaded images),
**Render** (hosting and Redis).

**Contents:** [How it fits together](#how-it-fits-together) ·
[Run locally](#run-locally) · [Environment variables](#environment-variables) ·
[Generate secrets and the salt](#generate-secrets-and-the-salt) ·
[Deploy on Render](#deploy-on-render) · [Custom domains](#custom-domains) ·
[Handover checklist](#handover-checklist) · [Troubleshooting](#troubleshooting)

## How it fits together

```
Browser ──► web   /api/v1/*  ──┐
                               ├──►  api  ──►  MongoDB, Redis, ImageKit
Browser ──► admin /api/v1/*  ──┘
```

Browsers never call the API directly. They call `/api/v1/*` on the site they are on, and that
server forwards the request. Cookies therefore belong to the web or admin host, so login works on
any domain, including Render's `onrender.com` addresses (browsers treat those as unrelated sites
and would block cookies shared between them).

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
| `TRUST_PROXY`                             | no            | no     | Number of proxies in front of the API: `0` locally, `1` on Render                              |
| `SMTP_URL`, `MAIL_FROM`                   | no            | yes    | Scheduled email reports; empty = written to `outbox/`                                          |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | local only    | yes    | Admin created by `npm run seed`                                                                |
| `COOKIE_DOMAIN`                           | no            | no     | Leave empty                                                                                    |

Session lengths and rate limits have sensible defaults; see `api/.env.example`.

### web and admin

| Variable                | Required      | Secret | What it is                                                         |
| ----------------------- | ------------- | ------ | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`  | yes           | no     | Offer site URL. Read **at build time**: redeploy after changing it |
| `API_URL`               | yes           | no     | API address ending in `/v1`. Only used by the server               |
| `PROXY_SECRET`          | in production | yes    | Same value as in the API                                           |
| `CLIENT_IP_HEADER`      | on Render     | no     | `cf-connecting-ip` on Render, empty locally                        |
| `IMAGE_REMOTE_PATTERNS` | yes           | no     | Image hosts that may be loaded. Read **at build time**             |

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

Use separate values for local and production. On Render you don't generate them: the Blueprint
does it once.

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

## Deploy on Render

[`render.yaml`](render.yaml) describes three web services and Redis in the Singapore region.

### 1. Database: MongoDB Atlas

1. Create a cluster at [cloud.mongodb.com](https://cloud.mongodb.com), in AWS Singapore
   (`ap-southeast-1`).
2. **Database Access:** add a user with a generated password and the _Read and write_ role.
3. **Network Access:** allow Render's outbound ranges (Render dashboard → a service → Connect →
   Outbound). You only see them once a service exists, so for the first deploy allow `0.0.0.0/0`
   and narrow it afterwards.
4. **Connect → Drivers:** copy the connection string and add the database name before the `?`:

   ```
   mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/offer_finder?retryWrites=true&w=majority
   ```

   Percent-encode special characters in the password.

### 2. Images: ImageKit

Copy the **private key** from ImageKit → Developer options → API keys. To use another ImageKit
account, also change `IMAGEKIT_URL_ENDPOINT` and both `IMAGE_REMOTE_PATTERNS` in `render.yaml`.

### 3. Create the Blueprint

1. In Render choose **New → Blueprint** and connect this repository.
2. Enter the two values it asks for: `MONGODB_URI` and `IMAGEKIT_PRIVATE_KEY`.
3. Review the plans and cost, then **Apply**.

Render generates the five secrets and shares `PROXY_SECRET` with web and admin. Before each API
release it creates any missing database indexes.

**If a service gets a different address** (its name was already taken), update these values in
`render.yaml`, commit and push:

| Value                                 | Set to                     |
| ------------------------------------- | -------------------------- |
| api: `PUBLIC_SITE_URL`                | web address                |
| api: `CORS_ORIGINS`                   | web address, admin address |
| web and admin: `NEXT_PUBLIC_SITE_URL` | web address                |
| web and admin: `API_URL`              | api address + `/v1`        |

### 4. Create the first admin

Run this once from your computer against the production database. It asks for the values so they
don't end up in your shell history:

```bash
cd api
npm install
read -rs "MONGODB_URI?Atlas connection string: "; echo
read -rs "ADMIN_PASSWORD?Admin password (12+ characters): "; echo
export MONGODB_URI ADMIN_PASSWORD
ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" npm run admin:create
unset MONGODB_URI ADMIN_PASSWORD
```

That is zsh (macOS). In bash use `read -rsp "Atlas connection string: " MONGODB_URI` instead. It
needs a local `api/.env` (see [Run locally](#run-locally)). On a paid plan you can instead run
`node dist/scripts/createAdmin.js` with the same variables in the API's Render Shell.

Don't run `npm run seed` against production: it is demo data.

### 5. Check the deployment

- [ ] `https://<api>/ready` answers `"status":"ready"`
- [ ] The offer site loads and shows no error page
- [ ] You can sign in to the admin panel
- [ ] Uploading a banner shows it on the offer site, with an `ik.imagekit.io` address
- [ ] Terms & Conditions are written in the admin panel
- [ ] A share link opened from **two different networks** (Wi-Fi and mobile data) counts twice.
      If it doesn't, check `CLIENT_IP_HEADER` and `PROXY_SECRET`

Pushing to `main` deploys automatically; only the services whose folder changed are rebuilt.

### Plans

| Service | Plan in `render.yaml` | Why                                                                                  |
| ------- | --------------------- | ------------------------------------------------------------------------------------ |
| api     | `starter` (paid)      | Must stay awake for background jobs; the index step needs a paid plan                |
| web     | `starter` (paid)      | A sleeping site takes about a minute to wake, which loses visitors from shared links |
| admin   | `free`                | Sleeps after 15 idle minutes; the first visit is slow                                |
| Redis   | `free`                | Only holds rate-limit counters. Render allows one free Key Value per workspace       |

For a free demo, set every `plan` to `free`, remove `preDeployCommand`, and change the API's
`startCommand` to `node dist/scripts/syncIndexes.js && npm start`. Expect slow first loads, errors
while the API wakes up, and background jobs that pause while it sleeps. Free services also can't
send email over SMTP.

## Custom domains

1. Add each domain in Render (service → Settings → Custom Domains) and create the DNS records it
   shows, for example `example.com` → web and `admin.example.com` → admin.
2. Update the same values as in the table under step 3 of the deployment, then push.

The API doesn't need a public domain. Leave `COOKIE_DOMAIN` empty.

## Handover checklist

For passing the project to another developer:

1. **GitHub:** add them to this repository.
2. **Render, MongoDB Atlas, ImageKit:** invite them to each account. Don't share your own login.
3. **Secrets:** they create their own local ones with `node scripts/setup-env.mjs`. Share
   production values only if needed, through a password manager; never by chat, email or git.
4. **Admin panel:** create an admin account for them (`npm run admin:create`). To block an
   account, set `isActive` to `false` in the `admins` collection; it takes effect immediately.
5. **When someone leaves:** remove their access, replace the Atlas password and the ImageKit
   private key, and rotate the session secrets and `PROXY_SECRET`
   (see [what each change does](#generate-secrets-and-the-salt)).

Read next: [`api/README.md`](api/README.md) for the API's architecture, scripts and endpoints.

## Troubleshooting

| Problem                                                  | Likely cause                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| API stops with "Invalid environment configuration"       | A required variable is missing or too short; the message names it                |
| API stops with "Unsafe production configuration"         | An address isn't public https, or two secrets are the same                       |
| API can't connect to MongoDB                             | Atlas Network Access doesn't allow Render, or the password isn't percent-encoded |
| "We couldn't load the offers"                            | `API_URL` is wrong or lacks `/v1`, or the API is asleep or down                  |
| Admin login returns to the login page                    | `COOKIE_DOMAIN` is set (leave it empty), or `API_URL` is wrong on admin          |
| Images don't show                                        | Their host isn't in `IMAGE_REMOTE_PATTERNS`; redeploy after changing it          |
| "ImageKit rejected the API key"                          | `IMAGEKIT_PRIVATE_KEY` is missing, wrong, or the public key                      |
| Share links point to the wrong address                   | `PUBLIC_SITE_URL` on the API                                                     |
| "Too many requests" for everyone, or opens stop counting | `PROXY_SECRET` differs between services, or `CLIENT_IP_HEADER` isn't set         |
| Email reports aren't sent                                | `SMTP_URL` is empty, or the API is on Render's free plan                         |
