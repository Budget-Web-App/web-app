# OneBudget

Zero-based budgeting web app: an Express API plus a React single-page app, in one
repo with two npm workspaces. Give every dollar a job, record transactions, and
roll balances forward month to month.

## Quick start

```bash
mise install        # Node.js 22, pinned in mise.toml
npm install
npm run dev         # API on :3001, web app on :5173
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the API and web app together |
| `npm run typecheck` | Type-check both workspaces |
| `npm test` | Run both Vitest suites |
| `npm run build` | Build the API and the web app |
| `npm start` | Serve the built app from the API on :3001 |

## Layout

```text
server/src/        Express API: routes/, middleware/, sync/, store.ts
web/src/
  app/             Entry, shell, and the hand-rolled router
  features/<name>/ Screens and their helpers, with colocated tests
  lib/             API client, money formatting, roles
  styles/          Global stylesheet
docs/              Requirements, API contract, and decision records
```

See `AGENTS.md` for invariants (money is integer cents, roles are enforced on the
server) and `docs/` for the API contract and ADRs.
