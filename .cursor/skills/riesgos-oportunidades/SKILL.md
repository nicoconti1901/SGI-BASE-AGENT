---
name: riesgos-oportunidades
description: Expert skill for researching, designing, implementing and operating
risk and opportunity management specifically according to ISO 9001,
with priority on ISO 9001:2026 clauses 6.1.1, 6.1.2 and 6.1.3.
Designed to create an intelligent operational tool for organizations
of different sizes and sectors. Separates ISO 9001 risks from
opportunities, avoids generic risk-register UX, uses evidence,
process context, actions, effectiveness, review triggers and
continuous improvement. ISO 45001 is handled separately; only shared
technical concepts such as owners, actions, evidence, dates and
effectiveness may be reused.
---

---

# ISO 9001 — RISK & OPPORTUNITY MANAGEMENT SKILL

## 0. PURPOSE

This skill exists to design, evaluate or implement a professional
risk-and-opportunity management capability for organizations using
ISO 9001.

The skill MUST prioritize:

1. Correct interpretation of ISO 9001 requirements.
2. Correct distinction between risks and opportunities.
3. Practical usability for real organizations.
4. Traceability from context/processes/objectives to risks/opportunities.
5. Explicit planning and execution of actions.
6. Effectiveness evaluation.
7. Continuous review.
8. Audit-ready evidence.
9. Adaptability to organization size, sector, maturity and complexity.
10. Progressive complexity without forcing unnecessary bureaucracy.

The skill MUST NOT assume that an organization needs a generic corporate
enterprise-risk-management system.

The target is an ISO 9001 Quality Management System.

The central question is:

"What could prevent or help the QMS achieve its intended results,
and what should the organization deliberately do about it?"

---

# 1. NORMATIVE RESEARCH GATE

Before designing any logic, UX, workflow, data model or implementation,
the agent MUST perform fresh research.

DO NOT rely exclusively on model knowledge.

DO NOT rely on generic ISO articles.

DO NOT assume ISO 9001:2015 is the current edition.

## 1.1 Current edition

The research MUST establish the currently applicable ISO 9001 edition
at execution time.

As of this skill's creation in September 2026:

ISO 9001:2026 is the current edition.

ISO 9001:2015 is historical/transition material.

The agent MUST support legacy organizations transitioning from 2015
when relevant, but MUST NOT design the new capability as if 2015 were
still the current normative baseline.

## 1.2 Mandatory source hierarchy

Use sources in this order:

### Tier 1 — Normative / ISO authority

1. ISO 9001 current edition.
2. ISO official page for the standard.
3. ISO Online Browsing Platform.
4. ISO/TC 176/SC 2 materials.
5. ISO 9001 Auditing Practices Group.
6. ISO implementation guidance.
7. ISO 9000 vocabulary when terminology is needed.

### Tier 2 — National standards bodies

Use relevant material from:

- AENOR / UNE;
- BSI;
- Standards Australia;
- Standards New Zealand;
- AFNOR;
- DIN;
- UNI;
- SIS;
- NEN;
- ISO member bodies in Asia, Latin America, Africa and North America.

### Tier 3 — Major certification / assurance organizations

Cross-check practical interpretation against organizations such as:

- NQA;
- LRQA;
- DNV;
- SGS;
- Bureau Veritas;
- TÜV organizations;
- Intertek;
- other recognized certification bodies.

These are guidance sources, NOT the ISO requirement itself.

### Tier 4 — Academic / professional evidence

Use:

- peer-reviewed research;
- university repositories;
- quality-management journals;
- professional quality organizations.

### Tier 5 — Company cases

Use public case studies from organizations that describe
ISO 9001 implementation and risk/opportunity practices.

Company examples are evidence of practice, NOT normative requirements.

---

# 2. SOURCE RESEARCH RULES

Every substantive normative claim must have a source.

The agent MUST maintain a research ledger:

| Source | Country | Type | Edition | Relevant clause | Use |
| ------ | ------- | ---- | ------- | --------------- | --- |

Classify each statement as:

- NORMATIVE
- OFFICIAL GUIDANCE
- CERTIFICATION-BODY GUIDANCE
- ACADEMIC EVIDENCE
- COMPANY PRACTICE
- MODEL INFERENCE

Never present COMPANY PRACTICE as an ISO requirement.

Never present a certification body's recommended template
as mandatory ISO documentation.

Never state that an assessment method is "required by ISO"
unless the current standard explicitly requires it.

---

# 3. COPYRIGHT / NORMATIVE TEXT

Do not reproduce large portions of ISO standards.

Do not build the system by copying normative text.

Use:

- paraphrases;
- requirement references;
- short quotations only where legally appropriate;
- links to official sources.

The actual licensed standard remains the authoritative source.

---

# 4. ABSOLUTE PRINCIPLE

ISO 9001 does NOT mean:

"Make a risk matrix."

It means the organization needs to determine, analyze/evaluate
as applicable to the current edition, plan actions, integrate those
actions into the QMS and evaluate their effectiveness.

The software must therefore model:

CONTEXT
→ DETERMINATION
→ ANALYSIS
→ EVALUATION
→ DECISION
→ ACTION
→ IMPLEMENTATION
→ EFFECTIVENESS
→ REVIEW
→ CONTINUOUS IMPROVEMENT

Do NOT reduce this to:

risk
→ score
→ color
→ close

---

# 5. ISO 9001:2026 RISK / OPPORTUNITY SEPARATION

Treat:

RISK

and

OPPORTUNITY

as separate semantic objects.

They MAY share technical infrastructure.

They MUST NOT be treated as the same object with:

type = positive / negative

Do not implement:

Risk {
direction: positive | negative
}

as the core business abstraction.

Instead use:

Risk
and

Opportunity

with separate lifecycle semantics.

## 5.1 Risk

A risk represents an uncertainty that can produce an undesirable
effect on the organization's/QMS's intended results.

The tool must help the organization determine:

- what may happen;
- why it may happen;
- what could be affected;
- how it could affect intended QMS results;
- how relevant/significant the risk is under the organization's
  selected method;
- what the organization will do;
- who owns the response;
- when the response must occur;
- whether the response worked;
- whether the exposure changed.

## 5.2 Opportunity

