# OneBudget repository guide

Zero-based budgeting web app: an Express API plus a React single-page app, in one
repo with two npm workspaces.

## Setup

- Use Node.js 22. It is pinned in `mise.toml`; run `mise install` once.
- Install from the repo root: `npm install`. That installs both workspaces.
- No lint or format task exists. Match the surrounding style instead of inventing one.

## Commands

- Develop both apps together: `npm run dev`. The API listens on
  `http://localhost:3001`; the web app listens on `http://localhost:5173` and
  Vite proxies `/api` to the API.
- Check before you finish: `npm run typecheck` then `npm test`. Both run across
  both workspaces.
- Run one workspace: `npm run <script> --workspace server` or `--workspace web`.
- Run one server test file: `npm test --workspace server -- test/auth.test.ts`.
  Run one case by name: `npm test --workspace server -- -t "rejects a duplicate email"`.
- Run the built app as one process: `npm run build` then `npm start`. The API
  serves `web/dist` on port 3001, so build the web app first.

## Layout

- `server/` — Express API in TypeScript. `src/index.ts` calls `createApp()` in
  `src/app.ts`. Routes live in `src/routes/`, session and role guards in
  `src/middleware/auth.ts`, all state in `src/store.ts` (in-memory maps), and
  bank sync adapters in `src/sync/`.
- `web/` — React SPA built with Vite, organized by feature under `src/`:
  `app/` (entry `main.tsx` to `App.tsx` to `AppShell.tsx`, plus the hand-rolled
  `router.ts`), `features/<name>/` (screens and their pure helpers: `auth`,
  `budgets`, `month`, `categories`, `accounts`, `transactions`, `members`,
  `reports`), `lib/` (API client, money formatting, roles), and `styles/`.
  Tests sit beside the code as `*.test.ts`. A feature may import from `lib/`
  and from other features; `lib/` imports from neither.
- `docs/` — the source of truth: `api-contract.md`, `requirements.md`,
  `development.md`, and `docs/adrs/`.

## Invariants

- Money is integer minor units (cents) end to end. Never use floating-point
  money. `formatMoney` divides by 100 for display only.
- IDs are opaque prefixed strings (`usr_`, `bud_`, `acct_`, `grp_`, `catg_`,
  `txn_`); months are `YYYY-MM`.
- Every error response is `{ "error": { "code", "message", "details?" } }` with
  the status map in `server/src/errors.ts`.
- Enforce roles in server middleware, not in the UI. A caller with no membership
  gets 404, not 403, so budget existence never leaks.
- The store is in-memory and disposable. A restart clears every user, session,
  and budget. Server tests call `resetStore()` in `beforeEach`.
- `web/package.json` keeps exactly `react` and `react-dom` as runtime
  dependencies. `docs/adrs/0003-client-routing.md` forbids adding a routing
  library. Add a decision record before you add any dependency.
- Keep the SPA catch-all in `server/src/app.ts` (`app.get('*')` sending
  `index.html`) after the `/api` routes, so a deep-link refresh returns the app.
- `server` compiles as CommonJS; `web` is ESM. Match the module style of the file
  you edit.

## Testing

- `npm test` runs both suites with Vitest. The server suite drives `createApp()`
  through supertest. The web suite covers pure logic only (router, categories,
  starters, money parsing), colocated with the source.
- Web tests run in the Node environment. There is no DOM test harness, so do not
  write component tests without adding `jsdom` and a testing library, which needs
  a decision record.
- `server/tsconfig.build.json` excludes `*.test.ts`, so tests never ship in `dist`.

## Docs and decisions

- Put new prose under `docs/` as kebab-case Markdown. Follow
  `docs/doc-standards.md`, the `google-tech-writing` skill for prose, and the
  `design-decision` skill for decision records.
- Rules docs and ADRs end with a `## Verify` section holding a command that
  prints `OK` or `FAIL`. Run the matching check when you change what it covers.

## OpenCode config

- `.opencode/opencode.json` loads the `ponytail` plugin, which biases toward the
  smallest change. It does not relax the invariants above.
- Agents and skills live in `.opencode/`. When you edit an agent definition,
  follow `docs/adrs/0001-agent-edit-permission-order.md`: put the catch-all
  `edit` deny before the scoped allow rules.
- Commit, branch, and pull request flows are the skills in `.opencode/skills/`.
  Use them instead of inventing your own.
