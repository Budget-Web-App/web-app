# Requirements

This document defines the acceptance criteria for the zero-based budgeting app. The team works through the phases in order, and each phase ends with a working checkpoint.

## Product principle

Budget management stays simple and intuitive whether one person uses it or a household shares it. A feature that complicates the core loop waits for a later phase.

## Auth

MUST: A visitor can sign up with an email, a name, and a password.
MUST: A user can log in and log out, and a valid login stays alive in a server-side session.
MUST: The server hashes every password with a slow key-derivation function before storing it and never returns or logs a password.
MUST: The server rejects requests without a valid session with a 401 response.
MUST: Two accounts cannot share an email address.

AC-1: Auth endpoints (`signup`, `login`, `logout`, `me`) behave as documented in `api-contract.md`. Implemented in phase 1.

## Budgets and memberships

MUST: A user can create a budget and becomes its owner.
MUST: A budget owns its data; every budget operation checks the caller's role on that budget.
MUST: Ownership maps to admin operations: manage members and roles, delete the budget.
MUST: Editors can write budget data; viewers can only read it.
MUST: A budget always keeps at least one owner.
MUST: The server enforces roles on every budget operation. Hiding a button is not enforcement.
MUST: Budget delete removes the budget and its memberships.

AC-2: Creating a budget creates the owner membership and lists the budget.
AC-3: A non-member gets a 404 on budget reads and writes; a viewer gets a 403 on writes; an editor can write but cannot manage members; the owner can do all of the above.
AC-4: The last owner cannot be demoted or removed.

Implemented in phase 1.

## Bank sync

MUST: All bank data enters the app through a provider-agnostic adapter; the frontend never talks to a provider directly.
MUST: Each provider adapter returns normalized accounts and transactions.
MUST: The importer skips a synced transaction whose `(provider, externalId)` pair already exists, so a synced transaction never double-counts against a hand-entered one.
MUST: Only editors and owners can trigger a sync.

AC-5: The sync and transactions loop exists: the mock provider imports a fixed feed, links provider accounts to budget accounts, and importing the same feed twice creates zero duplicate transactions. Demonstrate it by clearing the budget, importing the feed, and importing it again: the second import reports `imported` of zero and the transaction list shows no new rows. Implemented in phase 3.

## Core loop

MUST: A user can assign income and spending across categories until ready-to-assign is zero.
MUST: A user can record transactions by hand against accounts and categories and can transfer between own accounts.
MUST: Category available balances roll forward across months, including negative overspending balances.
MUST: All money is stored as integer minor units; the app never uses floating-point money.

AC-6: Phases 2 through 4 keep the loop working end to end: allocate, transact, roll over. Phase 3 adds the transact step: hand-entered transactions, transfers, and bank sync, per `api-contract.md`.

## Reports

MUST: The app reports spending by category, net worth, and income versus expense for a date range.

AC-7: Each report returns numbers that match the stored transactions. Implemented in phase 5.

## Phased scope

SHOULD: Build in this order, with a checkpoint after each phase:

1. Phase 0: API scaffold, error shape, health check, static SPA hosting.
2. Phase 1: Auth, sessions, budgets, memberships, role enforcement.
3. Phase 2: Accounts, category groups and categories, monthly allocation.
4. Phase 3: Transactions, transfers, mock bank sync with dedupe.
5. Phase 4: Monthly rollover and overspending.
6. Phase 5: Reports.

MAY: Multi-currency, scheduled transactions, savings goals, real credential storage, and a mobile UI come after the core loop works.

## Verify

Run this from the repo root. It passes when the implemented phases hold their criteria and the codebase type-checks:

```bash
npm run typecheck >/dev/null 2>&1 && npm test 2>&1 | grep -q 'Tests.*passed' && echo OK || echo FAIL
```