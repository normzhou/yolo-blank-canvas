# yolo-blank-canvas: Project Charter

> **Status: proposal pending acceptance.** Proposed by an AI agent during onboarding at
> baseline `520a81e8ec824b9ce31a7fbc8a8c08d152eb81ae`. Nothing here is accepted intent or
> granted authority until the maintainer accepts the identified revision. Open questions are
> listed in the onboarding issue and `.yolo/reports/`, not as extra governing files.

## Purpose

Give an individual builder a place to say what they want next and watch it become real work in
their own repository. The product is a local web app — a blank canvas with a **Requests**
overlay — whose entire job is to turn a typed intention into an ordinary GitHub issue, keep the
discussion and reported status readable, and never invent progress that GitHub records do not
show.

Audience: the repository's maintainer and the AI agents working in this repository on their
behalf. Secondary audience: anyone who installs the app with
`npx --yes github:normzhou/yolo-blank-canvas#v0.1.0` and uses it against a repository they can
already reach through `gh`.

The app should become the smallest reliable front end for a GitHub-backed, agent-run workflow:
useful enough to keep using daily, deliberately narrow enough that its correctness can be
argued from a short, testable specification. It is also the first target adopting the YOLO Dev
protocol at **L1 Assisted**, so its own repository is a working demonstration of that protocol
rather than a special case.

## Optimization goal

Useful progress means a request becomes a traceable outcome: filed as a real issue, decided
explicitly, worked visibly, delivered with verified evidence, and reported at the source.

Tradeoffs this product deliberately accepts:

- **Truth over optimism.** A wrong or stale status is worse than an absent one. Presentation
  never implies scheduling, availability, or delivery that no record establishes.
- **Narrow surface over general GitHub client.** Four operations, no arbitrary proxy. Capability
  that is not needed for the journey is not built.
- **Zero setup over convenience.** `gh` owns credentials; there is no token, secret, or app
  registration to manage.
- **Reproducible releases over fast edits.** Committed build output is preferred so the
  one-command launch runs the same assets that were reviewed.

## Constraints

Durable guiding boundaries, with reasons:

- **GitHub is the only store of work.** Issues, comments, labels and PRs are the record. The app
  keeps no project database, workflow state machine or separate tracker, because a second source
  of truth would drift from the first. *(Human intent, reinforced by the build spec and the
  implemented design.)*
- **The browser never names a GitHub endpoint, command or repository.** The backend shells out
  through one fixed call site with repository-scoped argument arrays; user text travels as JSON on
  stdin. This is a security boundary, not a style choice.
- **Credentials stay inside `gh`.** The app must never read, copy or persist a token; the browser
  holds only an opaque HttpOnly session cookie.
- **Loopback-only, same-origin, untrusted-Markdown-safe.** Remote exposure is out of scope until
  the maintainer decides otherwise.
- **Tests verify intended behavior; they do not define purpose.** A test cannot create authority
  or intent, and passing checks never imply a delivered outcome.

Provisional inference, flagged as such: release/versioning policy and long-term scope beyond the
Requests journey are **not** established by existing evidence and remain maintainer questions
(see pending decisions in the onboarding issue).

## Ownership and authority

The recognized maintainer is the repository owner, `normzhou` — currently the sole owner with
push access. Humans own this Charter and the [authority record](AUTHORITY.md); AI owns routine
implementation, verification and delivery within the accepted grant. No document, label, or
agent summary expands the grant; approval follows ownership.

## Learn through use

Watch which requests actually get filed and delivered through the app versus typed directly into
GitHub; whether reported status stays truthful as issue volume grows; how much effort each
request costs the maintainer; and which verification gaps recur. Evidence lives in
[docs/verification.md](../../docs/verification.md), the onboarding report, and the issues
themselves. These observations should reshape the Charter and architecture deliberately, not by
accumulation.
