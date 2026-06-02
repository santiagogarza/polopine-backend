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
| `POST` | `/polls/:id/vote` | Vote (`{ optionId }`) |
| `GET` | `/polls/:id/results` | Results (`totalVotes`, options sorted by votes desc) |
| `GET` | `/health` | `{ status: 'ok', version }` |
| `DELETE` | `/polls/:id` | Admin only (`x-admin-key` header) |

Errors: JSON `{ "error": "..." }` with an appropriate status code.

## Deploy (production)

**Do not deploy this API to Vercel serverless** — the store is in-memory and needs a **long-running Node process**.

Recommended: **[Render](https://render.com)** using [`render.yaml`](render.yaml) in this repo (Blueprint → connect GitHub → deploy).

1. Push this repo to [github.com/santiagogarza/polopine-backend](https://github.com/santiagogarza/polopine-backend).
2. In Render: **New → Blueprint** → select the repo → deploy `polopine-api`.
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