An opportunity is NOT:

"a risk with positive impact."

The opportunity lifecycle must independently answer:

- what favorable circumstance exists;
- what desired effect could result;
- why it matters;
- what capability/value could be created;
- what is required to pursue it;
- whether the organization decides to pursue it;
- what actions are needed;
- who owns them;
- what benefit is expected;
- what actually happened;
- whether the action was effective;
- whether the opportunity should remain active, be paused or be closed.

---

# 6. ISO 9001:2026 CLAUSE MODEL

The skill MUST structure the capability around:

## 6.1.1 — Determining risks and opportunities

The system should help organizations determine what needs to
be addressed based on relevant QMS context.

Research and consider as inputs:

- internal issues;
- external issues;
- interested parties;
- relevant requirements;
- QMS scope;
- processes;
- strategic direction;
- QMS objectives;
- performance information;
- changes;
- complaints;
- nonconformities;
- audits;
- supplier performance;
- process performance;
- customer feedback;
- relevant market/context changes.

Do not assume every input must generate a risk.

Inputs are sources of consideration.

The tool must distinguish:

SOURCE
from
RISK/OPPORTUNITY IDENTIFIED.

This distinction is essential.

Example:

External Issue:
"High volatility in imported raw material availability."

Possible result:

Risk:
"Supply interruption affecting delivery commitments."

Possible separate result:

Opportunity:
"Developing qualified local alternatives may reduce dependency
and improve lead-time flexibility."

One source may produce:

- a risk;
- an opportunity;
- both;
- neither.

The software MUST support all four.

---

# 7. SOURCE-TO-ITEM CREATION

Create a guided mechanism:

"Explore context"

rather than beginning with:

"Add risk."

The user should be able to start from:

- context issue;
- process;
- stakeholder;
- customer requirement;
- QMS objective;
- indicator;
- supplier;
- audit result;
- finding;
- complaint;
- change;
- incident;
- management review input;
- previous risk review.

Then the tool asks:

"Does this situation create an uncertainty that could negatively
affect the intended QMS results?"

or:

"Does this situation create a favorable circumstance that could
positively affect intended QMS results?"

The result may become:

Risk
Opportunity
Risk + Opportunity
Information only

---

# 8. RISK CANVAS

Do NOT present the user with a giant form.

Create a guided Risk Canvas.

Minimum logical components:

### Context

- Source
- Process
- Site / organizational area
- Interested party
- Objective or intended result
- Trigger/event
- Date identified
- Identified by

### Risk statement

Capture a structured relationship:

CAUSE
→ EVENT / UNCERTAINTY
→ EFFECT

Do not force users to write perfect prose.

Example:

CAUSE:
single qualified supplier

EVENT:
supplier interruption

EFFECT:
production delay

### Consequence

What intended result could be affected?

Examples:

- conformity of product/service;
- delivery;
- customer satisfaction;
- process effectiveness;
- QMS objective;
- regulatory/customer requirement;
- resource availability;
- operational continuity.

These are examples, NOT an exhaustive mandatory taxonomy.

### Existing controls

Capture what is already done.

Distinguish:

Existing control

from:

Planned action

This prevents the system from pretending that planned controls
already exist.

---

# 9. RISK ASSESSMENT ENGINE

The engine MUST be methodology-agnostic.

ISO 9001 does NOT require a universal:

5 × 5 matrix
or
FMEA
or
RPN.

The organization must be able to choose an appropriate method
according to context.

Support at minimum:

### Method A — Qualitative

Examples:

- Low
- Moderate
- High
- Critical

### Method B — Probability × Impact

Configurable scales.

### Method C — FMEA-inspired

Allow:

- severity;
- occurrence;
- detectability.

But clearly label FMEA as an organizational method,
not an ISO 9001 requirement.

### Method D — Scenario-based

Useful where numerical probability is unreliable.

### Method E — Custom tenant method

The organization may define:

- criteria;
- scales;
- thresholds;
- decision rules.

But the system MUST prevent completely unstructured assessments
where the organization claims an evaluation exists but no reasoning
or criteria are recorded.

---

# 10. ASSESSMENT VERSIONING

Never overwrite historical assessments.

Model:

Assessment 1
→ Assessment 2
→ Assessment 3

Each assessment must preserve:

- date;
- assessor;
- methodology;
- criteria/version;
- input values;
- result;
- rationale;
- context;
- linked evidence.

Never silently mutate historical scores.

If methodology changes:

Assessment A
using Method V1

must remain interpretable.

---

# 11. INHERENT VS CURRENT / RESIDUAL ASSESSMENT

Do not force "inherent risk" and "residual risk" terminology
on every organization.

The tool may support:

Initial exposure
Current exposure
Post-action exposure

or:

Inherent
Residual

as configurable terminology.

The underlying logic is:

BEFORE RESPONSE
→ AFTER RESPONSE

If an organization uses only a single qualitative state,
do not force artificial residual calculations.

---

# 12. RISK RESPONSE

The response must be a deliberate decision.

Support organizational strategies such as:

- avoid;
- reduce;
- transfer/share;
- accept/retain through informed decision;
- other organization-defined strategy.

The exact available vocabulary must be configurable.

The key record is:

DECISION +
RATIONALE +
RESPONSIBLE OWNER +
PLANNED RESPONSE.

Do not make the software automatically choose a treatment strategy.

The software may recommend questions.

It must not silently make management decisions.

---

# 13. ACTIONS

A risk does NOT become managed because it has a status of:

"Open."

A risk response requires action management when action is needed.

Every planned response should be able to define:

- action;
- owner;
- start date;
- due date;
- dependencies;
- resources;
- priority;
- expected result;
- evidence required;
- status;
- completion date.

Where the organization's process already has a common Action model,
reuse it.

Do not create:

RiskAction

as a separate universe.

---

# 14. ACTION EFFECTIVENESS

Critical distinction:

ACTION COMPLETED
≠
ACTION EFFECTIVE

The software must therefore have separate states.

Example:

Action:
"Qualify second supplier."

Result:
Completed.

Effectiveness:
Still under evaluation.

Later:

Supplier disruption simulation / monitoring
shows response works.

Effectiveness:
Effective.

This distinction should be visible in the UI.

---

