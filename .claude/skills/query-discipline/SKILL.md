---
name: query-discipline
description: Use when writing, reviewing, or generating any database query (raw SQL, ORM call, query builder). Catches N+1, missing indexes, unbounded lists, and bad pagination BEFORE the query reaches production. Use this whenever you reach for an ORM or write a SELECT.
---

# Query Discipline

Most "the app is slow" stories are "the data access is slow". Most data-access problems are obvious in advance to anyone who looks at the query plan. This skill turns that look into a reflex.

## The Discipline

For any non-trivial query, before it ships:

1. **Read the plan.** `EXPLAIN ANALYZE` on a realistic dataset. Eyeball the plan, not just the time.
2. **Confirm the access path.** Index Scan or Bitmap Index Scan on the hot path, not Seq Scan.
3. **Confirm the join order.** The smallest filtered set drives the join. The optimizer usually gets it right, but check.
4. **Bound the result.** Every list query has a `LIMIT`. Always.
5. **Suspect N+1.** If the query is inside a loop or rendered per-row, it is N+1 until proven otherwise.

If any of those answers is "I do not know", the query is not ready.

## N+1 Detection

The pattern that ships the most production slowness:

```typescript
// N+1: one query for invoices, then one per invoice for the customer.
const invoices = await db.invoice.findMany({ where: { dueThisWeek: true } });
for (const inv of invoices) {
  inv.customerName = (await db.customer.findUnique({ where: { id: inv.customerId } })).name;
}
```

Fix by batching at the data layer:

```typescript
const invoices = await db.invoice.findMany({
  where: { dueThisWeek: true },
  include: { customer: { select: { name: true } } },
});
```

Or for raw SQL, a JOIN. Or for cross-service calls, a dataloader. The rule: **the number of queries must not be proportional to the number of rows.**

The smell, regardless of language:

- A `.map`, `.forEach`, or `for` over a result, with a DB call inside.
- A serializer that calls `.related` on each row.
- An ORM relation accessed without an explicit eager-load.

## Pagination

Default: **cursor (keyset) pagination.**

```sql
SELECT id, created_at, ...
FROM events
WHERE (created_at, id) < (:last_seen_created_at, :last_seen_id)
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

This is `O(log N)`, stable under inserts, and does not leak counts.

Offset pagination is acceptable only for small, stable, admin-only lists. `OFFSET 10000` reads and discards 10000 rows. Past a few thousand offset, latency cliffs.

If the product demands "page 47 of 12,381", that is a UX request that costs money. Push back, or accept the cost and budget for it.

## Indexes Match Queries

Rules of thumb:

- An index serves a query when its leading columns match the query's filter and ordering. Order of columns matters.
- Composite index `(a, b, c)` serves `WHERE a = ?`, `WHERE a = ? AND b = ?`, `WHERE a = ? AND b = ? ORDER BY c`. It does NOT serve `WHERE b = ?` alone.
- Use a partial index when the hot query has a constant filter: `CREATE INDEX ... WHERE status = 'pending'`.
- Functional indexes for case-insensitive lookups: `CREATE INDEX ... (lower(email))`.

When in doubt, run `EXPLAIN ANALYZE` and confirm the plan uses your index. The plan tells the truth.

## ORM Hygiene

An ORM hides the query. Your job is to know which query it generated.

- Log the SQL in development. Always.
- For any query that matters (hot path, large table, customer-facing), check the generated SQL by hand.
- Never trust an ORM's default eager-load behavior. State the loads.
- `SELECT *` is fine for one-off scripts. In hot code, list the columns. Saves bandwidth and lets the planner use covering indexes.

## Transactions

- A transaction is held open for as short a time as possible. No third-party calls inside.
- For "read-modify-write" patterns, use `SELECT ... FOR UPDATE` or an optimistic version column. Decide at design time.
- Long-running reports do not need a transaction. Use a read replica or a snapshot.

## Anti-Patterns

- **Counting everything.** `SELECT COUNT(*) FROM big_table` is a full scan. If you need an approximate count, use `reltuples` from pg_class or maintain a counter.
- **`SELECT DISTINCT` instead of fixing the join.** DISTINCT papers over a duplicate-producing join. Fix the join.
- **Application-side joins.** Pulling two tables to memory and joining in code defeats every database optimization. Let the database join.
- **`IN (...)` with thousands of values.** Push them to a TEMP TABLE or use a `VALUES` clause join. Avoid query plans the size of a city block.
- **Unbounded ORDER BY without an index.** Sorts to disk. You will not notice until production.
- **`ILIKE '%foo%'`.** Full-text search dressed up as a filter. Use a real FTS index (`pg_trgm`, `tsvector`) or a search service.

## Quick Decision Guide

| Question | Default | Deviate when |
|----------|---------|--------------|
| Pagination style | Cursor (keyset) | Tiny admin list with stable data |
| Default LIMIT on lists | 50 to 100 | Explicit operator query |
| EXPLAIN before merge for new queries? | Yes | Trivial single-row lookup by PK |
| Index every FK? | Yes (child side) | One-off lookup table |
| Use ORM eager-load by default? | No, state it explicitly | Never trust defaults |
| Read replica for reporting | Yes | Strong-consistency need |

## See also

- [[data-modeling-discipline]] for the schema this skill reads
- [[migration-safety]] when an index needs `CONCURRENTLY`
- [[observability-by-default]] for query latency metrics in production
