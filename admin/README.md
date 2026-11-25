# Admin panel (admin)

Next.js panel for campaigns, media, leaderboards and winners, participants, terms and exports.

```bash
npm install
npm run dev          # http://localhost:3002 (the API must be running)
npm run build && npm start
npm run typecheck && npm run lint
```

- `src/app` routes, `src/features/<feature>` screens, hooks and API calls, `src/components` shared UI.
- `src/app/api/v1/[...path]` forwards browser calls to the admin API, so the session cookie stays first-party.
- `src/proxy.ts` sends signed-out visitors to `/login`; the API checks the session on every request.

Environment variables, secrets and deployment: see the [main README](../README.md).
