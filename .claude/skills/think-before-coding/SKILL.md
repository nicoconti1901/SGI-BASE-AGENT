---
name: think-before-coding
description: Use BEFORE writing any backend code (endpoint, worker, CLI, script, consumer, cron, pipeline, daemon, webhook handler, integration). Forces the 6-step senior workflow so the design is sound before the first line ships. If you are about to write a server-side component of any kind, you MUST invoke this first.
---

# Think Before Coding

A senior backend engineer does not start with code. They start with six questions. This skill enforces those questions for any server-side component, not just HTTP endpoints.

## The Hard Gate

Do NOT begin writing code, sketching files, or proposing an architecture until the six steps below are answered. The discipline applies equally to:

- HTTP endpoints (REST, GraphQL, RPC)
- Workers and background jobs (queue consumers, schedulers, daemons)
- CLIs and admin scripts (data fixes, one-shot migrations, ops tooling)
- ETL / batch pipelines (CSV import, nightly aggregation, backfill)
- Event consumers (Kafka, Pub/Sub, webhooks)
- Cron jobs and scheduled tasks
- Long-running processes (TCP/WebSocket servers, daemons)
- Outgoing integrations (calling Stripe, sending email, posting webhooks)
- Pure data-layer code (repositories, query objects, projections)

If you can answer "this is too simple to think through", you are wrong. Simple components are where production incidents come from. The shorter the component, the shorter the answers, but every step gets an answer.

**Match depth to stakes.** A health check endpoint deserves one-line answers per step. A payment endpoint deserves paragraphs. Do not present six numbered sections with bold headers when the answers are obvious; weave them into your reasoning. Do present the structured form when the design has real choices in it, or when the user asked for a design doc. The discipline is doing the thinking, not rendering the template.

## Step 1: Identify the context

Before anything else, classify the component. The right questions depend on this:

| Context | Latency budget | Failure mode | Concurrency model |
|---------|----------------|--------------|-------------------|
| Sync HTTP endpoint | tens to hundreds of ms | 4xx / 5xx | one request, one thread |
| Async worker | seconds to minutes | retry, dead-letter | N instances pulling from queue |
| Event consumer | sub-second to seconds | redeliver, poison | partitioned, ordering matters |
| Cron / scheduler | irrelevant per-run | missed run, overlap | one or many depending on lock |
| Admin CLI / script | irrelevant | exit code, partial run | one operator at a time |
| ETL / batch | minutes to hours | resumability, idempotence | bounded parallelism |
| Long-running daemon | continuous | crash, reconnect | one process per node |

State the classification out loud. Everything else follows from it.

Pair the classification with an expected load. "Endpoint" alone is not enough; "endpoint at 5 req/s peak" and "endpoint at 5000 req/s peak" produce different designs. If the user has not said, ask. See [[performance-optimization]] for what to do with the answer.

## Step 2: Model the data

Before any code, write down:

- The entities involved and their relationships
- The invariants that must NEVER be false (e.g. `invoice.total >= 0`, `user.email unique`, `order.status transitions are forward-only`)
- The ownership: who owns the row, who can mutate it, what scopes exist
- The lifecycle: created, updated, archived, deleted. What states exist, what transitions are legal.

If an invariant can be enforced in the schema (CHECK, UNIQUE, FK, NOT NULL), it must be. Application-level invariants drift. See [[data-modeling-discipline]].

## Step 3: List the failure modes

The error path is part of the design, not an afterthought. List concretely what can go wrong:

- **HTTP endpoint**: bad input (4xx with stable code), missing auth, missing permission, conflict (409), upstream timeout, downstream DB error.
- **Worker / consumer**: transient failure (retry with backoff), permanent failure (dead letter), poison message (cannot deserialize, skip with alert), partial side effect (need idempotence).
- **CLI / script**: invalid args (exit non-zero with message), partial completion (must be resumable), interrupted (Ctrl-C should leave state consistent).
- **ETL**: bad row (skip with audit, do not crash), upstream changed format (fail loud), partial run (idempotent re-run).
- **Cron**: previous run still running (lock or skip), missed window (catch-up or drop).
- **Integration outbound**: 4xx from third party (do not retry the same call), 5xx (retry with backoff and jitter), timeout (state unknown, idempotency key required).

Decide for each: detect, surface, recover. See [[error-handling-as-design]].

Then add a short pass with security goggles: what does this change expose, what does it trust, what can leak through it. See [[security-and-hardening]]. Failure modes and attack surfaces overlap, but they are not the same list.

## Step 4: Map authorization

Who can trigger this? With what scope? Touching which resources?

