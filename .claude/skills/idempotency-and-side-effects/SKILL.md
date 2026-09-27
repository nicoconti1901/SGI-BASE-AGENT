---
name: idempotency-and-side-effects
description: Use when designing any operation that changes state, sends a message, makes a payment, calls a third party, emits an event, or writes to multiple stores. Forces idempotence and the outbox pattern so replays and retries never duplicate side effects. Apply this BEFORE writing the handler, job, or consumer.
---

# Idempotency and Side Effects

Networks retry. Clients double-click. Queues redeliver. Operators replay scripts. If your code "works" only when each operation runs exactly once, your code does not work.

## The Discipline

For every state-changing operation, answer in one sentence:

**"What happens if this runs twice with the same input?"**

The answer must be: "the same observable outcome as if it ran once." If it is "duplicate charge", "duplicate email", "duplicate row", or "I do not know", the design is incomplete.

## Idempotency Keys

For any client-driven mutation (POST, PUT, command, RPC) where a retry is plausible, accept an idempotency key.

The contract:

1. Client sends `Idempotency-Key: <client-generated-uuid>` on the request.
2. Server stores `(idempotency_key, request_hash, response, status, expires_at)` for a window (24h to 7d is typical).
3. On replay with the same key:
   - Same request hash: return the stored response.
   - Different request hash: return 409 / `IDEMPOTENCY_KEY_CONFLICT`. Do not run the operation.
4. The key write and the business-state write must be in the same transaction, or the side effect must commit atomically with the key. Otherwise you can record success without doing the work, or vice versa.

This is mandatory on mutations that:

- Cost money (charges, refunds, transfers).
- Send a message (email, SMS, webhook, push).
- Create a row a user can see and complain about (orders, posts, signups).
- Trigger a workflow downstream.

It is optional on idempotent-by-nature operations: pure reads, single-row writes with a UNIQUE constraint that will reject the second insert, and "set field to constant" updates.

## Workers and Consumers

A queue is "at-least-once" delivery unless you have proved otherwise. Design every consumer for redelivery:

- The unit of work has a stable, idempotent key derived from the message (event ID, payload hash, business identifier).
- Before doing the work, check if it has already been done (DB row, Redis SETNX, dedup table with TTL).
- Or, design the work so a second run is a no-op: `INSERT ... ON CONFLICT DO NOTHING`, `UPDATE ... WHERE status = 'pending'`, set-to-constant rather than increment.

Increment operations are the classic trap. `UPDATE counter SET value = value + 1` is not idempotent. Either use a unique event log (count rows) or accept exactly-once semantics via a transactional outbox.

## The Outbox Pattern

When a single business operation requires "write to my DB AND send an event / call an external service", a transaction across both is impossible. The cheap fix is the outbox:

1. In the same DB transaction as the business write, insert a row into an `outbox` table with the event payload.
2. A separate publisher reads the outbox, dispatches the event, marks it done.
3. The publisher is idempotent against the destination (uses the outbox row ID as the idempotency key for the third party or the broker).

This survives every crash combination: if the business write rolls back, the outbox row is gone too. If the publisher crashes mid-send, it re-sends until the destination acknowledges.

Reach for the outbox whenever an operation has more than one externally observable effect.

## Outgoing Calls

Every call to a third party must assume:

- The request might succeed and the response might never arrive (network drop).
- The third party might dedupe by their own key. If they do, use it.
- A 5xx response is "unknown" state, not "failure". You must be safe to retry.
- A 4xx response is "do not retry", except for a few documented codes (`429`, sometimes `408`).

Default policy: retry on 5xx and connection errors with exponential backoff and jitter, capped at a small number of attempts, with the same idempotency key sent each time. Push the work to a background job if it is not strictly required to be inline.

## Side-Effect Discipline

Inside a DB transaction, do not:

- Send email, SMS, push notifications.
- Call third-party APIs.
- Publish to a message broker.
- Make HTTP calls of any kind.

Why: if the transaction rolls back, you cannot un-send the email. If the call hangs, you hold the row locks. Use the outbox.

After a DB transaction commits, side effects belong in a job, not in the request handler. The handler returns; the job carries the side effect with its own retries.

## Anti-Patterns

- **The "we will catch and retry" reflex.** A `try / catch / retry` around a non-idempotent operation just generates more duplicates.
- **Treating "exactly once" as a deployment option.** It is a design property. No broker gives it to you for free; you build it with idempotency keys and a dedup store.
- **Mixing reads and writes in a webhook handler.** Webhooks redeliver. Treat the handler as a queue consumer.
- **Idempotency key per server instance.** The key store must be shared. Cache invalidation across instances is not the same store.
- **"This call is fast, we will do it inline."** A 200ms third-party call is a 200ms held connection AND a request-time failure mode. Push it to a job.

## Quick Decision Guide

| Operation | Reflex |
|-----------|--------|
| POST that costs money | Idempotency key mandatory, dedup store, atomic with business write |
| Outgoing email / SMS / push | Background job, idempotency key on the provider call |
| Webhook receive | Idempotent handler keyed by provider's event ID |
| Queue consumer | Dedup by event ID, plan for redelivery |
| Cross-store write (DB + broker / DB + third party) | Outbox |
| Increment / counter | Either event log + COUNT, or accept eventual via outbox |
| 5xx from third party | Retry with backoff + jitter, same idempotency key |
| 4xx from third party | Do not retry, log, surface |

## See also

- [[think-before-coding]] Step 5 invokes this skill
- [[error-handling-as-design]] for the retry and failure shapes
- [[observability-by-default]] to track replays and dedup hits
