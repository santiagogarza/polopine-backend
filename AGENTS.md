# Polopine — agent notes

Polopine is a two-repo live polling demo (`polopine-backend` + `polopine-frontend`). There is no monorepo root package; run commands from each repo directory.

## Cursor Cloud specific instructions

### Services (local dev)

| Service | Directory | Port | Start |
|---------|-----------|------|--------|
| API | `repos/polopine-backend` (this repo) | 8080 | `npm run dev` |
| SPA | `repos/polopine-frontend` | 3000 | `npm run dev` |

Both must run for browser E2E. No database or Docker — backend uses an in-memory store seeded on boot.

Copy env files once per repo: `cp .env.example .env`. Frontend defaults `VITE_API_URL=http://localhost:8080`.

Use **tmux** for long-running dev servers in cloud VMs.

### Verification commands

After `npm install` in each repo:

- **Backend:** `npm run typecheck`, `npm test`, `npm run build`
- **Frontend:** `npm run typecheck` / `npm test` may fail on stale admin-related tests; `npx vite build` validates the SPA bundle.
- **Smoke:** `curl http://localhost:8080/health` → `{"status":"ok",...}`

No dedicated `lint` script in either repo.

### Test drift (known)

Some tests still expect admin routes (`POST /polls/:id/reset-votes`, `POST /admin/reset-all`) removed from the current API. Core poll CRUD/vote/results backend tests pass; frontend tests reference removed admin UI files.

### Production deploy (out of scope for local dev)

- Backend: Render (`render.yaml`)
- Frontend: Vercel — set `VITE_API_URL` to the deployed API
