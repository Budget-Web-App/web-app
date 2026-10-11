---
name: code-simplifier
description: >-
  Simplifies and refines code for clarity, consistency, and maintainability
  while preserving behavior exactly. USE whenever the user asks to simplify,
  clean up, tidy, refine, or "make this nicer" code, to reduce complexity or
  nesting, to remove dead or redundant code, or to review a diff for
  readability. USE proactively right after writing or modifying code in a
  session, unless the user says not to. Not for adding features or changing
  behavior — that is a normal code task.
---

# Code simplifier

Simplify the code that is already there: make it clearer and easier to keep
while behaving exactly the way it does today. This is not a rewrite and not a
feature task. The value is in the diff a reviewer can read and trust.

## Behavior is frozen

Never change what the code does — only how it reads. Outputs, status codes,
error shapes, money, ID formats, ordering, and edge cases stay identical. If a
candidate change alters behavior, it is a bug fix, not a simplification. Leave
it out and say so in one line.

## Scope

Refine only code written or modified in the current session, unless the user
asks for a broader scope. Find the scope before you touch anything:

```
git status
git diff
```

Read the touched code and everything it reaches — its callers and its tests.
A change that looks local often is not.

## Apply this repo's standards

Match the conventions the surrounding code already uses. The invariants in
`AGENTS.md` are not style preferences; a simplification must not relax them:

- Money stays integer minor units (cents) end to end. Never introduce
  floating-point money. Call `formatMoney` only for display.
- IDs stay opaque prefixed strings (`usr_`, `bud_`, `acct_`, `grp_`, `catg_`,
  `txn_`); months stay `YYYY-MM`.
- Error responses keep the `{ "error": { "code", "message", "details?" } }`
  shape and the status map in `server/src/errors.ts`.
- Roles stay enforced in server middleware, not the UI. A caller with no
  membership still gets 404, not 403.
- Match the module style of the file you edit: `server` is CommonJS, `web` is
  ESM.
- `web/package.json` keeps exactly `react` and `react-dom`. Do not reach for a
  library to replace a hand-rolled pattern such as `src/router.ts`. Adding a
  dependency needs a decision record first.
- Keep the SPA catch-all (`app.get('*')`) after the `/api` routes.

## Clarity moves

- Reduce nesting with early returns and guard clauses.
- Delete dead code, redundant branches, unused imports, and unused exports.
- Rename to say what the thing is; prefer a clear name over a comment.
- Consolidate logic that exists in several places into the one shared helper.
- Delete comments that restate the code. Keep the comment that explains a
  non-obvious why.
- Replace nested ternaries with an `if`/`else` chain or a small lookup.

This repo's taste is explicit over compact. A slightly longer function that a
reader understands once beats a clever one-liner.

## Do not over-simplify

Stop short of changes that trade clarity for fewer lines:

- Do not fold unrelated concerns into one function or component.
- Do not delete an abstraction that carries meaning or a name the domain uses.
- Do not compress into dense one-liners or nested ternaries.
- Do not make the code harder to debug, extend, or test.

When a "simplification" would remove validation, error handling that prevents
data loss, security checks, or accessibility, leave it in place. Those are not
complexity.

## Relation to ponytail

The `ponytail` plugin biases toward the smallest change that solves a task;
this skill improves code that already exists. Both favor deletion. When they
pull apart, behavior preservation wins, and ponytail's rule still holds: do not
add behavior, options, or flexibility nobody asked for.

## Process

1. Identify the recently modified code.
2. Read it with its callers and tests.
3. List the simplifications worth making.
4. Apply them, preserving behavior.
5. Verify: `npm run typecheck` then `npm test`.
6. Report what changed, why, and what you deliberately left alone.

If a simplification touches non-trivial logic, keep or add the small test that
proves the behavior is unchanged. Trivial edits need no new test.

## Verify

Run this from the repo root and confirm both steps pass:

```bash
npm run typecheck && npm test
```

A change that fails either check is not a simplification — fix it or drop it.
