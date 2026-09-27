---
name: auth-and-authorization
description: Use when designing or modifying any auth flow, permission check, session, token issuance, multi-tenant data scope, or admin path. Forces explicit separation of authentication and authorization, decisions about enforcement layers, and treatment of tokens as bearer credentials. Apply this whenever you add an endpoint, a role, a scope, or a tenant boundary.
---

# Auth And Authorization

Auth is two systems, not one. Authentication identifies the caller. Authorization decides what the caller can touch. Conflating them ships flaws like "anyone with a valid token is admin" or "the route guard passed so the data layer trusts the body".

## The Discipline

For any change that touches auth, answer five questions:

1. **AuthN**: how does the system know who is calling, and what does it trust to know that. Cookie? Bearer token? Mutual TLS? Signed request?
2. **AuthZ**: what is this principal allowed to do, on which resources, in which scope (tenant, project, row).
3. **Enforcement point**: middleware, service, data layer (RLS), or several. Pick on purpose.
4. **Failure mode**: closed by default. A missing rule denies, never allows.
5. **Auditability**: every auth-relevant decision logs principal, scope, outcome, and trace ID.

If any of those are vague, you are about to ship a hole.

## AuthN: Identify The Caller

Pick the right mechanism for the relationship:

- **User in a web app**: server-side sessions, sliding expiry, absolute timeout. See [[boring-by-default]] for why sessions beat JWT here.
- **Mobile or single-page app calling your API**: session cookie (with proper CSRF protection) or short-lived bearer token with refresh rotation. Not "JWT forever".
- **Service-to-service inside your network**: mutual TLS, or short-lived service tokens with audience claims. Validate `iss`, `aud`, `exp`, `nbf` every time.
- **Third party calling your webhook**: signature header (HMAC over the body with a shared secret, or asymmetric per the provider). Constant-time compare. Reject replays via timestamp + nonce.
- **CLI or admin tool**: per-operator credential with an audit log of every action. No shared service account.

The mechanism is not the security; the discipline is. A session can be hijacked, a JWT can be stolen, mTLS can be misconfigured. The questions below apply to all of them.

## Session Management (Beyond "Sessions Over JWT")

Sessions are not free either.

- **Sliding expiry**: extends on activity, capped at an absolute maximum. A session that lives 60 days of activity from the last action should still die at 90 days absolute.
- **Absolute timeout**: every session has a hard end. Sensitive flows (admin, payments) have a tighter one.
- **Device / IP awareness**: at least track them. Diff between issuance and use is a signal, not a verdict.
- **Logout that actually logs out**: the session row is deleted, not just the cookie. A session-token-leak is mitigated by "kill on revoke".
- **Multiple sessions per user**: explicit policy. Allowed (with a list and a revoke), or one at a time. Pick.
- **CSRF**: for session cookies on state-changing requests, either same-site Lax with a doubled token, or per-form token. Decide once.

## Tokens Are Bearer Credentials

Whoever holds the token is the principal. Design accordingly.

- **Short-lived access tokens** (minutes), with refresh rotation. Each refresh issues a new refresh token and invalidates the previous one. Detection of replay is your sign a refresh was stolen.
- **Refresh token in a httpOnly secure cookie**, scoped to the auth endpoint. Not in localStorage.
- **Audience and issuer claims** validated on every check, not just signature.
- **Revocation list** at the auth server, checked at sensible cadence. "JWT is stateless" is the marketing line; "JWT is forgeable until expiry" is the reality.
- **Never in URLs**. Authorization header or cookie. URL parameters leak into proxies, logs, browser history, and Referer headers.

## OAuth2 Sanity

Most OAuth flaws are about choosing the wrong flow.

- **Authorization Code + PKCE** for any app, native or web. PKCE is no longer optional in 2026.
- **Implicit flow**: do not use. It is deprecated and leaks tokens via URL fragments.
- **Resource Owner Password Credentials**: do not use. Defeats the point of OAuth.
- **Client Credentials**: service-to-service only, never user-facing.
- **State parameter**: random, single-use, validated on callback. Without it, CSRF on the auth callback.
- **Redirect URI allowlist**: strict, prefix-matched with care. Wildcarded redirect URIs are how Account Takeover ships.

## AuthZ: Decide The Model

