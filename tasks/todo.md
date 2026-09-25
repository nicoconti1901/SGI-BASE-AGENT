# Task List: SGI Base MVP

Source of truth: `SPEC.md` + `CAPABILITY-MAP.md` + `tasks/plan.md`.  
Mark tasks `[x]` only after acceptance criteria and verification pass.

---

## Task 1: Scaffold Next.js app + tooling

**Description:** Initialize the Next.js (App Router) + TypeScript project with ESLint, Prettier, Vitest, Playwright scripts, and folder layout from SPEC.

**Acceptance criteria:**
- [x] `npm run dev`, `npm run build`, `npm test`, `npm run lint` work
- [x] Directories `src/app`, `src/domain`, `src/lib`, `tests`, `e2e`, `prisma` exist

**Verification:**
- [x] `npm run build` succeeds
- [x] `npm test` runs (even if zero tests yet)

**Dependencies:** None  
**Files likely touched:** `package.json`, `tsconfig.json`, `src/app/layout.tsx`, config files  
**Estimated scope:** M

---

## Task 2: Prisma multi-tenant baseline + auth

**Description:** Add PostgreSQL/Prisma models for `Tenant`, `User`, membership/roles; integrate Better Auth (or document Auth.js fallback); seed one platform superuser via env.

**Acceptance criteria:**
- [x] Migrations apply cleanly
- [x] Superuser can sign in
- [x] Queries are tenant-scoped helpers (deny cross-tenant by default)

**Verification:**
- [x] Unit/integration test: two tenants cannot read each other’s rows
- [x] Manual: login as superuser

**Dependencies:** Task 1  
**Files likely touched:** `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/db.ts`, `tests/...`  
**Estimated scope:** M

---

## Task 3: Design tokens + shell skeleton

**Description:** Define CSS variables, typography, and a modern app shell (platform + tenant layouts) without purple-generic defaults.

**Acceptance criteria:**
- [ ] Tokens in `src/styles/`
- [ ] Empty platform layout and tenant layout render with distinctive visual identity
- [ ] Critical landmarks accessible (nav, main)

**Verification:**
- [ ] Manual visual check desktop + tablet width
- [ ] Build succeeds

**Dependencies:** Task 1  
**Files likely touched:** `src/styles/`, `src/app/(platform)/layout.tsx`, `src/app/(tenant)/layout.tsx`, shell components  
**Estimated scope:** M

---

## Task 4: ims-catalog — domain, seed, platform read UI

**Description:** Model ISO requirements (9001/14001/45001), essential vs scalable flags, seed essential set; platform UI to browse catalog.

**Acceptance criteria:**
- [ ] Seed loads essential requirements for three standards
- [ ] Domain helpers for lookup by standard/clause
- [ ] Superuser can list/filter catalog

**Verification:**
- [ ] Unit tests for seed invariants (no duplicate clause keys)
- [ ] Manual: catalog page shows seeded rows

**Dependencies:** Task 2, Task 3  
**Files likely touched:** `src/domain/ims/`, `prisma/`, `src/app/(platform)/catalog/`, `tests/`  
**Estimated scope:** M

---

## Task 5: tenant-provisioning — create tenant + essential template

**Description:** Superuser creates tenant (name, slug/URL, size, activity); system applies essential requirement template from catalog.

**Acceptance criteria:**
- [ ] Tenant created with unique slug
- [ ] Essential requirements assigned based on size + activity rules (documented defaults)
- [ ] Tenant reachable at configured path/subdomain strategy (path-based MVP OK)

**Verification:**
- [ ] Integration test: create tenant → template rows exist
- [ ] Manual: create tenant from platform UI

**Dependencies:** Task 4  
**Files likely touched:** `src/domain/tenant/`, `src/app/(platform)/tenants/`, `prisma/`  
**Estimated scope:** M

---

## Task 6: identity-access — tenant users + roles

**Description:** Tenant admin / superuser can invite users; assign roles; users sign in scoped to tenant.

**Acceptance criteria:**
- [ ] Invite + role assignment works for the five roles
- [ ] Middleware/session includes `tenantId` + role
- [ ] Viewer cannot mutate; contributor can limited writes (policy documented)

**Verification:**
- [ ] Authz unit tests per role
- [ ] Manual: invite user, login, see correct nav

**Dependencies:** Task 5  
**Files likely touched:** `src/lib/authz.ts`, `src/app/(tenant)/users/`, tests  
**Estimated scope:** M

---

## Checkpoint A: After Tasks 1–6

- [ ] All tests pass
- [ ] Build succeeds
- [ ] Flow: superuser login → create tenant → invite user → tenant login
- [ ] Human review before Phase 2

---

## Task 7: assessment-gap — superuser backoffice

**Description:** Superuser loads per-requirement status (missing/partial/compliant/N/A) and notes for a tenant; decide keep/replace/create hints.

**Acceptance criteria:**
- [ ] Gap form per tenant requirement
- [ ] Bulk save; audit of who changed what
- [ ] Domain function `decideDocumentFate` used

