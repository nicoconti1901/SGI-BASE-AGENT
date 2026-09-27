---
name: error-handling-as-design
description: Use when designing or implementing any backend component, BEFORE the happy path. Treats the error path as part of the contract, not as cleanup. Catches the silent swallow, the bare except, the wrapped-and-lost stack trace, and the generic 500. Apply this whenever you reach for try/catch.
---

# Error Handling As Design

The error path is the contract you sign with your future on-call self. It is part of the design, not a wrapper around the design.

## The Discipline

Before writing the happy path, write down:

1. **What can go wrong.** Bad input. Missing permission. Conflict. Upstream timeout. Downstream DB failure. Malformed third-party response. Cancellation.
2. **How each surfaces.** What the caller sees: status code, error code, message. What the operator sees: log line, metric, alert.
3. **Whether it is the caller's fault or the system's.** That decides 4xx vs 5xx, retry or not, paging or silent.
4. **What state the system is in afterwards.** Partial writes, half-sent messages, in-flight locks. Plan the recovery.

The rest of this skill is what those decisions look like in practice.

## The Caller vs System Split

Every error belongs to one of two camps:

- **Caller's fault (4xx-ish).** Bad input, missing auth, wrong state, conflict. The system is fine; the caller asked for something invalid. Do not log at ERROR level (it is not an error of yours). Do not retry. Surface a stable error code the caller can branch on.
- **System's fault (5xx-ish).** Database down, upstream timed out, a bug. The caller did nothing wrong. Log at ERROR, page if it matters, return a generic message externally, retry if safe.

Mixing the two ("we 500'd because the user sent a bad email") is the most common mistake. It pages the on-call for nothing and trains them to ignore alerts.

## Stable Error Codes

Status codes (HTTP 4xx/5xx, exit codes, NACK reasons) are too coarse. Add a stable, documented error code per failure type:

```json
{
  "error": {
    "code": "INVENTORY_INSUFFICIENT",
    "message": "Item X has 2 in stock, you requested 5",
    "details": { "sku": "X", "available": 2, "requested": 5 }
  }
}
```

Rules:

- The `code` is stable across versions. Clients branch on it. Never reword without a deprecation.
- The `message` is for humans (logs, debug screens). Localize at the client.
- `details` is structured. No prose-with-placeholders that clients try to regex.
- Use the RFC 7807 (`application/problem+json`) shape when exposing HTTP errors externally. Internal services can use their own as long as it is consistent.

## Never Swallow

The single worst pattern in backend code:

```python
try:
    do_thing()
except Exception:
    pass  # we will handle this later
```

Every silent except is a future incident with no logs.

Rules:

- Catch only the exceptions you have a plan for. `except Exception` is a smell unless followed by a re-raise or a structured log.
- Every catch logs structured context (operation, identifiers, exception type) OR re-raises. There is no third option.
- A catch that translates an exception to another exception preserves the cause (`raise NewError(...) from e` in Python, `errors.Wrap` in Go, `cause` in JS).

## Validate at the Boundary

Validation lives at the system boundary (HTTP handler, message consumer, CLI argument parser). Once data is past the boundary, it is trusted by type. Sprinkling validation deep in the stack is duplication AND a lie: the deep code does not actually know what the caller sent, only what the boundary forwarded.

Concretely:

- HTTP: a schema (zod, pydantic, JSON Schema, etc.) at the handler entry. Reject with 400 and a stable code.
- Consumer: validate the message schema at the consumer entry, dead-letter or skip with audit on failure.
- CLI: argparse / clap / cobra at main. Internal functions assume parsed values.

After validation, types speak for themselves. No `if not x: raise` in the middle of business code for things the type already guarantees.

## Retries Belong at One Layer

Decide where retries live, and only retry there:

- For outbound calls: at the call site, with explicit policy (backoff, cap, jitter, idempotency key).
- For consumers: at the queue framework level, with explicit dead-letter rules.

Do not also retry one layer up. Stacked retries multiply: 3 attempts at the call, 3 at the consumer, 3 at the upstream cron is 27 calls per logical operation. That is how a flaky third party becomes a self-DDOS.

## Cancellations and Timeouts

Every outbound call has a timeout. The default is never "no timeout". Pick one based on what the caller is waiting for, and propagate cancellations:

- A 30s request deadline budgets the children. A DB call inside a 30s request gets, say, 5s, not 30s.
- In Go, this is `context.WithTimeout`. In Node, `AbortSignal`. In Python, asyncio's timeouts. Use them.
- A handler that aborts releases its DB locks. A handler that ignores cancellation holds them. Choose.

## Anti-Patterns

- **The catch-and-log-and-return-default.** Returns 0, [], or None on error. Callers cannot distinguish "no data" from "broken data". Fail loudly or do not catch.
- **The wrap-and-lose-stack.** `raise WrappedError(str(e))` loses the cause. Use the language's wrapping mechanism.
- **The same except block for client and system errors.** A 400-able validation error and a 500-able DB error end up in the same alert. Split them.
- **Returning errors via a side channel.** Setting `last_error` on the object, then forgetting to check it. Errors are values; return them or raise them.
- **HTTP handlers that read `e.message` and echo it to the user.** That leaks internals. The external message is generic; the operator sees the stack via logs.
- **Retry without backoff.** Tight retry loops on a degraded service are how partial outages become full ones.

## Quick Decision Guide

| Situation | Reflex |
|-----------|--------|
| Catching `Exception` | Justify in a comment, or narrow it |
| Caller sent bad input | 400 + stable error code, no ERROR log |
| Upstream timed out | 5xx (or retry queue), ERROR log with correlation IDs |
| Outbound call | Explicit timeout, idempotency key, single retry layer |
| Bare `except: pass` | Delete it |
| Validation deep in the stack | Move to the boundary |
| Returning a default on error | Return an error value or re-raise |
| Page-worthy error | Tag in the log so the alert can match |

## See also

- [[think-before-coding]] Step 3 invokes this skill
- [[idempotency-and-side-effects]] for retry safety
- [[observability-by-default]] for the metrics that detect these failures