# 15. RISK REVIEW ENGINE

Risk review MUST NOT depend only on:

"review every 12 months."

Support multiple review triggers:

### Time based

- monthly;
- quarterly;
- semiannual;
- annual;
- custom.

### Event based

- major process change;
- supplier change;
- new product/service;
- customer complaint;
- nonconformity;
- audit finding;
- significant performance deterioration;
- technology change;
- organizational change;
- external context change;
- incident;
- change in legal/customer requirements.

### Performance based

Trigger review when:

indicator threshold exceeded;
trend deteriorates;
objective deviates;
control fails.

The tool should therefore support:

REVIEW TRIGGER
rather than only:

NEXT REVIEW DATE.

---

# 16. RISK STALENESS

A risk may be "open" but still be unmanaged because its analysis
is obsolete.

Detect:

- outdated assessment;
- expired action;
- no review after material change;
- owner inactive;
- evidence stale;
- no effectiveness assessment;
- control no longer applicable;
- risk linked to obsolete process/objective.

This creates a:

"Stale Risk"

state or signal.

---

# 17. OPPORTUNITY CANVAS

Do NOT reuse the Risk Canvas by replacing red with green.

Create a distinct Opportunity Canvas.

### Source

Where did the opportunity emerge?

- context;
- interested party;
- customer feedback;
- process performance;
- technology;
- supplier;
- organizational capability;
- employee knowledge;
- audit;
- indicator;
- strategic initiative;
- market development.

### Desired effect

What beneficial result could happen?

Examples:

- improved customer satisfaction;
- shorter delivery time;
- reduced waste;
- improved process capability;
- new service;
- improved reliability;
- better digital interaction;
- stronger supplier relationship;
- new market;
- improved productivity.

### Opportunity hypothesis

Structure:

CURRENT CONDITION
→ FAVORABLE CIRCUMSTANCE
→ POTENTIAL BENEFIT

### Analysis

Evaluate:

- expected benefit;
- effort;
- capability;
- resources;
- dependencies;
- timing;
- uncertainty;
- strategic relevance;
- effect on QMS results.

Do not force every factor for every opportunity.

---

# 18. OPPORTUNITY DECISION

Every opportunity should reach one of these organizational decisions:

- pursue now;
- pursue later;
- monitor;
- investigate further;
- do not pursue;
- closed.

When not pursued, preserve:

DECISION +
RATIONALE.

This is extremely important.

A mature opportunity system must preserve not only what the organization
did, but what it deliberately decided NOT to do.

---

# 19. OPPORTUNITY ACTION

For pursued opportunities:

Opportunity
→ decision
→ action plan
→ implementation
→ benefit realization
→ effectiveness/result
→ review

Do not close an opportunity just because:

"action completed."

The tool must capture whether the expected benefit occurred.

---

# 20. BENEFIT REALIZATION

Opportunity effectiveness should allow:

Expected benefit
vs
Observed result.

For example:

Expected:
20% reduction in processing time.

Actual:
14%.

The system should show:

Expected
14% achieved
Gap
Follow-up decision

Do not mark "effective" purely from action completion.

---

# 21. OPPORTUNITY PIPELINE

Create a portfolio view:

DISCOVERED
→ ANALYZING
→ EVALUATED
→ PURSUING
→ IMPLEMENTING
→ BENEFIT REVIEW
→ REALIZED
→ CLOSED

This is different from the Risk lifecycle.

---

# 22. RISK LIFECYCLE

Suggested model:

IDENTIFIED
→ ANALYZING
→ EVALUATED
→ RESPONSE PLANNED
→ IMPLEMENTING
→ EFFECTIVENESS REVIEW
→ MONITORED
→ CLOSED

The organization may retain a risk instead of eliminating it.

Therefore:

CLOSED
does not always mean:
"risk disappeared."

It may mean:

- no longer relevant;
- transferred to another governance mechanism;
- absorbed by another process;
- transformed by change;
- intentionally retained under defined conditions.

Preserve historical reasoning.

---

# 23. COMMON MANAGEMENT INFRASTRUCTURE

Risk and Opportunity may share:

- owner;
- responsible area;
- site;
- process;
- source;
- objectives;
- interested parties;
- actions;
- evidence;
- review dates;
- audit references;
- management review references;
- status history;
- notifications;
- permissions;
- attachments;
- comments/decisions;
- timestamps;
- audit trail.

But they MUST retain different business semantics.

---

# 24. PROCESS-FIRST MANAGEMENT

The primary view should NOT be:

"All risks."

The primary operational view should be:

"Where in the organization are uncertainties affecting the QMS?"

Provide lenses such as:

### Process lens

Sales
Design
Purchasing
Production
Delivery
Maintenance
Customer service

etc.

### Objective lens

Which risks/opportunities affect each objective?

### Stakeholder lens

Which uncertainties arise from important interested parties?

### Supplier lens

Which suppliers generate exposure or opportunity?

### Customer lens

Which issues could affect satisfaction or conformity?

### Change lens

What risks/opportunities emerged from changes?

### Site lens

What applies to each location?

### Review lens

What requires attention now?

---

# 25. INNOVATIVE FEATURE — RISK / OPPORTUNITY MAP

Create an interactive map of the organization.

Do not make it a traditional heat map.

Show:

PROCESS
↓
OBJECTIVE
↓
RISK / OPPORTUNITY
↓
ACTION
↓
EFFECTIVENESS
↓
RESULT

Users should be able to navigate from a business process
into the reasoning behind risk/opportunity decisions.

The visualization is not the source of truth.

The underlying records are.

---

# 26. INNOVATIVE FEATURE — "WHY?"

Every item should have a visible reasoning chain.

For a risk:

WHY IS IT HERE?
↓
Source
↓
Cause
↓
Potential event
↓
Affected result
↓
Assessment
↓
Decision
↓
Action
↓
Evidence
↓
Effectiveness

For an opportunity:

WHY DOES IT MATTER?
↓
Source
↓
Favorable circumstance
↓
Desired result
↓
Analysis
↓
Pursuit decision
↓
Action
↓
Benefit
↓
Observed result

This is much more valuable than a status table.

---

# 27. INNOVATIVE FEATURE — "WHAT CHANGED?"

When a user opens a risk/opportunity, show:

SINCE LAST REVIEW:

- assessment changed;
- process changed;
- objective changed;
- control changed;
- action overdue;
- performance changed;
- evidence added;
- owner changed;
- external source changed.

The user should not need to manually compare records.

The application should produce a change summary from actual historical data.

---

# 28. INNOVATIVE FEATURE — REVIEW ROOM

Create a guided review experience.

Instead of:

"Edit Risk"

use:

"Review Risk"

The screen presents:

1. Current situation.
2. What changed.
3. Current assessment.
4. Existing controls.
5. Planned actions.
6. Action effectiveness.
7. Relevant indicators.
8. Relevant findings/audits.
9. New evidence.
10. Review decision.

Possible decision:

KEEP
UPDATE
REASSESS
CLOSE
ESCALATE
TRANSFER TO ANOTHER MANAGEMENT MECHANISM

The actual decision belongs to the organization.

---

# 29. INNOVATIVE FEATURE — DISCOVERY ASSISTANT

Provide a guided interview for risk/opportunity discovery.

The assistant asks questions based on context.

For example:

### Process mode

"What can cause this process to fail to produce its intended result?"

"What has changed recently?"

"Where is variation appearing?"

"What depends on a single supplier?"

"What customer expectation is changing?"

"What capability is missing?"

"What recent finding suggests a recurring issue?"

### Opportunity mode

"What is currently changing that could benefit the organization?"

"Where are customers asking for something new?"

"Which process improvement could produce a measurable benefit?"

"Which technology could improve the intended result?"

"What existing capability is underused?"

The assistant may propose candidate items.

It MUST NOT automatically create or approve them.

User confirmation is required.

---

# 30. DUPLICATE DETECTION

Two risks describing the same underlying condition should not become
separate records accidentally.

Provide similarity detection based on:

- process;
- source;
- causes;
- event;
- affected objective;
- existing controls;
- semantic similarity.

Show:

"Potential duplicate."

Do not automatically merge.

---

# 31. RELATIONSHIP MODEL

Allow explicit relationships to:

- Process;
- QMS Objective;
- Indicator;
- Interested Party;
- Requirement;
- Supplier;
- Customer;
- Change;
- Finding;
- Audit;
- Control;
- Evidence;
- Corrective Action;
- Management Review.

Links must NOT imply automatic status propagation unless an explicit
business rule exists.

Example:

Risk → Finding

does NOT automatically mean:

Finding = cause of Risk.

The UI must clearly distinguish:

CAUSE
SOURCE
CONTEXT
RELATED
EVIDENCE

---

# 32. ACTION LINKING

A risk/opportunity may lead to action.

The action may also originate elsewhere.

Support:

Risk
→ existing Action

Opportunity
→ existing Action

without automatically duplicating it.

Example:

One supplier improvement action may address:

- supply-chain risk;
- delivery objective;
- customer satisfaction opportunity.

One action may serve multiple justified contexts.

The action should remain one action.

---

# 33. FINDING / NONCONFORMITY RELATIONSHIP

A finding can provide evidence for a risk review.

A risk can lead to a proactive action.

But:

Risk ≠ Finding
Finding ≠ Risk

Do not automatically create Findings from high risk.

Do not automatically create Risks from every Finding.

Allow explicit conversion/linking with traceability.

---

# 34. OBJECTIVE INTEGRATION

Risk and opportunity management must connect to QMS objectives.

Example:

Objective:
Improve on-time delivery from 92% to 97%.

Risk:
Supplier interruptions may prevent target achievement.

Opportunity:
Supplier collaboration may enable improved lead-time stability.

The tool should show both relationships.

Do not force every risk/opportunity to have an objective.

But require justification when organizational policy says an item must
be connected to a strategic/QMS objective.

---

# 35. INDICATOR INTEGRATION

Use indicators to trigger reassessment.

Example:

OTD < 95%
→ risk review trigger.

Customer complaints ↑
→ review selected risks.

Process capability ↓
→ inspect related risks.

Opportunity benefits below target
→ opportunity effectiveness review.

The software should support configurable trigger rules.

Do NOT build an AI model that autonomously determines organizational risk.

---

# 36. EVIDENCE

Every important assessment/review should be able to answer:

"What evidence supported this decision?"

Possible evidence:

- KPI;
- report;
- audit;
- document;
- customer feedback;
- supplier evaluation;
- meeting decision;
- inspection;
- process measurement;
- change record.

The evidence must be traceable.

Do not allow a user to attach arbitrary files as the only evidence
of a decision when structured evidence already exists.

---

# 37. AUDITABILITY

For each risk/opportunity, an auditor should be able to reconstruct:

WHY was it identified?

FROM WHERE?

WHO evaluated it?

WHEN?

WHAT criteria were used?

WHAT was decided?

WHAT action was planned?

WHO owned the action?

WHEN was it due?

WHAT happened?

WAS it effective?

WHAT changed afterward?

This is a core product objective.

---

# 38. DOCUMENTED INFORMATION

Do NOT assume that ISO requires a document called:

"Risk Matrix."

The software should create evidence of management.

Possible outputs:

- risk register;
- opportunity register;
- process risk report;
- review report;
- opportunity pipeline;
- action status;
- effectiveness report;
- audit evidence pack.

The organization chooses what needs to be formally retained.

The system itself is part of the documented evidence environment.

---

# 39. REVIEW CALENDAR

Create a unified review engine:

TODAY
THIS WEEK
OVERDUE
NEXT 30 DAYS
NEXT 90 DAYS

Classify:

Risk reassessment
Opportunity review
Action due
Effectiveness due
Evidence renewal
Management review input

Do not force a fixed annual cadence.

---

# 40. ESCALATION LOGIC

Examples:

Action overdue:
→ owner notification.

High-priority risk unreviewed:
→ responsible manager.

Effectiveness failed:
→ reopen/reassess.

Opportunity benefit below threshold:
→ review decision.

Repeated failed treatment:
→ escalate.

Do not escalate based only on color.

Escalation rules must use explicit conditions.

---

# 41. RISK EFFECTIVENESS

The system should distinguish:

### Action effectiveness

"Did the action work?"

from:

### Risk status

"Does the risk still matter?"

These are not identical.