**Verification:**
- [ ] Unit tests for fate rules
- [ ] Manual: load gap for a tenant

**Dependencies:** Checkpoint A  
**Files likely touched:** `src/domain/assessment/`, `src/app/(platform)/tenants/[id]/gap/`, tests  
**Estimated scope:** M

---

## Task 8: document-control — docs + object storage

**Description:** Attach documents to requirements with versioning and validity; keep compliant client docs; upload to S3-compatible storage.

**Acceptance criteria:**
- [ ] Upload/download via storage adapter
- [ ] Version history; current version pointer
- [ ] Cannot overwrite `keep` docs without explicit superuser action

**Verification:**
- [ ] Integration test with storage mock
- [ ] Manual: upload PDF, link to requirement

**Dependencies:** Task 7  
**Files likely touched:** `src/lib/storage.ts`, `src/domain/documents/`, `src/app/(tenant)/documents/`, platform document tools  
**Estimated scope:** M

---

## Checkpoint B: After Tasks 7–8

- [ ] Tests pass; build succeeds
- [ ] Flow: gap loaded → document keep/replace/create works
- [ ] Human review before automation/ops

---

## Task 9: automation-offers — due engine + notifications

**Description:** Model due items (generic), offer catalog stub, activation per tenant; scheduled scan + email/in-app reminder for upcoming/overdue items. No undeclared automations.

**Acceptance criteria:**
- [ ] Create due item linked to entity (doc, indicator, action, etc.)
- [ ] Job scans and emits reminders
- [ ] Offer can be activated/deactivated per tenant
- [ ] Audit log of automation runs

**Verification:**
- [ ] Unit tests for due calculation / reminder windows
- [ ] Manual or job-dev: trigger scan, see notification

**Dependencies:** Checkpoint B  
**Files likely touched:** `src/domain/automation/`, `src/lib/jobs/`, email adapter, UI offers page  
**Estimated scope:** M

---

## Task 10: operations-core — NC + corrective actions

**Description:** Create/list nonconformities and corrective actions with owners and due dates (feeds due engine).

**Acceptance criteria:**
- [ ] CRUD NC + actions scoped to tenant
- [ ] Status workflow minimal (open → in_progress → closed)
- [ ] Due dates create due items when present

**Verification:**
- [ ] Domain + API tests
- [ ] Manual: create NC with action due date

**Dependencies:** Task 9 (or Task 8 if due items created eagerly; prefer Task 9)  
**Files likely touched:** `src/domain/operations/nc.ts`, tenant NC routes, tests  
**Estimated scope:** M

---

## Task 11: operations-core — risks, audits, indicators

**Description:** Minimal usable modules for risks, internal audits, and indicators (with due/measurement dates hooked to due engine).

**Acceptance criteria:**
- [ ] Each entity list + create/edit in tenant UI
- [ ] Indicators support target + last value + next measurement due
- [ ] Audits have planned date → due item

**Verification:**
- [ ] Tests for indicator due generation
- [ ] Manual smoke on three modules

**Dependencies:** Task 10  
**Files likely touched:** `src/domain/operations/`, tenant routes for risks/audits/indicators  
**Estimated scope:** M (split further in `/build` if needed)

---

## Checkpoint C: After Tasks 9–11

- [ ] Tests pass; build succeeds
- [ ] Due reminders work for at least docs/actions/indicators
- [ ] Human review before portal polish

---

## Task 12: client-portal — navigation + dashboards

**Description:** Modern tenant home: requirement compliance summary, upcoming due items, shortcuts to docs/ops; polish platform nav.

**Acceptance criteria:**
- [ ] Dashboard shows compliance counts + due list
- [ ] Nav covers documents, NC, risks, audits, indicators, automations
- [ ] Visual polish matches design tokens (non-generic)

**Verification:**
- [ ] Manual UI review
- [ ] Basic a11y check (keyboard to main nav)

**Dependencies:** Checkpoint C  
**Files likely touched:** `src/app/(tenant)/page.tsx`, dashboard components  
**Estimated scope:** M

---

## Task 13: E2E critical paths

**Description:** Playwright covers: superuser login → create tenant → load gap → upload doc → create NC with due → see due on dashboard (tenant user).

**Acceptance criteria:**
- [ ] E2E suite green in CI/local
- [ ] Uses test DB / isolated tenant slugs

**Verification:**
- [ ] `npm run test:e2e` passes

**Dependencies:** Task 12  
**Files likely touched:** `e2e/*.spec.ts`  
**Estimated scope:** M

---

## Checkpoint D: Ship readiness

- [ ] All prior checkpoints green
- [ ] `SPEC.md` success criteria reviewed against demos
- [ ] Env sample documented (`.env.example`) without secrets
- [ ] Human approval to deploy / start client onboarding

---

## Notes for `/build`

- Implement **one task at a time**; stop at checkpoints for human review.
- Prefer TDD on `src/domain/**`.
- Do not invent automation behaviors beyond Task 9 engine until an automation-spec is approved.
