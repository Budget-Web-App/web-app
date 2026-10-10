# Documentation standards

These rules govern every Markdown file under `docs/`. Prose must follow the
`google-tech-writing` skill, and decision records must follow the
`design-decision` skill. This file is the contract: a rule without a check in
the `## Verify` section is not a rule.

## Location and naming

MUST: Every repo doc is a Markdown file under `docs/`, named in kebab-case:
lowercase letters, digits, and hyphens only.

MUST: An ADR follows the `design-decision` skill: file
`docs/adrs/<NNNN>-<kebab-title>.md`, with front matter holding `id`,
`applies_to`, and `status`.

## Structure

MUST: The first heading in every doc is a single H1, in sentence case, preceded
only by YAML front matter.

MUST NOT: Use ALL CAPS or Title Case headings. "Catch-all edit deny before the
scoped edit allow" is correct; "Catch-all Edit Deny" is not.

## Rule statements

MUST: A doc that states rules for agents — a rules doc — states each rule on its
own line, prefixed with an RFC-2119 keyword: `MUST:`, `MUST NOT:`, `SHOULD:`,
or `MAY:`. Put the rationale in a `## Why` section, not inside the rule.

## Verify

MUST: A rules doc — one with keyword rules or a `## Why` section — ends with a
`## Verify` section holding at least one shell command that prints `OK` when the
rules hold and `FAIL` when they do not. If a rule cannot be checked, say why in
one line in that section. A doc without rules, such as the product brief, skips
this section.

## Prose

MUST: Apply the `google-tech-writing` skill to every sentence. The check below
enforces the common violations: Latin abbreviations (`e.g.`, `i.e.`, `etc.`),
placeholder phrases (`please note`, `note that`, `at this time`, `simply`), and
exclamation points in prose.

## Verify

Run this from the repo root:

```bash
python3 - <<'EOF'
import glob, re, sys

docs = sorted(glob.glob('docs/**/*.md', recursive=True)) or sorted(glob.glob('docs/*.md'))
fail = []

# R location: kebab-case names; ADRs keep the NNNN- prefix from design-decision
for f in docs:
    if re.match(r'^docs/adrs/[0-9]{4}-[a-z0-9-]+\.md$', f):
        continue
    if not re.match(r'^docs(/[a-z0-9]+(-[a-z0-9]+)*)+\.md$', f):
        fail.append(f'R location: bad file name: {f}')

# R structure: first heading is an H1; no ALL CAPS or Title Case headings.
# Title Case shows up as a capitalized connector word (and, of, the, for)
# in the middle of a heading.
for f in docs:
    text = open(f).read()
    body = text
    if text.startswith('---') and text.count('---') >= 2:
        body = text.split('---', 2)[2]
    heads = re.findall(r'^#+ .+$', body, re.M)
    if not heads or not heads[0].startswith('# '):
        fail.append(f'R structure: first heading is not H1: {f}')
    for h in heads:
        h = re.sub(r'^#+ ', '', h)
        if re.match(r'^[A-Z0-9][A-Z0-9 ]{3,}$', h):
            fail.append(f'R structure: ALL CAPS heading: {f}: {h}')
        for w in h.split()[1:]:
            if re.match(r'^(And|Of|The|In|On|At|To|For|With|From|By|As)$', w):
                fail.append(f'R structure: Title Case heading: {f}: {h}')

# R prose: banned tokens and exclamation points outside code
banned = [r'\be\.g\.', r'\bi\.e\.', r'\betc\.', 'please note', 'note that', 'at this time', r'\bsimply\b']
for f in docs:
    text = open(f).read()
    prose = re.sub(r'```.*?```', '', text, flags=re.S)
    prose = re.sub(r'`[^`]*`', '', prose)
    for tok in banned:
        if re.search(tok, prose, re.I):
            fail.append(f'R prose: banned token {tok}: {f}')
    if '!' in prose:
        fail.append(f'R prose: exclamation point: {f}')

# R rule statements + R verify: a rules doc (keyword rules or "## Why") carries
# keyword rules and ends with "## Verify" printing OK/FAIL. Non-rule docs, such
# as the product brief, skip these two checks.
for f in docs:
    text = open(f).read()
    keywords = re.search(r'^(MUST|MUST NOT|SHOULD|MAY):', text, re.M)
    is_rules = bool(keywords) or bool(re.search(r'^## Why$', text, re.M))
    if not is_rules:
        continue
    if not keywords:
        fail.append(f'R rule statements: no keyword rules: {f}')
    heads = re.findall(r'^## .+$', text, re.M)
    m = re.search(r'^## Verify$', text, re.M)
    if not m or not heads or heads[-1] != '## Verify':
        fail.append(f'R verify: doc does not end with "## Verify": {f}')
    elif not (re.search(r'\bOK\b', text[m.end():]) and re.search(r'\bFAIL\b', text[m.end():])):
        fail.append(f'R verify: block prints no OK/FAIL: {f}')

# R adr: front matter with id, applies_to, status
for f in sorted(glob.glob('docs/adrs/*.md')):
    text = open(f).read()
    fm = text.split('---', 2)[1] if text.startswith('---') and text.count('---') >= 2 else ''
    for key in ('id', 'applies_to', 'status'):
        if not re.search(rf'^{key}:', fm, re.M):
            fail.append(f'R adr: missing front matter {key}: {f}')

if fail:
    print('FAIL')
    print('\n'.join(fail))
    sys.exit(1)
print('OK')
EOF
```