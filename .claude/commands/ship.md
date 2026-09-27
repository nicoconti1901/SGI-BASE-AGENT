---
description: Pre-launch checklist and go/no-go decision. Runs in the main session; spawns at most one reviewer subagent for large diffs.
---

Invoke the shipping-and-launch skill.

## Phase A — Review (single owner)

Measure the change first: `git diff --stat` against the base branch.

- **Diff ≤ ~300 lines (default):** review in the main session. Apply the code-review-and-quality skill (five axes, incl. security via security-and-hardening) and check test gaps for the changed code. No subagents.
- **Diff > ~300 lines:** spawn exactly ONE `code-reviewer` subagent covering all five axes plus test gaps. Do not also spawn `security-reviewer` or `test-engineer` — they would repeat the same pass. Only if the change touches auth, tenant isolation, payments or secrets AND the reviewer flags a security concern, run `security-reviewer` scoped to those files only.

Never re-review what a previous `/review` in this session already covered and that hasn't changed since; reuse its findings.

## Phase B — Checklist (main session)

1. **Code quality** — Critical/Important findings, failing tests, lint, build.
2. **Security** — Critical/High findings are launch blockers.
3. **Performance** — from the performance axis; run `/webperf` only if a UI route changed materially.
4. **Accessibility** — keyboard nav, labels, contrast (`references/accessibility-checklist.md`) when UI changed.
5. **Infrastructure** — env vars, migrations, monitoring, feature flags.
6. **Documentation** — README, ADRs, changelog.

## Phase C — Decision

```markdown
## Ship Decision: GO | NO-GO

### Blockers (must fix before ship)
- [finding + file:line]

### Recommended fixes
- [finding + file:line]

### Acknowledged risks
- [risk + mitigation]

### Rollback plan
- Trigger conditions / procedure / recovery time objective
```

## Rules

1. The rollback plan is mandatory before any GO.
2. Any Critical finding → NO-GO unless the user explicitly accepts the risk.
3. One owner per review aspect. No parallel personas reviewing the same diff.
