---
description: Design a backend component (endpoint, worker, CLI, script, consumer, cron, integration) using the senior 6-step workflow before writing any code.
argument-hint: Brief description of the component you want to design
disable-model-invocation: false
---

# Backend Design

You are about to help the user design a backend component. Before any code, you run the 6-step workflow from the `think-before-coding` skill, adapted to the actual context.

Initial request: $ARGUMENTS

## Step 1: Establish context

The first thing you do is ask the user one question (or infer from the request, if obvious) to classify the component:

- HTTP endpoint (REST, GraphQL, RPC)
- Worker or background job
- Queue / event consumer (Kafka, SQS, Pub/Sub, webhook receiver)
- CLI or admin script
- ETL / batch pipeline
- Cron / scheduled task
- Outbound integration (calls a third party)
- Long-running daemon

The skeleton of the design depends on this. A REST endpoint and a Kafka consumer share principles but differ in everything else (latency model, failure model, scaling model). Do not assume "endpoint".

If the request is unambiguous, state your classification in one sentence and move on.

## Step 2: Run the 6 steps

Invoke the `think-before-coding` skill and walk through:

1. Identify the context (just confirmed).
2. Model the data (entities, invariants, lifecycle).
3. List the failure modes (specific to the context).
4. Map authorization (principal, scope, enforcement point).
5. Decide idempotence and concurrency (replay, concurrent, out-of-order).
6. Decide observability (logs, metrics, healthcheck, trace).

For each step, present the answer in a few lines, then ask one targeted question if you need a decision from the user. Do not ask "what do you want for error handling?" Ask "is the caller a UI that retries on its own, or a background job that we control?"

## Step 3: Write the blueprint

Once the six answers exist, write the blueprint yourself in this session (no subagent — you already hold the context): component summary, data model, failure modes with handling, authorization, idempotence/concurrency, observability, and an ordered build sequence.

Then ask the user to review the design. Do not start coding until they approve.

## Hard rules

- **Do not write code in this command.** This command produces a design. Implementation is a separate step.
- **Do not skip a step.** Even for "simple" components. The shorter the component, the shorter the answers, but every step gets an answer.
- **Do not propose a CRUD shape by default.** Many components are workflows, commands, or RPCs. Name the operation by what it does.
- **Adapt the questions to the context.** A CLI does not need RED metrics. A consumer does not need a healthcheck.

## After approval

Once the user approves the design, the next step is implementation. The implementation should follow the build sequence in the blueprint and should call out which sibling skills apply:

- Schema changes -> [[data-modeling-discipline]], [[migration-safety]]
- Queries -> [[query-discipline]]
- Mutations / side effects -> [[idempotency-and-side-effects]]
- Error path -> [[error-handling-as-design]]
- Instrumentation -> [[observability-by-default]]

Suggest the user open a separate session for implementation, or proceed in this one if scope is small.
