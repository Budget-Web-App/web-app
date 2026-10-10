---
id: R-WEB-001
applies_to: ["web/src/**", "server/src/app.ts"]
status: accepted
---

# Client-side routing with the History API

MUST: Derive the selected budget and the active tab from the URL, not from component state.
MUST: Serve the route table below. `/budgets/:budgetId` and `/budgets/:budgetId/budget` both render budget detail with the Budget tab active, and the other three segments select their tab.
MUST: Canonicalize the Budget tab to `/budgets/:budgetId`; treat `/budgets/:budgetId/budget` as an alias that resolves to the same view.
MUST: Resolve a path with no route match to `/` with `history.replaceState`, so Back does not return to the bad URL.
MUST: When the budget id in the URL is absent from the loaded budget list, render a "budget not found" state with a link to `/`. The API returns 404 both when the budget is deleted and when the caller is not a member, so the client treats both the same.
MUST NOT: Redirect silently when a matched budget id is missing.
MUST: Route with `history.pushState` and `replaceState`, and react to `popstate`. MUST NOT use hash routing.
MUST: Encode ids with `encodeURIComponent` when writing a URL and decode with `decodeURIComponent` when reading one.
MUST: Parse a single optional `account` query parameter on the budget routes and expose it as `accountId` on the match. Its value is an account id.
MUST: Treat the `account` query parameter as the transaction-list filter. An absent, empty, or unknown account id means "all accounts".
MUST: Keep the SPA catch-all in `server/src/app.ts` (`app.get('*')` sending `index.html`) after the `/api` routes, so a deep-link refresh returns the app shell.
MUST NOT: Add a third-party routing dependency. The router is the hand-rolled module `web/src/router.ts`, exposing `useRoute()` and `navigate()`.
SHOULD: Keep the router in one module. Revisit this record if it needs nested layouts, more query parameters than the one above, route-level data loading, or grows past about 150 lines.

## Why

Navigation state is ephemeral React state today: `AppShell` holds `selectedId` and `BudgetDetail` holds `tab`. Back and Forward do nothing, refresh drops to the list, and no view is linkable. The repo convention is to minimize dependencies, and the required route surface is small, static, and path-first (a single optional query parameter), so a full router library buys capability the app does not use. The API reports every inaccessible budget as 404 in `loadBudget` (`server/src/middleware/auth.ts`), so the client cannot distinguish a deleted budget from one the caller cannot see; this record picks one behavior for both.

## Route table

| Path | View |
| --- | --- |
| `/` | Budget list |
| `/budgets/:budgetId` | Budget detail, Budget tab |
| `/budgets/:budgetId/budget` | Budget detail, Budget tab (alias of the row above) |
| `/budgets/:budgetId/accounts` | Budget detail, Accounts tab |
| `/budgets/:budgetId/transactions` | Budget detail, Transactions tab |
| `/budgets/:budgetId/transactions?account=:accountId` | Budget detail, Transactions tab, filtered to one account |
| `/budgets/:budgetId/members` | Budget detail, Members tab |
| any other path | Budget list (replace to `/`) |

The `budget` path segment maps to the existing Budget tab, whose component state id is `month`.

## Alternatives considered

- **react-router-dom.** Cost: a runtime dependency and its API surface. Benefit: mature matching, back and forward handling, query strings, nested routes. Reversibility: moderate, because links and `navigate` calls spread across the app, though a small wrapper localizes them. Rejected because the route surface is fixed and path-first, so its extra capability goes unused while adding the dependency the repo convention avoids.
- **Hash routing (`#/budgets/...`).** Cost: only the matcher. Benefit: needs no server fallback. Reversibility: high. Rejected because the requirement is real URLs and the server fallback already exists, so hash URLs add noise for no gain.
- **Hand-rolled History API router.** Chosen. Cost: about 60 lines plus one unit test for the matcher. Benefit: no dependency, full control, small. Reversibility: high, since it is ours and can be swapped for react-router-dom later behind the same `useRoute` and `navigate` shape.

## Consequences

- Back, Forward, refresh, and shared links work; every budget and tab is bookmarkable.
- The client now owns the edge cases a library would handle: encoded ids, trailing slashes, and `popstate` ordering. A unit test on the pure path matcher covers them.
- `AppShell` and `BudgetDetail` stop owning selection state and read it from the router. Their props change, not their children.
- The server needs no change. `server/src/app.ts` already serves `web/dist` and sends `index.html` for the catch-all after the `/api` routes, and the Vite dev server serves the SPA shell and proxies `/api`. Keep both in that order.
- The `account` query parameter syncs the transactions filter to the URL, so a filtered register is bookmarkable. Needing more URL-synced filters or nested routes later is the signal to revisit this record.

## Verify

Run from the repo root. It passes when routing stays hand-rolled, uses the History API, covers the route table, and the SPA fallback is intact:

```bash
python3 - <<'EOF'
import glob, json, re
fail = []

router = 'web/src/router.ts'
try:
    src = open(router).read()
except FileNotFoundError:
    src = ''
    fail.append(f'{router} is missing')

if src:
    for name in ('useRoute', 'navigate', 'pushState', 'popstate'):
        if name not in src:
            fail.append(f'{router}: missing {name}')
    for pat in ('/budgets/:budgetId', 'accounts', 'transactions', 'members'):
        if pat not in src:
            fail.append(f'{router}: route pattern missing: {pat}')

deps = set(json.load(open('web/package.json'))['dependencies'])
extra = deps - {'react', 'react-dom'}
if extra:
    fail.append(f'dependency: unexpected runtime deps: {sorted(extra)}')

app = open('server/src/app.ts').read()
if 'index.html' not in app or not re.search(r"app\.get\(\s*['\"]\*['\"]", app):
    fail.append('server: SPA catch-all fallback to index.html is missing')

print('OK' if not fail else 'FAIL\n' + '\n'.join(fail))
EOF
```

The unknown-route and missing-budget behaviors are runtime branches; cover them with the router unit test rather than this static check.
