# Instantiating the repository model

Read **Operating protocol** and **Repository layout** in the bundled [protocol](protocol.md) first. A repo supplies its purpose; YOLO Dev supplies the operating structure for pursuing it. These templates express reusable document responsibilities, not YOLO Dev's product goals. Reuse accepted content in the canonical governing homes. Record their mapping in adoption; do not infer conformance from filenames or headings.

| Template | Use |
| --- | --- |
| [Charter](../assets/charter.md) | Capture product purpose, goals, durable boundaries and a link to authority. Missing intent is a maintainer question or a visibly pending draft, not an invented decision. |
| [Authority](../assets/authority.md) | Record recognized maintainers, delegated scope, reserved decisions and authority limits; no template supplies acceptance. |
| [Architecture](../assets/architecture.md) | Record the smallest intended design, behavior contracts, verification/delivery route, limits and known discrepancies with current behavior. |
| [Behavior spec](../assets/behavior-spec.md) | Define a durable behavior contract and concrete acceptance when issue acceptance alone is insufficient. |
| [Agent instructions](../assets/agent-instructions.md) | Connect normal sessions to the local protocol, adoption mapping, and target-specific guidance; adapt relative paths and harness discovery. |
| [README](../assets/readme.md) | Explain the target app to visitors, preserving the separation from human control. |
| [Brainstorm topic](../assets/brainstorm-topic.md) and [session log](../assets/brainstorm-session.md) | Preserve material exploration and decisions when needed; omit empty scaffolding. |

Replace `{{fields}}` with accepted target facts or visibly pending decisions. Create missing governing roles at `.yolo/governance/CHARTER.md`, `AUTHORITY.md` and `ARCHITECTURE.md`; migrate existing equivalents there, preserving meaning and updating active references/native tooling. Historical records remain historical, not alternate active governance. Use only the reserved layout entries; unresolved questions belong in reports or the onboarding issue. The instruction template assumes a target-root document; adapt native entrypoints and relative links. No empty optional directory is required. Product goals, architecture, release process, roadmap, and authority come from that target, never from YOLO Dev's own instance. Templates suggest prose structure; the contract defines required behavior and paths.

Keep each decision in one governing home: Charter for purpose, authority for delegation, architecture/specs for intended behavior, and reports/issues for evidence and unresolved choices. Instructions and adoption records link to those homes. Tests verify design; governance is not a code inventory or rehearsal transcript.

Follow **Onboarding** in [the protocol](protocol.md#onboarding-onboarding-and-check) for intent discovery, proposal review, acceptance and assessment. Starter text cannot supply acceptance or qualification. Adapt meaning and useful existing content; do not rewrite documents merely to match template headings.
