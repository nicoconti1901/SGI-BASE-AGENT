---
description: Audit an existing backend component (endpoint, worker, consumer, CLI, integration, cron) against senior discipline. Checks invariants, error handling, idempotence, authorization, and observability.
argument-hint: Path to the component file or directory
disable-model-invocation: false
---

# Backend Component Audit

You are auditing existing backend code as a senior reviewer. The component already exists; the question is whether it is production-ready.

Input: $ARGUMENTS

## Step 1: Classify

Identify what kind of component this is:

- HTTP endpoint / handler
- Worker or background job
- Queue / event consumer
- CLI or admin script
- Cron / scheduled task
- Outbound integration
- Long-running daemon

The audit checklist adapts to the type. State the classification before you proceed.

## Step 2: Read the component

Read the entry point and follow the call graph one or two hops deep. Note:

- The data it reads and writes.
- The third-party calls it makes (and which library / SDK).
- The places it logs, validates, and authorizes.
- The queries it runs.

## Step 3: Run the audit

For each section below, give one of: **OK** / **Gap** / **Risk**, with a one-line note. Skip sections that do not apply to the component type.

```
## Audit: <component>

### Classification
<type, with file path>

### Invariants and data model
- Schema-enforced invariants: <list>
- Application-enforced invariants not in schema: <list, gap>
- Use of nullables that look like "unfilled state": <list>

### Authorization
- Principal identified at entry: <OK / Gap>
- Scope checked (tenant, role, ownership): <OK / Gap>
- Enforcement point (DB / app / both): <where>

### Error handling
- Validation at boundary: <OK / Gap>
- Bare `except` / `catch` blocks: <list with file:line>
- Caller vs system error split: <OK / muddled>
- Stable error codes exposed: <OK / Gap>

### Idempotence and side effects
- Mutation idempotency key (if applicable): <OK / Gap>
- Side effects inside DB transactions: <list, risk>
- Outbox or equivalent for cross-store: <OK / Gap / not applicable>
- Retry policy on outbound calls: <list, risk>

### Queries and data access
- Suspected N+1 patterns: <list with file:line>
- Unbounded list queries: <list>
- Indexes that likely back the queries: <OK / unknown / Gap>
- Pagination style: <cursor / offset / none>

### Observability
- Structured logging: <OK / partial / Gap>
- Trace ID propagation: <OK / Gap>
- Metrics appropriate for component type: <list, with what is missing>
- Healthcheck (if applicable): <OK / Gap / fake>

### Boring-tech check
- Any complexity that is not paying rent: <list>

### Top 5 issues to fix first
1. ...
2. ...
3. ...
4. ...
5. ...
```

## Rules

- **Cite file and line.** Every issue points to a location.
- **Severity-ordered.** The top 5 list is what the team should pick up first.
- **No "consider adding more tests".** If tests are missing for a critical path, say so concretely with the path.
- **No theoretical concerns.** Either you found a specific gap, or the section is OK.
- **Read enough to be honest.** If you only read the entry file, say so, and limit your claims to what you read.

## What To Skip

- Style and naming, unless it actively confuses the reader.
- Generic security platitudes. If you find a specific issue (SQL injection, secrets in code, missing rate limit), name it. Otherwise skip.
- Performance theorizing without a measurement. Flag suspected hot paths, do not predict numbers.