An action can be effective while the risk remains relevant.

Example:

Risk remains high-context,
but mitigation reduced exposure.

Do not close the risk automatically.

---

# 42. OPPORTUNITY EFFECTIVENESS

Similarly:

Action completed
≠ benefit achieved.

Track:

Expected benefit
→ actual result
→ variance
→ explanation
→ next decision.

---

# 43. RISK / OPPORTUNITY STATUS MODEL

Never reduce the state to a colored cell.

Use separate dimensions:

### Lifecycle state

Where am I?

### Priority / evaluation

How significant is it?

### Action health

Is the response progressing?

### Effectiveness

Did it work?

### Review health

Is the assessment current?

This is a major UX principle.

---

# 44. ORGANIZATIONAL SIZE

The same domain must support:

## Small company

Simple mode:

- guided questions;
- few fields;
- qualitative assessment;
- action owner;
- due date;
- evidence;
- review.

## Medium company

Intermediate mode:

- process lenses;
- configurable scales;
- multiple owners;
- indicators;
- reassessment;
- review triggers.

## Large company

Advanced mode:

- multiple sites;
- business units;
- multiple methodologies;
- delegated assessments;
- complex approval rules;
- reporting;
- trend analysis;
- portfolio analysis;
- controlled vocabularies;
- integration with objectives, processes and audits.

Complexity should increase by demonstrated need,
not employee count alone.

---

# 45. MATURITY MODEL

Support progressive maturity.

### LEVEL 1 — BASIC

Determine
→ assess
→ act
→ review

### LEVEL 2 — CONTROLLED

Add:

- process context;
- objectives;
- evidence;
- residual/current assessment;
- review calendar.

### LEVEL 3 — INTEGRATED

Add:

- indicators;
- audits;
- findings;
- suppliers;
- customer feedback;
- changes;
- management review.

### LEVEL 4 — ADVANCED

Add:

- trigger-driven reassessment;
- trends;
- scenario analysis;
- opportunity portfolio;
- benefit realization;
- cross-site comparison;
- strategic linkage.

Never hide required functionality merely because a tenant has a
lower commercial subscription.

Maturity controls complexity.

---

# 46. TENANT CONFIGURATION

Allow configuration of:

- terminology;
- assessment methods;
- scales;
- thresholds;
- review frequencies;
- notification thresholds;
- required relationships;
- mandatory evidence;
- roles;
- approval requirements.

But protect the underlying domain semantics.

A tenant may rename:

"Risk owner"

to:

"Responsable de riesgo"

but must not redefine Risk to mean Finding.

---

# 47. REQUIRED FIELDS SHOULD BE CONTEXTUAL

Do not make every field mandatory.

For example:

A strategic risk may need:

- objective;
- business process;
- impact.

An operational risk may need:

- process;
- control;
- measurement.

An opportunity may require:

- benefit hypothesis;
- feasibility rationale.

Use contextual requirements.

Avoid the 40-field "ISO form".

---

# 48. DATA QUALITY ENGINE

Detect:

- risks without owner;
- opportunities without decision;
- actions without owner;
- overdue actions;
- items with obsolete assessments;
- risks without any response;
- opportunities pursued without action;
- actions marked complete without effectiveness review;
- duplicate risks;
- duplicate opportunities;
- evidence older than the assessment;
- orphaned controls;
- obsolete process links.

Show these as work queues.

Do NOT silently repair.

---

# 49. "ORPHAN" CONCEPT

The application should be able to say:

"12 risks exist, but 4 have no current response plan."

"7 opportunities were identified, but 3 have never received a pursuit decision."

"5 actions are complete but effectiveness has not been evaluated."

This is far more useful than:

"Total risks = 74."

---

# 50. MANAGEMENT VIEW

Management should see:

### Risk

- important exposures;
- changes since previous review;
- response health;
- effectiveness;
- overdue decisions;
- repeated exposure;
- emerging risks.

### Opportunity

- opportunities under evaluation;
- opportunities being pursued;
- expected benefit;
- actual benefit;
- stalled initiatives;
- decisions pending.

Do NOT turn this into a generic KPI dashboard.

---

# 51. PROCESS REVIEW VIEW

The Quality Manager should be able to select:

Process:
Purchasing

and see:

Risks
Opportunities
Controls
Indicators
Findings
Actions
Changes
Evidence

This creates a process-based risk-thinking workspace.

---

# 52. SUPPLIER RISK LOGIC

Do not create SupplierRisk as a separate domain.

Use:

Supplier
→ Process
→ Risk

and optionally:

Supplier
→ Opportunity

Examples:

Risk:
supplier capacity uncertainty.

Opportunity:
strategic supplier development.

Track:

- supplier;
- process;
- affected result;
- evidence;
- action;
- review.

---

# 53. CUSTOMER RISK / OPPORTUNITY

Use customer-related inputs without turning the module into CRM.

Example:

Customer feedback:
"Need shorter lead time."

Possible:

Risk:
current process may fail expectation.

Opportunity:
streamlined order workflow.

The system can link to:

customer requirement;
process;
objective;
indicator.

---

# 54. CHANGE MANAGEMENT

Risk and opportunity logic should integrate with organizational change.

When a change is identified:

CHANGE
→ review relevant risks
→ identify new risks
→ identify opportunities
→ decide actions
→ implement
→ evaluate result

Do not automatically create records for every change.

Use a guided impact assessment.

---

# 55. AUDIT INTEGRATION

During an internal audit, auditors should be able to inspect:

- relevant risks;
- relevant opportunities;
- response actions;
- evidence;
- effectiveness;
- review history.

An audit finding should be able to trigger a review.

But:

Audit
≠
Risk management.

Keep these domains conceptually distinct.

---

# 56. MANAGEMENT REVIEW INTEGRATION

The tool should provide structured inputs to Management Review:

- major risks;
- changes in risk exposure;
- risk treatment effectiveness;
- opportunities pursued;
- opportunities realized;
- overdue responses;
- emerging issues.

The review should consume a snapshot/reference,
not silently rewrite historical risk records.

---

# 57. ISO 45001 COMPATIBILITY BOUNDARY

ISO 45001 is handled separately.

Current ISO 45001:2018 remains the current edition as of this skill's creation,
with an update in development.

