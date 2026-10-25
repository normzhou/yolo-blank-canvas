# Brainstorming

Discussion workspace for exploring ideas and architecture in `yolo-blank-canvas` before they graduate into `.yolo/governance/ARCHITECTURE.md`, specs, or admitted work issues.

Topic documents describe current thinking; session logs preserve how it developed. Brainstorming captures proposals and open questions (`Q1..Qn`), not accepted governing decisions.

## Structure

```text
brainstorm/
  README.md
  <topic>.md
  log/
    YYYY-MM-DD-NN-short-title.md
```

## Topics

- [Next milestones: Mobile touch support, Google-authenticated webapp feedback, and 2P online networking](next-milestones-mobile-auth-netplay.md) (`exploring` · 2026-10-25): UX and architecture for touch/mobile controls, serverless Google-authenticated GitHub feedback on `demo.yolo-dev.ai`, and the `yolo-pb-net-v1` 2-player online networking protocol (`Q1–Q4`).
- [YOLO Dev framework & settings UI](framework-settings-ui.md) (`exploring` · 2026-10-22): complete enumeration of the 7 framework surface-area domains (`.yolo/adoption.json`, governance, verification/releases, hosting, and `yolo:manual` tasks), architectural options for read/write authority controls, and open questions `Q1–Q6`.

## Session history

- [2026-10-25 · Next milestones: Mobile touch support, Google-authenticated webapp feedback, and 2P online networking](log/2026-10-25-01-mobile-auth-and-netplay-milestones.md): outlined architecture and trade-offs for mobile touch play, Google-gated bot-token feedback on `demo.yolo-dev.ai`, and 2P online Puzzle Bobble netplay.
- [2026-10-22 · Dual-writer state (UI vs. Runner), GitHub mechanisms, and Maintainer vs. User segregation](log/2026-10-22-02-dual-writer-github-mechanisms-and-roles.md): evaluated 6 native GitHub mechanisms for shared UI/Runner read-write state, defined the two-plane architecture (`yolo:control` issue for live controls + PRs for versioned files) and 3-tier role model (`visitor` / `requester` / `maintainer`), and walked all 7 surface-area examples through it.
- [2026-10-22 · Enumerating the YOLO Dev framework & settings UI surface area](log/2026-10-22-01-framework-settings-ui-surface.md): triggered by friction when enabling `feedback.automatic: true` and tracking `yolo:manual` task `#203` for `demo.yolo-dev.ai`.
