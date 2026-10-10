---
id: R-SYNC-001
applies_to: ["server/src/sync/**"]
status: accepted
---

# Provider-agnostic bank sync with unique external IDs

MUST: Every bank provider implements an adapter exposing `listAccounts(credentials)` and `listTransactions(accountRef, since)`.
MUST: Each adapter returns normalized DTOs in `server/src/sync/types.ts` and converts provider amounts to integer minor units inside the adapter.
MUST: The importer deduplicates on the unique `(provider, externalId)` pair and never imports a duplicate, including duplicates of hand-entered transactions saved with the same pair.
MUST NOT: The frontend or API routes talk to a provider directly; they always go through the `/api/budgets/:budgetId/sync` routes.
SHOULD: Keep `server/src/sync/types.ts` free of provider-specific fields so a real aggregator adapter drops in with no API change.

## Why

The product brief requires a sync path that can swap the mock provider for Plaid, GoCardless, or SimpleFIN later without frontend changes. A pull contract with stable external identifiers gives deterministic duplicate detection, which the core loop needs so a synced item never double-counts against a hand-entered one. Normalizing inside each adapter keeps the rest of the app provider-free.

## Verify

```bash
python3 - <<'EOF'
import glob
adapters = glob.glob('server/src/sync/**/*.ts', recursive=True)
bad = [f for f in adapters if 'listTransactions' not in open(f).read() or 'listAccounts' not in open(f).read()]
print('OK' if not bad else 'FAIL: ' + ', '.join(bad))
EOF
```