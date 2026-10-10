# API contract

This document is the contract between the frontend and the API. The API currently runs against an in-memory store; swapping that store for real storage later must not change a single endpoint, request, or response shape here.

## Conventions

MUST: IDs are opaque strings with a type prefix: `usr_`, `bud_`, `acct_`, `grp_`, `catg_`, `txn_`, plus `YYYY-MM` for budget months.
MUST: All money is integer minor units (cents) sent as JSON numbers. The app never stores or returns floating-point money.
MUST: Dates are full ISO 8601 timestamps; transaction dates are `YYYY-MM-DD`.
MUST: Every endpoint returns this error shape on failure:

```json
{ "error": { "code": "not_found", "message": "Budget not found" } }
```

MUST: Error codes map to HTTP statuses: `validation_error` 400, `unauthenticated` 401, `forbidden` 403, `not_found` 404, `conflict` 409, `internal_error` 500. A `validation_error` carries a `details` field with per-field messages.

## Roles

MUST: Every budget operation checks the caller's role, enforced in server middleware, not in the UI.
MUST: `owner` adds members, changes roles, and deletes the budget. `editor` may write budget data and trigger sync. `viewer` may only read. A budget always has at least one owner.

## Auth and sessions

MUST: Passwords are hashed with scrypt before storage; the API never returns or logs a password.
MUST: The API issues a session cookie named `sid` that is `HttpOnly`, `SameSite=Lax`, `Secure` in production, and valid for 30 days.
MUST: Every endpoint except `health`, `signup`, and `login` requires a valid session and returns 401 without one.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | `{email, password, name}` | 201 `{user}` |
| POST | `/api/auth/login` | `{email, password}` | 200 `{user}` |
| POST | `/api/auth/logout` | — | 204 |
| GET | `/api/me` | — | 200 `{user}` |

`user` is `{id, email, name}`. Duplicate email returns 409. Wrong credentials return 401.

## Budgets and members

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/budgets` | — | 200 `{budgets: [{id, name, currency, ownerId, role, createdAt}]}` |
| POST | `/api/budgets` | `{name, currency?}` | 201 `{budget}` |
| GET | `/api/budgets/:budgetId` | — | 200 `{budget}` |
| PATCH | `/api/budgets/:budgetId` | `{name}` | 200 `{budget}` (editor+) |
| DELETE | `/api/budgets/:budgetId` | — | 204 (owner) |
| GET | `/api/budgets/:budgetId/members` | — | 200 `{members: [{userId, email, name, role, createdAt}]}` |
| POST | `/api/budgets/:budgetId/members` | `{email, role}` | 201 `{member}` (owner) |
| PATCH | `/api/budgets/:budgetId/members/:userId` | `{role}` | 200 `{member}` (owner) |
| DELETE | `/api/budgets/:budgetId/members/:userId` | — | 204 (owner) |

MUST: A caller with no membership gets 404 on any budget path, so budget existence is not leaked.
MUST: Demoting or removing the last owner returns 409.

## Data model

MUST: A budget owns the entities below; every entity carries `budgetId`.

- Account: `{id, budgetId, name, type, closed, provider?, externalId?}`, where `type` is `checking`, `savings`, or `credit`. `provider` and `externalId` are `null` for hand-created accounts and hold the sync pair for provider-linked accounts. Balance is derived from transactions; list responses include `balanceMinor`.
- Category group: `{id, budgetId, name, sortOrder}`.
- Category: `{id, budgetId, groupId, name, sortOrder, archived}`.
- Budget month: `{budgetId, month}` and a category month `{categoryId, month, allocatedMinor, activityMinor, availableMinor}`.
- Transaction: `{id, budgetId, accountId, categoryId?, payee, amountMinor, date, memo?, cleared, provider?, externalId?, transferTransactionId?}`. Negative `amountMinor` is an outflow. `provider` and `externalId` are `null` for hand-entered transactions and hold the sync pair for synced ones.

## Accounts and categories

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/budgets/:budgetId/accounts` | — | 200 `{accounts: [{id, budgetId, name, type, closed, balanceMinor, provider, externalId}]}` |
| POST | `/api/budgets/:budgetId/accounts` | `{name, type}` | 201 `{account}` |
| PATCH | `/api/budgets/:budgetId/accounts/:accountId` | `{name?, closed?}` | 200 `{account}` |
| GET | `/api/budgets/:budgetId/category-groups` | — | 200 `{groups: [{id, name, categories: [...]}]}` |
| POST | `/api/budgets/:budgetId/category-groups` | `{name}` | 201 `{group}` |
| PATCH | `/api/budgets/:budgetId/category-groups/:groupId` | `{name}` | 200 `{group}` |
| DELETE | `/api/budgets/:budgetId/category-groups/:groupId` | — | 204, removes the group's categories too |
| POST | `/api/budgets/:budgetId/category-groups/:groupId/categories` | `{name}` | 201 `{category}` |
| PATCH | `/api/budgets/:budgetId/categories/:categoryId` | `{name?, archived?}` | 200 `{category}` |
| DELETE | `/api/budgets/:budgetId/categories/:categoryId` | — | 204 |
| GET | `/api/budgets/:budgetId/months/:month` | — | 200 `{month, readyToAssignMinor, groups}` |
| PUT | `/api/budgets/:budgetId/months/:month` | `{allocations: [{categoryId, allocatedMinor}]}` | 200 month view (editor+); `allocatedMinor` is a non-negative integer |

