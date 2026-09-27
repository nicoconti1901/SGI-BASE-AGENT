---
name: observability-by-default
description: Use when building or modifying any backend component (endpoint, worker, consumer, CLI, cron, daemon), BEFORE the code ships. Forces structured logs, RED metrics, trace IDs, and real healthchecks so the component can be debugged at 3am without SSH. If you wrote a service-side component without this, it is not done.
---

# Observability By Default

If you cannot diagnose the component without a shell on the host, you have shipped a problem to your future on-call self. This is non-negotiable from day one. Adding observability after an incident is too late.

## The Discipline

Before code is merged, every component answers:

1. **What is happening right now?** Metrics tuned to the component type.
2. **What just happened?** Structured logs at the right level, with correlation.
3. **Is it healthy?** A check that actually exercises dependencies, not `return 200`.
4. **Where did this request come from, and where did it go?** A trace ID that propagates through every hop and every log line.

These are not "nice to have". They are part of "done".

## Structured Logs

JSON only. Free-text logs scale like sand.

Every log line carries:

- `level`: `debug` / `info` / `warn` / `error`.
- `timestamp`: ISO 8601 UTC.
- `service`, `version`, `environment`.
- `trace_id` and `span_id` (or equivalent).
- The operation context: `user_id`, `tenant_id`, `request_id`, `job_id`, `event_id`, whichever matter.
- A short `event` field describing the thing in past tense: `"invoice.created"`, `"payment.failed"`, `"job.dead-lettered"`. Not `"Processing..."`.

Discipline:

- Log at the boundary: entry, exit, failure. Not on every line of internal logic.
- One log line per business event. Multiple lines per event makes grep unreliable.
- Log levels mean something. `error` pages the on-call (or should). Do not log every 4xx at error.
- Never log PII or secrets. Card numbers, passwords, tokens, full emails depending on policy. Use field redaction at the logger, not "I will remember to redact this".

## Metrics: Pick The Right Four

The component type decides the metrics.

**Sync request handlers (HTTP, gRPC, RPC) -> RED:**

- **Rate**: requests per second, labeled by route and method.
- **Errors**: 5xx rate and error code distribution.
- **Duration**: histogram, watch p50, p95, p99.

**Workers and queue consumers -> queue health:**

- **Lag**: seconds since the oldest unconsumed message.
- **Throughput**: messages processed per second.
- **Retry rate**: percent of messages that retried at least once.
- **Dead-letter rate**: messages that gave up.

**Cron and batch jobs:**

- **Last success timestamp**: when did this last finish cleanly. Alert when it falls behind expected interval.
- **Duration**: total runtime per execution.
- **Rows processed**: rate and total.
- **Exit code distribution**: clean exits vs failures.

**Outbound integrations:**

- **Call rate** per remote, per endpoint.
- **Error rate by remote status code**: 4xx vs 5xx vs timeout.
- **Latency p95/p99** per remote. Their slowness becomes yours.

Default reflex: if you cannot draw a dashboard for this component without writing new instrumentation, you are not done.

## Trace IDs

A request lands. It writes to DB. It enqueues a job. The job calls a third party. Each hop must carry the same `trace_id`. Each log line must include it. Without this, an incident is 50 disconnected log streams.

Mechanism:

- Inbound: read `traceparent` (W3C) or your provider's header. If missing, generate one.
- Internal: pass it on every internal call (DB query log, queue message, function context).
- Outbound: send it on every external call.

Use OpenTelemetry or whatever the org standardizes on. The thing that matters is one ID end to end. Do not invent a new one per layer.

## Healthchecks That Actually Check

`return 200` is not a healthcheck. It tests the framework, not the system.

A healthcheck exercises the dependencies the component needs:

- A DB query that hits the DB (cheap, like `SELECT 1` plus a connection-pool stat).
- A cache ping.
- A broker ping if the service publishes or consumes.

Split liveness and readiness:

- **Liveness**: "this process is not deadlocked". Almost always trivial. Recycle the pod if it fails.
- **Readiness**: "this process can serve traffic". Includes dependency checks. Pull the pod from load balancer if it fails.

A degraded readiness with a healthy liveness is what you want during a dependency blip. Restarting the pod is the wrong cure.

## Correlate To The User Story

Logs and metrics are read in two modes: aggregate (dashboards, alerts) and detail (one user complained). For detail mode, you need to query by an identifier the user knows: their account ID, an order number, an invoice ID. Make sure every log line touching that entity carries the identifier.

The hard rule: an operator should be able to take a single user-visible identifier and reconstruct what happened to them across all components.

## Anti-Patterns

- **`print` / `console.log` in production code.** Unstructured, no level, no metadata. Strip them.
- **One log line per loop iteration.** Floods storage and obscures the signal. Aggregate, sample, or move to a metric.
- **Metric explosion via labels.** Putting `user_id` as a label creates one time series per user. Storage costs explode. High-cardinality goes in logs, not metrics.
- **Log-everything-just-in-case.** Storage and signal both suffer. Log boundaries and failures, not internal steps.
- **The healthcheck that always returns 200.** Useless. The pod is happy while the DB is on fire.
- **No alert without a runbook.** Every page must point to a runbook. An untriaged alert is technical debt.

## Quick Decision Guide

| Component | Required metrics | Logs at | Healthcheck |
|-----------|------------------|---------|-------------|
| HTTP endpoint | RED per route | entry, exit, failure | DB ping + readiness flag |
| Worker / consumer | lag, throughput, retry, DLQ | per message: start, end, failure | broker reachable + DB ping |
| Cron / batch | last success, duration, rows, exit | start, end, summary | usually n/a |
| Outbound integration | call rate, error by code, p95 | per call: outbound, response status | remote reachable on a low-cost endpoint |
| Long-running daemon | uptime, dependency state | per state transition | dependency check |

## See also

- [[think-before-coding]] Step 6 invokes this skill
- [[error-handling-as-design]] for what to log and at what level
- [[idempotency-and-side-effects]] for replay and dedup metrics
