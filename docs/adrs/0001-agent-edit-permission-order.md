---
id: R-AGENT-001
applies_to: [".opencode/agents/**"]
status: accepted
---

# Catch-all edit deny before the scoped edit allow

MUST: Every agent definition declares a catch-all `edit` rule — `action: edit`, `resource: "*"`, `effect: deny` (or `effect: ask`).
MUST: List every scoped `edit` allow (or ask) rule after that catch-all rule, so it is the last matching rule.
MUST NOT: List a scoped `edit` rule before the catch-all `edit` rule. The catch-all matches last and shadows the scoped rule, so the agent loses its edit scope.
SHOULD: Keep one catch-all `edit` rule, directly above the scoped rules it carves out.

## Why

OpenCode matches permission rules in list order with last-match-wins: the V2 docs say "The last matching rule wins, so put broad rules before exceptions" (Agents, Permissions), and `.opencode/skills/agent-creator/SKILL.md` repeats it ("last match wins", "broad rule first, exceptions after"). A scoped allow placed before the catch-all deny never applies, so the agent silently cannot edit its own scope. When this record was written, `principal-software-engineer` and `senior-software-engineer` already follow this order; `devops-engineer`, `principal-architect`, and `senior-product-manager` do not and need a reorder.

## Verify

```bash
python3 - <<'EOF'
import glob, re
bad = []
for f in sorted(glob.glob('.opencode/agents/*.md')):
    rules = re.findall(r'action: edit\s*\n\s*resource: "([^"]*)"\s*\n\s*effect: (\w+)', open(f).read())
    catch = [i for i, (r, e) in enumerate(rules) if r == '*' and e in ('deny', 'ask')]
    scoped = [i for i, (r, e) in enumerate(rules) if r != '*' and e in ('allow', 'ask')]
    if not catch or (scoped and max(catch) > min(scoped)):
        bad.append(f)
print('FAIL: ' + ', '.join(bad) if bad else 'OK')
EOF
```