MUST: Account and category writes require `editor` or `owner`; reads are open to all members.
MUST: Month identifiers match `YYYY-MM`. An allocation amount must be a non-negative integer in minor units; the server returns 400 otherwise.

### Monthly math

MUST: For a month, `activityMinor` is the sum of categorized transaction amounts against the category.
MUST: `availableMinor = lastAvailableMinor + allocatedMinor + activityMinor`.
MUST: `readyToAssignMinor = uncategorized income - allocated - last month's overspending`, floored at negative carry from cash categories.
MUST: Transfer inflows are not income; they never count toward `readyToAssignMinor`.
MUST: Overspending in a cash category carries into the next month as a negative starting available. Overspending against a credit account stays as credit debt.

## Transactions and transfers

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/budgets/:budgetId/transactions?accountId=&categoryId=&month=` | — | 200 `{transactions}` |
| POST | `/api/budgets/:budgetId/transactions` | `{accountId, payee, amountMinor, date, memo?}` plus at most one of `categoryId` or `transferAccountId` | 201 `{transactions}` (editor+) |
| PATCH | `/api/budgets/:budgetId/transactions/:transactionId` | subset of `{payee?, amountMinor?, date?, memo?, cleared?, categoryId?: string\|null, accountId?}`; a transfer row accepts only `payee`, `memo`, and `cleared` | 200 `{transaction}` (editor+) |
| DELETE | `/api/budgets/:budgetId/transactions/:transactionId` | — | 204 (editor+) |

MUST: Transaction reads are open to all members; POST, PATCH, and DELETE require `editor` or `owner`.
MUST: The GET filters are optional and combine with AND: `accountId`, `categoryId`, and `month`, where `month` matches `YYYY-MM`. An invalid `month` returns 400.
MUST: `amountMinor` is an integer in minor units and may be negative (outflow) or positive (inflow). `date` is `YYYY-MM-DD`; an invalid format returns 400.
MUST: The POST body sets at most one of `categoryId` or `transferAccountId`. Setting both returns 400.
MUST: A POST with neither `categoryId` nor `transferAccountId` creates an uncategorized transaction with `categoryId` null. A positive `amountMinor` on such a transaction is uncategorized income and counts toward `readyToAssignMinor`.
MUST: When the body sets `transferAccountId`, a transfer is one transaction pair: the server creates two linked transactions with opposite-sign amounts. Both sides carry the other's id as `transferTransactionId` and keep `categoryId` null.
MUST: A transfer row — one whose `transferTransactionId` is set — is immutable in its money and identity fields. A PATCH that sends `amountMinor`, `date`, `accountId`, or a non-null `categoryId` returns 400; only `payee`, `memo`, and `cleared` may change, and `categoryId: null` is a no-op.
MUST: To correct a transfer, delete it and create a new one.
MUST: Deleting one side of a transfer deletes both sides and returns 204.

## Bank sync

MUST: The sync path lives behind a provider-agnostic interface in `server/src/sync/`, with DTOs in `server/src/sync/types.ts` as recorded in `docs/adrs/0002-bank-sync-adapter.md` (R-SYNC-001). A provider adapter implements two functions:

- `listAccounts(credentials)` returns `[{provider, externalId, name, type, balanceMinor, currency}]`.
- `listTransactions(accountRef, since)` returns `[{externalId, accountRef, postedAt, payee, amountMinor, currency, cleared}]`.

MUST: A provider adapter emits the data model's integer minor units; conversion happens inside the adapter.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/budgets/:budgetId/sync/providers` | — | 200 `{providers: [{id, name}]}` |
| POST | `/api/budgets/:budgetId/sync/:provider` | `{credentials?, accountExternalId?}` | 200 `{imported, ignored, matched}` (editor+) |

MUST: Any member may list providers; only `editor` and `owner` roles may trigger sync.
MUST: `externalId` is the provider's stable identifier for the item. The importer deduplicates on the unique `(provider, externalId)` pair and never imports a duplicate, so importing the same provider feed twice creates zero new transactions.
MUST: A synced item that matches a hand-entered transaction is adopted rather than duplicated: when the same `accountId`, `date`, `amountMinor`, and `payee` exist on a transaction with no `provider`, the importer sets that transaction's `provider` and `externalId` and counts it as `matched`. A matched transaction is then covered by the dedupe rule on a later import.
MUST: The server links each provider account to a budget account by the `(provider, externalId)` pair: it reuses a matching budget account when one exists and creates one otherwise, carrying the provider's `name` and `type`. A provider account never creates duplicate budget accounts.
MUST: `imported` is the count of new transactions created, `ignored` the count skipped by the `(provider, externalId)` pair, and `matched` the count of synced items adopted onto hand-entered transactions.
MUST: Account balances derive from transactions; the `balanceMinor` on the account list is the sum of the account's transaction amounts, never a value copied from the provider.

## Reports

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/budgets/:budgetId/reports/spending?from=&to=` | — | 200 `{totalMinor, byCategory: [{categoryId, name, totalMinor}]}` |
| GET | `/api/budgets/:budgetId/reports/net-worth` | — | 200 `{byAccount: [{accountId, name, balanceMinor}], totalMinor}` |
| GET | `/api/budgets/:budgetId/reports/income-expenses?from=&to=` | — | 200 `{incomeMinor, expenseMinor}` |

MUST: Report numbers derive from the same stored transactions the category math uses.

## Verify

Start the API with `npm run dev:api` from the repo root, then run this in a second shell:

```bash
curl -sf http://localhost:3001/api/health | grep -q '"status":"ok"' && echo OK || echo FAIL
```