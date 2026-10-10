# Zero-Based Budgeting Web App — Product Brief

> Use this brief as the working prompt for the product team. The product manager
> leads and sets priorities; the engineer and designer execute within the PM's
> scope decisions.

**Task:** Design and build a zero-based budgeting web application modeled after YNAB.

## Product principle

Budget management stays simple and intuitive whether one person uses it or a
household shares it. Every design choice answers to this — if a feature
complicates the core flow, it waits.

## Architecture

The backend is a full REST API. All of the app's data access goes through it.
For now the API runs against an in-memory mocked implementation; the API
contracts are real and stable so the mock can be swapped for real storage later
without touching the frontend.

## Core loop

1. Give every dollar a job (assign income to categories until ready-to-assign is zero).
2. Record transactions against accounts and categories — entered by hand or synced from the bank.
3. Roll category balances forward across months, including overspending handling.

## Scope — must have

- **REST API:** resources for accounts, transactions, categories, budgets,
  memberships, and auth. Documented endpoints; consistent error shapes;
  validation at the API boundary.
- **Auth (real, not mocked):** sign-up, login, sessions, logout. Passwords
  hashed; no plaintext credentials.
- **Ownership and membership model:** a budget has one owner and can have many
  members. Roles (owner, editor, viewer) are defined in the data model and
  enforced server-side, not just hidden in the UI.
- **Bank sync (mocked now, aggregator later):** the sync path lives behind a
  provider-agnostic interface — one provider adapter exists (mock data) and
  swapping in Plaid, GoCardless, SimpleFIN, or similar later is a new adapter
  with no frontend changes. Include duplicate detection so a synced transaction
  never double-counts against a hand-entered one.
- **Accounts, transactions, and transfers:** checking, savings, credit; transfer
  between own accounts.
- **Budget categories:** monthly allocation, available-balance tracking, carryover.
- **Reports:** spending by category, net worth, income vs. expense.

## Process

1. PM: state assumptions, list open questions, and propose a phased scope.
   **Stop and wait for confirmation before building.** Open questions must
   include: the sync interface contract, how ownership vs. membership maps to
   budget operations, and the tech stack.
2. PM: write a short requirements doc with acceptance criteria.
3. Designer and engineer: propose the data model, API surface, and auth flow in one pass.
4. Build phase by phase, with a working checkpoint after each.

## Constraints

Follow the existing repo conventions in `/workspaces/onebudget`. Prefer the
smallest implementation that supports the core loop. Name any feature you
deliberately skip.