DO NOT merge ISO 9001 Risk with ISO 45001 OH&S Risk.

ISO 45001 has specific hazard identification and OH&S risk assessment
requirements.

Shared technical infrastructure may include:

- owner;
- responsible person;
- site;
- process;
- actions;
- evidence;
- dates;
- status;
- effectiveness;
- review;
- audit trail.

But separate semantic objects MUST remain:

ISO 9001 Risk

vs

OH&S Hazard / OH&S Risk.

Do not let an ISO 9001 risk assessment pretend to satisfy ISO 45001 hazard
assessment requirements.

The 45001 methodology and criteria for OH&S risk assessment are specific
to that standard and its hazard context.

---

# 58. 45001 SHARING RULE

Allowed shared abstractions:

Action
Evidence
Owner
Due date
Effectiveness
Review
Process
Site
Control

Not allowed as a shortcut:

9001 Risk = 45001 Risk

The integration point must be explicit.

Example:

Process
→ ISO 9001 Risk

same Process
→ Hazard
→ OH&S Risk

They may share:

Control

without becoming the same risk.

---

# 59. BENCHMARK RESEARCH PROGRAM

The agent MUST research real-world examples.

At minimum, investigate:

### Portugal

Lusosider / academic case.

Look for:

- industrial process;
- risk identification;
- FMEA;
- quality-management integration.

### Europe / SMEs

Research on European manufacturing SMEs.

Look for:

- common risk sources;
- employee competence;
- supplier risk;
- nonconforming output;
- process risks.

### United Kingdom

Overbury and other ISO 9001 case studies.

Look for:

- supply-chain risks;
- opportunities;
- strategic context;
- continual improvement.

### Italy / global industry

Turboden.

Look for:

- business growth;
- risk-based thinking;
- integration into a rapidly growing industrial company.

### South Africa

BIC and G3G.

Look for:

- manufacturing;
- implementation practices;
- risk mapping;
- continual improvement.

### Indonesia

PT XYZ case study.

Look for:

- FMEA implementation;
- severity/occurrence/detection;
- measurable outcomes.

### North America

Canadian cases such as Coastal Testing.

Look for:

- engineering/inspection services;
- process-based QMS;
- risk-based thinking.

### Other regions

Search at least:

- Latin America;
- Asia;
- Africa;
- Oceania.

The goal is not to copy one company.

The goal is to identify recurring patterns.

---

# 60. BENCHMARK CLASSIFICATION

For every company case record:

Company
Country
Industry
Approximate scale if publicly documented
ISO edition
Certification context
Risk practice
Opportunity practice
Method used
Evidence
Reported result
Limitations

Do not claim:

"Company X uses the ISO-required method."

Instead say:

"Company X used method Y in its implementation."

---

# 61. WHAT THE TOOL SHOULD LEARN FROM CASES

Extract patterns such as:

- process-based risk identification;
- supply-chain dependency;
- customer expectation shifts;
- capability gaps;
- competence risks;
- nonconforming product/service risks;
- technology-driven opportunities;
- process optimization;
- supplier development;
- new product/service opportunities;
- use of FMEA where operationally appropriate;
- management review integration;
- effectiveness evaluation.

Never hard-code a company-specific workflow.

---

# 62. METHOD SELECTION ASSISTANT

Rather than showing:

"Choose your methodology."

with 20 options immediately,

ask:

What are you evaluating?

### Strategic uncertainty

Suggest:
scenario/qualitative assessment.

### Repetitive production process

Suggest:
FMEA-compatible assessment.

### Supplier dependency

Suggest:
probability/impact or scenario.

### Service process

Suggest:
qualitative + indicators.

### New opportunity

Use:
benefit/feasibility/value assessment.

The suggestion is advisory.

The organization selects the method.

---

# 63. RISK METHOD GOVERNANCE

A tenant may have multiple methods.

Every assessment must record:

Method
Version
Criteria
Assessment date

Never change the meaning of a historical result when the tenant
changes the scale.

---

# 64. NO UNIVERSAL SCORE

Do not require a numerical score.

A qualitative organization may have:

LOW
MEDIUM
HIGH

Another:

1–5 probability
×
1–5 impact.

Another:

FMEA.

Another:

scenario analysis.

The application should normalize methods for portfolio display
only where mathematically legitimate.

Do not compare:

FMEA RPN = 250

with:

5 × 5 risk = 20

as if they were equivalent.

---

# 65. PORTFOLIO NORMALIZATION

If management needs an overall view, create a neutral normalized layer:

Assessment Method
→ Method Result
→ Organizational Priority

The priority must retain:

- original method;
- original score/category;
- rationale;
- normalization rule.

Never destroy the original assessment.

---

# 66. RISK HEAT MAP

A heat map may exist.

It should be:

SECONDARY.

The primary work experience is:

"What needs a decision or action?"

Do not build a heat map as the product's main screen.

---

# 67. OPPORTUNITY VISUALIZATION

Do not use a risk heat map for opportunities.

Consider:

Benefit
vs
Effort

or:

Strategic relevance
vs
Feasibility

or:

Expected value
vs
Readiness.

These are organizational decision tools,
not ISO-mandated matrices.

The organization must be able to configure them.

---

# 68. MAIN WORKSPACE

The main workspace should have four layers:

## 1. Discovery

What changed?

## 2. Decisions

What needs evaluation?

## 3. Execution

What actions are underway?

## 4. Learning

What worked?

This is the central design principle.

---

# 69. "RISK REGISTER" SHOULD BECOME AN OUTPUT

The register is useful.

But it should NOT be the application itself.

The application should generate:

- current register;
- process register;
- objective register;
- supplier register;
- review register;
- overdue action register;
- effectiveness register.

The source of truth remains the underlying lifecycle.

---

# 70. ROLE-BASED WORK

### Quality Manager

Needs:

- portfolio;
- review queue;
- cross-process analysis;
- audit evidence.

### Process Owner

Needs:

- own process;
- related risks;
- opportunities;
- actions;
- indicators.

### Top Management

Needs:

- significant changes;
- strategic exposures;
- opportunities;
- decisions;
- outcomes.

### Action Owner

Needs:

- assigned work;
- due dates;
- evidence;
- effectiveness review.

