---
name: boring-by-default
description: Use when choosing a database, queue, language, deployment shape, auth scheme, or any infrastructure piece. Forces a defense of complexity before adopting new technology. Reach for this whenever the answer involves "let's use" followed by a name you read on Hacker News this month.
---

# Boring By Default

Complexity compounds. Novelty depreciates. The job is not to pick the technology you would enjoy operating, it is to pick the technology your on-call self at 3am will thank you for.

## The Discipline

Before adopting a new piece of infrastructure (database, broker, language, framework, deployment model, auth library), answer in writing:

1. **What problem do we have that the current stack cannot solve?** Specifically. With numbers if possible.
2. **What is the cheapest extension of the current stack that solves it?** Often a column, an index, a job, or a config.
3. **What does this new thing cost us over five years?** Operationally: backups, upgrades, on-call expertise, hiring, runbooks, monitoring.
4. **Who runs it at 3am?** If the answer is "we will figure it out", the answer is no.

If the new thing wins all four questions, adopt it. Most of the time it does not.

## The Default Stack

Opinionated, defensible, dull. Deviations are justified, not free.

| Need | Default | Why |
|------|---------|-----|
| Relational data | Postgres | Does relational, JSON, queues, search, geo, partitioning. Most "we need Mongo" stories are "we did not know Postgres." |
| Queue | Postgres table + SKIP LOCKED | Until you cross thousands of messages per second. Then SQS / Kafka. |
| Cache | Redis (or skip it) | Most apps do not need a cache. They need indexes. |
| Search | Postgres FTS / pg_trgm | Until ranking and scale need Elastic / Meili. |
| Sessions vs JWT for user auth | Server-side sessions | JWT revocation is a pit. Sessions give a kill switch. |
| Background jobs | Same DB + a worker process | One store of truth. Outbox pattern uses the same DB. |
| File storage | Object storage (S3 / GCS / R2) | Never the application filesystem. |
| Inter-service comms | HTTP / gRPC, sync where simple | Async / event-driven adds debugging complexity. Earn it. |
| Service architecture | Monolith | A modular monolith beats most microservice setups in eng-years saved. |
| Public IDs | UUIDv7 | See [[data-modeling-discipline]]. |
| Schema migrations | Plain SQL files + a runner | Magic ORM migrations hide what the DB sees. |
| Deployment | Container on a managed platform | Until you measurably outgrow it. |

## Sessions Beat JWT By Default

For user-facing web auth:

- Sessions: revocation is "delete the row". Tied to a real user object on the server. Trivial to inspect.
- JWT: revocation is a research project. The token is a bearer credential anyone with the network path can replay until expiry.

Use JWT for service-to-service authentication and for short-lived, single-purpose tokens (password reset, email verify, signed download URLs). Use sessions for "logged-in users in a web app".

Deviate when: you are a fully stateless edge with no central store, or your auth needs cross-org SSO with explicit short-lived tokens (then OAuth/OIDC, not raw JWT you minted).

## The "But At Scale" Excuse

Most teams adopt complexity for a scale they will not reach for two years, then carry the operational tax for the years before and after. The boring stack handles more than people think:

- A single Postgres instance handles tens of thousands of writes per second with sensible schema.
- A Postgres `SKIP LOCKED` queue handles thousands of jobs per second.
- A single application monolith handles millions of users with horizontal scaling at the process level.

When you cross a real ceiling, you will know, because you will have numbers. Until then, scale is not a reason; it is a fantasy.

## The "But It's Cleaner" Excuse

A microservice per bounded context is cleaner on a whiteboard. It is debugging-across-three-repos-and-a-broker in practice. A separate datastore per type ("Mongo for the flexible bits, Postgres for the strict bits") is cleaner in theory. In practice, you cross-reference between them and end up reimplementing joins in code.

Clean architectures earn their cost. Earn it, or skip it.

## When To Deviate

You should leave the boring path when the boring path measurably costs more than the alternative. Concretely:

- The boring solution caps out and you have measurements. Not "we read it caps out", you have numbers from your system.
- The boring solution has been tried and failed for a reason you can articulate.
- A specific feature of the new tool is irreplaceable for your problem and has no boring equivalent.

"Our senior wants to learn it" and "the docs are nicer" are not reasons.

## Anti-Patterns

- **The two-database start.** Beginning a project with Postgres AND Mongo AND Redis. Each one adds a backup story, an upgrade story, a monitoring story, a runbook. Start with one. Add when you must.
- **The microservices-from-day-one.** Costs the team a year of velocity to spread one team across three repos. Start as a modular monolith. Split when a service actually outgrows the rest.
- **The JWT-for-everything reflex.** Used because "stateless is cleaner". Pay for it the day a user reports their account was compromised.
- **The custom queue.** Writing your own queue on Redis when SKIP LOCKED on Postgres or SQS exists. The custom one will lose messages eventually.
- **The framework chase.** Switching framework majors every 18 months. Each switch resets institutional knowledge.
- **The "we use the latest" badge.** Pre-1.0 dependencies in production. Read the release notes, then wait.

## Quick Decision Guide

| Proposal | Default response |
|----------|------------------|
| Add a second database | No, push back on the use case |
| Replace Postgres with X | Show me the numbers |
| Move to microservices | What is the eng-year cost vs the win |
| Adopt the new shiny framework | Wait one major version |
| Custom auth | Use an off-the-shelf library |
| Custom queue | Use SKIP LOCKED, then SQS, then Kafka |
| Switch language | Pick the language the team operates well |

## See also

- [[data-modeling-discipline]] for what Postgres can carry
- [[migration-safety]] for boring changes that are still dangerous
- [[think-before-coding]] for the workflow that catches premature complexity
