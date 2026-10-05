# YOLO Dev Assisted operating contract

Portable contract · assisted-v1 · October 2, 2026

This file defines the opinions an adopting agent follows and the evidence needed to claim L1. It is shipped in the skill and copied into the target repo as its adopted protocol. Understanding or using it requires no YOLO Dev checkout, code reading, or network access. The target keeps its own product goals, owners, access controls, and delivery environment. Installation and qualification do not grant authority; conflicts with existing human controls remain explicit adoption gaps.

## L0 versus L1

- **L0 Baseline:** use a coding agent with a workflow of your choosing; no YOLO Dev contract is adopted.
- **Prepared for L1:** adopt this identified contract, connect it to ordinary agent instructions and the target's governing documents, and record unresolved gaps. Setup alone establishes no qualification.
- **L1 Assisted:** demonstrate the operating rules below on a bounded real task, including verified publication and continuation by a fresh session from durable records. The maintainer steers through their coding harness; AI manages the work under the target's authority. All qualification criteria must pass for the stated scope.

## Repository model

Every repo has two distinct components: **its purpose**, expressed through its own product goals and constraints, and **its operating structure**, which defines how work pursues that purpose. YOLO Dev supplies the reusable operating structure. It does not supply the target's purpose; YOLO Dev's own project charter is one instance, not a charter for every adopter.

The local protocol holds shared structural responsibilities and working rules; the adoption record maps them to the target's governing documents, authority, and evidence. The skill's templates are starter formats, not completed target decisions or permission grants. Existing equivalent documents can satisfy the roles below without renaming or rewriting them.

| Role and default home | Responsibility | Ownership |
| --- | --- | --- |
| Charter · `CHARTER.md` | Purpose, desired outcomes, optimization goals, constraints, owners, and decision authority. Product-specific meaning comes from accepted maintainer direction. | Human-owned meaning; identified approval for non-cosmetic changes. |
| Architecture · `ARCHITECTURE.md`; behavior contracts · `specs/` | Realize the charter: components, boundaries, durable behaviors, acceptance, and known limitations. Add a spec when a behavior needs a durable contract; a small fix can use issue acceptance. | Human and AI co-owned; significant changes notify maintainers within authority. |
| Agent instructions · `AGENTS.md` or harness equivalent | Direct ordinary sessions to the local protocol, mapped governing context, and repo-specific working instructions. | AI maintains instructions within the existing grant; instructions cannot override higher-layer ownership. |
| README · `README.md` | Explain the app to users and potential users: value, usage, adoption, and truthful status. Keep project-control rules in their governing documents; put planned milestones/current status at the end. | AI-maintained explanation of accepted intent and evidenced behavior. |
| Exploration · `brainstorm/<topic>.md`, `brainstorm/log/` or existing equivalents | Concise current thinking and chronological summaries. Distinguish proposals, accepted decisions, and unresolved questions; link graduated decisions to their governing home. | Humans and AI contribute; exploration does not authorize changes. |
| Work and evidence · GitHub issues/PRs and pushed Git records | Accepted work, interpretation, decisions, progress, results, feedback, verification, and recoverable next actions. | AI manages the lifecycle; maintainer steering follows their authority. |

Keep each document concise and principled. Prescribe mechanics only for an explicit constraint or observed need. Keep governing information in text that agents can read; graphics may summarize it. Introduce exploration records and new specs when the work needs them, rather than creating empty directories for every adoption.

Information moves from feedback/exploration into accepted charter or design decisions, then implementation and verified results; those results feed back into the lowest layer that needs correction. Material decisions leave chat for their governing home. Following this model means maintaining these responsibilities and relationships, not copying YOLO Dev's own product goals, roadmap, code layout, or session history.

## Operating rules

These rules apply to ordinary work after init, including sessions that do not explicitly invoke the skill. Existing equivalent document names and repository conventions can be retained.