### Auditor

Needs:

- objective evidence;
- history;
- criteria;
- decisions;
- actions;
- effectiveness.

Do not build five different data models.

Build different experiences over the same source of truth.

---

# 71. MOBILE / FIELD EXPERIENCE

The mobile interface should prioritize:

- identify;
- report;
- review;
- assign;
- update;
- attach evidence.

Do not force field users to complete the full analytical assessment
on a phone.

Support progressive completion.

---

# 72. AI USE

AI may assist with:

- candidate discovery;
- duplicate detection;
- summarization;
- question generation;
- suggested relationships;
- trend identification;
- change summaries;
- draft risk statements;
- draft opportunity hypotheses.

AI MUST NOT automatically:

- approve a risk;
- approve an opportunity;
- determine materiality;
- declare effectiveness;
- accept/retain a risk;
- close a risk;
- decide to pursue an opportunity.

Human decision remains explicit.

Every AI-generated suggestion must be distinguishable from
user-confirmed information.

---

# 73. AI EVIDENCE RULE

Do not store:

"AI says this is high risk"

as objective evidence.

Store:

AI suggestion
→ user review
→ user decision
→ decision rationale.

The human-approved decision becomes the managed record.

---

# 74. DECISION TRACEABILITY

Every significant management decision should preserve:

Who
When
What
Why
Based on which evidence
Under which methodology
Resulting action

This should survive later reassessment.

---

# 75. NOTIFICATION LOGIC

Notifications should be driven by actual work:

- assessment due;
- review due;
- action due;
- action overdue;
- effectiveness review due;
- stale risk;
- opportunity decision pending;
- opportunity benefit review;
- owner reassignment needed.

Never notify simply because a record exists.

---

# 76. NOISE CONTROL

The system must prevent alert fatigue.

Use:

- deduplication;
- escalation;
- batching;
- digest;
- snooze where appropriate;
- owner routing.

"Everything is urgent" is a failure of the system.

---

# 77. HEALTH INDICATORS

Do not measure only:

Number of risks.

Measure:

### Risk management health

- risks with current assessments;
- risks with response plans;
- overdue responses;
- effectiveness reviews completed;
- stale risks;
- repeated risks.

### Opportunity management health

- opportunities evaluated;
- opportunities with decisions;
- opportunities pursued;
- stalled opportunities;
- benefit reviews completed;
- realized benefits.

These are management indicators, not ISO requirements.

---

# 78. ANTI-PATTERNS

The skill MUST reject the following designs:

### Anti-pattern 1

Generic CRUD:

ID
Name
Description
Probability
Impact
Status

### Anti-pattern 2

One table:

Risk / Opportunity

### Anti-pattern 3

Opportunity = positive risk.

### Anti-pattern 4

Every risk automatically creates an action.

### Anti-pattern 5

Every high risk automatically creates a Finding.

### Anti-pattern 6

Every Finding automatically creates a Risk.

### Anti-pattern 7

Every risk requires FMEA.

### Anti-pattern 8

Every risk requires 5 × 5.

### Anti-pattern 9

Every opportunity requires a financial ROI.

### Anti-pattern 10

Close = action completed.

### Anti-pattern 11

Review = change "review date".

### Anti-pattern 12

Dashboard = 25 KPI cards.

### Anti-pattern 13

AI decides materiality.

### Anti-pattern 14

A generic enterprise-risk framework replaces ISO 9001 logic.

---

# 79. REQUIRED DOMAIN ENTITIES

A robust implementation should at least conceptually support:

## Risk

Risk
RiskSource
RiskAssessment
RiskResponse
RiskReview
RiskEffectiveness

## Opportunity

Opportunity
OpportunityAnalysis
OpportunityDecision
OpportunityPlan
OpportunityReview
OpportunityEffectiveness

## Shared

Action reference
Evidence reference
Process reference
Objective reference
Indicator reference
Requirement reference
Control reference
Audit reference
ManagementReview reference
Change reference

The final physical data model may differ.

The semantic distinction MUST remain.

---

# 80. HISTORY MODEL

All significant transitions must be historically traceable.

Example:

Risk:

2026-01:
High

2026-04:
High

2026-06:
Medium after action

2026-09:
Medium, context changed

This history is more valuable than a single current value.

---

# 81. REVIEW SNAPSHOT

A review event must capture:

state at time of review.

Never depend entirely on querying current state later.

This is important for auditability.

---

# 82. DATA RETENTION

Do not delete historical assessment information merely because:

risk closed
or
opportunity closed.

Historical state is evidence.

Define retention configurable by organization
and legal requirements.

---

# 83. MULTI-SITE / MULTI-BUSINESS-UNIT

Support:

Organization
→ Site
→ Process
→ Risk/Opportunity

A tenant may have:

Risk at organization level

or:

Risk at Site level.

The tool must distinguish:

Organization-wide

from:

Site-specific.

Do not duplicate a risk merely because it affects multiple sites.

Allow explicit scope:

- organization;
- site;
- business unit if configured.

---

# 84. GOVERNANCE OF SHARED RISKS

If one risk affects several processes:

do not clone it automatically.

Use:

Risk
→ multiple process contexts

if organizationally appropriate.

But each process may have separate:

- controls;
- actions;
- owners.

The model must support this without destroying the identity
of the underlying risk.

---

# 85. RISK VS ISSUE

Do not confuse:

Issue
Problem
Nonconformity
Finding
Risk

A current problem may produce a risk.

A risk is not automatically a current failure.

Likewise:

Opportunity
is not merely:

"everything that is going well."

---

# 86. RISK VS CONTROL

Risk:

uncertainty/effect on intended result.

Control:

what is already done to manage the process.

Action:

what is planned to improve/change the response.

These three must be explicitly differentiated.

---

# 87. OPPORTUNITY VS OBJECTIVE

Opportunity:

favorable circumstance / potential improvement.

Objective:

desired measurable result.

An opportunity may contribute to an objective.

It is not automatically an objective.

---

# 88. OPPORTUNITY VS ACTION

Opportunity:

why and what could be gained.

Action:

what will be done.

Do not collapse them.

---

# 89. DECISION QUALITY

The system should encourage:

"Why?"

rather than:

"Select a score."

