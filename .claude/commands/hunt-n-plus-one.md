---
description: Scan code for likely N+1 query patterns and propose fixes. Works across ORMs (Prisma, SQLAlchemy, ActiveRecord, TypeORM, Django, Sequelize, GORM, etc.) and raw SQL inside loops.
argument-hint: Path to file or directory to scan (defaults to the current working directory)
disable-model-invocation: false
---

# Hunt N+1

You are scanning code for the most common shipped-to-production performance bug: queries that run inside a loop, one per row.

Input: $ARGUMENTS (default: current working directory)

## What You Look For

N+1 patterns, in increasing subtlety:

1. **The literal loop.** `for x in items: db.query(...)` or `items.forEach(i => db.query(...))`. The query is right there.
2. **The relation accessor.** `user.posts` or `invoice.customer` inside a loop, where the ORM lazy-loads. The query is hidden.
3. **The serializer reflex.** A response shaper that calls `.related` on each item.
4. **The async fan-out without batching.** `Promise.all(items.map(i => db.query(...)))` is still N queries, just concurrent ones.
5. **The cross-service call in a loop.** Same pattern, different remote: `for x in items: api.fetch(x.id)`. Equally bad.
6. **The hidden in formatter.** A logger or template that calls a method that itself queries.

## How You Scan

1. **Glob and grep first.** Find loops (`for`, `forEach`, `.map`, list comprehensions) within reasonable distance of database modules. Read the bodies.
2. **Look for ORM relations accessed inside loops.** Language-specific:
   - Python (Django, SQLAlchemy): `obj.related` access inside `for` over a queryset; missing `select_related` / `prefetch_related` / `joinedload` / `selectinload`.
   - TypeScript (Prisma, TypeORM, Sequelize): missing `include` / `relations` / `eager`; lazy-loaded relations.
   - Ruby (ActiveRecord): missing `includes`; the classic `N+1`.
   - Go (GORM, sqlc): repeated `db.First(...)` inside loops.
3. **Look for `Promise.all` / `gather` / `errgroup.Wait` around per-row queries.** Concurrent N is still N.
4. **Look for serializers that call relations.** API response shapers and template helpers.

## How You Respond

```
## N+1 Scan: <path>

### High confidence (likely N+1)
- **file:line** <one-line description>
  - Pattern: <what you saw>
  - Suggested fix: <eager-load / batch / dataloader / single query>, with a 5-8 line snippet

### Medium confidence (looks like it but verify)
- **file:line** <one-line description>
  - Reason for uncertainty: <one line>
  - How to verify: <log SQL, run EXPLAIN, etc.>

### Low confidence (suspicious shape)
- **file:line** <one-line description>

### What looks fine
- <one line, optional>

### Verification notes
<one paragraph on how to confirm fixes in your environment: turn on query logging, add an N+1 detection middleware (e.g., bullet, n_plus_one_control, Prisma's $on('query'))>
```

## Rules

- **Cite file and line.** Every finding has a location.
- **Snippet the fix.** Show the eager-load or batch in the language you found. Keep snippets short.
- **Rank by confidence.** A "high confidence" finding has a visible loop and a visible per-row DB call. Anything else is medium or low.
- **Suggest a verification path.** Do not claim the fix is correct without telling the user how to confirm it in their environment.
- **Do not propose architectural rewrites.** Fix the N+1 in place.

## What To Skip

- Loops over results where the work is in-memory only.
- Per-row writes (`INSERT` per item is sometimes the correct pattern; flag only if the count is large and a batch insert would obviously win).
- Code marked as a one-shot script where N is small and known.