| Rule | Required behavior | A deviation or missing evidence |
| --- | --- | --- |
| **ownership** | Read the target's charter, architecture/relevant specs, active instructions, authority, and request before acting. Distinguish proposals from accepted steering. Humans own charter meaning; non-cosmetic changes need explicit human approval of the identified revision. Notify maintainers of significant architecture/spec changes: shared behavior, boundaries, adoption requirements, or delivery guarantees. AI owns routine planning, implementation, testing, and publication within the grant. | Unapproved semantic charter change, unrecorded expansion of authority, assumed permission, or an instruction conflict left unresolved. A maintainer's request supplies direction only within their authority. |
| **congruence** | Make design realize charter intent and implementation/verification realize the accepted design. Graduate accepted decisions into the lowest governing document that needs them; brainstorming remains exploratory. A small isolated fix can use issue acceptance directly. Feed observed results and user feedback upward, diagnose mismatches, and correct the lowest sufficient layer. Build the simplest complete solution to the current need; justify added complexity with an explicit requirement or observed problem. | Code contradicts a contract; a durable decision exists only in chat; a failed outcome is made to pass by silently relaxing the contract; or speculative scope lacks a present need. |
| **verification** | Define observable acceptance before declaring success. Run proportionate checks of the changed outcome and affected contracts. Record results for the inspected revision and identify what was actually published through the target's authorized delivery route. Distinguish local success, merge, publication, and deployment; failures and limits stay visible. | Stale checks, unsupported completion, an unknown published revision, or claiming deployment from a push alone. No human code review is required for work already within the grant. |
| **continuity** | AI manages planning and the visible request lifecycle in GitHub issues/PRs and pushed Git records. Preserve accepted outcome, authority, interpretation, decisions/reasons, progress, verification, blockers, result, and next action proportionally. Keep feedback and replies connected to the request. Before resuming, reconcile actual outcomes of interrupted operations. Review every intervening commit, including violations later repaired; retain failed findings and the last successful checkpoint. | Settled intent or progress exists only in a session/local workspace; retry duplicates an already completed operation; history is skipped; or resetting a marker erases an unresolved finding. |

Information flows both ways; authorization follows ownership. Evidence can justify a proposed charter amendment, but AI cannot approve it. These are soft operating obligations at L1, not claims of enforced runtime permissions or unattended delivery.

## Qualification criteria

Use this table as the acceptance checklist. Cite a file/revision, GitHub record, or observed session/check result for **each** criterion. A general statement that an agent behaved well is insufficient.

| ID | Pass requires | Fails or remains unverified when |
| --- | --- | --- |
| **Q1 · Portable setup** | The target has an identified, intact local protocol snapshot; mapped charter, architecture, normal instructions, and authority satisfying their repository-model responsibilities; and a preserved initial history baseline. Normal instructions explicitly tell agents to read/apply the snapshot and mapped context. | Rules require access to a YOLO Dev checkout; a required source or target-specific decision is missing, conflicting, or not loaded; template fields remain unresolved; or setup silently replaces product intent or the adopted protocol. |
| **Q2 · Authorized, traceable task** | A bounded real task is in a target GitHub issue, with accepted outcome, authority source/limits, and observable acceptance. Material steering and significant design notifications are recorded where future agents can find them. | Work has no accepted direction, authority is inferred, or decisions exist only in a private conversation. |
| **Q3 · Rule conformance** | A cited review covers all four operating rules, applicable protocol/authority revisions, every commit in the review interval, relevant working changes, and related GitHub records. Deviations are diagnosed, remedied, and given cited resolutions; historical findings remain available. | A rule or history interval is omitted; a required finding is missing, conflicting, or unverified; or today's repaired files are used to excuse an unexamined earlier violation. |
| **Q4 · Verified publication** | The task's declared acceptance passes on an identified revision; the authorized published result and its limits are confirmed in Git/GitHub. Evidence distinguishes the inspected revision from later report/bookkeeping commits. | Verification is stale or failing; publication is assumed; or the claimed outcome exceeds the observed delivery route. |
| **Q5 · Fresh continuation** | A fresh authorized session in the stated harness loads ordinary target instructions, reads the local protocol and durable work records, reconciles state, and performs or identifies the correct next action without a repeated briefing of settled intent. Record harness/version and instruction/skill loading. | It needs the previous chat, the upstream checkout, or a reminder of settled rules. Legitimately new decisions are recorded as such, not concealed as successful recovery. |

**Verdict:** qualified only when Q1–Q5 all pass and no required finding remains unresolved. Missing evidence is unverified and blocks qualification. Record the target, protocol revision, inspected commit/interval, harness/version, one verdict per criterion with evidence and reason, unresolved findings, and next action. Use this table directly as a report template; do not invent a weaker checklist. Qualification describes the inspected scope, not every future revision or another harness.

The helper only checks facts such as files, snapshot integrity, history boundaries, and report structure. Its exit 0 means **ready for agent review**, never qualified L1. The reviewing agent applies this contract, explains its verdict, and preserves evidence. Failed reviews cannot advance a successful checkpoint; corrections do not erase earlier failure records.
