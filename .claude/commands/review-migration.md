---
description: Review a database migration against senior backend discipline. Flags lock-up risks, irreversibilities, and missing-deprecation patterns BEFORE the file is committed.
argument-hint: Path to the migration file, or paste the SQL inline
disable-model-invocation: false
---

# Review Migration

You are reviewing a database migration as a senior on-call engineer who has been burned by migrations before.

Input: $ARGUMENTS

## Step 1: Read the migration

If a file path is provided, read it. If SQL was pasted, work from the paste. Identify:

- Tables touched and their estimated size (ask the user if unclear; "small" / "1M+" / "100M+" buckets are enough).
- Operations performed (CREATE, ALTER ADD, ALTER DROP, ALTER NOT NULL, RENAME, ADD CONSTRAINT, CREATE INDEX, UPDATE / INSERT inside the migration).
- Whether there is a down-migration sketched.

## Step 2: Apply the migration-safety checklist

Invoke the `migration-safety` skill. Run the six-pattern check, in order:

1. `ALTER TABLE ... NOT NULL` without default on a large table.
2. `DROP COLUMN` without a deprecation window.
3. One-shot rename of a column or table.
4. Index without `CONCURRENTLY` on a hot table.
5. Long-running data backfill inside the migration.
6. CHECK constraint added without `NOT VALID`.

Also check:

- Every new FOREIGN KEY has an index on the child side.
- Every new constraint declares ON DELETE explicitly.
- New nullable columns intended to become NOT NULL have a stated plan.
- Embedded UPDATE / INSERT statements that should be a separate backfill script.

## Step 3: Report

```
## Migration Review: <file name or "inline SQL">

### Tables touched
- <table> (estimated <size>): <operations>

### Blocking issues
- <issue>. Risk: <one line>. Safer pattern: <one line, often a multi-migration plan>.

### Should-fix
- <issue>. Risk: <one line>. Safer pattern: <one line>.

### Worth considering
- <suggestion>. Reason: <one line>.

### Rollback story
<one paragraph: what happens if this deploy is bad? Is the down-migration honest? Are there irreversibilities the PR description should call out?>

### Verdict
- **Safe to merge** | **Refactor required** | **Multi-deploy plan required**
```

## Rules

- **Lock budget over style.** Spend issues on what causes outages, not on naming.
- **Multi-deploy plans get concrete.** "Split into three migrations: A (add nullable), B (backfill script, separate), C (constrain NOT NULL after backfill verifies)."
- **No "looks fine to me".** If the migration is clean, say "no blocking issues, no should-fix" and move on.
- **Treat irreversibility as an explicit decision.** If a migration is irreversible, it must say so in the PR description and the reviewer must consent.

## When You Need More Info

If you cannot tell the table size, the deployment style (rolling vs stop-the-world), or the Postgres version, ask before you verdict. Do not assume.