- For endpoints: which roles, which tenant, which row-level scopes. If multi-tenant, the DB enforces tenancy ([[boring-by-default]] points at RLS on Postgres).
- For workers: jobs from which producer, signed with what, read access to what.
- For CLIs: which operator role, audit trail of what was changed.
- For consumers: validation of source (signed webhook, expected topic, schema version).

"Anyone authenticated" is not an answer. Be specific. If you cannot name the principal and the scope, you cannot ship the component.

See [[auth-and-authorization]] for the deeper treatment: authentication vs authorization separation, enforcement layers, OAuth flows, multi-tenancy via RLS.

## Step 5: Decide idempotence and concurrency

For any code that changes state, answer in one sentence each:

- **Replay**: what happens if this runs twice with the same input? If the answer is "duplicate charge / duplicate email / duplicate row", you have not designed it yet. See [[idempotency-and-side-effects]].
- **Concurrent**: what happens if two instances run at the same time? Pick: row lock, advisory lock, version column, queue partition by key, or "we accept last-write-wins because X".
- **Out-of-order**: for event consumers, can event N+1 arrive before N? If yes, decide: drop, reorder, or design for commutativity.

## Step 6: Decide observability

If a stranger gets paged at 3am for this component, what do they need? Decide BEFORE coding:

- **Logs**: what gets logged at boundary (entry / exit / failure). Structured. Trace ID propagated.
- **Metrics**: pick the right four for the context.
  - Endpoints / consumers: **RED** (Rate, Errors, Duration).
  - Workers / queues: **lag, throughput, retry rate, dead-letter rate**.
  - Cron / batch: **duration, rows processed, last success timestamp**.
  - Integrations: **call rate, error rate by remote status, p95 latency**.
- **Healthcheck**: what does "healthy" mean for this thing, and how does it actually test it.

See [[observability-by-default]]. For load-aware capacity choices (pool sizing, async vs sync, where the bottleneck lives), see [[performance-optimization]].

## Now You Code

Only after the six answers exist on paper (or in the chat), write code. The answers should be summarized to the user in 10 to 20 lines before any implementation starts.

## Red Flags

If any of these appear, stop and come back to this skill:

- You wrote a query before answering Step 2.
- The phrase "we'll handle errors later" was used or implied.
- The component sends an email / makes a payment / hits a third party, and Step 5 was skipped.
- The component runs in production but Step 6 produced "console.log should be fine".
- You found yourself writing a try/catch with no log, no metric, and no clear recovery.

## Anti-Patterns

- **The framework reflex**: jumping into `app.post("/things", ...)` or `class ThingsWorker(...)` before Step 1. The framework is the easy part. Write it last.
- **The CRUD assumption**: assuming every endpoint is a CRUD verb. Many are workflows, RPCs, or commands. Name the operation by what it does, not the HTTP verb.
- **The "happy path first, then we add edge cases"**: the edge cases ARE the design. They reveal the data model.
- **The "we'll add observability when we need it"**: by the time you need it, you cannot add it without a redeploy and a war room.

## Quick Decision Guide

| Question | Default answer | Deviate when |
|----------|----------------|--------------|
| Sync or async? | If > 200ms or calls a third party, async. | Read-only, fast, in-process. |
| Idempotency key on mutations? | Yes. | Pure read, or single-step DB write with a unique constraint. |
| Multi-tenant scoping? | DB-enforced (RLS on Postgres). | Single-tenant or admin-only. |
| Retry policy on outbound calls? | Exponential backoff with jitter, capped, dead-letter. | Fire-and-forget non-critical pings. |
| Structured logs? | Always JSON, with trace ID. | Never. |

## Continuous Disciplines

The six steps cover the design moment. They do not replace the reflexes that apply during and after the build:

- [[security-and-hardening]] on every diff, not at audit time.
- [[test-driven-development]] as the code grows: pick what is worth testing, ignore the rest.
- [[debugging-and-error-recovery]] the moment something is wrong in staging or production.

If you ship a component without those, you ship a half-design.

## See also

- [[data-modeling-discipline]] for Step 2
- [[error-handling-as-design]] for Step 3
- [[security-and-hardening]] for the attack-surface pass on Step 3
- [[auth-and-authorization]] for Step 4
- [[idempotency-and-side-effects]] for Step 5
- [[observability-by-default]] for Step 6
- [[performance-optimization]] for the load-aware choices across Step 1 and Step 6
- [[migration-safety]] when Step 2 implies a schema change
- [[query-discipline]] when Step 2 implies new reads
- [[boring-by-default]] when you reach for a new piece of tech to solve any of the above
- [[test-driven-development]] as you build out
- [[debugging-and-error-recovery]] when something breaks in production
