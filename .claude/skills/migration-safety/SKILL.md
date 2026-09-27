---
name: migration-safety
description: Use whenever writing, reviewing, or running a database migration (SQL files, ORM migrations, schema changes). Every migration is a potential incident. This skill catches the patterns that cause production lock-ups, partial deploys, and irreversible damage BEFORE the file ships.
---

# Migration Safety

A migration is not a code change. It is a deployment-time operation against the production database with real customers. Treat every line of it as if it ran at 9am on a Monday during peak traffic, because eventually one of them will.

## The Discipline

Before any migration is committed, it must pass these checks:

1. **Backward compatible with the previous app version** so a rolling deploy can run both versions at once. If your deploy stops the world, this rule relaxes, but you should still try.
2. **Forward compatible with the next migration** so the next change is not blocked by this one's awkward shape.
3. **Reversible** unless the irreversibility is named and accepted in the PR description.
4. **Lock budget known**. Estimate the lock and decide if it is acceptable for production traffic at this hour.
5. **Tested against a realistic snapshot.** A migration that runs on an empty dev DB proves nothing.

## The Six Dangerous Patterns

These are the moves that turn a deploy into an incident.

### 1. `ALTER TABLE ... ADD COLUMN ... NOT NULL` without a default

On large tables, this rewrites every row under an exclusive lock. Customers see timeouts.

Do this instead, in three migrations:
```sql
-- 1. Add nullable
ALTER TABLE invoices ADD COLUMN currency text;
-- 2. Backfill in batches (separate script)
-- 3. Add the constraint after backfill
ALTER TABLE invoices ALTER COLUMN currency SET NOT NULL;
```

On Postgres 11+, `ADD COLUMN ... NOT NULL DEFAULT 'USD'` is fast because the default is virtual. But the moment the default is non-constant or the version is older, you are back to the three-step.

### 2. `DROP COLUMN` without a deprecation window

The column is referenced by some service version still running. You will get a 500 storm. Do this:

1. Stop writing to the column (deploy).
2. Stop reading from the column (deploy).
3. Drop the column (next migration, separate deploy).

### 3. Rename in one shot

`ALTER COLUMN ... RENAME` breaks all running app instances during a rolling deploy. Two-step it:

1. Add the new column. Dual-write in the app.
2. Backfill, switch reads to the new column, stop writing to the old.
3. Drop the old column (separate migration).

Same for table renames and renamed FK constraints.

### 4. Adding an index without `CONCURRENTLY` on a hot table

Plain `CREATE INDEX` locks writes. Always:

```sql
CREATE INDEX CONCURRENTLY idx_invoices_customer_id ON invoices (customer_id);
```

On Postgres, this cannot run inside a transaction. Most migration tools support it with a flag (`disable_ddl_transaction!` in Rails, `transaction: false` in some others).

### 5. Long-running data backfill inside a migration

A migration that updates 10M rows inside a transaction holds locks for minutes. The fix: do the schema change in the migration, do the backfill in a separate script that runs in batches with throttling, and only add the final constraint after the backfill is verified.

### 6. CHECK constraint added without `NOT VALID`

`ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` scans every row under a lock. Use:

```sql
ALTER TABLE invoices ADD CONSTRAINT total_non_negative CHECK (total >= 0) NOT VALID;
-- later, after the data is known clean:
ALTER TABLE invoices VALIDATE CONSTRAINT total_non_negative;
```

`VALIDATE CONSTRAINT` takes a weaker lock and can run online.

## The Rollback Story

Every migration has an answer to "what do we run if this deploy is bad?" If the answer is "we cannot roll back, the data is gone", that is a deployment freeze decision, not a migration. Put it in the PR description.

For data-destructive migrations (DROP COLUMN, DROP TABLE), default to a multi-deploy plan: deprecate, observe in production for at least one release, then drop. The deprecation window catches the consumer you forgot.

## Reflexes During Review

When reading a migration, scan in this order:

1. Does it touch a table > 1M rows? If yes, every operation is suspect until proven cheap.
2. Are there any `DROP`, `RENAME`, `NOT NULL`, or unindexed FK adds?
3. Is every new `FOREIGN KEY` indexed in the same migration?
4. Is every new index created `CONCURRENTLY`?
5. Is there any data manipulation (UPDATE, INSERT) embedded in the migration? Pull it into a separate, restartable script.
6. Is the down-migration sketched, or just `raise NotImplementedError`?

## Anti-Patterns

- **"It worked on staging."** Staging usually has 0.1% of prod data. Test on a recent prod snapshot or a representative volume.
- **"We will run it during the maintenance window."** Migrations live forever in version control and will be replayed on every new environment, including the one without a maintenance window.
- **The mega-migration.** One migration that adds 6 columns, renames 2, drops 3, and reorganizes an index. Split. Each migration is one atomic concept.
- **Migration as ETL.** Migrations exist to change schema. Backfills, cleanups, and data reshapes are scripts, run separately, with progress logs and idempotent batching.
- **Silent default change.** Changing a column's default is silent for old rows. State it in the PR.

## Quick Decision Guide

| Operation | Safe form | When risky |
|-----------|-----------|------------|
| Add column | nullable first, backfill, constrain | NOT NULL without default on large table |
| Drop column | deprecate read, deprecate write, drop | one-shot drop |
| Rename | add-new, dual-write, switch, drop-old | one-shot rename |
| Add index | `CREATE INDEX CONCURRENTLY` | plain `CREATE INDEX` on a hot table |
| Add CHECK | `NOT VALID`, then `VALIDATE` | one-shot ADD CONSTRAINT |
| Backfill | external script, batched | inside the migration |

## See also

- [[data-modeling-discipline]] for the schema that justifies the migration
- [[query-discipline]] for indexes
- [[observability-by-default]] to know if a migration started causing slow queries
