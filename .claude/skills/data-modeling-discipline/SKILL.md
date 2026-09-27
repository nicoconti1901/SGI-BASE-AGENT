---
name: data-modeling-discipline
description: Use whenever creating or changing a database schema, defining an entity, writing an ORM model, or designing a data structure that will be persisted. Forces invariants into the schema instead of trusting the application layer. Use this BEFORE writing the migration.
---

# Data Modeling Discipline

The schema is the contract. The application code is the suggestion. Anything that can be wrong in the data, will eventually be wrong, unless the database refuses it.

## The Discipline

Before writing a CREATE TABLE, ALTER TABLE, or ORM model, answer:

1. **What is the invariant?** What must never be false in this row? Examples: total >= 0, status in a fixed set, end_at > start_at, exactly one of fields A or B is set.
2. **Where is it enforced?** Pick: NOT NULL, UNIQUE, CHECK, FOREIGN KEY, partial index, exclusion constraint, generated column. If the answer is "in the service layer", reconsider.
3. **What is the ownership and lifecycle?** Who creates the row, who mutates it, who deletes it. What states exist. What transitions are legal.
4. **Will this query well in 18 months?** At 100x current row count, with the access patterns you expect.

## Reflexes

**Types are tight.** A column is `numeric(12, 2)` for money, `timestamptz` for time, `text` only for actual free text, an enum for fixed sets. `varchar(255)` is a 1990s reflex, drop it. Never store dates, IDs, or money as `text`.

**NOT NULL is the default.** Every column is NOT NULL unless absence has a clear, distinct meaning. `NULL` is not "no value", it is "explicitly unknown". If you mean "not set yet", model the state, do not lean on NULL.

**Foreign keys are mandatory.** Every reference is a FOREIGN KEY with an explicit `ON DELETE` choice (`RESTRICT`, `CASCADE`, `SET NULL`, `NO ACTION`). Choosing means thinking. Not choosing means a future surprise.

**UUIDv7 for public IDs.** Internal sequences are fine for joins. Anything exposed to users or third parties is UUIDv7: time-ordered, indexes well, does not leak volume. UUIDv4 wrecks btree locality. Auto-increment leaks customer count and is enumerable.

**Money is decimal, not float.** `numeric(precision, scale)` or a dedicated minor-unit integer (cents, satoshi). Float is for physics.

**Time is `timestamptz`, always UTC at the boundary.** No local time in the DB. Display is the caller's job.

**Audit the things that pay the bills.** For business-critical rows (money, contracts, permissions), keep `created_at`, `created_by`, `updated_at`, and either a history table or an append-only event log. You will need it the day Legal asks.

## Soft Delete Is a Trap

Default position: do not soft delete. `WHERE deleted_at IS NULL` is one missed clause away from a privacy leak, and it pollutes every join.

Alternatives, in order of preference:

1. **Hard delete** when the entity has no meaningful afterlife.
2. **Archive table** when you need history. Move the row out of the live table; the live table stays clean.
3. **Explicit lifecycle state** (`status = 'archived'`) when the row remains discoverable but inactive. Then every query opts in, not opts out.

Deviate when: regulatory requirements force retention, AND the team has a real story for joins (views, partitioning).

## Indexes Are Part of the Schema

Add the index in the same migration as the column. Reflex:

- Every `FOREIGN KEY` needs an index on the child side (Postgres does not auto-create one).
- Every `WHERE` you will run on a non-trivial table needs an index.
- Every `ORDER BY` on a non-trivial list needs an index that covers the sort.
- For "find one row by X", a UNIQUE index is also a constraint. Free correctness.

See [[query-discipline]] for index choice mechanics.

## Multi-Tenancy

If the table is multi-tenant, `tenant_id` is NOT NULL and indexed, and on Postgres you enable Row Level Security. Application-level filtering fails open. Database-level filtering fails closed. See [[boring-by-default]].

## Anti-Patterns

- **JSON columns as schema escape hatch.** A `meta jsonb` column starts as "just a few flags" and ends as a denormalized mess no query can constrain. Use JSON for genuinely free-form data (third-party payloads, user-defined fields). Otherwise model it.
- **String enums as the source of truth.** `status text` with magic values in code: rename hell, typo hell. Use a database enum or a CHECK constraint on a known set.
- **Polymorphic associations** (`entity_type text + entity_id uuid`). Breaks FK integrity. Prefer separate tables or a discriminated set of nullable FKs with a CHECK.
- **Booleans for things that grow.** `is_archived bool` becomes `is_archived bool, is_suspended bool, is_pending_review bool` in 18 months. Model state, not flags.
- **Mutable IDs.** The primary key never changes. If "users can change their username", username is not the key.

## Quick Decision Guide

| Question | Default | Deviate when |
|----------|---------|--------------|
| Public ID type | UUIDv7 | Internal-only -> bigserial |
| Time column | `timestamptz` UTC | Never |
| Money | `numeric(precision, scale)` or integer minor units | Never use float |
| Free-text column max | None, use `text` | Hard external limit |
| Nullable by default? | No | Absence has a distinct meaning |
| Soft delete? | No | Regulatory + a real plan |
| Tenant column? | Yes, NOT NULL, indexed, RLS-enforced | Single-tenant or admin |

## See also

- [[migration-safety]] to ship these schema changes without an incident
- [[query-discipline]] to read this schema fast
- [[think-before-coding]] Step 2 invokes this skill
