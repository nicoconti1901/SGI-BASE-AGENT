---
description: Analyze a SQL query (or ORM call) for likely execution plan, missing indexes, and risks BEFORE it ships. Predicts EXPLAIN-style output and flags concerns.
argument-hint: SQL query, ORM call, or path to the file containing it
disable-model-invocation: false
---

# Explain This Query

You are analyzing a query before it ships. The user wants to know what it will look like when the database runs it on a non-trivial dataset.

Input: $ARGUMENTS

## Step 1: Normalize the query

If the input is an ORM call (Prisma, SQLAlchemy, ActiveRecord, etc.), translate to the SQL it likely generates. Ask the user to confirm if uncertain. If the input is a path, read the file and locate the query.

State the SQL clearly before analysis. If the user can run `EXPLAIN ANALYZE` themselves on a realistic dataset, that always beats your prediction. Suggest they do.

## Step 2: Predict the plan

For each table referenced, identify:

- The filter predicates (`WHERE ...`).
- The join predicates.
- The ordering (`ORDER BY`).
- The limit (`LIMIT ...`).

For each, ask: is there an index that the planner can use? Is the column on the left side of the operator (so the index can serve it)? Is the leading column of a composite index used?

Predict:

- **Access path**: Index Scan / Bitmap Index Scan / Seq Scan / Index-Only Scan / Parallel Seq Scan.
- **Join order**: smallest filtered set first.
- **Sort step**: in-memory sort, or sort-to-disk.
- **Row counts**: rough order of magnitude expected, if known.

## Step 3: Report

```
## Query Analysis

### The query (normalized)
```sql
<SQL>
```

### Tables referenced
| Table | Filters | Joins | Ordering | Expected access path | Index match |
|-------|---------|-------|----------|---------------------|-------------|
| ...   | ...     | ...   | ...      | ...                 | ...         |

### Predicted plan, in narrative
<one paragraph: what the planner is likely to do, in plain language>

### Risks
- <missing index, with the recommended `CREATE INDEX CONCURRENTLY ...` statement>
- <unbounded sort, with the index that would fix it>
- <Seq Scan on a table that will grow, with size threshold>
- <N+1 if the surrounding code calls this in a loop>
- <pagination style if relevant: cursor recommended over offset>

### Recommended next step
<one of:>
- Run `EXPLAIN (ANALYZE, BUFFERS)` on a realistic dataset and paste the output.
- Add the suggested index, in a separate migration with `CONCURRENTLY`.
- Rewrite the query as: <a specific rewrite>.

### Notes
- Postgres version assumed: <ask the user if unknown>.
- Realistic table size assumed: <ask if unknown>.
```

## Rules

- **No guesses without flags.** If table size is unknown, say "if X is over Y rows" and qualify the verdict.
- **Concrete index statements.** Give the exact `CREATE INDEX` (with `CONCURRENTLY`, with the right columns and order).
- **Distinguish predictions from facts.** "Predicted plan" makes it clear you did not run it.
- **Push EXPLAIN.** The user running EXPLAIN ANALYZE is always better than your prediction. Say so.
- **Flag pagination shape.** If the query has `OFFSET`, recommend cursor unless the use case justifies offset.

## What To Skip

- Generic query-optimization platitudes ("avoid SELECT *"). Apply specifics to this query, or skip.
- Theoretical performance numbers. You do not have measurements; do not produce fake ones.
