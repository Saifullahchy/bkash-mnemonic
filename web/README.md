# Offer site (web)

Next.js site for visitors: live offers, login by phone number, personal share links and the
shared-link page (`/s/{code}`).

```bash
npm install
npm run dev          # http://localhost:3000 (the API must be running)
npm run build && npm start
npm run typecheck && npm run lint
```

- `src/app` routes, `src/features/<feature>` components, hooks and API calls, `src/components` shared UI.
- `src/app/api/v1/[...path]` forwards browser calls to the API, so cookies stay first-party.
- Page data is fetched on the server (`src/lib/api/server.ts`); personal data in the browser with RTK Query.
- Desktop width: `--page-width` in `src/app/globals.css`.

Environment variables, secrets and deployment: see the [main README](../README.md).
