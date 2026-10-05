# blank canvas: Project Charter

> **Status: proposal pending acceptance.** Drafted by an AI agent during onboarding at baseline
> `520a81e8ec824b9ce31a7fbc8a8c08d152eb81ae`. Nothing here is accepted intent or granted
> authority until the maintainer accepts the identified revision.

## Purpose

**Start from a blank canvas and let its users decide what it grows into.**

There is no predefined feature list, product category or roadmap for this project. The canvas is
empty on purpose, and what appears in it is decided by the requests people bring — "what would you
like to build or change?" — rather than by a prior. The project's aspiration is that its users,
not its maintainer, define its direction.

What makes that possible is the method. This project develops itself through the **YOLO Dev
methodology** adopted in this repository: people describe needs, an AI agent manages the work
under a standing grant, GitHub holds the durable records, and progress is only claimed when
evidence shows it. The method is the stable thing here; the product is deliberately not.

**blank canvas and YOLO Dev are two separate projects with distinct charters.** blank canvas
*adopts* YOLO Dev's methodology as the way it makes progress. It is not YOLO Dev, not its user
interface, and not governed by it. YOLO Dev's revisions never decide this product's direction —
they only change how work is done here. This project's own defects stay here; methodology defects
are reported upstream, linked to the evidence that exposed them.

## Optimization goal

**Maximize useful, dependable progress with less human effort.**

Count specification, clarification, support, troubleshooting and recovery as human effort — not
just typing code. Evaluation weighs correctness, reliability, maintainability, safety and user
trust alongside speed. A merge, a passing check, or a queue position is an intermediate fact, not
success. Success is a requested outcome, delivered and verified on an identified version, that the
requester can see and use.

Because the product's direction is user-driven, the deeper goal is that **asking costs almost
nothing**. A person should be able to state a wish and get a real, traceable outcome without
learning project mechanics, managing tools, or babysitting an agent.

## How direction is set

- Requests arrive as ordinary GitHub issues — typed through the app or directly in GitHub.
- Agents interpret, admit, prioritize, plan and deliver them. They do not invent direction.
- Capabilities are added for an **observed** request, bug or inefficiency, not for symmetry,
  completeness or speculation.
- With no accepted request behind it, new surface is not built. "Useful to imagine" is not a
  reason.

Where product decisions land is a design matter, recorded in
[ARCHITECTURE.md](ARCHITECTURE.md) and the issues themselves.

## Durable constraints

These survive any product direction the users choose, because they protect the method and the
people using it — not any particular feature set.

1. **GitHub holds the record of work.** Requests, interpretation, decisions, progress and results
   live in issues, comments, labels and pull requests. No second store of work, no private
   tracker, no private database — two sources of truth drift, and then the project lies.
2. **Humans own the Charter and the authority; the agent cannot widen its own grant.** Approval
   follows repository ownership. A label, a document, a passing check or a confident summary is
   never a grant.
3. **Progress is reported truthfully.** Nothing is displayed or claimed — queued, scheduled,
   merged, available, complete — unless a record establishes it. Uncertainty and failure are
   reported as themselves.
4. **Credentials and authority are not laundered through the product.** Authentication belongs to
   the GitHub CLI; the product must not read, copy or persist a token. The browser must not be able
   to name an arbitrary GitHub operation, endpoint or repository. Every write follows the
   repository's owners' authority rules.
5. **People are not surprised by consequential effects.** Destructive, irreversible or externally
   visible actions — rewriting history, deleting work, changing access or visibility, publishing,
   spending someone's account — need identified human approval first.
6. **The direction of the product is itself a human decision.** Because scope is user-driven,
   narrowing or redirecting what the project is for is a Charter change, not a quiet refactor.

## What this Charter deliberately does not decide

Product scope, feature set, access model, hosting, supported forges, UI surface, and roadmap.
Those are open by design and are settled request by request. Their absence here is intentional
and is not a gap to be filled by default.

Present-day technical choices — a local loopback server, a fixed small API surface, GitHub-only
integration, committed build output — belong to [ARCHITECTURE.md](ARCHITECTURE.md) and may change
as requests arrive. They are current design, not protected intent.

## Ownership and authority

The recognized maintainer and the proposed grant are in [AUTHORITY.md](AUTHORITY.md). In short:
humans own this Charter and the grant; an AI agent owns interpretation, implementation,
verification and delivery within it, and follows the adopted
[protocol](../protocol.md) as closely as it specifies, exercising judgement only where the
protocol is silent.

## Learn through use

Watch what users actually ask for versus what gets built; where they leave the app to finish
something in GitHub instead; which status displays had to be reconciled; how much intervention
each outcome costs; and which requests get declined or deferred. Evidence lives in
[docs/verification.md](../../docs/verification.md), the onboarding report, and the issues
themselves. These observations should reshape this Charter and the architecture deliberately.
