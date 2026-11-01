# Hosted feedback UI — optional v1 delivery

Choose this profile only when the app maintainer accepts YOLO Dev's changing
browser code and asset availability. A skill upgrade alone does not opt a client
in. Existing packaged mounts remain supported. This changes browser delivery,
not app identity, permissions, the same-origin bridge, repository, ledger or L1
worker authority. Prepare managed/client-owned feedback normally before launch.

## Upgrade existing integrations

Review actual app entrypoints/imports, dependency locks and app-owned copies or
ports outside the installed skill. Compare affected old/new bundle assets with
those consumers; a filename or a clean skill-install check proves no runtime age.

| Evidence | What it establishes |
| --- | --- |
| Installed skill / adopted pin | Operating instructions and available assets; no app rollout. |
| `renderMark` / `animateYoloMark` | Brand appearance/motion. Its activation callback may still open a custom panel. |
| `mountFeedbackLauncher` / `mountHostedFeedbackLauncher` / React launcher | Which complete shared panel is mounted, with local or hosted browser delivery. |
| App dependency, served UI and bridge session/capabilities | Actual deployed behavior; compatible UI/server version text can differ. Identity/server code stays client-versioned. |

For accepted automatic browser updates, prefer the hosted launcher below with
its versioned local adapter/fallback. A logo-only hosted import does not adopt
the shared feedback UI. Local/offline/pinned deployments remain supported.
Preserve an established choice rather than asking for the same consent again.

Record the actual gap and concrete work: chosen mount/API route, relevant package
or copy update, CSP/fallback, compatibility and deploy/readback. Retain custom app
features, drafts, legacy links and privileged maintainer controls; review their
migration rather than replacing a product's whole Requests dashboard blindly.
Use [shared integration](client-feedback-library.md), [managed setup](managed-feedback.md)
and [identity](client-identity.md) only where needed; a UI update cannot activate a
missing bridge, registration or permission. Gather missing setup once in the
client's existing canonical request, preserving established accounts and credentials.

Apply accepted changes through ordinary target work and delivery. When separate
app work remains, distinguish completed YOLO upgrade from pending integration
and link its next action. Do not claim the UI is updated because the skill, mark
or source dependency changed. An app with no integration needs no opt-in or extra
hosting reads. This review adds no model call, polling or automatic deployment.

## One initial integration

Install/copy the complete released feedback package once, serving its local
adapter, brand fallback and `/yolo/feedback/styles.css` through the app's own
asset/bridge route. Keep that initial local adapter in the app's lock/deployment.
Then replace the local launcher mount:

```js
import {mountHostedFeedbackLauncher} from 'yolo-feedback-bridge/hosted';
const feedback = mountHostedFeedbackLauncher(root, {
  app: {id: trustedAppId, name: appName}
});
// Existing onLogin/onLogout/getContext/onOpenChange and apiBase remain available.
// feedback.open(), close(), destroy(); feedback.version identifies loaded UI.
```

Copied packages import `./yolo-feedback/dist/src/hosted.js`. React18 apps use
`HostedFeedbackLauncher` from `yolo-feedback-bridge/react`, with the same props.
Stable callbacks avoid remounting, as in the local component. Destroy on unmount;
loading/failed imports must not recreate an unmounted panel or issue a write.

Approve `https://yolo-dev.ai` in the app's existing `script-src` and `style-src`
policy, retaining its other restrictions. The loader requests public assets only;
API/login/logout still use the app's origin and verified identity. Cross-origin
scripts/CSS omit cookies and Authorization. No App/provider/GitHub key belongs in
the browser. Remote JavaScript remains trusted app-page code, not an isolation
boundary. Use the [browser module rules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
and current [provider header instructions](https://developers.cloudflare.com/workers/static-assets/headers/).

The default selects `https://yolo-dev.ai/feedback/v1.mjs`. It loads matching
immutable browser code, stylesheet and mark from one release. Theme variables
remain supported; hosted mounts deliberately use matching release CSS rather
than a custom stylesheet. Use a local mount for app-owned replacement CSS.
The local Y remains usable while loading; a failed load shows explicit retry.
Retry is user-driven, including a numeric cache retry for a failed stylesheet.
There is no background polling, automatic write retry or hot-swap under a draft.

## Explicit pins and standalone marks

Set `release: '0.1.0-alpha.52'` to select that immutable hosted snapshot instead
of the moving v1 entry. A pinned client deliberately changes its selection to
receive updates. Fixed content supports integrity pinning; a moving channel
accepts changed trusted code. Version selection does not register/authorize an app.

The same channel exports `renderMark` and `animateYoloMark` for standalone marks:

```js
import {animateYoloMark} from 'https://yolo-dev.ai/feedback/v1.mjs';
const motion = animateYoloMark(mark, {trigger, onActivate: yourAction});
// motion.destroy() on cleanup. No feedback panel unless separately mounted.
```

Importing mark helpers alone does not preload UI styles or access the app API.
For a fixed mark helper, import `brand.mjs` from the selected immutable release
path. Keep static local images when remote code is inappropriate.

## Updates, availability and recovery

Compatible browser changes remain on v1; breaking mount/API changes require a new
major entry and an explicit client update. Local server/React/runner/skill code
stays versioned by the client. Verify actual UI version separately from the
server's `libraryVersion`; compatible releases need not have equal version text.

The v1 entry revalidates on its short cache lifetime; immutable files remain.
A reload may still see a cached channel until that lifetime expires. Current tabs
keep their selected module. YOLO Dev tests the old adapter and requester API,
matching CSS, failure/retry, privacy and self-client use before promotion. Later
rollback moves the entry to a retained working snapshot and preserves published
URLs; it does not rewrite snapshots or roll back user data. The first hosted
release is the retained baseline, not proof of an earlier production rollback.

If delivery is unavailable, preserve app behavior and drafts, use the retry entry
or explicitly restore the local packaged mount through the app's normal deploy.
Report actual app/UI/API identities and missing registration or policy inputs in
one existing canonical request. Native fixtures are not real-user/client launch
acceptance; client-owned access/data and ordinary direct-gh recovery remain.
