# Polopine Backend

In-memory polling API (Node, Express, TypeScript) for **[Polopine](https://github.com/santiagogarza/polopine-frontend)** — a two-repo demo built by **Santi Garza** to show **multi-repo support for Cursor cloud agents**.

The frontend lives in a separate repository with no shared code: types are duplicated on purpose so each repo can be cloned, deployed, and worked on independently.

| Repo | Role |
|------|------|
| **This repo** | REST API (`POST/GET /polls`, vote, results) |
| [polopine-frontend](https://github.com/santiagogarza/polopine-frontend) | Vite + React UI (deployed on Vercel) |

## Quick start (local)

```bash
npm install
cp .env.example .env
npm run dev
```

API: `http://localhost:8080` (default). Three starter polls are seeded on boot; newest first is *"How much of a Cursor ninja are you?"*.

## Environment variables

| Variable | Sensitive | Description |
|----------|-----------|-------------|
| `PORT` | No | HTTP port (default `8080`; Render sets this automatically) |
| `ADMIN_API_KEY` | **Yes** | Secret for `DELETE /polls/:id` via `x-admin-key`. Never log or commit real values. |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with `tsx watch` |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run production build |
| `npm test` | Vitest + Supertest |
| `npm run typecheck` | `tsc --noEmit` |

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/polls` | List polls (newest first) |
| `POST` | `/polls` | Create poll (`{ question, options: string[] }`) |
| `GET` | `/polls/:id` | Get poll |
| `POST` | `/polls/:id/vote` | Vote (`{ optionId }`, requires `x-voter-id`) |
| `POST` | `/polls/:id/options` | Add a voter-authored option (`{ text }`, requires `x-voter-id`) |
| `DELETE` | `/polls/:id/options/:optionId` | Delete an option (author via `x-voter-id` **or** admin via `x-admin-key`) |
| `GET` | `/polls/:id/results` | Results (`totalVotes`, options sorted by votes desc) |
| `GET` | `/health` | `{ status: 'ok', version }` |
| `DELETE` | `/polls/:id` | Admin only (`x-admin-key` header) |
| `POST` | `/polls/:id/reset-votes` | Admin only (`x-admin-key` header) |
| `POST` | `/admin/verify` | Check admin key (204 / 401, rate-limited) |

Errors: JSON `{ "error": "..." }` with an appropriate status code.

### Option authorship (POL-10)

Each `PollOption` has an optional `authorId`. It is set to the voter id of
whoever added the option via `POST /polls/:id/options`. Options created when
the poll itself was created (and the three seeded polls) have no `authorId`
and can only be removed by an admin. Per-poll rules:

- Options are capped at **12** per poll.
- Option text is trimmed and limited to **80 characters**.
- Duplicate text (case-insensitive after trim) within the same poll returns `409`.
- Options that have any recorded votes are immutable (`409`) — including for admins.
- A poll must always have at least 2 options; deleting below that returns `409`.

## Deploy (production)

**Do not deploy this API to Vercel serverless** — the store is in-memory and needs a **long-running Node process**.

Recommended: **[Render](https://render.com)** using [`render.yaml`](render.yaml) in this repo (Blueprint → connect GitHub → deploy).

1. Push this repo to [github.com/santiagogarza/polopine-backend](https://github.com/santiagogarza/polopine-backend).
2. In Render: **New → Blueprint** → select the repo → deploy `polopine-api`.
3. In the service **Settings**, leave **Root Directory** empty (repo root). If it is set to `src`, the start command will look for the wrong `dist/server.js` path.
3. Copy the public URL (e.g. `https://polopine-api.onrender.com`).
4. In the **frontend** Vercel project, set `VITE_API_URL` to that URL (no trailing slash).

CORS is open for demo use so the Vercel frontend can call the API from the browser.

## Publish to GitHub

From this directory, after the remote exists:

```bash
git remote add origin https://github.com/santiagogarza/polopine-backend.git
git push -u origin main
```

## Governance

Cursor `beforeShellExecution` hook blocks destructive shell commands (`rm -rf`, force push, `git reset --hard`). See [`.cursor/hooks.json`](.cursor/hooks.json).