Three models, pick consciously.

**RBAC (role-based)**: roles map to permission sets. Good for small finite role taxonomies (`admin`, `editor`, `viewer`).

- Pros: simple, easy to audit, easy to explain.
- Cons: explodes when "viewer in this project, editor in that project" appears. Adding scope per role bloats the role list.

**ABAC (attribute-based)**: a policy evaluates attributes of (subject, resource, action, environment).

- Pros: handles "engineer can deploy if the change has approvals AND it is not Friday AND the env is staging".
- Cons: harder to audit. The policy engine becomes a system of its own.

**ReBAC (relationship-based)**: permissions follow graph relationships ("user owns project, project contains document, document is shared with user").

- Pros: maps to most product domains (shared docs, multi-tenant, social graphs). Zanzibar / SpiceDB / Permify style.
- Cons: requires a relationship store and an evaluator.

Default: start with **RBAC plus per-resource ownership checks at the data layer**. Move toward ReBAC when the relationship complexity makes RBAC bloat. ABAC only when policy variation needs it (regulatory, contextual).

## Enforcement Layers

A defense in depth, not "pick one".

- **Middleware**: rejects unauthenticated requests, attaches the principal. Coarse.
- **Service layer / handler**: knows the business context, enforces "can this principal do this action".
- **Data layer**: the last line. Row Level Security on Postgres, query-level tenant filter as a non-bypassable abstraction. Database scoping is what saves you when the service layer has a bug.

Multi-tenant by default belongs at the data layer. App filters fail open; the DB does not forget.

## Multi-Tenancy

For any data that belongs to a customer, a project, or a team:

- **Tenant column NOT NULL** on every row that has tenant data. See [[data-modeling-discipline]].
- **RLS policies** (Postgres) so a query without a tenant filter returns nothing. The DB is the floor.
- **Tenant in the principal context**, not in the request body. The caller never tells you which tenant they are; the auth says.
- **Cross-tenant operations are admin operations**: explicit, audited, scoped (no "any admin can see anyone"), time-bounded.
- **Impersonation logged**. When an admin operates as a tenant, every action is tagged with the real principal and the impersonated tenant.

## Anti-Patterns

- **Auth at the top, ignored at the bottom.** Route guard checks role; handler then does `Order.find(req.body.id)` without checking ownership. Common, exploited.
- **Trusting JWT claims as final truth.** Role claim in the token, never re-checked against the current user state. Demoted users keep admin powers until expiry.
- **`if user.is_admin` everywhere.** A scattered check is an unauditable check. Centralize.
- **Auth header in a query parameter "for convenience".** Tokens leak everywhere.
- **One service account for everything.** No per-operator accountability. First incident, no idea who did what.
- **CORS `*` with credentials.** The browser refuses; the developer reads `Allow-Credentials: false` and "fixes" it by going wider. The fix is the allowlist.
- **Login throttling per IP, not per account.** Credential stuffing distributes across IPs. Throttle per account too.
- **Forgot-password flow as the back door.** Tokens long-lived, account enumeration via the response, no rate limit. Often weaker than login itself.

## Quick Decision Guide

| Question | Default | Deviate when |
|----------|---------|--------------|
| User web auth | Server-side session, sliding + absolute timeout | Stateless edge, no central store |
| Mobile / SPA | Session cookie or short-lived bearer with refresh rotation | Pure stateless and short-lived |
| Service-to-service | mTLS or short-lived service tokens with audience | Single-instance trust domain |
| Webhook receive | Signed request, replay protection (timestamp + nonce) | Internal only |
| Authz model | RBAC + per-resource ownership at the data layer | ReBAC when the graph dominates |
| Multi-tenant enforcement | DB-level (RLS on Postgres) | Single-tenant or admin-only feature |
| Token location | Authorization header or httpOnly cookie | Never URL |
| Logout | Delete the session row, not just the cookie | Never just the cookie |
| Admin actions | Audited, time-bounded, scoped per resource | Never blanket admin |

## See also

- [[security-and-hardening]] for the surrounding security reflex
- [[boring-by-default]] for sessions over JWT and the OAuth defaults
- [[data-modeling-discipline]] for tenant columns and RLS
- [[think-before-coding]] Step 4 invokes this skill
- [[observability-by-default]] for auth audit logs
