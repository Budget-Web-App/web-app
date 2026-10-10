# Development

This document tells you how to run, build, and check the app.

## Prerequisites

MUST: Use Node.js 22. The repo pins the version in `mise.toml`; run `mise install` once.
MUST: Run `npm install` from the repo root. It installs both workspaces.

## Run in development

MUST: Run the API and the web dev server together:

```bash
npm run dev
```

The API listens on `http://localhost:3001`. The web app listens on `http://localhost:5173` and proxies `/api` to the API, so the browser never needs cross-origin requests.

SHOULD: Open `http://localhost:5173` for day-to-day work. Hot reload rebuilds the React app on save.

## Build and run as one process

MUST: Build both workspaces, then start the API, which serves the built SPA:

```bash
npm run build
npm start
```

The app is then available at `http://localhost:3001`.

## Checks

MUST: Run these before every checkpoint, and keep them green:

```bash
npm run typecheck
npm test
```

`npm test` runs the API test suite in `server/test/`, which covers password hashing, auth, and role enforcement.

## Data

MUST: Treat all data as disposable. The store lives in memory, so restarting the API clears every user, session, and budget. Real storage replaces the mock later without changing the API contract in `api-contract.md`.

## Layout

- `server/`: Express API in TypeScript. Routes in `server/src/routes/`, middleware in `server/src/middleware/`, in-memory store in `server/src/store.ts`.
- `server/src/sync/`: provider-agnostic bank sync adapters. Ships in phase 3.
- `web/`: React SPA built with Vite.
- `docs/`: this doc, `requirements.md`, `api-contract.md`, and the ADRs.

## Verify

Run this from the repo root. It passes when the code type-checks and the tests pass:

```bash
npm run typecheck >/dev/null 2>&1 && npm test 2>&1 | grep -q 'Tests.*passed' && echo OK || echo FAIL
```