Every important assessment should support a rationale.

Rationale can be concise.

The application should avoid long essay requirements.

---

# 90. CONTINUOUS IMPROVEMENT LOOP

The entire capability should eventually operate as:

DETERMINE
↓
ANALYZE
↓
EVALUATE
↓
DECIDE
↓
PLAN
↓
IMPLEMENT
↓
MEASURE
↓
EVALUATE EFFECTIVENESS
↓
LEARN
↓
REASSESS

This loop must remain visible throughout the product.

---

# 91. AUDITOR VIEW

Provide an evidence-oriented audit view.

For a sampled risk:

1. Source.
2. Context.
3. Determination.
4. Analysis.
5. Evaluation.
6. Decision.
7. Action.
8. Implementation.
9. Effectiveness.
10. Review.

For an opportunity:

1. Source.
2. Circumstance.
3. Analysis.
4. Evaluation.
5. Pursuit decision.
6. Action.
7. Implementation.
8. Benefit.
9. Effectiveness.
10. Review.

---

# 92. REPORTS

The system should produce:

### Risk register

Current risks.

### Opportunity register

Current opportunities.

### Process risk profile

Risks/opportunities by process.

### Review report

Items reviewed during a period.

### Action health

Actions related to risks/opportunities.

### Effectiveness report

Actions reviewed for effectiveness.

### Strategic report

Risks/opportunities connected to quality objectives.

### Audit evidence report

Traceable evidence for sampled items.

---

# 93. REPORTING LANGUAGE

Avoid:

"ISO compliant"

unless supported by actual conformity assessment.

Prefer:

"Risk management evidence"
"QMS risk assessment"
"Risk response status"
"Opportunity management status"

Do not claim certification.

---

# 94. IMPLEMENTATION PRINCIPLE

Before coding, create:

1. normative research report;
2. terminology model;
3. risk model;
4. opportunity model;
5. lifecycle model;
6. assessment framework;
7. action/effectiveness model;
8. review model;
9. source integration model;
10. UX model;
11. reporting model;
12. test model.

Only then implement.

---

# 95. IMPLEMENTATION SEQUENCE

Recommended sequence:

PHASE 1
Research

PHASE 2
Domain model

PHASE 3
Risk lifecycle

PHASE 4
Opportunity lifecycle

PHASE 5
Assessment methods

PHASE 6
Actions/effectiveness

PHASE 7
Review engine

PHASE 8
Context/source integration

PHASE 9
Work queues

PHASE 10
UX

PHASE 11
Reporting

PHASE 12
Notifications

PHASE 13
Auditability

PHASE 14
Testing

---

# 96. RESEARCH OUTPUT

Create a research report containing:

## A. Normative interpretation

ISO 9001:2026 6.1.1
ISO 9001:2026 6.1.2
ISO 9001:2026 6.1.3

## B. Supporting ISO guidance

ISO/TC176
APG
ISO implementation guidance

## C. National guidance

At least 5 countries.

## D. Certification-body guidance

At least 4 bodies.

## E. Academic evidence

At least 5 studies/cases.

## F. Company benchmarks

At least 8 organizations across multiple countries/sectors.

## G. Comparison

For every method:

ISO requirement
vs
recommended practice
vs
optional method.

---

# 97. RESEARCH QUALITY GATE

Before implementation verify:

- Is the claim normative?
- Is the edition current?
- Is the source primary?
- Is the interpretation contested?
- Is the method actually required?
- Is the example merely company practice?
- Does the tool accidentally encode a non-required practice as mandatory?

If uncertain:
document uncertainty.

---

# 98. FINAL PRODUCT PRINCIPLE

The final experience should feel like:

"Help me understand and manage uncertainty and opportunity
in my quality system."

Not:

"Fill in the ISO risk register."

That distinction is the central product requirement.

---

# 99. FINAL ACCEPTANCE CRITERIA

The tool cannot be considered complete unless a real organization can:

### Discovery

Identify a risk from:

- context;
- process;
- stakeholder;
- objective;
- change;
- performance;
- audit;
- supplier;
- customer.

### Analysis

Understand:

- cause;
- event;
- effect;
- relevant context;
- existing controls;
- assessment methodology.

### Decision

Record:

- evaluation;
- response decision;
- rationale;
- owner.

### Action

Plan:

- action;
- owner;
- due date;
- expected result.

### Execution

Track:

- progress;
- evidence;
- completion.

### Effectiveness

Determine:

- whether action worked;
- whether exposure changed;
- whether further action is required.

### Review

Reassess:

- after time;
- after changes;
- after relevant performance changes;
- after significant events.

### Opportunity

Perform the same conceptual completeness,
but using the distinct opportunity lifecycle.

---

# 100. FINAL UX TEST

Give the tool this scenario:

"A company depends on a single supplier for a critical component."

The product should help the user discover:

Risk:
supplier interruption.

Then guide:

cause
→ event
→ effect
→ existing controls
→ analysis
→ evaluation
→ response
→ action
→ owner
→ due date
→ evidence
→ effectiveness
→ review.

Then ask separately:

"Does this situation also create an opportunity?"

Potential:

"Developing a second supplier could improve resilience."

Then:

benefit hypothesis
→ analysis
→ pursue/not pursue
→ action
→ expected benefit
→ observed benefit
→ effectiveness
→ review.

The experience should make these two paths obvious.

---

# 101. FINAL INSTRUCTION TO THE AGENT

Never start by designing a database table.

Never start by designing a form.

Never start by designing a dashboard.

Start with:

ISO requirement
→ interpretation
→ management logic
→ user decision
→ evidence
→ workflow
→ data model
→ interaction model
→ implementation.

The goal is to create a system that helps an organization THINK,
DECIDE, ACT and LEARN.

The register is only one output of that system.

---

# 102. STOP CONDITIONS

Stop and ask for clarification only when:

- normative sources conflict materially;
- the organization has not defined a mandatory policy;
- a domain decision would alter Risk/Opportunity semantics;
- a proposed method would become mandatory for all tenants;
- ISO 45001 requirements are about to be mixed with ISO 9001 semantics.

Do NOT stop simply because the organization has no formal risk matrix.

The system must be able to help organizations build a proportionate
method rather than assuming one exists.
